"""
Wraps whatever your real noise-filter + clustering + receipts engine is.

This stub joins the raw signals into one block of text for the LLM/local
engine to analyze. REPLACE the body of `run()` with a call into your actual
existing clustering module so receipts/verbatim quotes keep working exactly
as they do today — this file exists so the Demand Discovery agent has a
single, swappable seam instead of duplicating your engine.
"""
from typing import List

from agents.llm import call_structured

DEMAND_SCHEMA = """{
  "demand": string,
  "confidence": number (0-1),
  "frequency": integer,
  "urgency_score": integer (0-100)
}"""


async def run(raw_signals: List[str], extra_hint: str = "") -> dict:
    joined = "\n".join(f"- {s}" for s in raw_signals[:200])  # cap for prompt size
    prompt = (
        "Here are audience comments/DMs/reviews. Filter out spam, trolls, and "
        "generic hype. Find the single most repeated, most specific unmet "
        "demand (something people would pay for). Quote receipts internally "
        "but only return the structured fields.\n\n"
        f"{extra_hint}\n\nSignals:\n{joined}"
    )
    return await call_structured(
        system_prompt="You are Echo's Demand Discovery agent for a creator's audience.",
        user_prompt=prompt,
        schema_hint=DEMAND_SCHEMA,
    )
