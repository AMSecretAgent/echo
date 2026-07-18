"""
Wraps your existing trackable-link generator.

REPLACE this with a call into your real link-creation code if it already
exists — the important contract is: given a product_id, return a full,
working /r/{id} URL that increments a click counter when visited.
"""
import os

from sqlalchemy.orm import Session

from db.models import TrackedLink

PUBLIC_BASE = os.getenv("ECHO_PUBLIC_BASE", "http://localhost:8000").rstrip("/")


def create_tracked_link(db: Session, product_id: str) -> str:
    link = TrackedLink(product_id=product_id)
    db.add(link)
    db.commit()
    db.refresh(link)
    return f"{PUBLIC_BASE}/r/{link.id}"
