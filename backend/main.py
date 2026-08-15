import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json

from config import settings
import database
import style_engine
import vector_store
import llm_client

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield

app = FastAPI(title="Echo Local Backend", version="1.0.0", lifespan=lifespan)

# Enable CORS for browser extension requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LearnRequest(BaseModel):
    sender: str = "user"
    content: str
    platform: str = "whatsapp"
    weight: Optional[float] = 1.0
    contact_id: Optional[str] = ""

class ContextMessage(BaseModel):
    sender: str  # 'them' or 'me'
    text: str

class SuggestRequest(BaseModel):
    incoming_message: str
    contact_name: Optional[str] = ""
    formality: Optional[str] = "neutral"
    conversation_history: Optional[List[ContextMessage]] = []
    is_retry: Optional[bool] = False
    current_draft: Optional[str] = ""

class RewriteRequest(BaseModel):
    text: str
    target_tone: Optional[str] = "natural personal style"
    ghost_mode: Optional[str] = "user"  # 'user', 'genz', 'executive', 'emoji_heavy'

class SeedRequest(BaseModel):
    messages: List[str]
    greetings: Optional[List[str]] = []
    favorite_emojis: Optional[List[str]] = []
    lowercase_pref: Optional[bool] = False

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ContextMessage]] = []

class RefineRequest(BaseModel):
    text: str
    action: Optional[str] = "fix_vocab" # 'fix_vocab', 'formal', 'casual', 'concise', 'expand'

@app.get("/api/health")
def health_check():
    ollama_info = llm_client.check_ollama_health()
    profile = database.get_style_profile_db()
    return {
        "status": "online",
        "active_model": ollama_info.get("active_model", settings.PRIMARY_LLM_MODEL),
        "ollama": ollama_info,
        "total_messages_learned": profile.get("total_messages_learned", 0)
    }

@app.post("/api/learn")
def learn_message(req: LearnRequest):
    if not req.content or not req.content.strip():
        raise HTTPException(status_code=400, detail="Empty message content")
        
    cleaned_text = req.content.strip()
    
    # Compute vector embedding
    embedding = llm_client.get_embedding(cleaned_text)
    
    # Save in DB
    database.save_message(
        sender=req.sender,
        content=cleaned_text,
        embedding=embedding,
        platform=req.platform,
        weight=req.weight or 1.0,
        contact_id=req.contact_id or ""
    )
    
    # Update style aggregate metrics
    style_engine.analyze_and_update_style(cleaned_text, contact_id=req.contact_id or "")
    
    profile = database.get_style_profile_db()
    return {
        "status": "success",
        "message_learned": cleaned_text,
        "total_learned": profile.get("total_messages_learned", 0)
    }

@app.post("/api/suggest")
def suggest_replies(req: SuggestRequest):
    incoming = req.incoming_message.strip()
    if not incoming:
        raise HTTPException(status_code=400, detail="Incoming message cannot be empty")
        
    # Tier 0: Check 0-latency instant templates only if not a forced retry
    if not req.is_retry:
        instant_matches = style_engine.get_instant_templates(incoming)
        if instant_matches:
            return {
                "incoming_message": incoming,
                "suggestions": instant_matches,
                "past_context_used": [],
                "tier_used": "instant"
            }

    # Tier 1: Triage Classifier
    if not req.is_retry:
        should_reply = llm_client.triage_should_reply(incoming)
        if not should_reply:
            return {
                "incoming_message": incoming,
                "suggestions": [],
                "past_context_used": [],
                "tier_used": "triage_skipped"
            }
        
    # Set model tier and temperature (higher on retry for creative fresh ideas)
    tier = "full"
    temperature = 0.85 if req.is_retry else 0.7
        
    # 1. Compute query embedding and get similar past user replies
    query_emb = llm_client.get_embedding(incoming)
    past_replies = vector_store.find_similar_past_messages(query_emb, top_k=3, contact_id=req.contact_name) if query_emb else []
    
    # 2. Get style persona prompt
    persona_system_prompt = style_engine.build_style_persona_prompt(formality=req.formality or "neutral", contact_name=req.contact_name or "")
    
    # 3. Format conversation history context
    history_str = ""
    if req.conversation_history and len(req.conversation_history) > 0:
        history_lines = []
        for m in req.conversation_history[-8:]:
            sender_label = "Contact" if m.sender in ["them", "contact", "incoming"] else "You"
            history_lines.append(f"{sender_label}: {m.text}")
        history_str = "\nRecent Conversation History:\n" + "\n".join(history_lines) + "\n"
        
    draft_str = ""
    if req.current_draft and req.current_draft.strip():
        draft_str = f'\nUser\'s current rough typed draft in input box: "{req.current_draft.strip()}" (Provide smart continuations or polished alternatives)\n'

    past_examples_str = ""
    if past_replies:
        past_examples_str = "\nExamples of how this user has replied in similar past situations:\n" + "\n".join([f"- {r}" for r in past_replies]) + "\n"
        
    retry_instruction = "Generate 3 FRESH, distinct and creative alternate angles/ideas on what to message next." if req.is_retry else "Generate EXACTLY 3 distinct reply suggestions that sound naturally like the user."
        
    prompt = f"""
{history_str}{draft_str}{past_examples_str}
Latest Active Message from Contact: "{incoming}"

Task: {retry_instruction}
Format output strictly as a valid JSON list of 3 strings:
["Option 1", "Option 2", "Option 3"]

Option 1: Quick / Casual direct response
Option 2: Thoughtful / Informative idea
Option 3: Warm / Engaging continuation

OUTPUT ONLY THE JSON ARRAY AND NOTHING ELSE:
"""
    
    full_system = f"{persona_system_prompt}\nIMPORTANT: You are Echo, a smart context-aware messaging copilot powered by Llama 3.2. You must reply ONLY with a valid JSON array of 3 distinct string suggestions."
    
    raw_response = llm_client.generate_tiered_llm_response(prompt, system_prompt=full_system, tier=tier, temperature=temperature)
    
    # Clean and parse JSON response
    raw_suggestions = []
    try:
        start_idx = raw_response.find("[")
        end_idx = raw_response.rfind("]")
        if start_idx != -1 and end_idx != -1:
            json_str = raw_response[start_idx:end_idx+1]
            raw_suggestions = json.loads(json_str)
    except Exception as e:
        print(f"[JSON Parse Error]: {e}, Raw: {raw_response}")
        # Fallback line extraction if model formatted with numbers or bullets
        lines = [line.strip().lstrip("0123456789.-*\"' ").rstrip("\"'") for line in raw_response.split("\n") if len(line.strip()) > 3]
        if len(lines) >= 3:
            raw_suggestions = lines[:3]
        
    if not isinstance(raw_suggestions, list) or len(raw_suggestions) == 0:
        if req.is_retry:
            raw_suggestions = [
                f"sounds good! let's do it 👍",
                f"let me check the details and ping you shortly",
                f"got it, thanks for updating me!"
            ]
        else:
            raw_suggestions = [
                f"hey! yeah sounds good 👍",
                f"sure, will check and get back to you",
                f"haha awesome!"
            ]
        
    profile = database.get_style_profile_db()
    learned_count = profile.get("total_messages_learned", 0)
    
    # Enrich suggestions with Confidence + Explainability metadata
    structured_suggestions = []
    for idx, s in enumerate(raw_suggestions[:3]):
        conf = "high" if learned_count > 10 and past_replies else ("medium" if learned_count > 3 else "learning")
        reason = f"Llama 3.2 adapted to active chat context & {learned_count} learned messages"
        if past_replies and idx == 0:
            reason = f"Matched similar past reply: '{past_replies[0][:30]}...'"
        elif req.is_retry and idx == 1:
            reason = "Fresh creative angle generated on retry"
        elif idx == 2 and profile.get("top_emojis"):
            top_e = profile["top_emojis"][0]["emoji"] if isinstance(profile["top_emojis"], list) and len(profile["top_emojis"]) > 0 else "👍"
            reason = f"Warm style with favorite emoji ({top_e})"
            
        structured_suggestions.append({
            "text": str(s),
            "confidence": conf,
            "reason": reason
        })
        
    return {
        "incoming_message": incoming,
        "suggestions": structured_suggestions,
        "past_context_used": past_replies
    }

@app.post("/api/rewrite")
def rewrite_text(req: RewriteRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text to rewrite cannot be empty")
        
    mode = req.ghost_mode or "user"
    if mode == "genz":
        persona_system_prompt = "Rewrite in an ultra-casual Gen-Z internet slang style with lowercase and modern emojis (fr, deadass, lowkey, 💀, 🔥)."
    elif mode == "executive":
        persona_system_prompt = "Rewrite in an executive, clear, professional, articulate business tone."
    elif mode == "emoji_heavy":
        persona_system_prompt = "Rewrite in an enthusiastic, warm tone with lots of vibrant, expressive emojis."
    else:
        persona_system_prompt = style_engine.build_style_persona_prompt()
    
    prompt = f"""
Original Draft: "{req.text}"

Task: Rewrite the original draft into the target style, preserving the core meaning while adapting voice and tone.

Return ONLY the rewritten text, nothing else.
"""
    rewritten = llm_client.generate_llm_response(prompt, system_prompt=persona_system_prompt)
    return {
        "original": req.text,
        "rewritten": rewritten,
        "mode": mode
    }

@app.post("/api/chat")
def chat_with_echo(req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Chat message cannot be empty")
        
    persona_system_prompt = style_engine.build_style_persona_prompt()
    system_prompt = f"{persona_system_prompt}\nYou are Echo, an intelligent writing companion & copilot powered by Llama 3.2. Assist the user with drafting, refining text, fixing vocabulary and grammar mistakes, or generating message ideas in a helpful, friendly, natural tone."
    
    history_str = ""
    if req.history:
        history_lines = [f"{m.sender}: {m.text}" for m in req.history[-6:]]
        history_str = "Chat History:\n" + "\n".join(history_lines) + "\n\n"
        
    prompt = f"{history_str}User: {req.message.strip()}\n\nEcho Assistant:"
    reply = llm_client.generate_llm_response(prompt, system_prompt=system_prompt)
    return {"reply": reply}

@app.post("/api/refine")
def refine_vocabulary(req: RefineRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text to refine cannot be empty")
        
    action = req.action or "fix_vocab"
    
    if action == "formal":
        instruction = "Rewrite this draft in a clear, professional, and articulate business tone."
    elif action == "casual":
        instruction = "Rewrite this draft in a friendly, relaxed, casual conversational tone."
    elif action == "concise":
        instruction = "Shorten and tighten this text to be punchy and direct without losing key meaning."
    elif action == "expand":
        instruction = "Elaborate and flesh out this draft into a complete, well-written message."
    else:
        instruction = "Carefully fix all spelling mistakes, grammatical errors, and sentence structure issues. Upgrade vocabulary for natural fluency and clarity while keeping the original intent intact."
        
    persona = style_engine.build_style_persona_prompt()
    system_prompt = f"{persona}\nYou are an expert writing and vocabulary editor powered by Llama 3.2. {instruction} Do NOT output conversational greetings or introductions."
    
    prompt = f"""Original Draft:
\"\"\"{req.text.strip()}\"\"\"

Task: {instruction}
Respond in this exact format:
REFINED:
<Write the improved, corrected text here>
EXPLANATION:
<Write a 1-sentence brief summary of the key corrections made>
"""
    raw_res = llm_client.generate_llm_response(prompt, system_prompt=system_prompt, temperature=0.3)
    
    refined_text = raw_res
    explanation = "Fixed grammar, spelling typos & polished vocabulary."
    
    if "REFINED:" in raw_res and "EXPLANATION:" in raw_res:
        parts = raw_res.split("REFINED:", 1)[1].split("EXPLANATION:", 1)
        refined_text = parts[0].strip()
        explanation = parts[1].strip()
    elif "EXPLANATION:" in raw_res:
        parts = raw_res.split("EXPLANATION:", 1)
        refined_text = parts[0].replace("REFINED:", "").strip()
        explanation = parts[1].strip()
        
    return {
        "original": req.text,
        "refined": refined_text,
        "explanation": explanation,
        "action": action
    }

@app.get("/api/profile")
def get_profile():
    profile = database.get_style_profile_db()
    
    emoji_counts = profile.get("emoji_counts", {})
    top_emojis = sorted(emoji_counts.items(), key=lambda x: x[1], reverse=True)[:8]
    
    greetings_counts = profile.get("greetings_counts", {})
    top_greetings = sorted(greetings_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "total_messages_learned": profile.get("total_messages_learned", 0),
        "avg_sentence_length": profile.get("avg_sentence_length", 0.0),
        "top_emojis": [{"emoji": e[0], "count": e[1]} for e in top_emojis],
        "top_greetings": [{"greeting": g[0], "count": g[1]} for g in top_greetings],
        "punctuation_habits": profile.get("punctuation_habits", {})
    }

@app.post("/api/seed")
def seed_messages(req: SeedRequest):
    added = 0
    for msg in req.messages:
        if msg and msg.strip():
            cleaned = msg.strip()
            emb = llm_client.get_embedding(cleaned)
            database.save_message("user", cleaned, embedding=emb, weight=1.5)
            added += 1
            
    # Process quiz metadata if supplied
    if req.greetings or req.favorite_emojis or req.lowercase_pref is not None:
        prof = database.get_style_profile_db()
        emoji_counts = prof.get("emoji_counts", {})
        greetings_counts = prof.get("greetings_counts", {})
        punc = prof.get("punctuation_habits", {})
        
        for g in (req.greetings or []):
            greetings_counts[g.lower()] = greetings_counts.get(g.lower(), 0) + 10
            
        for e in (req.favorite_emojis or []):
            emoji_counts[e] = emoji_counts.get(e, 0) + 10
            
        if req.lowercase_pref:
            punc["lowercase_only"] = punc.get("lowercase_only", 0) + 20
            
        database.update_style_profile_db(
            emoji_counts=emoji_counts,
            greetings_counts=greetings_counts,
            avg_length=prof.get("avg_sentence_length", 8.0),
            punctuation_habits=punc,
            total_count=prof.get("total_messages_learned", 0) + added
        )
        
    style_engine.analyze_and_update_style()
    profile = database.get_style_profile_db()
    return {
        "status": "success",
        "added_count": added,
        "total_learned": profile.get("total_messages_learned", 0)
    }

@app.get("/api/profile/export")
def export_profile():
    return database.export_profile_db()

@app.post("/api/profile/import")
def import_profile(data: Dict[str, Any]):
    imported = database.import_profile_db(data)
    style_engine.analyze_and_update_style()
    return {"status": "success", "imported_count": imported}

@app.post("/api/reset")
def reset_profile():
    database.clear_db()
    return {"status": "success", "message": "All learned style profile data cleared."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
