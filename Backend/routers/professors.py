from fastapi import APIRouter, HTTPException, Query, Depends
import requests
import json
import threading
from typing import List, Optional
from auth.clerk_middleware import require_auth
from urllib.parse import quote

router = APIRouter(prefix="/professors", tags=["professors"])

API_BASE = "https://api-aggiesbp.servehttp.com"

_professors_cache = None
_cache_lock = threading.Lock()
_cache_time = 0

def fetch_local_professors():
    """Cache the professors list locally for fast searching."""
    global _professors_cache, _cache_time
    import time
    
    # 24 hour cache
    if _professors_cache is not None and (time.time() - _cache_time) < 86400:
        return _professors_cache
        
    with _cache_lock:
        if _professors_cache is not None and (time.time() - _cache_time) < 86400:
            return _professors_cache
            
        try:
            resp = requests.get(f"{API_BASE}/professors?limit=100000", timeout=15)
            resp.raise_for_status()
            _professors_cache = resp.json()
            _cache_time = time.time()
        except Exception as e:
            print(f"Error fetching professors list: {e}")
            if _professors_cache is None:
                _professors_cache = []
                
    return _professors_cache

@router.get("/search")
def search_professors(q: str = Query("", description="Professor name query")):
    """Search for professors by name across our cached external dataset."""
    profs = fetch_local_professors()
    if not q:
        # Return a sample of top-rated interesting professors if no query
        return sorted(profs, key=lambda p: (p.get('total_reviews') or 0), reverse=True)[:20]
        
    q_lower = q.lower().strip()
    results = []
    
    for p in profs:
        name = p.get("name") or ""
        if q_lower in name.lower():
            results.append(p)
            
    # Sort by relevance (startsWith), then by total_reviews
    return sorted(
        results, 
        key=lambda x: (
            0 if str(x.get("name", "")).lower().startswith(q_lower) else 1,
            -(x.get("total_reviews") or 0)
        )
    )[:50]

@router.get("/{professor_id}")
def get_professor_details(professor_id: str):
    """Get rich professor data including written reviews and AI summary."""
    try:
        url = f"{API_BASE}/professor/{quote(professor_id)}"
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching professor details for {professor_id}: {e}")
        raise HTTPException(status_code=404, detail="Professor not found")
