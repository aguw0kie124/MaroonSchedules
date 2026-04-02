import requests
import uuid
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_upload():
    print("Testing Image Upload...")
    # Create a dummy image file
    with open("test_img.jpg", "wb") as f:
        f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 10)
    
    with open("test_img.jpg", "rb") as f:
        files = {"file": ("test_img.jpg", f, "image/jpeg")}
        resp = requests.post(f"{BASE_URL}/upload/image", files=files)
    
    if resp.status_code == 200:
        data = resp.json()
        print(f"✅ Upload Success: {data['url']}")
        return data["url"]
    else:
        print(f"❌ Upload Failed: {resp.text}")
        return None

def test_add_ping(image_url):
    print("\nTesting Native PING Addition...")
    user_id = f"user_{uuid.uuid4().hex[:8]}"
    payload = {
        "activity": {
            "actor": f"SU:{user_id}",
            "verb": "ping",
            "text": "Native Independence Test!",
            "attachments": [{"image_url": image_url}],
            "custom": {
                "user_name": "Test Aggie",
                "ping_title": "Independent Ping",
                "ping_category": "Free Food",
                "location_tag": "MSC",
                "lat": 30.6123,
                "lng": -96.3412
            }
        }
    }
    resp = requests.post(f"{BASE_URL}/chat/feeds/proxy/flat/campus_pings", json=payload)
    if resp.status_code == 200:
        print(f"✅ Ping Added Natively: {resp.json()}")
        return True
    else:
        print(f"❌ Ping Addition Failed: {resp.text}")
        return False

def test_get_feed():
    print("\nTesting Native Feed Retrieval...")
    resp = requests.get(f"{BASE_URL}/chat/feeds/proxy/flat/campus_pings?limit=5")
    if resp.status_code == 200:
        data = resp.json()
        results = data.get("results", [])
        print(f"✅ Feed Fetched: Received {len(results)} items")
        if results:
            item = results[0]
            print(f"   First Item ID: {item['id']}")
            print(f"   Reaction Counts: {item.get('reaction_counts')}")
            # Verify batch count format
            if "like" in item.get('reaction_counts', {}):
                print("   ✅ Interaction counts confirmed")
        return True
    else:
        print(f"❌ Feed Fetch Failed: {resp.text}")
        return False

if __name__ == "__main__":
    img_url = test_upload()
    if img_url:
        if test_add_ping(img_url):
            test_get_feed()
