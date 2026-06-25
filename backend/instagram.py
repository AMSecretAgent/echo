"""
Real Instagram integration using the Instagram API with Instagram Login.

This pulls REAL comments from an Instagram **Business/Creator** account that logs in
and authorizes the app. It is NOT a scraper — it only works for accounts that connect.

Setup (one time):
  1. Create an app at https://developers.facebook.com → add "Instagram" product.
  2. Switch the target Instagram account to a Business or Creator account (free, in IG settings).
  3. Add that account as a tester/role on the app so it works WITHOUT full App Review.
  4. Put the app's Instagram App ID + Secret + redirect URI in backend/.env.
  5. The redirect URI must exactly match what you register on the app dashboard.
     For local dev, Instagram needs an https URL — use a tunnel (e.g. ngrok) and set
     INSTAGRAM_REDIRECT_URI to https://<tunnel>/api/instagram/callback.

Docs: https://developers.facebook.com/docs/instagram-platform/
"""
import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone

APP_ID = os.getenv("INSTAGRAM_APP_ID", "")
APP_SECRET = os.getenv("INSTAGRAM_APP_SECRET", "")
REDIRECT = os.getenv("INSTAGRAM_REDIRECT_URI", "http://localhost:8000/api/instagram/callback")
SCOPES = "instagram_business_basic,instagram_business_manage_comments"


def configured():
    return bool(APP_ID and APP_SECRET and REDIRECT)


def _get(url):
    with urllib.request.urlopen(url, timeout=25) as r:
        return json.loads(r.read().decode())


def _post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())


def auth_url():
    params = urllib.parse.urlencode({
        "client_id": APP_ID,
        "redirect_uri": REDIRECT,
        "scope": SCOPES,
        "response_type": "code",
    })
    return "https://www.instagram.com/oauth/authorize?" + params


def exchange_code(code):
    out = _post("https://api.instagram.com/oauth/access_token", {
        "client_id": APP_ID,
        "client_secret": APP_SECRET,
        "grant_type": "authorization_code",
        "redirect_uri": REDIRECT,
        "code": code,
    })
    return out["access_token"], out.get("user_id")


def long_lived(short_token):
    try:
        out = _get("https://graph.instagram.com/access_token?" + urllib.parse.urlencode({
            "grant_type": "ig_exchange_token",
            "client_secret": APP_SECRET,
            "access_token": short_token,
        }))
        return out.get("access_token", short_token)
    except Exception:
        return short_token


def _ago(ts):
    if not ts:
        return ""
    try:
        # Instagram timestamps look like 2026-06-18T12:00:00+0000
        t = datetime.strptime(ts.replace("+0000", "+00:00"), "%Y-%m-%dT%H:%M:%S%z")
        delta = datetime.now(timezone.utc) - t
        s = int(delta.total_seconds())
        if s < 3600:
            return f"{max(s // 60, 1)}m"
        if s < 86400:
            return f"{s // 3600}h"
        return f"{s // 86400}d"
    except Exception:
        return ""


def fetch_comments(token, max_media=12):
    me = _get("https://graph.instagram.com/me?" + urllib.parse.urlencode({
        "fields": "user_id,username", "access_token": token}))
    handle = me.get("username", "creator")

    media = _get("https://graph.instagram.com/me/media?" + urllib.parse.urlencode({
        "fields": "id,caption", "access_token": token, "limit": str(max_media)}))

    comments = []
    for m in media.get("data", []):
        try:
            cs = _get(f"https://graph.instagram.com/{m['id']}/comments?" + urllib.parse.urlencode({
                "fields": "text,username,timestamp,like_count", "access_token": token}))
            for c in cs.get("data", []):
                if not c.get("text"):
                    continue
                comments.append({
                    "u": c.get("username", "fan"),
                    "t": c.get("text", ""),
                    "time": _ago(c.get("timestamp")),
                    "likes": c.get("like_count", 0),
                })
        except Exception:
            continue
    return {"comments": comments, "account": {"handle": handle}}
