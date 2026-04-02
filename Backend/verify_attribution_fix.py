import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"

def test_comment_attribution():
    print("Testing Comment Attribution Fix...")
    post_id = str(uuid.uuid4())
    user_id = "user_official_clerk_test"
    user_name = "Senior Aggie Developer"
    user_image = "https://avatar.com/test.jpg"
    
    # Simulate a comment addition with metadata
    payload = {
        "kind": "comment",
        "activity_id": post_id,
        "user_id": user_id,
        "data": {
            "text": "This should show my real name!",
            "name": user_name,
            "image": user_image
        }
    }
    
    # 1. Add reaction
    add_resp = requests.post(f"{BASE_URL}/chat/feeds/proxy/reactions", json=payload)
    if add_resp.status_code != 200:
        print(f"❌ Failed to add reaction: {add_resp.text}")
        return
    
    # 2. Get reactions
    get_resp = requests.get(f"{BASE_URL}/chat/feeds/proxy/reactions/{post_id}/comment")
    if get_resp.status_code == 200:
        results = get_resp.json().get("results", [])
        if results:
            comment = results[0]
            returned_user = comment.get("user", {})
            print(f"✅ Comment Retrieved")
            print(f"   Returned User Name: {returned_user.get('name')}")
            print(f"   Returned User ID: {returned_user.get('id')}")
            
            if returned_user.get('name') == user_name:
                print("   🔥🔥 ATTRIBUTION VERIFIED: Real name preserved!")
            else:
                print(f"   ❌ ATTRIBUTION FAILED: Expected {user_name}, got {returned_user.get('name')}")
        else:
            print("❌ No comments found in retrieval")
    else:
        print(f"❌ Failed to fetch reactions: {get_resp.text}")

if __name__ == "__main__":
    test_comment_attribution()
