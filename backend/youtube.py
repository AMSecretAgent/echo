"""
Real YouTube integration via the YouTube Data API v3.

Unlike Instagram, this needs only a free API key (no OAuth, no business account,
no tunnel) and works on ANY public video — paste a creator's video URL and Echo
pulls their real comments.

Setup (2 minutes, free, no card):
  1. Go to https://console.cloud.google.com → create/select a project.
  2. APIs & Services → Library → enable "YouTube Data API v3".
  3. APIs & Services → Credentials → Create credentials → API key.
  4. Put it in backend/.env as YOUTUBE_API_KEY=...
Free quota is 10,000 units/day; each comment page costs 1 unit.
"""
import os
import re
import json
import urllib.request
import urllib.parse

API_KEY = os.getenv("YOUTUBE_API_KEY", "")


def configured():
    return bool(API_KEY)


def _get(url):
    with urllib.request.urlopen(url, timeout=25) as r:
        return json.loads(r.read().decode())


def video_id(url):
    url = (url or "").strip()
    m = re.search(r"(?:v=|/shorts/|youtu\.be/|/embed/|/live/)([A-Za-z0-9_-]{11})", url)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url):  # raw id
        return url
    return None


def _fmt(n):
    try:
        n = int(n)
        if n >= 1_000_000:
            return f"{n/1_000_000:.1f}M"
        if n >= 1000:
            return f"{n/1000:.1f}K"
        return str(n)
    except Exception:
        return "—"


def _channel_info(vid):
    try:
        v = _get("https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode({
            "part": "snippet", "id": vid, "key": API_KEY}))
        items = v.get("items", [])
        if not items:
            return None
        ch_id = items[0]["snippet"].get("channelId")
        ch = _get("https://www.googleapis.com/youtube/v3/channels?" + urllib.parse.urlencode({
            "part": "snippet,statistics", "id": ch_id, "key": API_KEY}))
        c = (ch.get("items") or [{}])[0]
        csn, stats = c.get("snippet", {}), c.get("statistics", {})
        thumb = (csn.get("thumbnails", {}).get("default", {}) or {}).get("url")
        return {
            "handle": csn.get("title", "creator"),
            "name": csn.get("title", "creator"),
            "followers": _fmt(stats.get("subscriberCount")),
            "posts": _fmt(stats.get("videoCount")),
            "bio": (csn.get("description", "") or "").replace("\n", " ")[:90],
            "avatar": thumb,
        }
    except Exception:
        return None


def fetch_comments(url, max_comments=200):
    vid = video_id(url)
    if not vid:
        raise ValueError("bad_url")
    out, page = [], None
    while len(out) < max_comments:
        params = {
            "part": "snippet",
            "videoId": vid,
            "maxResults": "100",
            "textFormat": "plainText",
            "order": "relevance",
            "key": API_KEY,
        }
        if page:
            params["pageToken"] = page
        data = _get("https://www.googleapis.com/youtube/v3/commentThreads?" + urllib.parse.urlencode(params))
        for item in data.get("items", []):
            sn = item["snippet"]["topLevelComment"]["snippet"]
            text = sn.get("textOriginal") or sn.get("textDisplay", "")
            if not text:
                continue
            out.append({
                "u": (sn.get("authorDisplayName", "fan") or "fan").lstrip("@"),
                "t": text,
                "time": "",
                "likes": sn.get("likeCount", 0),
            })
            if len(out) >= max_comments:
                break
        page = data.get("nextPageToken")
        if not page:
            break
    return {"comments": out, "video_id": vid, "account": _channel_info(vid)}
