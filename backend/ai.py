import os

# Uses Replit AI Integrations (blueprint: python_openai_ai_integrations) for
# OpenAI-compatible access without a personal API key. The env vars
# AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY are set
# automatically by the integration — do not edit or request them.
#
# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
# do not change this unless explicitly requested by the user
from openai import OpenAI

AI_INTEGRATIONS_OPENAI_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
AI_INTEGRATIONS_OPENAI_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")

DEFAULT_MODEL = "gpt-5"


def get_openai_client() -> OpenAI:
    """Return a fresh OpenAI client wired to Replit AI Integrations."""
    return OpenAI(
        api_key=AI_INTEGRATIONS_OPENAI_API_KEY,
        base_url=AI_INTEGRATIONS_OPENAI_BASE_URL,
    )


def chat(prompt: str, system: str | None = None, model: str = DEFAULT_MODEL) -> str:
    """Send a single chat prompt and return the text reply."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    client = get_openai_client()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        max_completion_tokens=8192,
    )
    return response.choices[0].message.content or ""
