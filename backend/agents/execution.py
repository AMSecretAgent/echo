from agents.llm import call_structured
from agents.state import EchoOpportunityState
from db.session import SessionLocal
from db.models import Product
from tools import link_tool, checkout_tool

EXECUTION_SCHEMA = """{
  "landing_page": string,
  "checkout_copy": string,
  "CTA": string,
  "marketing_assets": [string]
}"""


async def execution_node(state: EchoOpportunityState) -> dict:
    product = state["product"]

    # 1. Persist the product and create the REAL trackable link + UPI page,
    #    reusing your existing /r/{id} and /p/{id} machinery.
    db = SessionLocal()
    try:
        row = Product(
            opportunity_run_id=state["run_id"],
            name=product.get("product_name", "Untitled product"),
            description=product.get("description", ""),
            price_inr=int(product.get("pricing") or 0),
            listing_copy=product.get("description", ""),
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        tracked_link = link_tool.create_tracked_link(db, row.id)
        upi_deep_link = checkout_tool.build_upi_deep_link(row.name, row.price_inr)
    finally:
        db.close()

    # 2. Generate the surrounding landing/checkout copy via the LLM/local engine.
    prompt = (
        f"Product: {product.get('product_name')} at ₹{product.get('pricing')}\n"
        f"Features: {', '.join(product.get('feature_list', []))}\n"
        "Write landing page copy, checkout microcopy, a single strong CTA "
        "label, and a short list of marketing assets to prepare."
    )
    copy_result = await call_structured(
        system_prompt="You are Echo's Execution agent, preparing launch-ready assets.",
        user_prompt=prompt,
        schema_hint=EXECUTION_SCHEMA,
    )

    return {
        "execution": {
            **copy_result,
            "product_id": row.id,
            "tracked_link": tracked_link,
            "upi_deep_link": upi_deep_link,
        }
    }
