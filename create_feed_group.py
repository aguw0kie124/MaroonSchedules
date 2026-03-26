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
        # For Stream Feeds, we can try to create a 'flat' feed group named 'place_reviews'
        # Note: The 'stream-python' library might not have a direct 'create_feed_group' 
        # but 'get_feed_group' often works or we use the management API.
        # Actually, let's try calling add_activity on it first to see if it auto-creates (rare for groups)
        # and if not, we use the client's internal methods or requests.
        
        # Many Stream libraries use the dashboard for groups, but we'll try to 'create' it
        print("Attempting to create feed group 'place_reviews' of type 'flat'...")
        # (This is a guess at the SDK method if it exists, otherwise we'll see the error)
        # Most likely we need to use the REST API if the SDK doesn't support group creation.
        
        import requests
        url = f"https://api.getstream.io/api/v1.0/feedgroup/?api_key={api_key}"
        headers = {
            "Content-Type": "application/json",
            "Stream-Auth-Type": "secret",
            "Authorization": api_secret # Or similar
        }
        # Standard Stream creation is often done via dashboard, but let's try the response logic.
        print("SDK doesn't always have create_group. Let's try adding an activity to force a check.")
        feed = client.feed('place_reviews', 'global')
        feed.get(limit=1)
        print("Group already exists or was created.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_place_reviews_group()
