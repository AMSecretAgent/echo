from langgraph.graph import StateGraph, END

from agents.state import EchoOpportunityState
from agents.demand_discovery import demand_discovery_node
from agents.market_validation import market_validation_node
from agents.product_creation import product_creation_node
from agents.revenue import revenue_node
from agents.launch import launch_node
from agents.execution import execution_node
from agents.supervisor import route_after_demand, route_after_market


def build_echo_graph():
    graph = StateGraph(EchoOpportunityState)

    graph.add_node("demand_discovery", demand_discovery_node)
    graph.add_node("market_validation", market_validation_node)
    graph.add_node("product_creation", product_creation_node)
    graph.add_node("revenue_agent", revenue_node)
    graph.add_node("launch_agent", launch_node)
    graph.add_node("execution_agent", execution_node)

    graph.set_entry_point("demand_discovery")

    graph.add_conditional_edges(
        "demand_discovery",
        route_after_demand,
        {"demand_discovery": "demand_discovery", "market_validation": "market_validation"},
    )
    graph.add_conditional_edges(
        "market_validation",
        route_after_market,
        {"market_validation": "market_validation", "product_creation": "product_creation"},
    )

    graph.add_edge("product_creation", "revenue_agent")
    graph.add_edge("revenue_agent", "launch_agent")
    graph.add_edge("launch_agent", "execution_agent")
    graph.add_edge("execution_agent", END)

    return graph.compile()


# Compiled once, reused across requests (LangGraph graphs are stateless/pure per-invocation)
echo_graph = build_echo_graph()
