import os
import stream
from dotenv import load_dotenv

def test_stream_proxy():
    env_path = os.path.join(os.getcwd(), 'Backend', '.env')
    load_dotenv(dotenv_path=env_path)
    
    api_key = os.environ.get("STREAM_FEEDS_API_KEY")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET")
    
    if not api_key or not api_secret:
        print("FAIL: Missing Stream Feeds keys")
        return

    print(f"Using Key: {api_key[:4]}...")
    client = stream.connect(api_key, api_secret)
    feed = client.feed('flat', 'campus_global')
    
    try:
        res = feed.add_activity({
            'actor': 'SU:test_user',
            'verb': 'post',
            'object': 'test_obj',
            'text': 'Diagnostic Test'
        })
        print(f"SUCCESS: Activity added (ID: {res.get('id')})")
        
        # Test reel verb
        reel_res = client.feed('flat', 'reels_global').add_activity({
            'actor': 'SU:test_user',
            'verb': 'reel',
            'object': 'test_reel',
            'text': 'Diagnostic Reel'
        })
        print(f"SUCCESS: Reel verb added (ID: {reel_res.get('id')})")
        
    except Exception as e:
        print(f"FAIL: {e}")

if __name__ == "__main__":
    test_stream_proxy()
