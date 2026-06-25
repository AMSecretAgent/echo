"""
Echo's intelligence layer.

Calls a real LLM (Anthropic) when ANTHROPIC_API_KEY is set. If there is no key,
or the call fails, it falls back to a deterministic local analysis so the product
ALWAYS runs end to end — clone the repo, `uvicorn`, and it works with zero setup.
"""
import os
import re
import json
import base64

try:
    from openai import OpenAI
except Exception:  # package not installed
    OpenAI = None

# Provider-agnostic: speaks the OpenAI chat-completions format, so it works with
# xAI Grok (default), Google Gemini, OpenAI, Groq, or a local server — just set env vars.
#   Grok    : LLM_BASE_URL=https://api.x.ai/v1                         LLM_MODEL=grok-4.1-fast
#   Gemini  : LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/  LLM_MODEL=gemini-2.5-flash
#   OpenAI  : LLM_BASE_URL=https://api.openai.com/v1                   LLM_MODEL=gpt-4.1-mini
BASE_URL = os.getenv("LLM_BASE_URL", "https://api.x.ai/v1")
DEFAULT_MODEL = os.getenv("LLM_MODEL", "grok-4.1-fast")
VISION_MODEL = os.getenv("LLM_VISION_MODEL", DEFAULT_MODEL)
_key = (os.getenv("LLM_API_KEY") or os.getenv("XAI_API_KEY")
        or os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))
_client = OpenAI(api_key=_key, base_url=BASE_URL) if (OpenAI and _key) else None

llm_enabled = _client is not None


def _extract_json(text: str):
    text = re.sub(r"```json|```", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


def _call(system: str, user: str, max_tokens: int = 2000):
    kwargs = dict(
        model=DEFAULT_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    )
    try:
        # JSON mode forces valid JSON on providers that support it (Groq, OpenAI, Gemini...)
        resp = _client.chat.completions.create(response_format={"type": "json_object"}, **kwargs)
    except Exception:
        resp = _client.chat.completions.create(**kwargs)
    return _extract_json(resp.choices[0].message.content)


# ---------------------------------------------------------------- ANALYZE
def analyze(comments, niche):
    """comments: list[str]. Returns {clusters:[...], noise:{count, examples}}."""
    if _client:
        try:
            return _analyze_llm(comments, niche)
        except Exception as e:  # noqa
            print("[echo] analyze fell back to local:", e)
    return _analyze_local(comments)


def _analyze_llm(comments, niche):
    listing = "\n".join(f"{i+1}. {c}" for i, c in enumerate(comments))
    system = (
        "You are Echo, an AI that reads a creator's raw comments and DMs (English, "
        "Hindi, Tamil, Telugu, Hinglish and other Indian languages). Most messages are "
        "noise: spam, self-promo, scams, bots, trolls/abuse, off-topic chatter and "
        "low-effort praise ('first', emojis, 'nice'). Ruthlessly discard the noise and "
        "surface only genuine product-buying intent. Return ONLY valid minified JSON."
    )
    user = (
        f"Creator niche: {niche}.\nRaw comments & DMs:\n{listing}\n\n"
        "Step 1: ignore every spam/self-promo/scam/bot/troll/off-topic/low-effort message.\n"
        "Step 2: cluster the genuine messages by the underlying NEED, not surface wording, and "
        "build the TOP 4 demand signals (most-requested first). For each cluster decide its "
        "intent — exactly one of:\n"
        "  'buy'     = fans want a PRODUCT THE CREATOR USED/FEATURED that belongs to someone "
        "else (another brand): 'which foundation?', 'link to that dress?', 'price of the mic?', "
        "'where did you buy it?'. The creator can't sell this — it is a brand-deal signal.\n"
        "  'content' = fans want the creator to MAKE A VIDEO/REEL/POST about a topic: 'make a "
        "video on X', 'do a GRWM', 'show your routine', 'explain Y'. This is free content, not "
        "a product.\n"
        "  'product' = fans want the creator to CREATE & GIVE a digital good OF THEIR OWN "
        "(planner, notes PDF, preset, Notion template, guide, course): 'sell your notes', 'drop "
        "the planner', 'make a template'.\n"
        "Merge requests with the same underlying need into ONE cluster. For each cluster give: "
        "title (max 6 words), category, intent (buy|content|product), need (short phrase: what "
        "they actually want), brand (for 'buy' ONLY: the specific product/brand they ask about, "
        "e.g. 'your foundation' — else ''), wants_to_pay (true ONLY if a receipt explicitly "
        "offers money: 'I'll pay', 'paid bhi chalega', 'kitne ka', 'take my money'), fan_count "
        "(int), score (0-100), languages (array), receipts (up to 3 EXACT verbatim comment "
        "strings that prove it).\n"
        "CRITIC RULE: only keep a cluster if its receipts EXPLICITLY show that need. Do NOT "
        "infer from a single vague word. Base everything on what THESE comments actually say, "
        "not the creator's niche label. Fewer solid clusters beat many weak ones.\n"
        "Step 3: report noise: count (int) and examples (up to 4 of {text, reason}).\n"
        "Step 4: labels: an array with EXACTLY one label per comment, in the SAME order as the "
        "numbered list above. Each label is one of: 'buy' (wants a product the creator "
        "used/featured), 'create' (wants the creator to make a video OR a product), 'noise' "
        "(spam/self-promo/scam/troll/off-topic/low-effort), 'neutral' (genuine but NOT demand: "
        "appreciation, chit-chat, jokes).\n"
        'Respond as: {"clusters":[{"title":"","category":"","intent":"buy","need":"","brand":"",'
        '"wants_to_pay":false,"fan_count":0,"score":0,"languages":[],"receipts":[]}],'
        '"noise":{"count":0,"examples":[{"text":"","reason":""}]},"labels":["neutral"]}'
    )
    out = _call(system, user, 4096)
    out["clusters"] = [c for c in out.get("clusters", []) if c.get("title")]
    if not out["clusters"]:
        raise ValueError("no clusters")
    return out


# keyword-based local clustering used when no API key is present
_TOPICS = [
    ("Aesthetic Study Planner", "Printable / Digital planner",
     ["planner", "schedule", "timetable", "routine"]),
    ("Notion Student Dashboard", "Notion template",
     ["notion", "template", "dashboard", "organise", "organize"]),
    ("Handwritten Notes Pack", "PDF notes bundle",
     ["notes", "handwriting", "handwritten", "chemistry", "bio", "pdf"]),
    ("NEET / Boards Revision Plan", "PDF guide",
     ["neet", "boards", "revision", "guide", "prep"]),
]
_NOISE = [
    ("first", "Low-effort"), ("nice", "Low-effort"), ("🔥", "Low-effort"),
    ("sub for sub", "Self-promo"), ("check out my", "Self-promo"),
    ("earn", "Scam"), ("giveaway", "Scam"), ("followers", "Spam"),
    ("overrated", "Troll"), ("cringe", "Troll"), ("marry", "Off-topic"),
    ("which phone", "Off-topic"), ("where is this", "Off-topic"), ("asdf", "Bot"),
]


def _is_noise(c):
    low = c.lower()
    for kw, reason in _NOISE:
        if kw in low:
            return reason
    # very short / emoji-only
    if len(re.sub(r"[^a-zA-Z\u0900-\u097F\u0B80-\u0BFF]", "", c)) < 3:
        return "Low-effort"
    return None


# cheap keyword labels over the FULL comment pool — lets us scan hundreds of comments
# and concentrate the LLM on just the demand, instead of blindly capping at 40.
_BUY_KW = ["link", "price", "buy", "order", "cost", "kitne", "kitna", "code", "discount",
           "where to buy", "where can i", "which one", "which shade", "shade", "colour", "color",
           "brand", "kaha milega", "kahan", "name of", "what is the", "send link", "link pls",
           "pls link", "link please", "from where", "kaha se"]
_MAKE_KW = ["make a", "banao", "banaiye", "sell", "drop your", "share your", "drop the",
            "please make", "create a", "template", "planner", "notes", "pdf", "guide", "preset",
            "course", "tutorial", "video on", "do a video", "ek video", "explain", "teach",
            "routine", "share kar", "share pannunga", "i'll pay", "paid bhi"]


def quick_labels(comments):
    """One label per comment (buy|create|noise|neutral), keyword-based, no LLM cost."""
    out = []
    for c in comments:
        if _is_noise(c):
            out.append("noise")
            continue
        low = c.lower()
        if any(k in low for k in _BUY_KW):
            out.append("buy")
        elif any(k in low for k in _MAKE_KW):
            out.append("create")
        else:
            out.append("neutral")
    return out


def _analyze_local(comments):
    noise_examples, noise_count = [], 0
    labels = []
    buckets = {t[0]: {"title": t[0], "category": t[1], "receipts": []} for t in _TOPICS}
    buy_kw = ["link", "price", "buy", "order", "cost", "kitne", "kitna", "code", "discount", "where to buy"]
    pay_kw = ["pay", "paid", "kitne", "kitna", "\u20b9", "take my money", "charge", "kharid", "buy it"]
    for c in comments:
        reason = _is_noise(c)
        if reason:
            noise_count += 1
            labels.append("noise")
            if len(noise_examples) < 4:
                noise_examples.append({"text": c, "reason": reason})
            continue
        low = c.lower()
        if any(k in low for k in buy_kw):
            labels.append("buy")
        elif any(k in low for k in ["make", "banao", "sell", "drop your", "share your"]):
            labels.append("create")
        else:
            labels.append("neutral")
        for title, _cat, kws in _TOPICS:
            if any(k in low for k in kws):
                buckets[title]["receipts"].append(c)
                break
    clusters = []
    for b in buckets.values():
        n = len(b["receipts"])
        if n == 0:
            continue
        recs = b["receipts"][:3]
        wp = any(any(k in r.lower() for k in pay_kw) for r in b["receipts"])
        clusters.append({
            "title": b["title"], "category": b["category"], "fan_count": n,
            "intent": "product", "need": "Fans want you to make this",
            "brand": "", "wants_to_pay": wp,
            "score": min(60 + n * 9, 97), "languages": ["Hinglish", "English", "Tamil"],
            "receipts": recs,
        })
    clusters.sort(key=lambda x: x["fan_count"], reverse=True)
    return {"clusters": clusters[:4],
            "noise": {"count": noise_count, "examples": noise_examples},
            "labels": labels}


# ---------------------------------------------------------------- GENERATE
def generate(cluster, niche, is_seller=False, reach=None):
    reach = reach or {}
    if _client:
        try:
            return _generate_llm(cluster, niche, is_seller, reach)
        except Exception as e:  # noqa
            print("[echo] generate fell back to local:", e)
    return _generate_local(cluster, is_seller, reach)


def _generate_llm(cluster, niche, is_seller, reach):
    intent = (cluster.get("intent") or "product").lower()
    title = cluster.get("title", "this")
    need = cluster.get("need", "")
    fans = cluster.get("fan_count", 0)
    receipts = cluster.get("receipts", [])

    if intent == "buy":
        # Another brand's product — package the demand into a real partnership pitch.
        subs = reach.get("followers") or reach.get("subscribers") or ""
        vids = reach.get("posts") or reach.get("videos") or ""
        rate = reach.get("intent_rate")
        cname = reach.get("name") or reach.get("handle") or "the creator"
        reach_line = ""
        if subs:
            reach_line = f"The creator ({cname}) has {subs} subscribers"
            if vids:
                reach_line += f" across {vids} videos"
            reach_line += "."
        if rate:
            reach_line += (f" {rate}% of the engaged comments are unprompted purchase requests "
                           f"for this product — a strong conversion signal.")
        system = (
            "You are Echo's brand-deal strategist. Fans keep asking a creator about a product "
            "the creator USED in their content — it belongs to ANOTHER brand, so there is "
            "nothing for the creator to sell. Package this proven demand into a real "
            "partnership pitch. The value to the brand is NOT raw sales volume — it is reach + a "
            "pre-validated conversion signal (their exact customers asking by name). At lower "
            "volume, recommend an AFFILIATE deal because the brand pays nothing upfront and only "
            "a commission on real sales, so saying yes is risk-free; recommend a paid "
            "integration only when reach/intent is clearly large. Also identify WHO to pitch: if "
            "a brand is named in the comments use it; otherwise suggest 2-4 real, well-known "
            "brands in this exact category as candidates to approach. Return ONLY valid minified "
            "JSON."
        )
        user = (
            f"Creator niche: {niche}. {fans} fans asked about: {title} — {need}. {reach_line}\n"
            f"Fans' own words: {json.dumps(receipts)}.\n"
            'Return JSON: {"kind":"brand","product":"<the specific product/brand the fans want, '
            'short>","metric":"<one line quantifying the demand as a RATE + reach, not just a raw '
            'count, e.g. \'12% of comments ask for this · 458K subscribers\'>","brands":["<2-4 '
            'real candidate brands to pitch for this product/category; a brand named in the '
            'comments goes first>"],"where_to_pitch":"<one short line on how to reach a brand\'s '
            'partnerships team, e.g. their site collaborations page, partnerships@ email, or '
            'official IG DM>","deal":{"recommended":"<affiliate | paid integration | both>",'
            '"rationale":"<one sentence: why this deal fits, making the brand\'s risk/upside '
            'explicit (e.g. affiliate = pay only on sales)>"},"fan_reply_hint":"<one short line '
            'the assistant can reply to fans with, naming the product>","outreach":{"subject":'
            '"<email subject>","body":"<3-5 sentence pitch TO THE BRAND, first person: lead with '
            'reach + the % of comments that are unprompted requests for their product (proof '
            'their customers convert here), then propose the recommended deal, confident and '
            'concrete>"}}'
        )
        return _call(system, user, 1500)

    if intent == "content":
        system = (
            "You are Echo's content strategist. Fans want the creator to MAKE a video/reel about "
            "a topic. Design the creator's next video straight from that demand — specific, not "
            "generic. Return ONLY valid minified JSON."
        )
        user = (
            f"Creator niche: {niche}. {fans} fans asked for: {title} — {need}.\n"
            f"Fans' own words: {json.dumps(receipts)}.\n"
            'Return JSON: {"kind":"video","title":"<punchy video title, max 8 words>","hook":'
            '"<the opening line/hook for the video>","outline":["3-5 beats to cover, each a short '
            'phrase"],"why_it_works":"<one sentence: why this performs, referencing the fan '
            'demand>"}'
        )
        return _call(system, user, 1300)

    # product — the creator's OWN digital good
    sell_note = (
        "The creator sells their own products, so frame this as a real paid offer with a "
        "realistic INR price (99-499)."
        if is_seller else
        "Frame this as something the creator can CREATE for the fans who asked — do NOT hard-sell "
        "it. Still suggest a fair INR price (99-499) in case they later choose to sell it."
    )
    system = (
        "You are Echo's product strategist for creators. Fans want the creator to make a digital "
        "product of their own (planner, notes, preset, template, guide, course). " + sell_note +
        " Return ONLY valid minified JSON."
    )
    user = (
        f"Creator niche: {niche}. {fans} fans asked for: {title} — {need}.\n"
        f"Fans' own words: {json.dumps(receipts)}.\n"
        'Generate JSON: {"kind":"product","name":"","format":"","price_inr":0,"tagline":"one '
        'line","description":"2 sentences","listing_copy":["b1","b2","b3"],"why_it_sells":"1 '
        'sentence referencing the fan demand"}'
    )
    return _call(system, user, 1500)


def _generate_local(cluster, is_seller=False, reach=None):
    reach = reach or {}
    intent = (cluster.get("intent") or "product").lower()
    fans = cluster.get("fan_count", 0)
    title = cluster.get("title", "this")
    cat = cluster.get("category", "creator")

    if intent == "buy":
        subs = reach.get("followers") or reach.get("subscribers") or ""
        rate = reach.get("intent_rate")
        cname = reach.get("name") or reach.get("handle") or "I"
        reach_bit = f" My channel has {subs} subscribers" if subs else ""
        rate_bit = f", and {rate}% of the comments are unprompted requests for your product" if rate else ""
        metric = (f"{rate}% of comments ask for this" + (f" · {subs} subscribers" if subs else "")) if rate \
            else f"{fans} fans asked about {title} in your comments"
        return {
            "kind": "brand", "product": title,
            "metric": metric,
            "brands": [title],
            "where_to_pitch": ("Reach their partnerships team via the brand's site "
                               "'collaborations' page, a partnerships@ email, or their official "
                               "Instagram DM."),
            "deal": {"recommended": "affiliate",
                     "rationale": "Affiliate is risk-free for the brand — they pay only a "
                                  "commission on real sales — so it's an easy yes even before "
                                  "the volume scales into a paid integration."},
            "fan_reply_hint": f"Tell them exactly what {title} is and where you got it.",
            "outreach": {
                "subject": f"My audience keeps asking for {title}",
                "body": (f"Hi — I'm a {cat} creator and my audience keeps commenting to ask about "
                         f"{title} after I featured it.{reach_bit}{rate_bit} — they're your exact "
                         f"customers, telling me they want to buy you. I'd love an affiliate "
                         f"partnership so I can send that demand straight to you; you only pay on "
                         f"sales. Open to a quick chat this week?"),
            },
        }
    if intent == "content":
        return {
            "kind": "video", "title": title,
            "hook": "You keep asking for this — so here's exactly how I do it.",
            "outline": ["Set up the question your fans keep asking",
                        "Walk through it step by step on camera",
                        "Show the result and answer the top comment"],
            "why_it_works": (f"{fans} fans literally asked for this video — the audience is "
                             f"already waiting for it."),
        }
    return {
        "kind": "product", "name": title, "format": cat,
        "price_inr": 199 if cluster.get("score", 0) > 85 else 149,
        "tagline": f"The exact thing {fans} of your fans just asked you to make.",
        "description": ("A ready-to-use " + str(cat).lower() + " built around what your audience "
                        "is requesting by name. Delivered instantly."),
        "listing_copy": ["Made from real fan demand, not guesswork",
                         "Works on mobile — start today",
                         "Instant delivery via UPI / link"],
        "why_it_sells": f"{fans} fans asked for this in their own words — the demand is already there.",
    }


# ---------------------------------------------------------------- CLONE
def clone(offer, link, receipts, handle):
    if _client:
        try:
            return _clone_llm(offer, link, receipts, handle)
        except Exception as e:  # noqa
            print("[echo] clone fell back to local:", e)
    return _clone_local(offer, link, receipts, handle)


def _clone_llm(offer, link, receipts, handle):
    kind = (offer.get("kind") or "product").lower()
    if kind == "brand":
        ctx = (f"Fans asked about {offer.get('product')} — a product the creator used. Reply "
               f"telling each fan what it is / that you'll point them to it. Do NOT ask for "
               f"money and do NOT include a link. {offer.get('fan_reply_hint', '')}")
    elif kind == "video":
        ctx = (f"Fans asked the creator to make a video: '{offer.get('title')}'. Reply warmly "
               f"that it's coming because they asked. No selling, no link.")
    elif link:
        ctx = (f"Product: {offer.get('name')} - Rs {offer.get('price_inr')}. Link: {link}. "
               f"Reply with the product, the price and the link.")
    else:
        ctx = (f"Fans asked the creator to make '{offer.get('name')}'. Reply that the creator is "
               f"making it and will share it with them when it's ready. No price, no link.")
    system = (
        "You are the creator's Echo Clone — a DISCLOSED AI assistant replying to fans in the "
        "creator's warm voice. Reply in the SAME language/script the fan used (Hinglish->"
        "Hinglish, Tamil->romanised Tamil, English->English). 1-2 sentences, genuine, not pushy. "
        "Reference what they asked for. Return ONLY valid minified JSON."
    )
    user = (
        f"Creator: {handle}. {ctx}\nReply to each fan:\n{json.dumps(receipts[:3])}\n"
        'JSON: {"replies":[{"to":"","lang":"","text":""}]}'
    )
    out = _call(system, user, 1200)
    if not out.get("replies"):
        raise ValueError("no replies")
    return out


def _clone_local(offer, link, receipts, handle):
    kind = (offer.get("kind") or "product").lower()
    if kind == "brand":
        line = (f"Hey! {handle}'s assistant here \U0001F642 you asked about "
                f"{offer.get('product')} — I'll get you the exact details, hang tight!")
    elif kind == "video":
        line = (f"Hey! {handle}'s assistant here \U0001F642 great idea — a video on "
                f"\u201c{offer.get('title')}\u201d is on the way because so many of you asked!")
    elif link:
        line = (f"Hey! {handle}'s assistant here \U0001F642 you asked about this — I just made "
                f"the \u201c{offer.get('name')}\u201d (Rs {offer.get('price_inr')}). "
                f"Grab it here: {link}")
    else:
        line = (f"Hey! {handle}'s assistant here \U0001F642 you asked for this — {handle} is "
                f"making \u201c{offer.get('name')}\u201d and we'll share it with you when it's "
                f"ready!")
    return {"replies": [{"to": r, "lang": "auto", "text": line} for r in receipts[:3]]}


# ---------------------------------------------------------------- AUDIENCE PULSE
def audience_pulse(comments):
    """How the audience FEELS about the creator: sentiment, mood, resonance, shift."""
    if _client:
        try:
            return _pulse_llm(comments)
        except Exception as e:  # noqa
            print("[echo] pulse fell back to local:", e)
    return _pulse_local(comments)


def _pulse_llm(comments):
    sample = "\n".join("- " + c for c in comments[:60])
    system = (
        "You are Echo's audience analyst. Read a creator's comments and gauge how the "
        "AUDIENCE FEELS about the creator and their content (not about products). "
        "Return ONLY valid minified JSON."
    )
    user = (
        "Comments:\n" + sample + "\n\nReturn JSON: {"
        '"resonance":<0-100 how strongly fans emotionally connect with the creator>,'
        '"sentiment":{"positive":<int>,"neutral":<int>,"negative":<int>} (percentages ~100),'
        '"mood":"<2-4 word label of the dominant mood>",'
        '"shift":"<one of: warming up | steady | cooling off>",'
        '"themes":["<3 short emotional or topic themes>"],'
        '"insight":"<one sentence the creator should know about their audience>"}'
    )
    return _call(system, user, 700)


def _pulse_local(comments):
    n = len(comments) or 1
    pos = sum(1 for c in comments if any(w in c.lower() for w in
              ["love", "best", "amazing", "please", "thank", "🔥", "❤", "🥺", "🙏"]))
    neg = sum(1 for c in comments if any(w in c.lower() for w in
              ["overrated", "cringe", "worst", "hate", "stop", "boring"]))
    p = round(100 * pos / n)
    ng = round(100 * neg / n)
    nu = max(0, 100 - p - ng)
    return {
        "resonance": min(45 + p, 95),
        "sentiment": {"positive": p, "neutral": nu, "negative": ng},
        "mood": "Engaged & asking",
        "shift": "steady",
        "themes": ["requests", "appreciation", "questions"],
        "insight": "Your audience is actively asking for things — there's demand to capture.",
    }


# ---------------------------------------------------------------- SCREENSHOT (vision)
def read_screenshot(image_bytes, media_type):
    """Extract comments from an Instagram screenshot. Needs a real (vision) model."""
    if not _client:
        raise RuntimeError("no_key")
    if media_type not in ("image/png", "image/jpeg", "image/gif", "image/webp"):
        media_type = "image/png"
    b64 = base64.standard_b64encode(image_bytes).decode()
    data_uri = f"data:{media_type};base64,{b64}"
    resp = _client.chat.completions.create(
        model=VISION_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": (
                "This is a screenshot of an Instagram comments or DM section. Extract EVERY "
                "comment/message you can read. For each, give the username and the exact text "
                "(keep original language/script, including Hindi/Tamil/Hinglish). "
                'Return ONLY JSON: {"comments":[{"u":"username","t":"comment text"}]}')},
            {"type": "image_url", "image_url": {"url": data_uri}},
        ]}],
    )
    out = _extract_json(resp.choices[0].message.content)
    out["comments"] = [c for c in out.get("comments", []) if c.get("t")]
    return out
