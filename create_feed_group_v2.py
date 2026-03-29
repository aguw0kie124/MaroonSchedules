import os
import stream
from dotenv import load_dotenv

def create_place_reviews_group():
    env_path = os.path.join(os.getcwd(), 'Backend', '.env')
    load_dotenv(dotenv_path=env_path)
    
    api_key = os.environ.get("STREAM_FEEDS_API_KEY")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET")
    
    if not api_key or not api_secret:
        print("FAIL: Missing Stream Feeds keys")
        return

    client = stream.connect(api_key, api_secret)
    try:
        print("Attempting to create feed group 'place_reviews' of type 'flat'...")
        # many Stream clients use create_feed_group or similar
        # let's try the direct API if the SDK is restricted, but check first
        client.create_feed_group('place_reviews', 'flat')
        print("SUCCESS: f
        print(f"Error: {e}")eed_group created.")
    except Exception as e:

if __name__ == "__main__":
    create_place_reviews_group()
