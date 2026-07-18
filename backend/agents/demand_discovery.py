from agents.state import EchoOpportunityState
from tools import clustering_tool


async def demand_discovery_node(state: EchoOpportunityState) -> dict:
    retries = state.get("demand_retries", 0)
    hint = "" if retries == 0 else "Previous pass had low confidence — dig for a more specific, urgent demand."
    result = await clustering_tool.run(state["raw_signals"], extra_hint=hint)
    return {"demand": result, "demand_retries": retries + 1}
