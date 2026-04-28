import os
from anthropic import Anthropic
from .base import LLMClient

class AnthropicClient(LLMClient):
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        self.client = Anthropic(api_key=api_key)

    def complete(self, prompt: str, system: str = None) -> str:
        messages = [{"role": "user", "content": prompt}]
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=messages
        )
        return response.content[0].text

    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        import json
        text = self.complete(prompt, system)
        return json.loads(text)