import base64
import json
from typing import Any

import httpx

from app.core.config import settings


class AIPipeline:
    def __init__(self) -> None:
        self.timeout = httpx.Timeout(45.0)

    async def transcribe_voice(self, audio_bytes: bytes, filename: str) -> str:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
        files = {
            "file": (filename, audio_bytes, "audio/webm"),
            "model": (None, settings.groq_whisper_model),
            "language": (None, "hi"),
            "temperature": (None, "0"),
            "response_format": (None, "json"),
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, files=files)
            response.raise_for_status()
            data = response.json()
        return data.get("text", "").strip()

    async def ocr_paper(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": "Extract all text accurately from this image including handwritten Hindi/Hinglish. Return plain text only."},
                        {"inline_data": {"mime_type": mime_type, "data": encoded}},
                    ]
                }
            ]
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_pro_model}:generateContent?key={settings.gemini_api_key}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError, TypeError):
            return ""

    async def extract_structured_need(self, text: str) -> dict[str, Any]:
        prompt = (
            "You are an emergency NGO intake parser. "
            "Return strict JSON with keys: urgency_score (1-10 int), category, location_context, summary. "
            "Language can be Hindi/Hinglish/English. Keep summary under 280 chars. Input:\n"
            f"{text}"
        )
        body = {"contents": [{"parts": [{"text": prompt}]}]}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_flash_model}:generateContent?key={settings.gemini_api_key}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            data = response.json()

        raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
        parsed["urgency_score"] = max(1, min(10, int(parsed["urgency_score"])))
        return parsed
