import os
import requests
import json
from datetime import datetime, timedelta
import threading

CANVAS_CLIENT_ID = os.getenv("CANVAS_CLIENT_ID", "YOUR_CANVAS_CLIENT_ID")
CANVAS_CLIENT_SECRET = os.getenv("CANVAS_CLIENT_SECRET", "YOUR_CANVAS_CLIENT_SECRET")
CANVAS_REDIRECT_URI = os.getenv("CANVAS_REDIRECT_URI", "exp://localhost:8081/--/canvas/callback")

# Simple thread-safe TTL Cache
class TTLCache:
    def __init__(self, ttl_seconds):
        self.ttl = ttl_seconds
        self.cache = {}
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            if key in self.cache:
                value, expires_at = self.cache[key]
                if datetime.now() < expires_at:
                    return value
                else:
                    del self.cache[key]
        return None

    def set(self, key, value):
        with self.lock:
            self.cache[key] = (value, datetime.now() + timedelta(seconds=self.ttl))

dashboard_cache = TTLCache(ttl_seconds=300)

def get_oauth_url(user_id: str, instance_url: str = "https://canvas.tamu.edu") -> str:
    """Returns the authorization URL to redirect the user to."""
    return f"{instance_url}/login/oauth2/auth?client_id={CANVAS_CLIENT_ID}&response_type=code&redirect_uri={CANVAS_REDIRECT_URI}&state={user_id}"

def exchange_code_for_token(code: str, instance_url: str = "https://canvas.tamu.edu"):
    """Exchanges an OAuth code for access and refresh tokens."""
    url = f"{instance_url}/login/oauth2/token"
    payload = {
        "grant_type": "authorization_code",
        "client_id": CANVAS_CLIENT_ID,
        "client_secret": CANVAS_CLIENT_SECRET,
        "redirect_uri": CANVAS_REDIRECT_URI,
        "code": code
    }
    resp = requests.post(url, data=payload)
    resp.raise_for_status()
    return resp.json()

def refresh_access_token(refresh_token: str, instance_url: str = "https://canvas.tamu.edu"):
    """Creates a new access token from a refresh token."""
    url = f"{instance_url}/login/oauth2/token"
    payload = {
        "grant_type": "refresh_token",
        "client_id": CANVAS_CLIENT_ID,
        "client_secret": CANVAS_CLIENT_SECRET,
        "refresh_token": refresh_token
    }
    resp = requests.post(url, data=payload)
    resp.raise_for_status()
    # Note: canvas doesn't usually return a new refresh token here.
    return resp.json()

def get_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}"}

def get_courses(access_token: str, instance_url: str):
    """Fetch active courses for the current user."""
    # enrollment_state=active to get only current courses
    url = f"{instance_url}/api/v1/courses?enrollment_state=active&include[]=term"
    resp = requests.get(url, headers=get_headers(access_token))
    resp.raise_for_status()
    return resp.json()

def get_todo_items(access_token: str, instance_url: str):
    """Fetch user's upcoming assignments & quizzes to do."""
    url = f"{instance_url}/api/v1/users/self/todo"
    resp = requests.get(url, headers=get_headers(access_token))
    resp.raise_for_status()
    return resp.json()

def get_upcoming_events(access_token: str, instance_url: str):
    """Fetch user's upcoming events from schedule."""
    url = f"{instance_url}/api/v1/users/self/upcoming_events"
    resp = requests.get(url, headers=get_headers(access_token))
    resp.raise_for_status()
    return resp.json()

def get_announcements(access_token: str, instance_url: str, course_ids: list):
    """Fetch recent announcements for given course IDs"""
    if not course_ids:
        return []
    
    context_codes = [f"course_{cid}" for cid in course_ids]
    # We must pass multiple context_codes
    params = "&".join([f"context_codes[]={code}" for code in context_codes])
    
    url = f"{instance_url}/api/v1/announcements?{params}"
    resp = requests.get(url, headers=get_headers(access_token))
    resp.raise_for_status()
    return resp.json()

def get_grades(access_token: str, instance_url: str, course_id: str):
    """Fetch explicit grades for a course if permitted."""
    url = f"{instance_url}/api/v1/courses/{course_id}/enrollments?user_id=self"
    resp = requests.get(url, headers=get_headers(access_token))
    resp.raise_for_status()
    return resp.json()
