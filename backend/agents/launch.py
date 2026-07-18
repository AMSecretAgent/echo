from agents.llm import call_structured
from agents.state import EchoOpportunityState

LAUNCH_SCHEMA = """{
  "instagram_post": string,
  "linkedin_post": string,
  "twitter_post": string,
  "email_campaign": string,
  "launch_plan": string
}"""


async def launch_node(state: EchoOpportunityState) -> dict:
    product = state["product"]
    revenue = state["revenue"]
    prompt = (
        f"Product: {product.get('product_name')} — {product.get('description')}\n"
        f"Pricing strategy: {revenue.get('pricing_strategy')}\n"
        "Write launch copy: an Instagram post, a LinkedIn post, a Twitter/X "
        "post, a short email campaign, and a simple day-by-day launch plan."
    )
    result = await call_structured(
        system_prompt="You are Echo's Launch agent, writing creator-voiced launch copy.",
        user_prompt=prompt,
        schema_hint=LAUNCH_SCHEMA,
    )
    return {"launch": result}
