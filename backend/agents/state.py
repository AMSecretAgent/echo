from typing import TypedDict, List, Dict, Any, Optional


class EchoOpportunityState(TypedDict, total=False):
    run_id: str
    raw_signals: List[str]              # comments/DMs/reviews, one string each (existing ingestion)

    demand: Optional[Dict[str, Any]]     # {demand, confidence, frequency, urgency_score}
    demand_retries: int

    market: Optional[Dict[str, Any]]     # {market_score, competition_level, growth_potential, validation_reasoning}
    market_retries: int

    product: Optional[Dict[str, Any]]    # {product_name, description, pricing, feature_list, roadmap}
    revenue: Optional[Dict[str, Any]]    # {revenue_model, pricing_strategy, estimated_revenue, upsell_opportunities}
    launch: Optional[Dict[str, Any]]     # {instagram_post, linkedin_post, twitter_post, email_campaign, launch_plan}
    execution: Optional[Dict[str, Any]]  # {landing_page, checkout_copy, CTA, marketing_assets}

    opportunity_score: Optional[int]
    status: str
    errors: List[str]
