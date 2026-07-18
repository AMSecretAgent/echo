import json
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import OpportunityRun, OpportunityReport

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])


class StartOpportunityRequest(BaseModel):
    signals: List[str]           # same shape as your existing /api/listen payload
    creator_id: str | None = None


class StartOpportunityResponse(BaseModel):
    run_id: str


@router.post("", response_model=StartOpportunityResponse)
def start_opportunity(payload: StartOpportunityRequest, db: Session = Depends(get_db)):
    if not payload.signals:
        raise HTTPException(400, "signals must not be empty")

    run = OpportunityRun(id=uuid.uuid4().hex, creator_id=payload.creator_id, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    # Stash the raw signals on disk keyed by run_id so the SSE route (which
    # opens its own DB session per your existing pattern) can load them.
    _pending_signals[run.id] = payload.signals

    return StartOpportunityResponse(run_id=run.id)


# Simple in-memory hand-off between POST (create run) and GET (stream run).
# Fine for a single-process hackathon deploy; swap for Redis/DB-backed queue
# if you run multiple workers.
_pending_signals: dict[str, List[str]] = {}


def pop_pending_signals(run_id: str) -> List[str]:
    return _pending_signals.pop(run_id, [])


@router.get("/{run_id}")
def get_opportunity(run_id: str, db: Session = Depends(get_db)):
    run = db.get(OpportunityRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")

    report = db.get(OpportunityReport, run_id)
    return {
        "run_id": run.id,
        "status": run.status,
        "opportunity_score": run.opportunity_score,
        "created_at": run.created_at,
        "completed_at": run.completed_at,
        "report": None if not report else {
            "demand_summary": report.demand_summary,
            "market_validation": report.market_validation,
            "product_blueprint": json.loads(report.product_blueprint or "{}"),
            "revenue_model": json.loads(report.revenue_model or "{}"),
            "launch_plan": json.loads(report.launch_plan or "{}"),
            "execution_assets": json.loads(report.execution_assets or "{}"),
            "recommended_next_action": report.recommended_next_action,
        },
    }
