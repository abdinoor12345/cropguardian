import os
import requests
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("ANTHROPIC_API_KEY")

models_to_test = [
    "claude-3-haiku-20240307",
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-haiku-latest"
]

print("Testing API Key access across Claude models...\n")

for model in models_to_test:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    payload = {
        "model": model,
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "Ping"}]
    }
    res = requests.post(url, headers=headers, json=payload)
    if res.status_code == 200:
        print(f" SUCCESS: Key is authorized for '{model}'")
    else:
        err = res.json().get("error", {}).get("message", res.text)
        print(f" FAILED ({res.status_code}) for '{model}': {err}")