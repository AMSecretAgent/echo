"""
Reconstructed from your README's described behavior:
  - /r/{id}      records a click, then redirects/serves the buyer page
  - /p/{id}      the UPI buyer page with a working upi://pay deep link
  - /api/stats/{id}  live click/view counter for the dashboard

If you already have these exact routes in your real main.py, DELETE this
file and keep yours — don't run both, or /r/{id} will double-count clicks.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from db.session import SessionLocal
from db.models import TrackedLink, LinkClick, Product
from tools.checkout_tool import build_upi_deep_link

router = APIRouter(tags=["links"])


@router.get("/r/{link_id}")
def record_click_and_redirect(link_id: str):
    db: Session = SessionLocal()
    try:
        link = db.get(TrackedLink, link_id)
        if not link:
            raise HTTPException(404, "link not found")
        db.add(LinkClick(link_id=link_id))
        db.commit()
        return RedirectResponse(url=f"/p/{link.product_id}")
    finally:
        db.close()


@router.get("/p/{product_id}", response_class=HTMLResponse)
def buyer_page(product_id: str):
    db: Session = SessionLocal()
    try:
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(404, "product not found")
        upi_link = build_upi_deep_link(product.name, product.price_inr)
        return f"""
        <html>
          <head><title>{product.name}</title></head>
          <body style="font-family: sans-serif; max-width: 480px; margin: 40px auto;">
            <h1>{product.name}</h1>
            <p>{product.description}</p>
            <p style="font-size: 1.5rem; font-weight: bold;">₹{product.price_inr}</p>
            <a href="{upi_link}" style="display:inline-block;padding:12px 20px;
               background:#111;color:#fff;border-radius:8px;text-decoration:none;">
              Pay with UPI
            </a>
          </body>
        </html>
        """
    finally:
        db.close()


@router.get("/api/stats/{product_id}")
def stats(product_id: str):
    db: Session = SessionLocal()
    try:
        links = db.query(TrackedLink).filter(TrackedLink.product_id == product_id).all()
        link_ids = [l.id for l in links]
        clicks = db.query(LinkClick).filter(LinkClick.link_id.in_(link_ids)).count() if link_ids else 0
        return {"product_id": product_id, "clicks": clicks, "links": len(links)}
    finally:
        db.close()
