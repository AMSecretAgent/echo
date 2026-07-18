"""
SQLAlchemy models for Echo.

`Product` / `TrackedLink` / `LinkClick` reconstruct the shape implied by your
README (trackable /r/{id} links, a UPI /p/{id} buyer page, a live click
counter at /api/stats/{id}). If your real schema differs, keep yours and
just make sure `AgentRun.output_json` for the execution agent references
your real product/link primary keys instead of duplicating them.

`OpportunityRun` / `AgentRun` / `OpportunityReport` are new and additive.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from db.session import Base


def new_id() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Existing-style Echo tables (reconstructed from README; replace with yours)
# ---------------------------------------------------------------------------

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=new_id)
    opportunity_run_id = Column(String, ForeignKey("opportunity_runs.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    price_inr = Column(Integer)
    listing_copy = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrackedLink(Base):
    __tablename__ = "tracked_links"

    id = Column(String, primary_key=True, default=new_id)  # this is the {id} in /r/{id}
    product_id = Column(String, ForeignKey("products.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class LinkClick(Base):
    __tablename__ = "link_clicks"

    id = Column(String, primary_key=True, default=new_id)
    link_id = Column(String, ForeignKey("tracked_links.id"))
    clicked_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# New: multi-agent run tracking
# ---------------------------------------------------------------------------

class OpportunityRun(Base):
    __tablename__ = "opportunity_runs"

    id = Column(String, primary_key=True, default=new_id)
    creator_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="running")  # running|done|failed|needs_review
    opportunity_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    agent_runs = relationship("AgentRun", back_populates="opportunity_run")
    report = relationship("OpportunityReport", uselist=False, back_populates="opportunity_run")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, default=new_id)
    opportunity_run_id = Column(String, ForeignKey("opportunity_runs.id"))
    agent_name = Column(String, nullable=False)
    attempt = Column(Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default="pending")  # pending|running|done|failed
    input_json = Column(Text)
    output_json = Column(Text)
    confidence = Column(Float, nullable=True)
    reasoning_log = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    opportunity_run = relationship("OpportunityRun", back_populates="agent_runs")


class OpportunityReport(Base):
    __tablename__ = "opportunity_reports"

    opportunity_run_id = Column(String, ForeignKey("opportunity_runs.id"), primary_key=True)
    demand_summary = Column(Text)
    market_validation = Column(Text)
    product_blueprint = Column(Text)   # JSON string
    revenue_model = Column(Text)        # JSON string
    launch_plan = Column(Text)           # JSON string
    execution_assets = Column(Text)      # JSON string
    recommended_next_action = Column(Text)

    opportunity_run = relationship("OpportunityRun", back_populates="report")
