from agents.llm import call_structured
from agents.state import EchoOpportunityState

MARKET_SCHEMA = """{
  "market_score": integer (0-100),
  "competition_level": "low" | "medium" | "high",
  "growth_potential": string,
  "validation_reasoning": string
}"""


async def market_validation_node(state: EchoOpportunityState) -> dict:
    demand = state["demand"]
    retries = state.get("market_retries", 0)
    hint = "" if retries == 0 else "Previous pass scored too low to trust — re-evaluate more carefully, consider adjacent niches."
    prompt = (
        f"Demand signal: {demand.get('demand')}\n"
        f"Frequency mentioned: {demand.get('frequency')}, urgency: {demand.get('urgency_score')}/100.\n"
        f"{hint}\n"
        "Estimate whether this is a real, sellable market opportunity for an "
        "individual creator (not a VC-scale business)."
    )
    result = await call_structured(
        system_prompt="You are Echo's Market Validation agent, evaluating creator-scale product opportunities.",
        user_prompt=prompt,
        schema_hint=MARKET_SCHEMA,
    )
    return {"market": result, "market_retries": retries + 1}
