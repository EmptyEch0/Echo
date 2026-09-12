import sqlite3
import json
import os
from typing import Dict, List, Any, Optional
from config import settings

_db_initialized = False

def get_db():
    global _db_initialized
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    if not _db_initialized:
        _db_initialized = True
        try:
            init_db()
        except Exception:
            pass
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Table for storing message logs and embeddings for RAG
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT,
        weight REAL DEFAULT 1.0,
        contact_id TEXT DEFAULT '',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        platform TEXT DEFAULT 'whatsapp'
    );
    """)
    
    # Check for missing columns in existing DB
    cursor.execute("PRAGMA table_info(messages)")
    columns = [col["name"] for col in cursor.fetchall()]
    if "weight" not in columns:
        cursor.execute("ALTER TABLE messages ADD COLUMN weight REAL DEFAULT 1.0")
    if "contact_id" not in columns:
        cursor.execute("ALTER TABLE messages ADD COLUMN contact_id TEXT DEFAULT ''")

    # Table for aggregated style metrics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS style_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        emoji_counts TEXT DEFAULT '{}',
        greetings_counts TEXT DEFAULT '{}',
        avg_sentence_length REAL DEFAULT 0.0,
        punctuation_habits TEXT DEFAULT '{}',
        total_messages_learned INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Table for per-contact relationship memory & tone preferences
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contact_preferences (
        contact_id TEXT PRIMARY KEY,
        preferred_tone TEXT DEFAULT 'casual',
        notes TEXT DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table for customizable slash commands and macro text expanders
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS snippets (
        shortcut TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        description TEXT DEFAULT ''
    );
    """)
    
    # Seed default snippets if empty
    cursor.execute("SELECT COUNT(*) FROM snippets")
    if cursor.fetchone()[0] == 0:
        default_snippets = [
            ("/cal", "Here's my booking link: https://calendly.com/your-name/30min - feel free to pick a time that works best!", "Meeting / Calendar Link"),
            ("/meet", "Let's hop on Google Meet: https://meet.google.com/abc-defg-hij", "Google Meet Link"),
            ("/loc", "My office address: 100 Innovation Blvd, Tech Park, Suite 400", "Office Location Address"),
            ("/bank", "Payment Details - UPI ID: user@upi | Bank A/C: 1234567890 (IFSC: HDFC0001234)", "Payment / Bank Info"),
            ("/phone", "You can reach me directly at: +1 (555) 019-2834", "Phone Number")
        ]
        cursor.executemany("INSERT OR REPLACE INTO snippets (shortcut, content, description) VALUES (?, ?, ?)", default_snippets)

    # Ensure default row in style_profile
    cursor.execute("SELECT id FROM style_profile WHERE id = 1")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO style_profile (id, emoji_counts, greetings_counts, avg_sentence_length, total_messages_learned) VALUES (1, '{}', '{}', 0.0, 0)")
        
    conn.commit()
    conn.close()

def save_message(sender: str, content: str, embedding: Optional[List[float]] = None, platform: str = "whatsapp", weight: float = 1.0, contact_id: str = ""):
    conn = get_db()
    cursor = conn.cursor()
    emb_json = json.dumps(embedding) if embedding else None
    cursor.execute(
        "INSERT INTO messages (sender, content, embedding, platform, weight, contact_id) VALUES (?, ?, ?, ?, ?, ?)",
        (sender, content, emb_json, platform, weight, contact_id)
    )
    conn.commit()
    conn.close()

def get_all_user_messages(contact_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    if contact_id:
        cursor.execute("SELECT content, weight, timestamp FROM messages WHERE sender = 'user' AND (contact_id = ? OR contact_id = '') ORDER BY id DESC", (contact_id,))
    else:
        cursor.execute("SELECT content, weight, timestamp FROM messages WHERE sender = 'user' ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"content": row["content"], "weight": row["weight"] or 1.0} for row in rows]

def has_messages_with_embeddings(contact_id: Optional[str] = None) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    if contact_id:
        cursor.execute("SELECT 1 FROM messages WHERE sender = 'user' AND embedding IS NOT NULL AND (contact_id = ? OR contact_id = '') LIMIT 1", (contact_id,))
    else:
        cursor.execute("SELECT 1 FROM messages WHERE sender = 'user' AND embedding IS NOT NULL LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return row is not None

def get_messages_with_embeddings(contact_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    if contact_id:
        cursor.execute("SELECT content, embedding, weight FROM messages WHERE sender = 'user' AND embedding IS NOT NULL AND (contact_id = ? OR contact_id = '')", (contact_id,))
    else:
        cursor.execute("SELECT content, embedding, weight FROM messages WHERE sender = 'user' AND embedding IS NOT NULL")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        try:
            emb = json.loads(r["embedding"])
            result.append({"content": r["content"], "embedding": emb, "weight": r["weight"] or 1.0})
        except Exception:
            pass
    return result

def get_style_profile_db() -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM style_profile WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {
            "emoji_counts": {},
            "greetings_counts": {},
            "avg_sentence_length": 0.0,
            "punctuation_habits": {},
            "total_messages_learned": 0
        }
    return {
        "emoji_counts": json.loads(row["emoji_counts"] or "{}"),
        "greetings_counts": json.loads(row["greetings_counts"] or "{}"),
        "avg_sentence_length": row["avg_sentence_length"] or 0.0,
        "punctuation_habits": json.loads(row["punctuation_habits"] or "{}"),
        "total_messages_learned": row["total_messages_learned"] or 0
    }

def update_style_profile_db(emoji_counts: Dict[str, int], greetings_counts: Dict[str, int], avg_length: float, punctuation_habits: Dict[str, int], total_count: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE style_profile
    SET emoji_counts = ?,
        greetings_counts = ?,
        avg_sentence_length = ?,
        punctuation_habits = ?,
        total_messages_learned = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    """, (
        json.dumps(emoji_counts),
        json.dumps(greetings_counts),
        avg_length,
        json.dumps(punctuation_habits),
        total_count
    ))
    conn.commit()
    conn.close()

def export_profile_db() -> Dict[str, Any]:
    profile = get_style_profile_db()
    messages = get_all_user_messages()
    return {
        "version": "1.0",
        "exported_at": str(os.getenv("CURRENT_TIME", "")),
        "profile": profile,
        "sample_messages": [m["content"] for m in messages[:50]]
    }

def import_profile_db(data: Dict[str, Any]) -> int:
    profile = data.get("profile", {})
    emoji_counts = profile.get("emoji_counts", {})
    greetings_counts = profile.get("greetings_counts", {})
    avg_sentence_length = profile.get("avg_sentence_length", 8.0)
    punctuation_habits = profile.get("punctuation_habits", {})
    samples = data.get("sample_messages", [])
    
    count = 0
    for s in samples:
        if s and isinstance(s, str) and s.strip():
            save_message("user", s.strip(), weight=1.5)
            count += 1
            
    current_prof = get_style_profile_db()
    new_total = current_prof.get("total_messages_learned", 0) + count
    update_style_profile_db(emoji_counts, greetings_counts, avg_sentence_length, punctuation_habits, new_total)
    return count

def clear_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages")
    cursor.execute("UPDATE style_profile SET emoji_counts='{}', greetings_counts='{}', avg_sentence_length=0.0, punctuation_habits='{}', total_messages_learned=0 WHERE id=1")
    conn.commit()
    conn.close()

# -----------------------------------------------------------------
# Contact Relationship Preferences & Tone Memory
# -----------------------------------------------------------------
def get_contact_preference(contact_id: str) -> Optional[Dict[str, Any]]:
    if not contact_id:
        return None
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT contact_id, preferred_tone, notes, updated_at FROM contact_preferences WHERE contact_id = ?", (contact_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "contact_id": row["contact_id"],
            "preferred_tone": row["preferred_tone"],
            "notes": row["notes"] or "",
            "updated_at": row["updated_at"]
        }
    return None

def save_contact_preference(contact_id: str, preferred_tone: str = "casual", notes: str = ""):
    if not contact_id:
        return
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO contact_preferences (contact_id, preferred_tone, notes, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(contact_id) DO UPDATE SET
        preferred_tone = excluded.preferred_tone,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    """, (contact_id, preferred_tone, notes))
    conn.commit()
    conn.close()

def get_all_contact_preferences() -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT contact_id, preferred_tone, notes, updated_at FROM contact_preferences ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"contact_id": r["contact_id"], "preferred_tone": r["preferred_tone"], "notes": r["notes"], "updated_at": r["updated_at"]} for r in rows]

# -----------------------------------------------------------------
# Snippets & Slash Command Macros
# -----------------------------------------------------------------
def get_snippets() -> List[Dict[str, str]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT shortcut, content, description FROM snippets ORDER BY shortcut ASC")
    rows = cursor.fetchall()
    conn.close()
    return [{"shortcut": r["shortcut"], "content": r["content"], "description": r["description"] or ""} for r in rows]

def save_snippet(shortcut: str, content: str, description: str = ""):
    clean_sc = shortcut.strip().lower()
    if not clean_sc.startswith("/"):
        clean_sc = "/" + clean_sc
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO snippets (shortcut, content, description)
    VALUES (?, ?, ?)
    ON CONFLICT(shortcut) DO UPDATE SET
        content = excluded.content,
        description = excluded.description
    """, (clean_sc, content.strip(), description.strip()))
    conn.commit()
    conn.close()

def delete_snippet(shortcut: str):
    clean_sc = shortcut.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM snippets WHERE shortcut = ?", (clean_sc,))
    conn.commit()
    conn.close()
