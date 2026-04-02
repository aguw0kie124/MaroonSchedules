import requests
import uuid
import psycopg
from db_config import CONNECTION_PARAMS

BASE_URL = "http://127.0.0.1:8000"

def setup_test_user():
    clerk_id = str(uuid.uuid4())
    real_name = "Howdy Developer 2026"
    print(f"Setting up test user {clerk_id} with name {real_name}...")
    
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (clerk_id, full_name) VALUES (%s, %s) ON CONFLICT (clerk_id) DO UPDATE SET full_name = EXCLUDED.full_name",
                (clerk_id, real_name)
            )
            conn.commit()
    return clerk_id, real_name

def test_feed_identity_fallback(clerk_id, real_name):
    print("\nTesting Feed Identity Fallback...")
    # Add a post with 'Aggie' (generic) name
    payload = {
        "activity": {
            "actor": f"SU:{clerk_id}",
            "verb": "post",
            "text": "Identity Fallback Test",
            "custom": {
                "user_name": "Aggie",
                "user_image": ""
            }
        }
    }
    
    # 1. Post natively
    post_resp = requests.post(f"{BASE_URL}/chat/feeds/proxy/flat/campus_global", json=payload)
    if post_resp.status_code != 200:
        print(f"❌ Post Failed: {post_resp.text}")
        return
    
    # 2. Fetch feed - the backend should JOIN and return the real_name
    get_resp = requests.get(f"{BASE_URL}/chat/feeds/proxy/flat/campus_global?limit=5")
    if get_resp.status_code == 200:
        results = get_resp.json().get("results", [])
        for item in results:
            if item.get("actor") == f"SU:{clerk_id}":
                actor_data = item.get("actor_data") or item.get("user") or {}
                # In our transform, we put it in actor_data or user depending on the route
                current_name = item.get("custom", {}).get("user_name")
                
                # Check the COALESCE result
                # Note: our mapActivityToPost uses actor.data.name or custom.user_name
                print(f"   Post Found for {clerk_id}")
                print(f"   Name returned in custom: {current_name}")
                
                if current_name == real_name:
                    print("   🔥🔥 IDENTITY FALLBACK VERIFIED: Postgres JOIN working correctly!")
                    return True
                else:
                    print(f"   ❌ IDENTITY FAIL: Expected {real_name}, got {current_name}")
        print("❌ Test post not found in feed")
    else:
        print(f"❌ Feed fetch failed: {get_resp.text}")
    return False

if __name__ == "__main__":
    clerk_id, real_name = setup_test_user()
    test_feed_identity_fallback(clerk_id, real_name)
