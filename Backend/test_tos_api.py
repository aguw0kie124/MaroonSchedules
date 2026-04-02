import requests
import sys

BASE_URL = "http://127.0.0.1:8000"
TEST_CLERK_ID = "test_user_tos_123"

def test_tos_flow():
    print(f"--- Testing TOS flow for {TEST_CLERK_ID} ---")
    
    # 1. Sync user (should initialize with tos_accepted=False)
    print("1. Syncing user...")
    resp = requests.post(f"{BASE_URL}/users/sync", json={
        "clerk_id": TEST_CLERK_ID,
        "email": "tos_test@example.com",
        "full_name": "TOS Tester"
    })
    if resp.status_code != 200:
        print(f"FAILED to sync user: {resp.text}")
        return
    
    data = resp.json()
    print(f"User synced. tos_accepted: {data.get('tos_accepted')}")
    
    if data.get('tos_accepted') is True:
        print("Error: User already has TOS accepted. (Clean DB?)")
    
    # 2. Accept TOS
    print("2. Accepting TOS...")
    resp = requests.post(f"{BASE_URL}/users/{TEST_CLERK_ID}/tos/accept")
    if resp.status_code != 200:
        print(f"FAILED to accept TOS: {resp.text}")
        return
    print("TOS accepted successfully.")
    
    # 3. Verify status in profile
    print("3. Verifying status...")
    resp = requests.get(f"{BASE_URL}/users/{TEST_CLERK_ID}")
    data = resp.json()
    print(f"Verified tos_accepted: {data.get('tos_accepted')}")
    
    if data.get('tos_accepted') is True:
        print("SUCCESS: TOS flow verified.")
    else:
        print("FAILURE: tos_accepted is still False.")

if __name__ == "__main__":
    test_tos_flow()
