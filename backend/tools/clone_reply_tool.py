"""
Wraps your existing disclosed, in-language Clone-reply feature.

REPLACE with your real implementation — the contract: given the original
comment (in whatever language) and the new product/link, return a reply
that is clearly disclosed as AI-assisted and in the commenter's language.
"""
from agents.llm import call_structured

REPLY_SCHEMA = '{ "reply": string }'


async def generate_reply(original_comment: str, product_name: str, link: str) -> str:
    prompt = (
        f"Original comment: {original_comment!r}\n"
        f"We built '{product_name}' partly because of requests like this. "
        f"Write a short, warm reply in the SAME language as the comment, "
        f"clearly disclosed as an AI-assisted reply from the creator's team, "
        f"including this link: {link}"
    )
    result = await call_structured(
        system_prompt="You are Echo's disclosed AI Clone, replying on a creator's behalf.",
        user_prompt=prompt,
        schema_hint=REPLY_SCHEMA,
    )
    return result.get("reply", f"Thanks for the ask! Here's what we built: {link} (AI-assisted reply)")
