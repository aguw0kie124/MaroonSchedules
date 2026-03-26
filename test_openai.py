import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from services import openai_service

def test_ask():
    print("Testing OpenAI GPT-5 Service...")
    resp = openai_service.ask_gpt5("Say 'Test Success' in one word.", "You are a test assistant.")
    print(f"Response: {resp}")

if __name__ == "__main__":
    test_ask()
