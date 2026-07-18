from agents.llm import call_structured
from agents.state import EchoOpportunityState

REVENUE_SCHEMA = """{
  "revenue_model": string,
  "pricing_strategy": string,
  "estimated_revenue": string,
  "upsell_opportunities": [string]
}"""


async def revenue_node(state: EchoOpportunityState) -> dict:
    product = state["product"]
    market = state["market"]
    prompt = (
        f"Product: {product.get('product_name')} at ₹{product.get('pricing')}.\n"
        f"Market growth potential: {market.get('growth_potential')}, "
        f"competition: {market.get('competition_level')}.\n"
        "Recommend a monetization model (one-time / subscription / tiered), "
        "a pricing strategy, a realistic revenue estimate for a creator-scale "
        "audience, and 2-3 upsell or subscription opportunities."
    )
    result = await call_structured(
        system_prompt="You are Echo's Revenue agent, recommending monetization for creator products.",
        user_prompt=prompt,
        schema_hint=REVENUE_SCHEMA,
    )
    return {"revenue": result}
