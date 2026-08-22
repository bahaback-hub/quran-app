#!/usr/bin/env python3
"""List available Gemini generation models without printing any credential."""

import os
from google import genai


def main() -> None:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    for model in client.models.list():
        name = getattr(model, "name", "")
        actions = getattr(model, "supported_actions", []) or []
        if "generateContent" in actions:
            print(name)


if __name__ == "__main__":
    main()
