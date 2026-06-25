# Echo

**Your fans already told you what to sell. We just listened.**

Echo reads a creator's messy, multilingual comments and DMs, throws out the spam /
scams / trolls, clusters what fans actually keep asking to **buy**, proves it with
their own words (*receipts*), and turns the top signal into a ready-to-sell product
with a price, listing copy, a **real trackable link**, and a UPI checkout page.
A disclosed AI **Clone** then replies to the fans who asked — in their own language.



---

## The loop

```
Listen  ->  Detect demand  ->  Sell  ->  Clone
comments    filter noise +     product +   in-language,
& DMs       cluster + rank     ₹price +    disclosed
            (with receipts)    link        auto-replies
```

## Stack

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** FastAPI + SQLite (`backend/`)
- **Intelligence:** any OpenAI-compatible LLM — **xAI Grok** (free $25 signup credit),
  **Google Gemini** (free tier), OpenAI, or local — set via env. Built-in **local fallback**
  runs with **no key at all** (screenshots need a real key).

## What actually works (not mocked)

- Noise filtering + demand clustering with a signal-vs-noise breakdown
- Verbatim **receipts** under each demand cluster
- Product generation: name, format, ₹ price, listing copy, "why it sells"
- **Trackable links that really track** — `/r/{id}` records each click in SQLite
- A live **UPI buyer page** at `/p/{id}` with a working `upi://pay` deep link
- Live click/view counter in the dashboard (`/api/stats/{id}`)
- Import real comments from a `.txt` / `.csv`
- Disclosed, in-language Clone replies

---

## Getting comments into Echo (4 ways)

1. **Connect Instagram (real API)** — click *Connect Instagram account* in the app. The
   creator logs in and Echo pulls the **real comments** off their recent posts via the
   Instagram Graph API. Only works for **Business/Creator** accounts that connect — it's
   not a scraper. Needs the `INSTAGRAM_*` values in `.env` (see below).
2. **Read a screenshot (◳)** — drop a screenshot of any comments section; Echo's vision
   reads the usernames + comments off the image. Works on any account you can see. Needs
   `ANTHROPIC_API_KEY`.
3. **Import a file (⤴)** — a `.txt` or `.csv` export, one comment per line.
4. **Paste (＋)** — paste comments straight in.

> For a live demo, drive with **screenshot or paste** (zero auth risk) and show the
> **Connect** button as the production path.

### Instagram API setup (optional, for path 1)

1. Create an app at https://developers.facebook.com and add the **Instagram** product.
2. Switch the target Instagram account to a **Business or Creator** account (free, in IG app settings).
3. Add that account as a **tester / role** on your app — this lets it work **without full App Review**.
4. Put the Instagram **App ID**, **App Secret**, and **redirect URI** in `backend/.env`.
5. Instagram requires an **https** redirect, so for local dev run a tunnel (e.g. `ngrok http 8000`)
   and set `INSTAGRAM_REDIRECT_URI=https://<tunnel>/api/instagram/callback` (match it on the dashboard).

## Run it (dev — two terminals)

**1. Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # optional: add ANTHROPIC_API_KEY for live LLM
uvicorn main:app --reload --port 8000
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :8000)
```

Open http://localhost:5173 and hit **Listen to my audience**.

> No key? It still works — the backend uses a local keyword engine and shows
> "Local engine" in the header. Add `LLM_API_KEY` (e.g. a free Grok key) to `.env`
> to switch the header to "LLM live". See `.env.example` for Grok/Gemini settings.

## Run it (single process — for deploy/demo)

```bash
cd frontend && npm install && npm run build     # creates frontend/dist
cd ../backend && uvicorn main:app --port 8000   # also serves the built UI at /
```
Then everything (UI, API, links, buyer pages) is on `http://localhost:8000`.

## The 60-second demo

1. The feed is a *real* comment section — spam, scams, "first 🎉", trolls, plus real requests.
2. Hit **Listen**. Watch the junk dim out and demand surface, each with receipts.
3. Open the receipts on the top cluster — "these are the fans' own words."
4. **Turn this into a product** → name, ₹ price, listing.
5. **Copy the trackable link**, open it in a new tab → land on the UPI buyer page →
   come back and watch the **click counter tick up live**.
6. **Let the Clone reply** → see the dumb-bot vs Echo contrast, then real in-language replies.

## Config (all optional — see `backend/.env.example`)

| Variable | What it does |
|---|---|
| `LLM_API_KEY` | Your provider key (Grok/Gemini/OpenAI). Blank = local fallback. |
| `LLM_BASE_URL` / `LLM_MODEL` | Point at Grok (default), Gemini, OpenAI, or local. |
| `ECHO_UPI_VPA` | The UPI id the buyer page pays to. |
| `ECHO_CREATOR_NAME` | Name shown on the buyer page. |
| `ECHO_PUBLIC_BASE` | Public URL for links in production. |

## Roadmap->

- OCR ingestion for DM screenshots (Tesseract) — stubbed by the upload endpoint today
- Embeddings-based clustering for scale beyond a single LLM pass
- Razorpay/Stripe for hosted checkout + payouts (UPI deep link is the zero-setup version)
- Creator auth + a real owned-buyer CRM (the flywheel)
