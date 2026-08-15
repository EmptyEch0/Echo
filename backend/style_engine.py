import re
from typing import Dict, List, Any
import database

# Regular expressions for emojis and greetings
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    "]+",
    flags=re.UNICODE
)

COMMON_GREETINGS = ["hey", "heyy", "yo", "sup", "hi", "hello", "gm", "gn", "hola", "wassup", "bro", "dude"]

# Instant template map for sub-10ms trivial replies
INSTANT_TEMPLATES = {
    "ok": ["sounds good!", "got it 👍", "kk cool"],
    "okay": ["sure thing", "sounds good 👍", "kk"],
    "thanks": ["anytime!", "no problem!", "you got it 👍"],
    "thank you": ["happy to help!", "no problem at all", "anytime!"],
    "where are you": ["on my way!", "almost there!", "just heading out now"],
    "are you free": ["yeah what's up?", "busy right now, call in 10?", "free in a bit!"],
    "good morning": ["gm! hope you have a great day", "morning!", "gm bro ☕"],
    "goodnight": ["gn! sleep well", "gn night!", "catch ya tomorrow"],
    "hahaha": ["lol right?! 😂", "haha fr", "dead 💀"],
    "lol": ["haha literally", "fr fr 😂", "lmao"],
}

def get_instant_templates(incoming: str) -> List[Dict[str, Any]]:
    clean = incoming.lower().strip(",.!? ")
    for key, replies in INSTANT_TEMPLATES.items():
        if clean == key or clean.startswith(key + " ") or clean.endswith(" " + key):
            return [
                {
                    "text": reply,
                    "confidence": "high",
                    "reason": f"Instant template match for '{key}'"
                }
                for reply in replies
            ]
    return []

def extract_emojis(text: str) -> List[str]:
    return EMOJI_PATTERN.findall(text)

def detect_greetings(text: str) -> List[str]:
    words = [w.lower().strip(",.!?") for w in text.split()]
    found = []
    for w in words:
        if w in COMMON_GREETINGS:
            found.append(w)
    return found

def analyze_and_update_style(new_message: str = "", contact_id: str = ""):
    messages = database.get_all_user_messages()
    if not messages:
        return
    
    emoji_counts: Dict[str, float] = {}
    greetings_counts: Dict[str, float] = {}
    total_words = 0.0
    total_sentences = 0.0
    punctuation_counts = {"exclamations": 0.0, "questions": 0.0, "ellipses": 0.0, "lowercase_only": 0.0}
    
    total_effective_messages = 0.0
    
    # Recency decay + explicit weight
    for idx, item in enumerate(messages):
        msg = item.get("content", "")
        base_w = item.get("weight", 1.0)
        # Recency decay factor (most recent 20 msgs get higher weight)
        recency = max(0.5, 1.5 - (idx * 0.02))
        weight = base_w * recency
        total_effective_messages += weight
        
        # Emojis
        emojis = extract_emojis(msg)
        for e in emojis:
            for ch in e:
                emoji_counts[ch] = emoji_counts.get(ch, 0.0) + weight
                
        # Greetings
        grs = detect_greetings(msg)
        for g in grs:
            greetings_counts[g] = greetings_counts.get(g, 0.0) + weight
            
        # Punctuation & casing
        if "!" in msg:
            punctuation_counts["exclamations"] += weight
        if "?" in msg:
            punctuation_counts["questions"] += weight
        if "..." in msg:
            punctuation_counts["ellipses"] += weight
        if msg.islower() and len(msg) > 3:
            punctuation_counts["lowercase_only"] += weight
            
        words = msg.split()
        total_words += len(words) * weight
        sentences = [s for s in re.split(r'[.!?]+', msg) if s.strip()]
        total_sentences += max(1.0, len(sentences)) * weight
        
    avg_sentence_len = round(total_words / max(1.0, total_sentences), 1)
    
    # Convert float counts to int for profile DB format
    emoji_counts_int = {k: int(v) for k, v in emoji_counts.items()}
    greetings_counts_int = {k: int(v) for k, v in greetings_counts.items()}
    punc_counts_int = {k: int(v) for k, v in punctuation_counts.items()}
    
    database.update_style_profile_db(
        emoji_counts=emoji_counts_int,
        greetings_counts=greetings_counts_int,
        avg_length=avg_sentence_len,
        punctuation_habits=punc_counts_int,
        total_count=len(messages)
    )

def build_style_persona_prompt(formality: str = "neutral", contact_name: str = "") -> str:
    profile = database.get_style_profile_db()
    total_msgs = profile.get("total_messages_learned", 0)
    
    base_instructions = []
    if contact_name:
        base_instructions.append(f"You are generating a reply to '{contact_name}'.")
        
    if formality == "casual":
        base_instructions.append("Tone Override: Casual, warm, relaxed, informal.")
    elif formality == "formal":
        base_instructions.append("Tone Override: Professional, polite, clear, structured.")
        
    if total_msgs == 0:
        base_instructions.append("The user has no recorded writing history yet. Provide a natural, concise reply.")
        return "\n".join(base_instructions)
    
    # Sort top emojis
    emoji_counts = profile.get("emoji_counts", {})
    top_emojis = sorted(emoji_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_emoji_str = " ".join([e[0] for e in top_emojis]) if top_emojis else "None"
    
    # Sort top greetings
    greetings_counts = profile.get("greetings_counts", {})
    top_greetings = sorted(greetings_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    top_greeting_str = ", ".join([g[0] for g in top_greetings]) if top_greetings else "hey, hi"
    
    avg_len = profile.get("avg_sentence_length", 8.0)
    punc = profile.get("punctuation_habits", {})
    lowercase_pref = punc.get("lowercase_only", 0) > (total_msgs * 0.3)
    
    prompt_lines = [
        f"You are acting as an AI clone of the user's natural personal messaging style.",
        f"- Target Average Sentence Length: ~{avg_len} words.",
        f"- Preferred Greetings: {top_greeting_str}.",
        f"- Favorite Emojis (use sparingly where appropriate): {top_emoji_str}.",
    ]
    
    if lowercase_pref and formality != "formal":
        prompt_lines.append("- Style Trait: Prefers informal lowercase typing.")
    else:
        prompt_lines.append("- Style Trait: Standard capitalization.")
        
    return "\n".join(base_instructions + prompt_lines)
