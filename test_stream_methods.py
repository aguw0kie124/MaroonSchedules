import os
import stream
from dotenv import load_dotenv

def test_stream_methods():
    env_path = os.path.join(os.getcwd(), 'Backend', '.env')
    load_dotenv(dotenv_path=env_path)
    
    api_key = os.environ.get("STREAM_FEEDS_API_KEY")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET")
    
    client = stream.connect(api_key, api_secret)
    print(f"Client type: {type(client)}")
    print(f"Has users attribute: {hasattr(client, 'users')}")
    if hasattr(client, 'users'):
        print(f"Users type: {type(client.users)}")
    
    print(f"Has user method: {hasattr(client, 'user')}")
    
    try:
        # Test common V1/V2/V3 patterns
        print("Attempting user lookup...")
        u = client.user('test_user')
        print(f"User object type: {type(u)}")
    except Exception as e:
        print(f"User lookup failed: {e}")

if __name__ == "__main__":
    test_stream_methods()
