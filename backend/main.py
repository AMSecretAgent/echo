import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from db.session import Base, engine
from routes import opportunities, stream, links

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Echo — AI Venture Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(opportunities.router)
app.include_router(stream.router)
app.include_router(links.router)

# --- keep any of your existing routes here (Instagram OAuth, /api/listen, etc.) ---
# from routes import instagram
# app.include_router(instagram.router)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_live": bool(os.getenv("LLM_API_KEY"))}
