import os
from dotenv import load_dotenv
from stream_chat import StreamChat

load_dotenv(override=True)

api_key = os.environ.get("STREAM_API_KEY", "")
api_secret = os.environ.get("STREAM_API_SECRET", "")

if not api_key or not api_secret:
    print("Missing STREAM_API_KEY or STREAM_API_SECRET")
    exit(1)

print(f"Loaded API_KEY: {api_key}")

client = StreamChat(api_key=api_key, api_secret=api_secret)
app_settings = client.get_app_settings()

print(f"App Settings fetched for App ID: {app_settings.get('app', {}).get('name', 'Unknown')}")
