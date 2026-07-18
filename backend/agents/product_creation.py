from agents.llm import call_structured
from agents.state import EchoOpportunityState

PRODUCT_SCHEMA = """{
  "product_name": string,
  "description": string,
  "pricing": integer (INR),
  "feature_list": [string],
  "roadmap": [string]
}"""


async def product_creation_node(state: EchoOpportunityState) -> dict:
    demand = state["demand"]
    market = state["market"]
    prompt = (
        f"Demand: {demand.get('demand')} (urgency {demand.get('urgency_score')}/100)\n"
        f"Market validation: score {market.get('market_score')}/100, "
        f"competition {market.get('competition_level')}, "
        f"growth potential: {market.get('growth_potential')}\n"
        "Design a concrete MVP product/service a solo creator could ship this "
        "week: a name, one-paragraph description, an INR price, 3-6 features, "
        "and a short post-launch roadmap."
    )
    result = await call_structured(
        system_prompt="You are Echo's Product Creation agent, designing lean MVPs for creators.",
        user_prompt=prompt,
        schema_hint=PRODUCT_SCHEMA,
    )
    return {"product": result}
