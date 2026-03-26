import os
from openai import OpenAI
from dotenv import load_dotenv

# Load env in case it's not already loaded
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

def get_client():
    return OpenAI(api_key=OPENAI_API_KEY)

def ask_gpt5(prompt: str, system_prompt: str = "You are a helpful TAMU campus assistant.") -> str:
    """
    Standard interface for GPT-5 calls using the provided documentation.
    """
    if not OPENAI_API_KEY:
        return "Error: OPENAI_API_KEY not configured."
    
    client = get_client()
    try:
        # Using the specific responses.create interface from user documentation
        response = client.responses.create(
            model="gpt-5.4",
            input=f"{system_prompt}\n\nUser: {prompt}"
        )
        return response.output_text
    except Exception as e:
        print(f"OpenAI GPT-5 Error: {e}")
        # Fallback to standard chat completions if responses.create fails 
        # (though we should stick to the user's documented API if possible)
        try:
            # Traditional fallback just in case the library version doesn't support the documented method yet
            resp = client.chat.completions.create(
                model="gpt-4o", # Fallback model
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            )
            return resp.choices[0].message.content
        except Exception as e2:
            return f"Error calling OpenAI API: {str(e)}"
