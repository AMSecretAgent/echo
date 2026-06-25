const BASE = import.meta.env.VITE_API_BASE || "";

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Echo API error " + r.status);
  return r.json();
}

export const analyze = (comments, niche) => post("/api/analyze", { comments, niche });
export const generate = (cluster, niche, isSeller, reach) =>
  post("/api/generate", { cluster, niche, is_seller: !!isSeller, reach: reach || {} });
export const clone = (offer, link, receipts, handle) =>
  post("/api/clone", { offer, link, receipts, handle });

export const stats = (id) => fetch(BASE + "/api/stats/" + id).then((r) => r.json());

// outreach tracker
export const listPitches = () => fetch(BASE + "/api/pitches").then((r) => r.json());
export const addPitch = (brand, product) => post("/api/pitches", { brand, product });
export const updatePitch = (id, patch) => post("/api/pitches/" + id, patch);
export const deletePitch = (id) =>
  fetch(BASE + "/api/pitches/" + id, { method: "DELETE" }).then((r) => r.json());

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(BASE + "/api/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("upload failed");
  return r.json();
}

export async function screenshotFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(BASE + "/api/screenshot", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "screenshot failed");
  return data;
}

export const igComments = () => fetch(BASE + "/api/instagram/comments").then((r) => r.json());

// full-page navigation to start the Instagram OAuth flow
export const igLoginUrl = BASE + "/api/instagram/login";

export async function youtube(url) {
  const r = await fetch(BASE + "/api/youtube", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "youtube failed");
  return data;
}
