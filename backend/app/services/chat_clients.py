"""LLM provider clients for Chat-to-Farm."""

from __future__ import annotations

import json
import urllib.error
import urllib.request


def call_deepseek(question: str, context: str, history: list, api_key: str, system_prompt: str) -> tuple[str | None, str | None]:
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-12:]:
        role = "assistant" if msg.role == "ai" else "user"
        messages.append({"role": role, "content": msg.text})

    messages.append({
        "role": "user",
        "content": (
            "FARM DATA:\n"
            f"{context}\n\n"
            "CURRENT USER QUESTION - prioritize this over older chat history:\n"
            f"{question}"
        ),
    })
    body = {
        "model": "deepseek-v4-flash",
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 400,
    }
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result = json.loads(response.read())
            return result["choices"][0]["message"]["content"], None
    except Exception as exc:
        error = format_api_error("DeepSeek", exc)
        print(f"[Chat] {error}")
        return None, error


def call_gemini(question: str, context: str, history: list, api_key: str, system_prompt: str) -> tuple[str | None, str | None]:
    contents = []
    for msg in history[-12:]:
        role = "model" if msg.role == "ai" else "user"
        contents.append({"role": role, "parts": [{"text": msg.text}]})

    contents.append({
        "role": "user",
        "parts": [{
            "text": (
                "FARM DATA:\n"
                f"{context}\n\n"
                "CURRENT USER QUESTION - prioritize this over older chat history:\n"
                f"{question}"
            )
        }],
    })
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 400, "temperature": 0.2},
    }
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="
        + api_key,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result = json.loads(response.read())
            return result["candidates"][0]["content"]["parts"][0]["text"], None
    except Exception as exc:
        error = format_api_error("Gemini", exc)
        print(f"[Chat] {error}")
        return None, error


def format_api_error(provider: str, exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        body = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body).get("error", {}).get("message") or body
        except json.JSONDecodeError:
            detail = body
        detail = detail.strip()[:240]
        if exc.code == 401:
            return f"{provider} rejected the API key. Create a new key and update backend/.env."
        if exc.code == 402:
            return f"{provider} API balance is insufficient. Add balance or granted credits, then try again."
        if exc.code == 429:
            return f"{provider} rate limit was reached. Wait a moment and try again."
        return f"{provider} API returned HTTP {exc.code}: {detail}"
    if isinstance(exc, urllib.error.URLError):
        return f"Cannot reach {provider}. Check internet, proxy, firewall, or DNS settings."
    return f"{provider} request failed: {str(exc)[:240]}"
