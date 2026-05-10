import os
from openai import OpenAI
from .base import LLMClient

class OpenAIClient(LLMClient):
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        self.client = OpenAI(api_key=api_key)

    def complete(self, prompt: str, system: str = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        return response.choices[0].message.content

    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        import json
        text = self.complete(prompt, system)
        return json.loads(text)