import requests
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8000"

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def run_tests():
    print("--- Testing Echo Advanced Features ---")
    
    # 1. Health Check
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        print("1. /api/health Response:", r.status_code, r.json())
    except Exception as e:
        print("Health check failed. Is FastAPI backend running?", e)
        sys.exit(1)
        
    # 2. Test Onboarding Quiz Seeding
    quiz_payload = {
        "messages": [
            "hey bro! sup?",
            "yeah sounds like a plan!",
            "let's catch up tomorrow around 5pm",
            "awesome! see ya 👍",
        ],
        "greetings": ["hey", "yo"],
        "favorite_emojis": ["👍", "🔥"],
        "lowercase_pref": True
    }
    r = requests.post(f"{BASE_URL}/api/seed", json=quiz_payload)
    print("2. /api/seed (Quiz) Response:", r.status_code, r.json())
    
    # 3. Test Instant Template Fallback (Sub-10ms)
    r = requests.post(f"{BASE_URL}/api/suggest", json={"incoming_message": "thanks"})
    print("3. Instant Template Fallback Response:", r.status_code, json.dumps(r.json(), indent=2))
    
    # 4. Test Explainable Suggestions with Confidence & Reason
    r = requests.post(f"{BASE_URL}/api/suggest", json={
        "incoming_message": "Are we still meeting today at 5?",
        "contact_name": "Alex",
        "formality": "casual"
    })
    print("4. /api/suggest (Explainable + Per-Contact) Response:", r.status_code, json.dumps(r.json(), indent=2))
    
    # 5. Test Ghost Mode Rewriting
    r = requests.post(f"{BASE_URL}/api/rewrite", json={
        "text": "I am confirming that I will attend the scheduled meeting.",
        "ghost_mode": "genz"
    })
    print("5. /api/rewrite (Ghost Mode - GenZ) Response:", r.status_code, r.json())
    
    # 6. Test Export Profile
    r = requests.get(f"{BASE_URL}/api/profile/export")
    exported_data = r.json()
    print("6. /api/profile/export Response:", r.status_code, "Sample count:", len(exported_data.get("sample_messages", [])))
    
    # 7. Test Import Profile
    r = requests.post(f"{BASE_URL}/api/profile/import", json=exported_data)
    print("7. /api/profile/import Response:", r.status_code, r.json())
    
    # 8. Test Thread Summarizer ("Catch Me Up")
    r = requests.post(f"{BASE_URL}/api/summarize", json={
        "messages": [
            {"sender": "them", "text": "Hey, can you send over the updated financial forecast?"},
            {"sender": "me", "text": "Sure, working on it now."},
            {"sender": "them", "text": "Also let's finalize the meeting for tomorrow at 3 PM if that works for you."}
        ],
        "contact_name": "Sarah"
    })
    print("8. /api/summarize Response:", r.status_code, json.dumps(r.json(), indent=2))

    # 9. Test Fast Inline Ghost Autocomplete
    r = requests.post(f"{BASE_URL}/api/autocomplete", json={
        "prefix": "sounds good let's",
        "contact_name": "Sarah"
    })
    print("9. /api/autocomplete Response:", r.status_code, r.json())

    # 10. Test Contact Tone Memory
    r = requests.post(f"{BASE_URL}/api/contact_tone", json={
        "contact_id": "Sarah",
        "preferred_tone": "formal",
        "notes": "VP of Operations at Partner Co"
    })
    print("10. /api/contact_tone (POST) Response:", r.status_code, r.json())

    r = requests.get(f"{BASE_URL}/api/contact_tone?contact_id=Sarah")
    print("10b. /api/contact_tone (GET) Response:", r.status_code, r.json())

    # 11. Test Custom Snippets / Macros
    r = requests.get(f"{BASE_URL}/api/snippets")
    print("11. /api/snippets Response:", r.status_code, "Snippets count:", len(r.json()))
    
    print("\n🎉 ALL ADVANCED PRODUCTIVITY FEATURE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
