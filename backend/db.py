"""Tiny SQLite store so trackable links and clicks are REAL, not mocked."""
import sqlite3
import time
import os
import secrets

DB_PATH = os.getenv("ECHO_DB", os.path.join(os.path.dirname(__file__), "echo.db"))


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS links(
            id TEXT PRIMARY KEY, creator TEXT, product TEXT, price INTEGER,
            description TEXT, vpa TEXT, created REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS clicks(
            id INTEGER PRIMARY KEY AUTOINCREMENT, link_id TEXT, kind TEXT, ts REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS pitches(
            id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT, product TEXT,
            status TEXT, notes TEXT, created REAL)""")


def create_link(creator, product, price, description, vpa):
    lid = secrets.token_urlsafe(6)
    with _conn() as c:
        c.execute("INSERT INTO links(id,creator,product,price,description,vpa,created) "
                  "VALUES(?,?,?,?,?,?,?)",
                  (lid, creator, product, price, description, vpa, time.time()))
    return lid


def get_link(lid):
    with _conn() as c:
        row = c.execute("SELECT * FROM links WHERE id=?", (lid,)).fetchone()
        return dict(row) if row else None


def record(lid, kind):
    with _conn() as c:
        c.execute("INSERT INTO clicks(link_id,kind,ts) VALUES(?,?,?)", (lid, kind, time.time()))


def stats(lid):
    with _conn() as c:
        rows = c.execute("SELECT kind, COUNT(*) n FROM clicks WHERE link_id=? GROUP BY kind",
                         (lid,)).fetchall()
    out = {"clicks": 0, "views": 0, "pay": 0}
    for r in rows:
        if r["kind"] in out:
            out[r["kind"]] = r["n"]
    return out


# ---------------------------------------------------------------- outreach tracker
def add_pitch(brand, product, status="To send", notes=""):
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO pitches(brand,product,status,notes,created) VALUES(?,?,?,?,?)",
            (brand, product, status, notes, time.time()))
        return cur.lastrowid


def list_pitches():
    with _conn() as c:
        rows = c.execute("SELECT * FROM pitches ORDER BY created DESC").fetchall()
        return [dict(r) for r in rows]


def update_pitch(pid, status=None, notes=None):
    with _conn() as c:
        row = c.execute("SELECT * FROM pitches WHERE id=?", (pid,)).fetchone()
        if not row:
            return False
        row = dict(row)
        ns = status if status is not None else row["status"]
        nn = notes if notes is not None else row["notes"]
        c.execute("UPDATE pitches SET status=?, notes=? WHERE id=?", (ns, nn, pid))
        return True


def delete_pitch(pid):
    with _conn() as c:
        c.execute("DELETE FROM pitches WHERE id=?", (pid,))
        return True
