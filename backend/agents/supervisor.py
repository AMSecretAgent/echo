import os

from agents.state import EchoOpportunityState

DEMAND_THRESHOLD = float(os.getenv("DEMAND_CONFIDENCE_THRESHOLD", "0.55"))
MARKET_THRESHOLD = float(os.getenv("MARKET_SCORE_THRESHOLD", "50"))
MAX_RETRIES = int(os.getenv("MAX_AGENT_RETRIES", "2"))


def route_after_demand(state: EchoOpportunityState) -> str:
    demand = state.get("demand") or {}
    confidence = demand.get("confidence", 0)
    retries = state.get("demand_retries", 0)
    if confidence < DEMAND_THRESHOLD and retries < MAX_RETRIES:
        return "demand_discovery"
    return "market_validation"


def route_after_market(state: EchoOpportunityState) -> str:
    market = state.get("market") or {}
    score = market.get("market_score", 0)
    retries = state.get("market_retries", 0)
    if score < MARKET_THRESHOLD and retries < MAX_RETRIES:
        return "market_validation"
    return "product_creation"
