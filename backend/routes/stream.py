import json
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.session import SessionLocal
from db.models import AgentRun, OpportunityRun, OpportunityReport
from agents.graph import echo_graph
from routes.opportunities import pop_pending_signals

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])

# Order matters for computing a simple opportunity score at the end.
SCORE_WEIGHTS = {
    "demand": 0.25,   # from demand.confidence (0-1)
    "market": 0.35,   # from market.market_score (0-100)
    "revenue": 0.20,  # flat credit if a revenue model was produced
    "launch": 0.10,   # flat credit if launch assets were produced
    "execution": 0.10,  # flat credit if a real link/checkout was created
}


def compute_opportunity_score(state: dict) -> int:
    demand_part = (state.get("demand", {}) or {}).get("confidence", 0) * 100 * SCORE_WEIGHTS["demand"]
    market_part = (state.get("market", {}) or {}).get("market_score", 0) * SCORE_WEIGHTS["market"]
    revenue_part = 100 * SCORE_WEIGHTS["revenue"] if state.get("revenue") else 0
    launch_part = 100 * SCORE_WEIGHTS["launch"] if state.get("launch") else 0
    execution_part = 100 * SCORE_WEIGHTS["execution"] if state.get("execution") else 0
    return round(demand_part + market_part + revenue_part + launch_part + execution_part)


@router.get("/{run_id}/stream")
async def stream_opportunity(run_id: str):
    signals = pop_pending_signals(run_id)

    async def event_gen():
        db: Session = SessionLocal()
        final_state: dict = {"run_id": run_id, "raw_signals": signals}
        try:
            async for update in echo_graph.astream(final_state, stream_mode="updates"):
                for node_name, partial in update.items():
                    final_state.update(partial)

                    agent_row = AgentRun(
                        opportunity_run_id=run_id,
                        agent_name=node_name,
                        attempt=partial.get(f"{node_name}_retries", 1) if isinstance(partial, dict) else 1,
                        status="done",
                        output_json=json.dumps(partial, default=str),
                        confidence=(partial.get("demand", {}) or {}).get("confidence")
                        if node_name == "demand_discovery" else None,
                        started_at=datetime.utcnow(),
                        finished_at=datetime.utcnow(),
                    )
                    db.add(agent_row)
                    db.commit()

                    yield f"data: {json.dumps({'agent': node_name, 'output': partial}, default=str)}\n\n"

            score = compute_opportunity_score(final_state)

            run = db.get(OpportunityRun, run_id)
            run.status = "done"
            run.opportunity_score = score
            run.completed_at = datetime.utcnow()

            report = OpportunityReport(
                opportunity_run_id=run_id,
                demand_summary=json.dumps(final_state.get("demand")),
                market_validation=json.dumps(final_state.get("market")),
                product_blueprint=json.dumps(final_state.get("product")),
                revenue_model=json.dumps(final_state.get("revenue")),
                launch_plan=json.dumps(final_state.get("launch")),
                execution_assets=json.dumps(final_state.get("execution")),
                recommended_next_action=_recommend_next_action(final_state, score),
            )
            db.merge(report)
            db.commit()

            yield f"data: {json.dumps({'status': 'done', 'opportunity_score': score})}\n\n"
        except Exception as exc:  # keep the stream from dying silently mid-demo
            run = db.get(OpportunityRun, run_id)
            if run:
                run.status = "failed"
                db.commit()
            yield f"data: {json.dumps({'status': 'failed', 'error': str(exc)})}\n\n"
        finally:
            db.close()

    return StreamingResponse(event_gen(), media_type="text/event-stream")


def _recommend_next_action(state: dict, score: int) -> str:
    if score >= 75:
        return "Strong signal — publish the launch posts and share the checkout link today."
    if score >= 50:
        return "Promising — soft-launch to your top-engaged fans first, then widen."
    return "Weak signal — gather more comments/DMs before committing to build."
