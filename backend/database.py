import sqlite3
import json
import os
from typing import Dict, List, Any, Optional
from config import settings

def get_db():
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
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
