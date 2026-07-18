"""
Shared, OpenAI-compatible LLM client for all agents.

Mirrors the behavior your README already promises: if LLM_API_KEY is blank,
everything still works via a local heuristic engine (no key needed); if a
key is set (Grok/Gemini/OpenAI/etc via LLM_BASE_URL), agents call the real
model and return structured JSON.
"""
import json
import os
import re
from collections import Counter

import httpx

LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

LIVE = bool(LLM_API_KEY)


async def call_structured(system_prompt: str, user_prompt: str, schema_hint: str) -> dict:
    """
    Ask the model for ONLY a JSON object matching schema_hint.
    Falls back to a local heuristic if no LLM_API_KEY is configured.
    """
    if not LIVE:
        return _local_fallback(user_prompt, schema_hint)

    full_system = (
        f"{system_prompt}\n\n"
        f"Respond with ONLY a single JSON object matching this shape, "
        f"no markdown fences, no preamble:\n{schema_hint}"
    )
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": full_system},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.4,
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

    content = content.strip()
    content = re.sub(r"^```(json)?|```$", "", content, flags=re.MULTILINE).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Model didn't return clean JSON — fall back rather than crash the graph
        return _local_fallback(user_prompt, schema_hint)


def _local_fallback(user_prompt: str, schema_hint: str) -> dict:
    """
    Extremely lightweight keyword-frequency engine so the whole pipeline
    runs with zero API key, matching the "Local engine" mode in your README.
    This is intentionally simple — swap in your real local clustering engine
    if you already have one.
    """
    words = re.findall(r"[a-zA-Z']{4,}", user_prompt.lower())
    stop = {"this", "that", "with", "have", "your", "just", "want", "please", "would"}
    freq = Counter(w for w in words if w not in stop)
    top_word, count = (freq.most_common(1) or [("demand", 1)])[0]

    # Return something plausible for whichever schema was requested,
    # keyed off distinctive field names in the hint.
    if "urgency_score" in schema_hint:
        return {
            "demand": f"more {top_word}-related content/products",
            "confidence": min(0.4 + 0.05 * count, 0.9),
            "frequency": count,
            "urgency_score": min(30 + 10 * count, 95),
        }
    if "competition_level" in schema_hint:
        return {
            "market_score": 55,
            "competition_level": "medium",
            "growth_potential": "moderate",
            "validation_reasoning": "Local-engine estimate; connect an LLM key for real analysis.",
        }
    if "roadmap" in schema_hint:
        return {
            "product_name": f"{top_word.title()} Starter Kit",
            "description": f"A focused offer addressing repeated requests about {top_word}.",
            "pricing": 499,
            "feature_list": [f"{top_word.title()} core module", "Bonus templates", "Community access"],
            "roadmap": ["MVP launch", "Gather feedback", "Add tier 2 features"],
        }
    if "upsell_opportunities" in schema_hint:
        return {
            "revenue_model": "one-time purchase + optional subscription",
            "pricing_strategy": "anchor at ₹499, discount for early buyers",
            "estimated_revenue": "₹15,000–₹40,000 in first 30 days at current audience size",
            "upsell_opportunities": ["1:1 add-on session", "Premium tier with templates"],
        }
    if "email_campaign" in schema_hint:
        return {
            "instagram_post": f"Big news 👀 I built something based on what you all keep asking for: {top_word}. Link in bio.",
            "linkedin_post": f"After hearing the same request repeatedly from my audience, I built a focused solution around {top_word}.",
            "twitter_post": f"You asked, I built it. New: a {top_word} resource made from your own requests. 🧵",
            "email_campaign": f"Subject: I built this because you asked\n\nYou've been asking about {top_word} — here it is.",
            "launch_plan": "Teaser (Day 1) -> Reveal + link (Day 2) -> Reminder + urgency (Day 4)",
        }
    if "checkout_copy" in schema_hint:
        return {
            "landing_page": f"Everything you asked for about {top_word}, in one place.",
            "checkout_copy": "Secure UPI checkout. Instant access.",
            "CTA": "Get instant access",
            "marketing_assets": ["Launch graphic", "Countdown sticker", "Testimonial template"],
        }
    return {"note": "local fallback: unrecognized schema", "top_word": top_word}
