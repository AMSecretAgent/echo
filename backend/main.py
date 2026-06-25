"""
Echo API — FastAPI backend.

Run:  uvicorn main:app --reload --port 8000
Works with or without ANTHROPIC_API_KEY (falls back to local analysis).
"""
import os
import io
import csv
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import llm
import db
import instagram
import youtube

PUBLIC_BASE = os.getenv("ECHO_PUBLIC_BASE", "")          # e.g. https://echo.example.com
DEFAULT_VPA = os.getenv("ECHO_UPI_VPA", "creator@upi")   # the creator's UPI id
CREATOR_NAME = os.getenv("ECHO_CREATOR_NAME", "Aarohi")
FRONTEND_URL = os.getenv("ECHO_FRONTEND_URL", "http://localhost:5173")

# latest comments pulled from a connected Instagram account (single-session demo store)
LATEST_IG = {"comments": [], "account": None}

app = FastAPI(title="Echo API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
db.init()


# ----------------------------------------------------------------- models
class Comment(BaseModel):
    t: str


class AnalyzeIn(BaseModel):
    comments: List[str]
    niche: str = "creator"


class GenerateIn(BaseModel):
    cluster: dict
    niche: str = "creator"
    is_seller: bool = False
    reach: dict = {}


class CloneIn(BaseModel):
    offer: dict
    link: Optional[str] = ""
    receipts: List[str]
    handle: str = "@creator"


# ----------------------------------------------------------------- helpers
def base_url(request: Request) -> str:
    if PUBLIC_BASE:
        return PUBLIC_BASE.rstrip("/")
    return str(request.base_url).rstrip("/")


def upi_link(vpa, name, amount, note):
    q = urllib.parse.urlencode(
        {"pa": vpa, "pn": name, "am": amount, "cu": "INR", "tn": note})
    return f"upi://pay?{q}"


# ----------------------------------------------------------------- api
@app.get("/healthz")
def healthz():
    return {"ok": True, "llm": llm.llm_enabled, "model": llm.DEFAULT_MODEL}


@app.post("/api/analyze")
def api_analyze(body: AnalyzeIn):
    # Scan the FULL pool cheaply, then spend LLM tokens only on the demand.
    raw = [c.strip()[:240] for c in body.comments if c and c.strip()]
    total = len(raw)
    labels = llm.quick_labels(raw)                       # full-pool, no LLM cost
    pairs = list(zip(raw, labels))
    candidates = [c for c, l in pairs if l in ("buy", "create")]
    others = [c for c, l in pairs if l not in ("buy", "create")]
    # concentrate the demand (+ a little context) into a token-bounded sample for the LLM
    sample = candidates[:38] + others[:8]
    if not sample:
        sample = raw[:40]

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_clusters = ex.submit(llm.analyze, sample, body.niche)
        f_pulse = ex.submit(llm.audience_pulse, sample)
        try:
            result = f_clusters.result()
        except Exception as e:  # noqa
            print("[echo] analyze hard-failed, using local:", e)
            result = llm._analyze_local(sample)
        try:
            result["pulse"] = f_pulse.result()
        except Exception:  # noqa
            result["pulse"] = None

    # full-pool labels + scan stats drive the feed tags, the intent rate, and the noise count
    demand = sum(1 for lab in labels if lab in ("buy", "create"))
    noise_n = sum(1 for lab in labels if lab == "noise")
    examples = []
    for c, lab in pairs:
        if lab == "noise" and len(examples) < 4:
            examples.append({"text": c, "reason": llm._is_noise(c) or "Low-effort"})
    result["labels"] = labels
    result["noise"] = {"count": noise_n, "examples": examples}
    result["scan"] = {"total": total, "demand": demand, "noise": noise_n,
                      "intent_rate": round(100 * demand / total) if total else 0}
    return result


@app.post("/api/generate")
def api_generate(body: GenerateIn, request: Request):
    offer = llm.generate(body.cluster, body.niche, body.is_seller, body.reach)
    kind = (offer.get("kind") or "product").lower()
    wants_to_pay = bool(body.cluster.get("wants_to_pay"))
    # a real checkout link is only created for the creator's OWN product, and only when the
    # creator actually sells (seller mode) or the fans explicitly offered to pay.
    sell_enabled = kind == "product" and (body.is_seller or wants_to_pay)
    link = None
    if sell_enabled:
        lid = db.create_link(
            creator=CREATOR_NAME,
            product=offer.get("name", "Product"),
            price=int(offer.get("price_inr", 199) or 199),
            description=offer.get("description", ""),
            vpa=DEFAULT_VPA,
        )
        link = {"id": lid, "url": f"{base_url(request)}/r/{lid}"}
    return {"offer": offer, "link": link, "sell_enabled": sell_enabled}


@app.post("/api/clone")
def api_clone(body: CloneIn):
    return llm.clone(body.offer, body.link or "", body.receipts, body.handle)


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    raw = (await file.read()).decode("utf-8", errors="ignore")
    comments = []
    if file.filename and file.filename.lower().endswith(".csv"):
        for row in csv.reader(io.StringIO(raw)):
            for cell in row:
                if cell.strip():
                    comments.append(cell.strip())
    else:
        comments = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    return {"comments": comments[:300]}


@app.get("/api/stats/{lid}")
def api_stats(lid: str):
    return db.stats(lid)


# ----------------------------------------------------------------- outreach tracker
class PitchIn(BaseModel):
    brand: str
    product: str = ""


class PitchUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


@app.get("/api/pitches")
def api_pitches():
    return {"pitches": db.list_pitches()}


@app.post("/api/pitches")
def api_add_pitch(body: PitchIn):
    db.add_pitch(body.brand, body.product)
    return {"pitches": db.list_pitches()}


@app.post("/api/pitches/{pid}")
def api_update_pitch(pid: int, body: PitchUpdate):
    db.update_pitch(pid, body.status, body.notes)
    return {"pitches": db.list_pitches()}


@app.delete("/api/pitches/{pid}")
def api_delete_pitch(pid: int):
    db.delete_pitch(pid)
    return {"pitches": db.list_pitches()}


# ----------------------------------------------------------------- screenshot (vision)
@app.post("/api/screenshot")
async def api_screenshot(file: UploadFile = File(...)):
    if not llm.llm_enabled:
        return JSONResponse(
            {"error": "Reading screenshots needs a real model — set ANTHROPIC_API_KEY in backend/.env."},
            status_code=400)
    raw = await file.read()
    mt = file.content_type or "image/png"
    try:
        out = llm.read_screenshot(raw, mt)
        return {"comments": out.get("comments", [])}
    except Exception as e:  # noqa
        print("[echo] screenshot read failed:", e)
        return JSONResponse({"error": "Couldn't read that screenshot. Try a clearer, full-res image."},
                            status_code=500)


# ----------------------------------------------------------------- real Instagram connect
@app.get("/api/instagram/login")
def ig_login():
    if not instagram.configured():
        return JSONResponse(
            {"error": "Instagram app isn't configured. Add INSTAGRAM_APP_ID / SECRET / REDIRECT_URI to backend/.env"},
            status_code=400)
    return RedirectResponse(instagram.auth_url())


@app.get("/api/instagram/callback")
def ig_callback(code: str = "", error: str = "", error_description: str = ""):
    if error or not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/?ig=error")
    try:
        token, _uid = instagram.exchange_code(code)
        token = instagram.long_lived(token)
        data = instagram.fetch_comments(token)
        LATEST_IG["comments"] = data["comments"]
        LATEST_IG["account"] = data.get("account")
        return RedirectResponse(url=f"{FRONTEND_URL}/?ig=connected")
    except Exception as e:  # noqa
        print("[echo] instagram callback error:", e)
        return RedirectResponse(url=f"{FRONTEND_URL}/?ig=error")


@app.get("/api/instagram/comments")
def ig_get_comments():
    return LATEST_IG


# ----------------------------------------------------------------- real YouTube connect
class YoutubeIn(BaseModel):
    url: str


@app.post("/api/youtube")
def api_youtube(body: YoutubeIn):
    if not youtube.configured():
        return JSONResponse(
            {"error": "YouTube isn't configured. Add YOUTUBE_API_KEY to backend/.env"},
            status_code=400)
    try:
        return youtube.fetch_comments(body.url)
    except ValueError:
        return JSONResponse({"error": "Couldn't read that as a YouTube link — paste a full video URL."},
                            status_code=400)
    except Exception as e:  # noqa
        print("[echo] youtube error:", e)
        return JSONResponse(
            {"error": "Couldn't fetch comments (video may have comments off, or the key/quota is invalid)."},
            status_code=502)


# ----------------------------------------------------------------- real link funnel
@app.get("/r/{lid}")
def redirect(lid: str):
    """The trackable link. Records a click, then sends the fan to the product page."""
    link = db.get_link(lid)
    if not link:
        return JSONResponse({"error": "link not found"}, status_code=404)
    db.record(lid, "clicks")
    return RedirectResponse(url=f"/p/{lid}", status_code=302)


@app.get("/p/{lid}", response_class=HTMLResponse)
def product_page(lid: str):
    link = db.get_link(lid)
    if not link:
        return HTMLResponse("<h1>Link not found</h1>", status_code=404)
    db.record(lid, "views")
    pay = upi_link(link["vpa"], link["creator"], link["price"], link["product"])
    return f"""<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>{link['product']}</title>
<style>
 body{{margin:0;font-family:system-ui,sans-serif;background:#0C0A12;color:#F3EFFA;
   display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}}
 .card{{max-width:380px;width:100%;background:#15121E;border:1px solid #2A2438;
   border-radius:20px;padding:26px}}
 .eyebrow{{color:#54E0C7;font-size:12px;letter-spacing:.12em;text-transform:uppercase}}
 h1{{font-size:26px;margin:10px 0 6px;line-height:1.2}}
 p{{color:#9C93AE;font-size:14px;line-height:1.6}}
 .price{{font-size:32px;font-weight:700;color:#FFA51F;margin:16px 0}}
 a.btn{{display:block;text-align:center;background:#FFA51F;color:#1a1206;text-decoration:none;
   padding:14px;border-radius:13px;font-weight:700;margin-top:8px}}
 small{{display:block;color:#6E667E;margin-top:14px;font-size:11px}}
</style></head><body>
 <div class=card>
   <div class=eyebrow>by {link['creator']} · powered by Echo</div>
   <h1>{link['product']}</h1>
   <p>{link['description']}</p>
   <div class=price>&#8377;{link['price']}</div>
   <a class=btn href="{pay}">Pay &#8377;{link['price']} via UPI</a>
   <small>Opens GPay / PhonePe / any UPI app. Every visit to this link is attributed to {link['creator']}.</small>
 </div>
</body></html>"""


# ----------------------------------------------------------------- serve built frontend (prod)
_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
