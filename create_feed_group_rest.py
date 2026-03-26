import os
import requests
from dotenv import load_dotenv

def create_place_reviews_group_rest():
    env_path = os.path.join(os.getcwd(), 'Backend', '.env')
    load_dotenv(dotenv_path=env_path)
    
    api_key = os.environ.get("STREAM_FEEDS_API_KEY")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET")
    
    if not api_key or not api_secret:
        print("FAIL: Missing Stream Feeds keys")
        return

    print("Attempting to create feed group 'place_reviews' via REST API...")
    url = f"https://api.getstream.io/api/v1.0/feedgroup/?api_key={api_key}"
    headers = {
        "Content-Type": "application/json",
        "Stream-Auth-Type": "secret",
        "Authorization": api_secret
    }
    data = {
        "name": "place_reviews",
        "type": "flat"
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code in [200, 201]:
            print("SUCCESS: Feed group 'place_reviews' created.")
        else:
            print(f"FAIL: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_place_reviews_group_rest()
