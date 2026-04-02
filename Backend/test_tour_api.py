import requests

BASE_URL = "http://127.0.0.1:8000"
TEST_CLERK_ID = "test_user_tour_123"

def test_tour_status_flow():
    print(f"--- Testing Tour Status flow for {TEST_CLERK_ID} ---")
    
    # 1. Sync user (should initialize with tour_completed=False)
    print("1. Syncing user...")
    resp = requests.post(f"{BASE_URL}/users/sync", json={
        "clerk_id": TEST_CLERK_ID,
        "email": "tour_test@example.com",
        "full_name": "Tour Tester"
    })
    if resp.status_code != 200:
        print(f"FAILED to sync user: {resp.text}")
        return
    
    data = resp.json()
    print(f"User synced. tour_completed status: {data.get('tour_completed')}")
    
    # 2. Complete Tour
    print("2. Completing Tour...")
    resp = requests.post(f"{BASE_URL}/users/{TEST_CLERK_ID}/tour/complete")
    if resp.status_code != 200:
        print(f"FAILED to complete tour: {resp.text}")
        return
    print("Tour completed successfully.")
    
    # 3. Verify status in profile
    print("3. Verifying status...")
    resp = requests.get(f"{BASE_URL}/users/{TEST_CLERK_ID}")
    data = resp.json()
    print(f"Verified tour_completed status: {data.get('tour_completed')}")
    
    if data.get('tour_completed') is True:
        print("SUCCESS: Tour completion flow verified.")
    else:
        print("FAILURE: tour_completed is still False.")

if __name__ == "__main__":
    test_tour_status_flow()
