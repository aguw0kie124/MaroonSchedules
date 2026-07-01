from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Depends
from typing import Dict, Any, List
from auth.clerk_middleware import require_auth
from pydantic import BaseModel
# NOTE: `openai_service` (and the `openai` package) is imported lazily inside the
# voice endpoints below so the rest of the AI router — including RevAI's
# /ai/assistant, which uses OpenRouter, not OpenAI — works without that dependency.
import asyncio
import shutil
import os
import json
import tempfile
from concurrent.futures import ThreadPoolExecutor

router = APIRouter(prefix="/ai", tags=["AI"])

# Dedicated pool for RevAI's blocking LLM call so it never competes with (or is
# starved by) the shared request threadpool — important when other endpoints are
# blocked on a slow/dead database and hogging that shared pool.
_REVAI_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="revai")


class AssistantRequest(BaseModel):
    message: str


@router.post("/assistant")
async def assistant(body: AssistantRequest, auth_user_id: str = Depends(require_auth)):
    """RevAI campus assistant. Async endpoint that runs the blocking LLM call on a
    dedicated executor, so it doesn't need — and can't be starved by — the shared
    request threadpool. Returns {"text"}."""
    print(f"[RevAI] ENDPOINT HIT — user={auth_user_id} msg={body.message!r}", flush=True)
    from services import assistant_service

    try:
        loop = asyncio.get_running_loop()
        # Hard 43s guard (under the app's 45s client timeout) so a long agent loop
        # always returns a friendly message instead of a client-side timeout.
        return await asyncio.wait_for(
            loop.run_in_executor(_REVAI_EXECUTOR, assistant_service.answer_question, body.message),
            timeout=43,
        )
    except asyncio.TimeoutError:
        print("[RevAI] ENDPOINT TIMEOUT (>43s)", flush=True)
        return {"text": "That took longer than expected — please try again in a moment."}
    except Exception as exc:  # noqa: BLE001 - never 500 the chat UI
        print(f"[RevAI] ENDPOINT ERROR: {exc!r}", flush=True)
        return {"text": f"[RevAI endpoint error] {exc}"}


class VoiceIntentRequest(BaseModel):
    text: str # For now, we'll send pre-transcribed text if possible, or we might need audio processing
    # If sending audio, we'll need a different approach (e.g. UploadFile)

@router.post("/voice-intent")
async def extract_voice_intent(body: VoiceIntentRequest, auth_user_id: str = Depends(require_auth)):
    """
    Extract navigation intent from voice transcript using OpenAI GPT-5.
    """
    system_prompt = """
    You are a Texas A&M campus navigation assistant. Extract the navigation intent from the user's text.
    
    Intent types:
    - BUILDING: User wants to go to a specific building (e.g. "Take me to Zachry")
    - NEAREST: User wants to find the closest amenity (restroom, coffee, dining, library, study, parking)
    - SEARCH: General search query
    - UNKNOWN: Could not determine intent
    
    Respond ONLY with valid JSON:
    {"intent_type": "BUILDING|NEAREST|SEARCH|UNKNOWN", "building_id": "string if BUILDING", "category": "string if NEAREST", "query": "string if SEARCH"}
    """

    from services import openai_service

    response = openai_service.ask_gpt5(body.text, system_prompt)
    
    try:
        # Clean response and parse JSON
        cleaned = response.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except Exception as e:
        print(f"Failed to parse AI response: {response}")
        return {"intent_type": "UNKNOWN", "query": body.text}

@router.post("/process-voice")
async def process_voice(file: UploadFile = File(...), auth_user_id: str = Depends(require_auth)):
    """
    Handle audio file, transcribe with Whisper, and extract intent with GPT-5.
    """
    from services import openai_service

    client = openai_service.get_client()
    
    # 1. Save temp file for OpenAI
    with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
        
    try:
        # 2. Transcribe with Whisper
        audio_file = open(tmp_path, "rb")
        transcript_res = client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file
        )
        transcript = transcript_res.text
        
        # 3. Extract Intent with GPT-5
        system_prompt = """
        You are a Texas A&M campus navigation assistant. Extract the navigation intent from the user's transcript.
        Available amenity categories: restroom, coffee, dining, library, study, parking.
        
        Respond ONLY with valid JSON:
        {"intent_type": "BUILDING|NEAREST|SEARCH|UNKNOWN", "building_id": "string if BUILDING", "category": "string if NEAREST", "query": "string if SEARCH"}
        """
        
        ai_resp = openai_service.ask_gpt5(transcript, system_prompt)
        
        # Clean response and parse JSON
        cleaned = ai_resp.replace("```json", "").replace("```", "").strip()
        intent = json.loads(cleaned)
        
        return {
            "transcript": transcript,
            "intent": intent
        }
    except Exception as e:
        print(f"Voice Processing Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
