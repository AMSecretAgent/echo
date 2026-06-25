import { useState, useEffect, useRef } from "react";
import { analyze, generate, clone, stats, uploadFile, screenshotFile, igComments, igLoginUrl, youtube, listPitches, addPitch, updatePitch, deletePitch } from "./api";

/*
  ECHO
  Frontend for the FastAPI backend. The backend does the LLM work and owns the
  trackable links, so this app talks only to /api/* — no keys in the browser.
*/

// ---------- design tokens ----------
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');

.echo-root *{box-sizing:border-box;margin:0;padding:0}
.echo-root{
  --ink:#0C0A12; --panel:#15121E; --panel2:#1D1828; --line:#2A2438;
  --text:#F3EFFA; --muted:#9C93AE; --muted2:#6E667E;
  --gold:#FFA51F; --gold-soft:rgba(255,165,31,.14); --gold-line:rgba(255,165,31,.35);
  --coral:#FF6B81; --aqua:#54E0C7;
  font-family:'Inter',system-ui,sans-serif;
  background:radial-gradient(120% 90% at 80% -10%, #1a1330 0%, var(--ink) 55%);
  color:var(--text); min-height:100%; padding:26px clamp(14px,4vw,46px) 60px;
  -webkit-font-smoothing:antialiased;
}
.echo-disp{font-family:'Space Grotesk',sans-serif}
.echo-mono{font-family:'Space Mono',monospace}

/* header */
.echo-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:22px}
.echo-logo{display:flex;align-items:center;gap:11px}
.echo-eq{display:flex;align-items:flex-end;gap:3px;height:26px}
.echo-eq span{width:4px;background:var(--gold);border-radius:2px;height:30%}
.echo-eq.live span{animation:eq .9s ease-in-out infinite}
.echo-eq span:nth-child(2){animation-delay:.15s}
.echo-eq span:nth-child(3){animation-delay:.3s}
.echo-eq span:nth-child(4){animation-delay:.45s}
@keyframes eq{0%,100%{height:25%}50%{height:100%}}
.echo-word{font-size:30px;font-weight:700;letter-spacing:-1px}
.echo-tag{color:var(--muted);font-size:13px;margin-top:3px}
.echo-badge{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);
  border:1px solid var(--gold-line);border-radius:999px;padding:6px 12px;white-space:nowrap}
.echo-engine{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted);font-family:'Space Mono',monospace}
a.url{text-decoration:none}
a.url:hover{text-decoration:underline}
.echo-track{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin:0 0 14px}
.echo-track b{color:var(--aqua);font-size:15px;margin-right:4px}
.echo-track-hint{color:var(--muted2);font-size:11px}

/* loop steps */
.echo-loop{display:flex;gap:10px;margin:0 0 24px;flex-wrap:wrap}
.echo-step{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--muted2);
  border:1px solid var(--line);border-radius:10px;padding:8px 13px;transition:.3s}
.echo-step b{font-weight:600}
.echo-step.on{color:var(--text);border-color:var(--gold-line);background:var(--gold-soft)}
.echo-dot{width:7px;height:7px;border-radius:50%;background:currentColor}

.echo-grid{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:20px;align-items:start}
@media(max-width:860px){.echo-grid{grid-template-columns:1fr}}

.echo-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px}
.echo-h{font-family:'Space Grotesk';font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.echo-h .n{font-family:'Space Mono';color:var(--gold);font-size:12px}

/* creator */
.echo-creator{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.echo-av{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;
  font-family:'Space Grotesk';font-weight:700;font-size:20px;color:var(--ink);
  background:linear-gradient(135deg,var(--gold),var(--coral))}
.echo-creator .hn{font-weight:600;font-size:15px}
.echo-creator .ni{color:var(--muted);font-size:12.5px}

/* instagram panel */
.ig-card{padding-top:14px}
.ig-connected{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--aqua);border:1px solid rgba(84,224,199,.3);
  background:rgba(84,224,199,.07);border-radius:999px;padding:5px 10px;margin-bottom:16px;
  text-decoration:none;cursor:pointer;transition:.2s}
a.ig-connected:hover{background:rgba(84,224,199,.16)}
.ig-connected.live{color:#5BE8A0;border-color:rgba(91,232,160,.35);background:rgba(91,232,160,.08);cursor:default}
.ig-hint{font-size:10.5px;color:var(--muted2);margin-top:9px;line-height:1.5}
.ig-glyph{font-size:13px}
.ig-profile{display:flex;align-items:center;gap:16px;margin-bottom:12px}
.ig-av-ring{width:62px;height:62px;border-radius:50%;flex-shrink:0;padding:2.5px;
  background:linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)}
.ig-av-img{width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid var(--panel)}
.ig-av-fallback{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--panel2);border:2px solid var(--panel);color:var(--text);font-size:24px;font-weight:700}
.ig-meta{min-width:0}
.ig-handle{display:flex;align-items:center;gap:6px;font-size:16px;font-weight:600}
.ig-verified{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;
  background:#3897F0;color:#fff;font-size:9px;font-weight:700}
.ig-stats{display:flex;gap:14px;margin-top:6px;font-size:12.5px;color:var(--muted)}
.ig-stats b{color:var(--text);font-weight:600}
.ig-bio{font-size:12.5px;line-height:1.5;color:var(--muted);margin-bottom:14px}
.ig-bio b{color:var(--text)}
.ig-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:16px}
.ig-thumb{aspect-ratio:1;border-radius:7px;opacity:.85}
.ig-comments-h{display:flex;justify-content:space-between;align-items:center;font-size:12px;
  letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border-top:1px solid var(--line);
  padding-top:14px;margin-bottom:10px}
.ig-comments-h .n{font-family:'Space Mono';color:var(--gold)}
.ig-feed{max-height:330px}
.ig-cm{display:flex;gap:10px;align-items:flex-start;padding:9px 6px;border-radius:10px;
  transition:opacity .5s ease,background .5s ease;position:relative}
.ig-cm.pulse{animation:pulse 1.1s ease-in-out infinite}
.ig-cm.filtered{opacity:.32;filter:grayscale(.6)}
.ig-cm.surfaced{background:var(--gold-soft)}
.ig-cm-av{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;
  justify-content:center;font-size:12px;font-weight:700;color:#fff;font-family:'Space Grotesk'}
.ig-cm-body{min-width:0;flex:1}
.ig-cm-text{font-size:13px;line-height:1.45}
.ig-cm-text b{font-weight:600;margin-right:2px}
.ig-cm-meta{display:flex;gap:12px;align-items:center;margin-top:5px;font-size:11px;color:var(--muted2);flex-wrap:wrap}
.ig-cm-meta>span:nth-child(2),.ig-cm-meta>span:nth-child(3){font-weight:600}
.ig-flag{font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;border-radius:6px;padding:2px 6px}
.ig-flag.bad{color:var(--coral);border:1px solid rgba(255,107,129,.3)}
.ig-flag.good{color:var(--gold);border:1px solid var(--gold-line)}
.ig-heart{color:var(--muted2);font-size:14px;flex-shrink:0;padding-top:8px}

/* comments */
.echo-feed{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;padding-right:4px;margin-bottom:12px}
.echo-feed::-webkit-scrollbar{width:6px}
.echo-feed::-webkit-scrollbar-thumb{background:var(--line);border-radius:6px}
.echo-cm{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45;position:relative}
.echo-cm.pulse{animation:pulse 1.1s ease-in-out infinite}
@keyframes pulse{0%,100%{border-color:var(--line)}50%{border-color:var(--gold-line);background:var(--gold-soft)}}
.echo-lang{display:inline-block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);
  border:1px solid var(--line);border-radius:6px;padding:2px 6px;margin-top:7px}
.echo-lang.noise{color:var(--muted2);border-color:var(--line)}
.echo-cm.filtered{opacity:.4;filter:grayscale(.5)}
.echo-cm.filtered .echo-lang.noise{color:var(--coral);border-color:rgba(255,107,129,.3)}
.echo-cm.surfaced{border-color:var(--gold-line);background:linear-gradient(var(--gold-soft),var(--gold-soft)),var(--panel2)}
.echo-cm{transition:opacity .5s ease,border-color .5s ease,background .5s ease}

/* audience pulse */
.echo-pulse{background:linear-gradient(135deg,rgba(255,165,31,.10),rgba(255,107,129,.10)),var(--panel);
  border:1px solid var(--gold-line);border-radius:16px;padding:16px;margin-bottom:16px;animation:fadeup .5s ease both}
.echo-pulse-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.echo-pulse-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.echo-pulse-mood{font-family:'Space Grotesk';font-size:20px;font-weight:600;margin-top:4px}
.echo-pulse-res{text-align:right}
.echo-pulse-res .num{font-size:30px;font-weight:700;color:var(--aqua);line-height:1}
.echo-pulse-res .cap{font-size:10.5px;color:var(--muted);margin-top:2px}
.echo-senti{display:flex;gap:3px;height:8px;margin-bottom:8px}
.echo-senti i{border-radius:4px}
.echo-senti .pos{background:#5BE8A0}
.echo-senti .neu{background:var(--muted2)}
.echo-senti .neg{background:var(--coral)}
.echo-senti-row{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:12px}
.echo-senti-row b.pos{color:#5BE8A0;font-family:'Space Mono'}
.echo-shift{text-transform:capitalize}
.echo-pulse-themes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.echo-pulse-themes span{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--text);
  border:1px solid var(--line);border-radius:7px;padding:3px 8px}
.echo-pulse-insight{font-size:12.5px;line-height:1.55;color:#FFE9CC;border-top:1px solid var(--line);padding-top:10px}

/* signal vs noise summary */
.echo-sn{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px 16px;margin-bottom:16px;animation:fadeup .5s ease both}
.echo-sn-bar{display:flex;gap:4px;height:9px;margin-bottom:10px}
.echo-sn-bar i{border-radius:5px}
.echo-sn-bar .sig{background:linear-gradient(90deg,var(--gold),var(--coral))}
.echo-sn-bar .noi{background:var(--line)}
.echo-sn-row{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted)}
.echo-sn-row b{font-family:'Space Mono';font-size:15px}
.echo-sn-row b.sig{color:var(--gold)}
.echo-sn-row b.noi{color:var(--muted2)}
.echo-sn-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
.echo-sn-tags span{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--coral);
  border:1px solid rgba(255,107,129,.25);border-radius:7px;padding:4px 8px;display:flex;gap:5px;align-items:center}
.echo-sn-tags em{font-style:normal;text-transform:none;letter-spacing:0;color:var(--muted2);font-family:'Space Mono';font-size:10px}

.echo-input{flex:1;background:var(--panel2);border:1px solid var(--line);border-radius:10px;color:var(--text);
  padding:10px 12px;font-size:13px;font-family:inherit;outline:none}
.echo-input:focus{border-color:var(--gold-line)}
.echo-mini{background:none;border:1px solid var(--line);color:var(--muted);border-radius:10px;
  padding:0 14px;cursor:pointer;font-size:18px;line-height:1}
.echo-mini:hover{border-color:var(--gold-line);color:var(--text)}

/* primary cta */
.echo-cta{width:100%;margin-top:14px;background:var(--gold);color:#1a1206;border:none;border-radius:13px;
  padding:14px;font-family:'Space Grotesk';font-weight:700;font-size:15px;cursor:pointer;transition:.2s;
  display:flex;align-items:center;justify-content:center;gap:9px}
.echo-cta:hover{filter:brightness(1.08);transform:translateY(-1px)}
.echo-cta:disabled{opacity:.6;cursor:wait;transform:none}

/* right column states */
.echo-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  min-height:340px;color:var(--muted);gap:14px;padding:30px}
.echo-empty .big{font-family:'Space Grotesk';font-size:21px;color:var(--text);font-weight:600;max-width:340px;line-height:1.35}
.echo-ripple{width:64px;height:64px;border-radius:50%;border:2px solid var(--gold-line);position:relative}
.echo-ripple::after,.echo-ripple::before{content:'';position:absolute;inset:-2px;border-radius:50%;border:2px solid var(--gold-line);animation:rip 2.4s ease-out infinite}
.echo-ripple::before{animation-delay:1.2s}
@keyframes rip{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.1);opacity:0}}

.echo-listening{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:340px;gap:20px}
.echo-bigeq{display:flex;align-items:flex-end;gap:6px;height:70px}
.echo-bigeq span{width:9px;border-radius:5px;background:linear-gradient(var(--gold),var(--coral));animation:eq2 1s ease-in-out infinite}
.echo-bigeq span:nth-child(odd){animation-duration:.8s}
.echo-bigeq span:nth-child(3n){animation-duration:1.2s}
@keyframes eq2{0%,100%{height:14px}50%{height:70px}}
.echo-listening .lbl{color:var(--muted);font-size:14px}
.echo-listening .lbl b{color:var(--text);font-weight:600}

/* clusters */
.echo-clusters{display:flex;flex-direction:column;gap:14px}
.echo-cl{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;
  animation:fadeup .5s ease both}
@keyframes fadeup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.echo-cl-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.echo-cl-title{font-family:'Space Grotesk';font-size:19px;font-weight:600;line-height:1.25}
.echo-cl-cat{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:5px}
.echo-cl-need{font-size:12.5px;color:var(--aqua);margin:10px 0 2px}
.echo-count{text-align:right;flex-shrink:0}
.echo-count .num{font-family:'Space Mono';font-weight:700;font-size:30px;color:var(--gold);line-height:1}
.echo-count .cap{font-size:11px;color:var(--muted);margin-top:3px}
.echo-meter{height:6px;background:var(--panel2);border-radius:5px;margin:14px 0 12px;overflow:hidden}
.echo-meter i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--coral));border-radius:5px;transition:width 1s cubic-bezier(.2,.8,.2,1)}
.echo-langs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.echo-langs span{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--aqua);
  border:1px solid rgba(84,224,199,.3);border-radius:6px;padding:3px 7px}

.echo-receipts-btn{background:none;border:none;color:var(--coral);font-size:12.5px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;padding:2px 0}
.echo-receipts{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.echo-receipt{background:rgba(255,107,129,.07);border:1px solid rgba(255,107,129,.22);border-left:3px solid var(--coral);
  border-radius:0 10px 10px 0;padding:9px 12px;font-size:12.5px;line-height:1.5;color:#FFE3E8}
.echo-receipt .q{color:var(--coral);font-family:'Space Grotesk';font-weight:700;margin-right:4px}

.echo-sell{margin-top:14px;width:100%;background:var(--panel2);border:1px solid var(--gold-line);color:var(--gold);
  border-radius:11px;padding:11px;font-family:'Space Grotesk';font-weight:600;font-size:13.5px;cursor:pointer;transition:.2s}
.echo-sell:hover{background:var(--gold-soft)}

/* drawer */
.echo-overlay{position:fixed;inset:0;background:rgba(6,4,12,.7);backdrop-filter:blur(4px);
  display:flex;justify-content:flex-end;z-index:50;animation:fade .25s ease}
@keyframes fade{from{opacity:0}to{opacity:1}}
.echo-drawer{width:min(460px,100%);height:100%;background:var(--panel);border-left:1px solid var(--line);
  overflow:auto;padding:26px;animation:slide .35s cubic-bezier(.2,.8,.2,1)}
@keyframes slide{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}}
.echo-drawer::-webkit-scrollbar{width:6px}.echo-drawer::-webkit-scrollbar-thumb{background:var(--line);border-radius:6px}
.echo-x{background:none;border:1px solid var(--line);color:var(--muted);width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:16px}
.echo-x:hover{color:var(--text);border-color:var(--gold-line)}
.echo-ready{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--aqua);margin:18px 0 6px;display:flex;align-items:center;gap:7px}
.echo-pname{font-family:'Space Grotesk';font-size:26px;font-weight:700;line-height:1.15}
.echo-ptag{color:var(--coral);font-size:14px;margin-top:7px;font-style:italic}
.echo-prow{display:flex;gap:10px;margin:18px 0;flex-wrap:wrap}
.echo-chip{border:1px solid var(--line);border-radius:10px;padding:9px 13px;font-size:12px}
.echo-chip .k{color:var(--muted2);font-size:10px;letter-spacing:.06em;text-transform:uppercase;display:block;margin-bottom:3px}
.echo-chip .v{font-family:'Space Grotesk';font-weight:600;font-size:15px}
.echo-chip.price .v{color:var(--gold);font-family:'Space Mono'}
.echo-pdesc{color:#D9D2E6;font-size:13.5px;line-height:1.6;margin:6px 0 18px}
.echo-bul{display:flex;flex-direction:column;gap:9px;margin-bottom:18px}
.echo-bul div{display:flex;gap:9px;font-size:13px;line-height:1.45;color:#E6E0F0}
.echo-bul .t{color:var(--aqua);flex-shrink:0;font-weight:700}
.echo-why{background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:12px;padding:13px 15px;
  font-size:13px;line-height:1.55;color:#FFE9CC;margin-bottom:18px}
.echo-why b{color:var(--gold);font-family:'Space Grotesk'}
.echo-link{display:flex;align-items:center;gap:8px;background:var(--ink);border:1px solid var(--line);
  border-radius:11px;padding:11px 13px;margin-bottom:14px}
.echo-link .url{font-family:'Space Mono';font-size:12.5px;color:var(--aqua);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.echo-copy{background:var(--aqua);color:var(--ink);border:none;border-radius:8px;padding:7px 12px;font-weight:700;font-size:12px;cursor:pointer;font-family:'Space Grotesk'}
.echo-pub{display:flex;gap:10px}
.echo-pub button{flex:1;background:var(--gold);color:#1a1206;border:none;border-radius:11px;padding:12px;
  font-family:'Space Grotesk';font-weight:700;font-size:13px;cursor:pointer}
.echo-pub button.ghost{background:none;color:var(--text);border:1px solid var(--line)}
.echo-err{background:rgba(255,107,129,.1);border:1px solid rgba(255,107,129,.3);color:#FFC9D2;
  border-radius:11px;padding:11px 14px;font-size:12.5px;margin-top:12px}

/* clone */
.echo-clone-sub{color:var(--muted);font-size:12.5px;line-height:1.55;margin:7px 0 14px}
.echo-away{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#5BE8A0;
  border:1px solid rgba(91,232,160,.35);border-radius:999px;padding:2px 8px;margin-left:8px}
.echo-clone-sub b{color:var(--coral)}
.echo-clone-btn{width:100%;background:var(--panel2);border:1px solid rgba(255,107,129,.4);color:var(--coral);
  border-radius:12px;padding:12px;font-family:'Space Grotesk';font-weight:600;font-size:13.5px;cursor:pointer;transition:.2s}
.echo-clone-btn:hover{background:rgba(255,107,129,.1)}
.echo-clone-btn:disabled{opacity:.6;cursor:wait}
.echo-vs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.echo-vs-tag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:6px}
.echo-vs-note{font-size:10.5px;color:var(--muted2);margin-top:6px;line-height:1.35}
.echo-vs-note.good{color:var(--aqua)}
.echo-bubble{border-radius:13px;padding:10px 12px;font-size:12.5px;line-height:1.5}
.echo-bubble.dumb{background:var(--panel2);border:1px solid var(--line);color:var(--muted)}
.echo-bubble.smart{background:var(--gold-soft);border:1px solid var(--gold-line);color:#FFE9CC}
.echo-bubble.fan{background:rgba(255,107,129,.07);border:1px solid rgba(255,107,129,.22);color:#FFE3E8}
.echo-bubble.fan .q{color:var(--coral);font-family:'Space Grotesk';font-weight:700;margin-right:3px}
.echo-thread{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
.echo-thread .fan{align-self:flex-start;max-width:88%;border-radius:13px 13px 13px 4px}
.echo-thread .reply{align-self:flex-end;max-width:92%;border-radius:13px 13px 4px 13px}
.echo-disclose{display:block;margin-top:7px;font-size:9.5px;letter-spacing:.03em;color:var(--muted2);font-family:'Space Mono'}

.echo-foot{text-align:center;color:var(--muted2);font-size:11.5px;margin-top:34px;line-height:1.6}

/* seller toggle */
.echo-seller{display:flex;align-items:center;justify-content:space-between;gap:10px;
  border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:14px;background:var(--panel2)}
.echo-seller-t{font-size:12.5px;font-weight:600;color:var(--text)}
.echo-seller-s{font-size:10.5px;color:var(--muted2);margin-top:2px;line-height:1.4}
.echo-switch{flex-shrink:0;width:40px;height:23px;border-radius:999px;border:1px solid var(--line);
  background:var(--ink);cursor:pointer;position:relative;transition:.2s;padding:0}
.echo-switch span{position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;
  background:var(--muted2);transition:.2s}
.echo-switch.on{background:var(--gold-soft);border-color:var(--gold-line)}
.echo-switch.on span{left:19px;background:var(--gold)}

/* brand-deal pitch + create-only note */
.echo-pitch{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:18px}
.echo-pitch-sub{font-size:11.5px;color:var(--muted);margin-bottom:10px;line-height:1.45}
.echo-pitch-sub span{color:var(--muted2);text-transform:uppercase;letter-spacing:.06em;font-size:9.5px;margin-right:6px}
.echo-pitch-body{font-size:13px;line-height:1.6;color:#E6E0F0;white-space:pre-wrap;margin-bottom:12px}
.echo-metric{display:inline-block;font-family:'Space Mono';font-size:12.5px;color:var(--aqua);
  border:1px solid rgba(84,224,199,.3);border-radius:8px;padding:5px 10px;margin-top:10px}
.echo-note{background:var(--panel2);border:1px dashed var(--line);border-radius:12px;padding:13px 15px;
  font-size:12.5px;line-height:1.55;color:var(--muted);margin-bottom:4px}
.echo-note b{color:var(--gold)}

/* ===== professional dashboard chrome ===== */
.echo-root .echo-top{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:22px}
.echo-kicker{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted2);
  font-family:'Space Mono';margin-top:4px}

/* channel card (replaces the IG profile clone) */
.chan{display:flex;align-items:center;gap:13px;margin-bottom:16px}
.chan-av{width:52px;height:52px;border-radius:14px;flex-shrink:0;object-fit:cover;
  background:linear-gradient(135deg,var(--gold),var(--coral));display:flex;align-items:center;
  justify-content:center;font-family:'Space Grotesk';font-weight:700;font-size:22px;color:var(--ink)}
.chan-meta{min-width:0}
.chan-name{font-family:'Space Grotesk';font-weight:600;font-size:16px;line-height:1.2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chan-src{display:inline-flex;align-items:center;gap:5px;font-size:9.5px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--coral);margin-top:3px}
.chan-stats{display:flex;gap:16px;padding:12px 0;border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);margin-bottom:13px}
.chan-stat .v{font-family:'Space Mono';font-weight:700;font-size:16px;color:var(--text)}
.chan-stat .k{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted2);margin-top:2px}
.chan-bio{font-size:12px;line-height:1.5;color:var(--muted);margin-bottom:14px}

.src-h{font-family:'Space Grotesk';font-size:11px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);display:flex;justify-content:space-between;align-items:center;
  border-top:1px solid var(--line);padding-top:13px;margin-bottom:10px}
.src-h .n{font-family:'Space Mono';color:var(--gold)}

/* action plan — the "what to do next" headline */
.echo-plan{background:linear-gradient(135deg,rgba(255,165,31,.12),rgba(84,224,199,.08)),var(--panel);
  border:1px solid var(--gold-line);border-radius:16px;padding:18px;margin-bottom:16px;animation:fadeup .5s ease both}
.echo-plan-k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.echo-plan-h{font-family:'Space Grotesk';font-size:19px;font-weight:600;line-height:1.25;margin:5px 0 14px}
.echo-plan-h b{color:var(--gold)}
.echo-plan-row{display:flex;align-items:center;gap:12px;padding:11px;border:1px solid var(--line);
  border-radius:12px;margin-top:8px;cursor:pointer;transition:.18s;background:var(--panel2)}
.echo-plan-row:hover{border-color:var(--gold-line);transform:translateX(2px)}
.echo-plan-rank{font-family:'Space Mono';font-size:12px;color:var(--muted2);width:18px;flex-shrink:0}
.echo-plan-tag{font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:700;
  border-radius:7px;padding:4px 8px;flex-shrink:0}
.echo-plan-tag.brand{color:var(--coral);background:rgba(255,107,129,.12);border:1px solid rgba(255,107,129,.3)}
.echo-plan-tag.video{color:var(--gold);background:var(--gold-soft);border:1px solid var(--gold-line)}
.echo-plan-tag.product{color:var(--aqua);background:rgba(84,224,199,.1);border:1px solid rgba(84,224,199,.3)}
.echo-plan-title{font-size:13.5px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.echo-plan-n{font-family:'Space Mono';font-size:12px;color:var(--muted);flex-shrink:0}
.echo-plan-go{color:var(--muted2);flex-shrink:0}

/* brand pitch package */
.bp-reach{display:flex;gap:18px;flex-wrap:wrap;margin:16px 0 4px}
.bp-reach .v{font-family:'Space Mono';font-weight:700;font-size:17px;color:var(--text)}
.bp-reach .k{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted2);margin-top:2px}
.bp-deal{background:rgba(84,224,199,.08);border:1px solid rgba(84,224,199,.28);border-radius:12px;
  padding:13px 15px;margin:16px 0 18px}
.bp-deal-k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--aqua);margin-bottom:6px}
.bp-deal-v{font-family:'Space Grotesk';font-weight:600;font-size:15px;text-transform:capitalize;margin-bottom:5px}
.bp-deal-r{font-size:12px;line-height:1.5;color:var(--muted)}
.bp-proof{display:flex;flex-direction:column;gap:7px;margin:10px 0 0}
.bp-proof .echo-receipt{font-size:12px}

/* outreach tracker */
.echo-track-btn{background:var(--panel2);border:1px solid var(--gold-line);color:var(--gold);
  border-radius:999px;padding:7px 14px;font-family:'Space Grotesk';font-weight:600;font-size:12px;
  cursor:pointer;transition:.2s}
.echo-track-btn:hover{background:var(--gold-soft)}
.echo-trk{width:100%;border-collapse:collapse;font-size:12.5px}
.echo-trk th{text-align:left;color:var(--muted2);font-size:10px;letter-spacing:.06em;text-transform:uppercase;
  padding:0 8px 8px 0;border-bottom:1px solid var(--line);font-weight:600}
.echo-trk td{padding:11px 8px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
.trk-brand{font-weight:600;color:var(--text)}
.trk-prod{color:var(--muted2);font-size:11px;margin-top:2px}
.trk-sel{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:8px;
  padding:6px 8px;font-size:12px;font-family:inherit;cursor:pointer}
.trk-notes{width:100%;min-width:120px;background:var(--panel2);border:1px solid var(--line);color:var(--text);
  border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;outline:none}
.trk-notes:focus{border-color:var(--gold-line)}
.trk-del{background:none;border:none;color:var(--muted2);cursor:pointer;font-size:13px}
.trk-del:hover{color:var(--coral)}
`;

// ---------- demo creator + seed comments ----------
// 👇 EDIT THIS to your own real Instagram account for the demo.
//    Put your real handle, follower count, and bio. Avatar/posts are styled gradients;
//    swap `avatar` for a real image URL if you want your actual profile picture.
const CREATOR = {
  initial: "A",
  name: "Aarohi",
  handle: "studywith.aarohi",
  niche: "Study & productivity creator",
  bio: "📚 NEET + boards · daily study tips · DM for collabs",
  posts: "418",
  followers: "240K",
  following: "312",
  verified: true,
  avatar: null, // e.g. "https://.../me.jpg"
};

// Real comment sections are mostly noise. Each item is tagged so the demo can
// show Echo separating genuine buying intent (l = language) from junk (noise + why).
const SEED = [
  { u: "first.always_", t: "FIRST 🎉🎉", time: "2m", likes: 0, noise: "Low-effort" },
  { u: "riya.reads", t: "didi please ek study planner banao na, main bhi aapke jaisa schedule follow karna chahti hu 🙏", time: "3h", likes: 24, l: "Hinglish" },
  { u: "gaming_yt_promo", t: "Bro check out my channel, sub for sub 🙏🙏", time: "1h", likes: 0, noise: "Self-promo" },
  { u: "ananya.studies", t: "Can you make a Notion template? I'll literally pay for it", time: "5h", likes: 41, l: "English" },
  { u: "hype.machine", t: "🔥🔥🔥🔥", time: "4m", likes: 1, noise: "Low-effort" },
  { u: "tn_aspirant_", t: "akka neenga use panra timetable share pannunga please", time: "6h", likes: 18, l: "Tamil" },
  { u: "daily.earn.official", t: "Earn ₹5000/day from home, DM me the word START", time: "4h", likes: 0, noise: "Scam" },
  { u: "meera.notes", t: "your handwriting notes are so good, you should sell them", time: "8h", likes: 33, l: "English" },
  { u: "just_saying_99", t: "honestly this is so overrated lol", time: "7h", likes: 2, noise: "Troll" },
  { u: "board.prep.2026", t: "please drop the PDF of your revision plan 🥺", time: "9h", likes: 27, l: "English" },
  { u: "followers.shop.cheap", t: "100% real followers cheapest price, contact fast", time: "3h", likes: 0, noise: "Spam" },
  { u: "aesthetic.padhai", t: "ek aesthetic planner sell karo, sab kharidenge", time: "10h", likes: 52, l: "Hinglish" },
  { u: "your_secret_fan.22", t: "didi marry me 😍😍", time: "1h", likes: 0, noise: "Off-topic" },
  { u: "neet_2027_dreams", t: "I need your timetable for NEET prep, where to get it", time: "11h", likes: 19, l: "English" },
  { u: "scrolling.viewer", t: "nice 👍", time: "5m", likes: 0, noise: "Low-effort" },
  { u: "chem_lover_", t: "aapke chemistry notes kaha milenge boards ke liye", time: "12h", likes: 22, l: "Hinglish" },
  { u: "hater.no1", t: "stop posting cringe content", time: "8h", likes: 0, noise: "Troll" },
  { u: "productivity.priya", t: "make a Notion dashboard for students please", time: "13h", likes: 30, l: "English" },
  { u: "tech_curious_", t: "which phone do you use for editing??", time: "6h", likes: 3, noise: "Off-topic" },
  { u: "chennai.studies", t: "Tamil la oru study guide PDF pannunga", time: "14h", likes: 15, l: "Tamil" },
  { u: "iphone.giveaway.live", t: "free iphone giveaway click my bio link now", time: "2h", likes: 0, noise: "Scam" },
  { u: "waiting4planner", t: "didi planner ka link do please, kab aayega", time: "15h", likes: 28, l: "Hinglish" },
  { u: "notion.newbie", t: "how do you organise notes in Notion? need a template", time: "16h", likes: 21, l: "English" },
  { u: "x_bot_8821", t: "asdfgh op op", time: "4m", likes: 0, noise: "Bot" },
  { u: "serious.aspirant", t: "aapka revision schedule chahiye, paid bhi chalega", time: "17h", likes: 26, l: "Hinglish" },
  { u: "wanderlust.22", t: "where is this place 😮", time: "5h", likes: 4, noise: "Off-topic" },
  { u: "bio.buff", t: "sell the handwritten bio notes na, full set", time: "18h", likes: 17, l: "Hinglish" },
  { u: "reel.watcher", t: "where is the daily planner you showed in the reel", time: "19h", likes: 23, l: "English" },
];

// generate a stable-ish handle for pasted/imported comments
function guessHandle(i) {
  const pool = ["user", "fan", "viewer", "follower", "student", "subscriber"];
  return pool[i % pool.length] + "_" + (100 + (i * 37) % 900);
}

// deterministic avatar tint from a handle
function igTint(h) {
  const c = ["#FFA51F", "#FF6B81", "#7A5CFF", "#54E0C7", "#3B82F6", "#EC4899", "#10B981"];
  let s = 0;
  for (let i = 0; i < h.length; i++) s += h.charCodeAt(i);
  const a = c[s % c.length], b = c[(s + 3) % c.length];
  return "linear-gradient(135deg," + a + "," + b + ")";
}

// ---------- LLM helpers ----------
// count-up number
function useCountUp(target, run) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) { setN(target); return; }
    let raf, start;
    const dur = 700;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setN(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return n;
}

function Cluster({ cl, i, onSell, isSeller }) {
  const [open, setOpen] = useState(i === 0);
  const [meter, setMeter] = useState(0);
  const n = useCountUp(cl.fan_count, true);
  useEffect(() => { const t = setTimeout(() => setMeter(cl.score), 120 + i * 90); return () => clearTimeout(t); }, [cl.score, i]);
  const intent = (cl.intent || "product").toLowerCase();
  const sellable = isSeller || cl.wants_to_pay;
  const catLine = intent === "buy" ? " · they want to buy this"
    : intent === "content" ? " · they want a video on this"
    : " · they want you to make this";
  const action = intent === "buy" ? "See the brand opportunity"
    : intent === "content" ? "Plan this video"
    : sellable ? "Create & sell this" : "Create this";
  return (
    <div className="echo-cl" style={{ animationDelay: i * 0.09 + "s" }}>
      <div className="echo-cl-top">
        <div style={{ minWidth: 0 }}>
          <div className="echo-cl-title">{cl.title}</div>
          <div className="echo-cl-cat">{cl.category}{catLine}{cl.wants_to_pay && intent !== "buy" ? " · 💸 fans offered to pay" : ""}</div>
        </div>
        <div className="echo-count">
          <div className="num">{n}</div>
          <div className="cap">fans asked</div>
        </div>
      </div>
      {cl.need && <div className="echo-cl-need">What they need: {cl.need}</div>}
      <div className="echo-meter"><i style={{ width: meter + "%" }} /></div>
      <div className="echo-langs">{(cl.languages || []).map((l) => <span key={l}>{l}</span>)}</div>
      <button className="echo-receipts-btn" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} {open ? "Hide" : "Show"} the receipts ({(cl.receipts || []).length})
      </button>
      {open && (
        <div className="echo-receipts">
          {(cl.receipts || []).map((r, k) => (
            <div className="echo-receipt" key={k}><span className="q">“</span>{r}</div>
          ))}
        </div>
      )}
      <button className="echo-sell" onClick={() => onSell(cl)}>{action} →</button>
    </div>
  );
}

// detect whether a creator actually sells their own products (auto-default for the toggle)
function detectSeller(c) {
  const hay = ((c.bio || "") + " " + (c.niche || "") + " " + (c.handle || "") + " " + (c.name || "")).toLowerCase();
  const kw = ["shop", "store", "order now", "buy now", "link in bio", "linktr", "gumroad",
    "checkout", "founder", "my course", "ebook", "e-book", "merch", "available now",
    "dm to buy", "dm for order", "sells", "selling", "my products", "use code"];
  return kw.some((k) => hay.includes(k));
}

export default function App() {
  const [comments, setComments] = useState(SEED);
  const [creator, setCreator] = useState(CREATOR);
  const [igConnected, setIgConnected] = useState(false);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | listening | detected
  const [clusters, setClusters] = useState([]);
  const [noise, setNoise] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [labels, setLabels] = useState(null);
  const [scan, setScan] = useState(null);   // {total, demand, noise, intent_rate}
  const [pitches, setPitches] = useState([]);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [err, setErr] = useState("");
  const [health, setHealth] = useState(null); // {llm, model}

  const [active, setActive] = useState(null);   // cluster being acted on
  const [offer, setOffer] = useState(null);     // {kind, ...} from backend
  const [sellEnabled, setSellEnabled] = useState(false);
  const [link, setLink] = useState(null);       // {id, url} — only for sellable products
  const [genning, setGenning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cloneReplies, setCloneReplies] = useState(null);
  const [cloning, setCloning] = useState(false);
  const [clickStats, setClickStats] = useState(null);
  const [shotLoading, setShotLoading] = useState(false);
  const [seller, setSeller] = useState(false);  // does this creator sell their own products?

  const feedRef = useRef(null);
  const fileRef = useRef(null);
  const shotRef = useRef(null);

  // engine status (live LLM vs local fallback) — shows the BYO-key design
  useEffect(() => {
    fetch("/healthz").then((r) => r.json()).then(setHealth).catch(() => setHealth({ llm: false }));
  }, []);

  // auto-set seller mode from the creator's profile (creator can override with the toggle)
  useEffect(() => {
    setSeller(detectSeller(creator));
  }, [creator.bio, creator.niche, creator.handle, creator.name]);

  // load the saved outreach pipeline
  useEffect(() => {
    listPitches().then((d) => setPitches(d.pitches || [])).catch(() => {});
  }, []);

  // returning from the Instagram OAuth flow — load the real pulled comments
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ig = p.get("ig");
    if (ig === "connected") {
      igComments().then((data) => {
        if (data && data.comments && data.comments.length) {
          setComments(data.comments);
          setIgConnected(true);
          if (data.account && data.account.handle) {
            setCreator((c) => ({ ...c, handle: data.account.handle, name: data.account.handle, verified: false }));
          }
        } else {
          setErr("Connected, but no comments came back. Make sure the account has posts with comments.");
        }
      }).catch(() => setErr("Connected, but couldn't load comments."));
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ig === "error") {
      setErr("Instagram connection failed or was cancelled. Check the app setup in backend/.env.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // live click tracking — open the link in another tab and watch this update
  useEffect(() => {
    if (!link) return;
    let live = true;
    const poll = () => stats(link.id).then((s) => { if (live) setClickStats(s); }).catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => { live = false; clearInterval(t); };
  }, [link]);

  function resetAnalysis() {
    setPhase("idle"); setClusters([]); setNoise(null); setPulse(null); setLabels(null); setScan(null);
    setActive(null); setOffer(null); setSellEnabled(false); setLink(null); setCloneReplies(null);
    setClickStats(null); setErr("");
  }

  function addComment() {
    if (!draft.trim()) return;
    const lines = draft.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    setComments((c) => [...c, ...lines.map((t, k) => ({ t, u: guessHandle(c.length + k), time: "now" }))]);
    setDraft("");
    if (phase === "detected") resetAnalysis();
    setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 50);
  }

  async function onUpload(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const { comments: parsed } = await uploadFile(f);
      if (phase === "detected") resetAnalysis();
      setComments((c) => [...c, ...(parsed || []).map((t, k) => ({ t, u: guessHandle(c.length + k), time: "now" }))]);
    } catch (_) {
      setErr("Couldn't read that file. Use a .txt or .csv of comments.");
    }
    e.target.value = "";
  }

  async function onScreenshot(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setErr(""); setShotLoading(true);
    try {
      const { comments: parsed } = await screenshotFile(f);
      if (!parsed || !parsed.length) {
        setErr("No comments found in that screenshot. Try a clearer, full-resolution image.");
      } else {
        if (phase === "detected") resetAnalysis();
        setComments((c) => [...c, ...parsed.map((x, k) => ({ t: x.t, u: x.u || guessHandle(c.length + k), time: "now" }))]);
      }
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
    setShotLoading(false);
    e.target.value = "";
  }

  async function onYoutube() {
    const url = window.prompt("Paste a YouTube video URL — Echo will pull its real comments:");
    if (!url) return;
    setErr(""); setShotLoading(true);
    try {
      const data = await youtube(url);
      const parsed = data.comments;
      if (!parsed || !parsed.length) {
        setErr("No comments found — that video may have comments turned off.");
      } else {
        resetAnalysis();
        setComments(parsed.map((x, k) => ({ t: x.t, u: x.u || guessHandle(k), time: x.time || "", likes: x.likes })));
        const a = data.account || {};
        setCreator((c) => ({
          ...c,
          handle: a.handle || "youtube",
          name: a.name || "YouTube",
          niche: "Real comments pulled from YouTube",
          followers: a.followers || "—",
          posts: a.posts || "—",
          following: "—",
          bio: a.bio || "",
          avatar: a.avatar || null,
          verified: false,
        }));
      }
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
    setShotLoading(false);
  }

  async function listen() {
    setPhase("listening"); setErr(""); setClusters([]); setNoise(null); setPulse(null); setLabels(null);
    const strings = comments.map((c) => c.t);
    const minWait = new Promise((r) => setTimeout(r, 600));
    try {
      const [out] = await Promise.all([analyze(strings, creator.niche), minWait]);
      const cl = (out.clusters || []).filter((c) => c.title);
      if (!cl.length) throw new Error("empty");
      setClusters(cl);
      setNoise(out.noise && typeof out.noise.count === "number" ? out.noise : null);
      setPulse(out.pulse || null);
      setLabels(Array.isArray(out.labels) ? out.labels.map((x) => String(x).toLowerCase()) : null);
      setScan(out.scan || null);
      setPhase("detected");
    } catch (e) {
      setErr("Echo's engine is unreachable. Is the backend running on :8000?");
      setPhase("idle");
    }
  }

  async function sell(cl) {
    setActive(cl); setOffer(null); setSellEnabled(false); setLink(null); setClickStats(null);
    setGenning(true); setCopied(false); setCloneReplies(null);
    try {
      const out = await generate(cl, creator.niche, seller, { followers: creator.followers, posts: creator.posts, name: creator.name, handle: creator.handle, intent_rate: scan ? scan.intent_rate : undefined });
      setOffer(out.offer);
      setSellEnabled(!!out.sell_enabled);
      setLink(out.link || null);
      // auto-track every brand opportunity in the outreach pipeline
      if (out.offer && out.offer.kind === "brand") {
        const brand = (out.offer.brands && out.offer.brands[0]) || out.offer.product;
        ensurePitch(brand, out.offer.product || "", "To send");
      }
    } catch (e) {
      setErr("Couldn't generate — backend unreachable.");
      setActive(null);
    }
    setGenning(false);
  }

  // local fallback reply, matched to the offer kind
  function localCloneLine() {
    const h = creator.handle;
    if (!offer) return "";
    if (offer.kind === "brand") return `Hey! ${h}'s assistant here 🙂 you asked about ${offer.product} — I'll get you the exact details, hang tight!`;
    if (offer.kind === "video") return `Hey! ${h}'s assistant here 🙂 great idea — a video on “${offer.title}” is on the way because so many of you asked!`;
    if (link) return `Hey! ${h}'s assistant here 🙂 you asked about this — I just made the “${offer.name}” (₹${offer.price_inr}). Grab it here: ${link.url}`;
    return `Hey! ${h}'s assistant here 🙂 you asked for this — ${h} is making “${offer.name}” and we'll share it with you when it's ready!`;
  }

  async function runClone() {
    if (!active || !offer) return;
    setCloning(true); setCloneReplies(null);
    const fans = (active.receipts || []).slice(0, 3);
    const minWait = new Promise((r) => setTimeout(r, 800));
    try {
      const [out] = await Promise.all([clone(offer, link ? link.url : "", fans, '@' + creator.handle), minWait]);
      const r = (out.replies || []).filter((x) => x.text);
      if (!r.length) throw new Error("empty");
      setCloneReplies(r);
    } catch (e) {
      const text = localCloneLine();
      setCloneReplies(fans.map((f) => ({ to: f, lang: "auto", text })));
    }
    setCloning(false);
  }

  function copyText(text) {
    try { navigator.clipboard.writeText(text); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  }
  function copy() { if (link) copyText(link.url); }

  // bundle the brand outreach into a clean, professional pitch (leads with rate + reach, not a tiny count)
  function buildFullPitch() {
    if (!offer || !offer.outreach) return "";
    const o = offer.outreach;
    const lines = [];
    if (o.subject) lines.push("Subject: " + o.subject, "");
    lines.push(o.body, "");
    lines.push("— Why this audience —");
    if (scan && scan.intent_rate) lines.push(`• ${scan.intent_rate}% of engaged comments are direct, unprompted requests for ${offer.product}`);
    if (creator.followers) lines.push(`• ${creator.followers} subscribers, highly engaged`);
    if (pulse && pulse.sentiment && typeof pulse.sentiment.positive === "number") lines.push(`• ${pulse.sentiment.positive}% positive audience sentiment`);
    if (active && active.languages && active.languages.length) lines.push(`• Audience across ${active.languages.join(", ")}`);
    lines.push("", "— About the creator —");
    lines.push(`${creator.name}${creator.niche ? " · " + creator.niche : ""}`);
    if (creator.followers) lines.push(`YouTube · ${creator.followers} subscribers`);
    return lines.join("\n");
  }

  // ---- outreach tracker (auto) ----
  // add a pitch to the pipeline if it isn't there; bump status (e.g. To send -> Sent) if it is
  async function ensurePitch(brand, product, status) {
    if (!brand) return;
    const existing = pitches.find((p) => p.brand === brand && p.product === product);
    try {
      if (existing) {
        const rank = { "To send": 0, "Sent": 1, "Replied": 2, "Negotiating": 3, "Closed": 4 };
        if (status && (rank[status] || 0) > (rank[existing.status] || 0)) {
          const d = await updatePitch(existing.id, { status });
          setPitches(d.pitches || []);
        }
        return;
      }
      let d = await addPitch(brand, product);   // backend stores as "To send"
      let list = d.pitches || [];
      if (status && status !== "To send") {
        const just = list.find((p) => p.brand === brand && p.product === product);
        if (just) { const d2 = await updatePitch(just.id, { status }); list = d2.pitches || list; }
      }
      setPitches(list);
    } catch (e) {}
  }
  async function setPitchStatus(id, status) {
    try { const d = await updatePitch(id, { status }); setPitches(d.pitches || []); } catch (e) {}
  }
  async function setPitchNotes(id, notes) {
    try { const d = await updatePitch(id, { notes }); setPitches(d.pitches || []); } catch (e) {}
  }
  async function removePitch(id) {
    try { const d = await deletePitch(id); setPitches(d.pitches || []); } catch (e) {}
  }
  function exportPitchesCSV() {
    const head = ["Brand", "Product", "Status", "Notes", "Added"];
    const rows = pitches.map((p) => [p.brand, p.product, p.status,
      (p.notes || "").replace(/\s+/g, " "), new Date((p.created || 0) * 1000).toLocaleDateString()]);
    const csv = [head, ...rows]
      .map((r) => r.map((x) => `"${String(x == null ? "" : x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "echo-outreach.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  const PITCH_STAGES = ["To send", "Sent", "Replied", "Negotiating", "Closed"];

  const steps = [
    { k: "Listen", on: true },
    { k: "Detect demand", on: phase !== "idle" },
    { k: "Act", on: !!offer },
  ];

  // the disclosed Clone block, reused across all opportunity types
  function CloneSection({ title, sub }) {
    return (
      <>
        <div className="echo-clone-hd">
          <div className="echo-ready" style={{ margin: "26px 0 0" }}><span className="echo-dot" style={{ background: "var(--coral)" }} /> The Clone · {title}</div>
          <p className="echo-clone-sub">{sub}</p>
        </div>
        {!cloneReplies && (
          <button className="echo-clone-btn" onClick={runClone} disabled={cloning}>
            {cloning ? "Writing replies…" : "Let the Clone reply →"}
          </button>
        )}
        {cloneReplies && (
          <>
            <div className="echo-vs">
              <div className="echo-vs-col bad">
                <div className="echo-vs-tag">Normal comment bot</div>
                <div className="echo-bubble dumb">Done! ✅ Check your DM 📩</div>
                <div className="echo-vs-note">✗ fires on everything, ignores what they said</div>
              </div>
              <div className="echo-vs-col good">
                <div className="echo-vs-tag">Echo Clone</div>
                <div className="echo-bubble smart">{cloneReplies[0].text}</div>
                <div className="echo-vs-note good">✓ only real intent · their language · the right answer</div>
              </div>
            </div>
            <div className="echo-h" style={{ margin: "20px 0 10px" }}>Replies going out</div>
            {cloneReplies.map((r, i) => (
              <div className="echo-thread" key={i}>
                <div className="echo-bubble fan"><span className="q">“</span>{r.to}</div>
                <div className="echo-bubble smart reply">
                  {r.text}
                  <span className="echo-disclose">🤖 sent by @{creator.handle}'s Echo Clone{r.lang && r.lang !== "auto" ? " · " + r.lang : ""}</span>
                  <button className="echo-copy" style={{ marginTop: 8, fontSize: 11, padding: "5px 10px" }}
                    onClick={() => copyText(r.text)}>Copy reply</button>
                </div>
              </div>
            ))}
            <div className="echo-note" style={{ borderStyle: "solid", marginTop: 14 }}>
              Approve and these post through your <b>connected channel</b> — Echo replies as you, around the clock. (YouTube/Instagram only let you reply as your own account, so the creator connects once via OAuth; until then, copy to post.)
            </div>
          </>
        )}
      </>
    );
  }

  // derive the "what to do next" plan from the detected clusters
  const planMoves = clusters.map((cl) => {
    const it = (cl.intent || "product").toLowerCase();
    const kind = it === "buy" ? "brand" : it === "content" ? "video" : "product";
    const sellable = seller || cl.wants_to_pay;
    const label = kind === "brand" ? "Brand deal" : kind === "video" ? "Video to make" : (sellable ? "Product to launch" : "Product to create");
    return { cl, kind, label };
  });
  const planCounts = planMoves.reduce((a, m) => { a[m.kind] = (a[m.kind] || 0) + 1; return a; }, {});
  const planSummary = [
    planCounts.brand ? `${planCounts.brand} brand deal${planCounts.brand > 1 ? "s" : ""} to pursue` : null,
    planCounts.video ? `${planCounts.video} video${planCounts.video > 1 ? "s" : ""} to make` : null,
    planCounts.product ? `${planCounts.product} product${planCounts.product > 1 ? "s" : ""} for your fans` : null,
  ].filter(Boolean);

  return (
    <div className="echo-root">
      <style>{CSS}</style>

      <div className="echo-top">
        <div>
          <div className="echo-logo">
            <div className={"echo-eq" + (phase === "listening" ? " live" : "")}>
              <span /><span /><span /><span />
            </div>
            <div className="echo-word echo-disp">echo</div>
          </div>
          <div className="echo-tag">Your fans already told you what to sell. We just listened.</div>
          <div className="echo-kicker">Creator demand intelligence</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button className="echo-track-btn" onClick={() => setTrackerOpen(true)}>
            ✦ Outreach{pitches.length ? " · " + pitches.length : ""}
          </button>
          {health && (
            <div className="echo-engine">
              <span className="echo-dot" style={{ background: health.llm ? "var(--aqua)" : "var(--muted2)" }} />
              {health.llm ? "LLM live · " + (health.model || "") : "Local engine (no API key)"}
            </div>
          )}
        </div>
      </div>

      <div className="echo-loop">
        {steps.map((s, i) => (
          <div key={s.k} className={"echo-step" + (s.on ? " on" : "")}>
            <span className="echo-dot" /> <b>{i + 1}. {s.k}</b>
          </div>
        ))}
      </div>

      <div className="echo-grid">
        {/* LEFT — the source channel + raw comments */}
        <div className="echo-card">
          <div className="chan">
            {creator.avatar
              ? <img className="chan-av" src={creator.avatar} alt="" />
              : <div className="chan-av echo-disp">{(creator.name || creator.handle || "C")[0].toUpperCase()}</div>}
            <div className="chan-meta">
              <div className="chan-name">{creator.name || creator.handle}</div>
              <div className="chan-src">▶ {creator.niche || "Source channel"}</div>
            </div>
          </div>

          <div className="chan-stats">
            <div className="chan-stat"><div className="v">{creator.followers || "—"}</div><div className="k">subscribers</div></div>
            <div className="chan-stat"><div className="v">{creator.posts || "—"}</div><div className="k">videos</div></div>
            <div className="chan-stat"><div className="v">{comments.length}</div><div className="k">comments read</div></div>
          </div>

          {creator.bio && <div className="chan-bio">{creator.bio}</div>}

          <div className="echo-seller">
            <div>
              <div className="echo-seller-t">Seller mode</div>
              <div className="echo-seller-s">{seller ? "“Make” requests can become paid offers" : "Just create — nothing sold to fans"}</div>
            </div>
            <button className={"echo-switch" + (seller ? " on" : "")} role="switch" aria-checked={seller}
              onClick={() => setSeller((s) => !s)} title="Does this creator sell their own products?"><span /></button>
          </div>

          <div className="src-h">
            <span>Comment inbox</span>
            <span className="n">{comments.length}</span>
          </div>

          <div className="echo-feed ig-feed" ref={feedRef}>
            {comments.map((c, i) => {
              const label = labels && labels[i] ? labels[i] : null;
              const isDemand = label === "buy" || label === "create";
              const isNoise = label === "noise" || (!label && c.noise);
              const filtered = phase === "detected" && isNoise;
              const surfaced = phase === "detected" && isDemand;
              const handle = c.u || guessHandle(i);
              return (
                <div key={i}
                  className={"ig-cm" + (phase === "listening" ? " pulse" : "") + (filtered ? " filtered" : "") + (surfaced ? " surfaced" : "")}
                  style={{ animationDelay: (i % 6) * 0.12 + "s" }}>
                  <div className="ig-cm-av" style={{ background: igTint(handle) }}>{handle[0].toUpperCase()}</div>
                  <div className="ig-cm-body">
                    <div className="ig-cm-text"><b>{handle}</b> {c.t}</div>
                    <div className="ig-cm-meta">
                      <span>{c.time || "now"}</span>
                      {typeof c.likes === "number" && c.likes > 0 && <span>{c.likes} likes</span>}
                      <span>Reply</span>
                      {phase === "detected" && (isDemand
                        ? <span className="ig-flag good">demand · {label === "buy" ? "wants to buy" : "wants this made"}</span>
                        : isNoise
                        ? <span className="ig-flag bad">filtered{c.noise ? " · " + c.noise : ""}</span>
                        : null)}
                    </div>
                  </div>
                  <span className="ig-heart">♡</span>
                </div>
              );
            })}
          </div>

          <button onClick={onYoutube} disabled={shotLoading}
            style={{ width: "100%", marginBottom: 10, background: "rgba(255,107,129,.1)", border: "1px solid rgba(255,107,129,.35)", color: "var(--coral)", borderRadius: 12, padding: "11px", fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            ▶ {shotLoading ? "Pulling comments…" : "Analyze a YouTube video"}
          </button>
          <div className="echo-add">
            <input className="echo-input" placeholder="…or paste comments (one per line)" value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} />
            <button className="echo-mini" onClick={addComment} title="Add pasted comments">+</button>
            <button className="echo-mini" onClick={() => fileRef.current && fileRef.current.click()} title="Import a .txt / .csv of comments">⤴</button>
            <button className="echo-mini" onClick={() => shotRef.current && shotRef.current.click()} title="Read a screenshot of comments (needs a vision model)" disabled={shotLoading}>{shotLoading ? "…" : "◳"}</button>
            <input ref={fileRef} type="file" accept=".txt,.csv" onChange={onUpload} style={{ display: "none" }} />
            <input ref={shotRef} type="file" accept="image/*" onChange={onScreenshot} style={{ display: "none" }} />
          </div>
          <div className="ig-hint">▶ YouTube video · ＋ paste · ⤴ file · ◳ screenshot</div>
          {err && <div className="echo-err" style={{ marginTop: 12 }}>{err}</div>}
          <button className="echo-cta" onClick={listen} disabled={phase === "listening"}>
            {phase === "listening" ? "Listening…" : phase === "detected" ? "↻ Listen again" : "Read this comment section"}
          </button>
        </div>

        {/* RIGHT — demand + sell */}
        <div>
          {phase === "idle" && (
            <div className="echo-card echo-empty">
              <div className="echo-ripple" />
              <div className="big echo-disp">Most of a comment section is noise. Echo finds the demand — and tells you what to do with it.</div>
              <div style={{ maxWidth: 340, fontSize: 13.5, lineHeight: 1.5 }}>
                Spam, scams, trolls and “first 🎉” get filtered out. What's left becomes real moves — brand deals, videos to make, products to launch — each proven with your fans' own words.
              </div>
            </div>
          )}

          {phase === "listening" && (
            <div className="echo-card echo-listening">
              <div className="echo-bigeq">{Array.from({ length: 11 }).map((_, i) => <span key={i} style={{ animationDelay: i * 0.07 + "s" }} />)}</div>
              <div className="lbl">Sifting <b>{comments.length}</b> messages — dropping spam, scams & trolls…</div>
              <div className="lbl" style={{ fontSize: 12.5 }}>clustering real demand · matching products · pulling receipts</div>
            </div>
          )}

          {phase === "detected" && (
            <>
              {planMoves.length > 0 && (
                <div className="echo-plan">
                  <div className="echo-plan-k">What to do next</div>
                  <div className="echo-plan-h">Echo found <b>{planMoves.length} move{planMoves.length > 1 ? "s" : ""}</b> in {comments.length} comments{planSummary.length ? " — " + planSummary.join(" · ") : ""}.</div>
                  {planMoves.map((m, i) => (
                    <div className="echo-plan-row" key={i} onClick={() => sell(m.cl)}>
                      <span className="echo-plan-rank">{i + 1}</span>
                      <span className={"echo-plan-tag " + m.kind}>{m.label}</span>
                      <span className="echo-plan-title">{m.cl.title}</span>
                      <span className="echo-plan-n">{m.cl.fan_count} fans</span>
                      <span className="echo-plan-go">→</span>
                    </div>
                  ))}
                </div>
              )}
              {pulse && (
                <div className="echo-pulse">
                  <div className="echo-pulse-top">
                    <div>
                      <div className="echo-pulse-label">Audience Pulse</div>
                      <div className="echo-pulse-mood">{pulse.mood || "Engaged"}</div>
                    </div>
                    <div className="echo-pulse-res">
                      <div className="num echo-mono">{typeof pulse.resonance === "number" ? pulse.resonance : "—"}</div>
                      <div className="cap">resonance</div>
                    </div>
                  </div>
                  {pulse.sentiment && (
                    <div className="echo-senti" title="positive / neutral / negative">
                      <i className="pos" style={{ flex: Math.max(pulse.sentiment.positive || 0, 1) }} />
                      <i className="neu" style={{ flex: Math.max(pulse.sentiment.neutral || 0, 1) }} />
                      <i className="neg" style={{ flex: Math.max(pulse.sentiment.negative || 0, 1) }} />
                    </div>
                  )}
                  <div className="echo-senti-row">
                    {pulse.sentiment && <span><b className="pos">{pulse.sentiment.positive || 0}%</b> positive</span>}
                    {pulse.shift && <span className="echo-shift">mood {pulse.shift}</span>}
                  </div>
                  {pulse.themes && pulse.themes.length > 0 && (
                    <div className="echo-pulse-themes">
                      {pulse.themes.slice(0, 4).map((t, i) => <span key={i}>{t}</span>)}
                    </div>
                  )}
                  {pulse.insight && <div className="echo-pulse-insight">{pulse.insight}</div>}
                </div>
              )}
              {noise && (
                <div className="echo-sn">
                  <div className="echo-sn-bar">
                    <i className="sig" style={{ flex: Math.max(clusters.reduce((a, c) => a + (c.fan_count || 0), 0), 1) }} />
                    <i className="noi" style={{ flex: Math.max(noise.count, 1) }} />
                  </div>
                  <div className="echo-sn-row">
                    <span><b className="sig">{clusters.reduce((a, c) => a + (c.fan_count || 0), 0)}</b> real demand signals</span>
                    <span><b className="noi">{noise.count}</b> filtered as noise</span>
                  </div>
                  {scan && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted2)", fontFamily: "'Space Mono'" }}>
                      scanned {scan.total} comments · {scan.intent_rate}% buy-intent
                    </div>
                  )}
                  {noise.examples && noise.examples.length > 0 && (
                    <div className="echo-sn-tags">
                      {noise.examples.slice(0, 4).map((e, i) => (
                        <span key={i}>{e.reason}<em>“{(e.text || "").slice(0, 26)}{(e.text || "").length > 26 ? "…" : ""}”</em></span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="echo-h" style={{ marginBottom: 14, fontSize: 14 }}>
                Demand detected <span className="n">{clusters.length} things your fans are asking for</span>
              </div>
              <div className="echo-clusters">
                {clusters.map((cl, i) => <Cluster key={i} cl={cl} i={i} onSell={sell} isSeller={seller} />)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* DRAWER — the generated product */}
      {active && (
        <div className="echo-overlay" onClick={(e) => { if (e.target.classList.contains("echo-overlay")) { setActive(null); } }}>
          <div className="echo-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="echo-badge">From {active.fan_count} fan requests</div>
              <button className="echo-x" onClick={() => setActive(null)}>✕</button>
            </div>

            {genning && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "70px 0" }}>
                <div className="echo-bigeq" style={{ height: 50 }}>{Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ animationDelay: i * 0.07 + "s" }} />)}</div>
                <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Working out the best move for these fans…</div>
              </div>
            )}

            {/* BUY — another brand's product → brand-deal leverage, not a sale */}
            {offer && offer.kind === "brand" && (
              <>
                <div className="echo-ready"><span className="echo-dot" style={{ background: "var(--coral)" }} /> Brand opportunity</div>
                <div className="echo-pname echo-disp">{offer.product}</div>
                {offer.metric && <div className="echo-metric">{offer.metric}</div>}
                <p className="echo-clone-sub" style={{ marginTop: 14 }}>
                  This isn't yours to sell — it's another brand's product. The play is the demand itself: take this proof to the brand and turn the asks into a paid partnership. Echo packaged the pitch.
                </p>

                {/* the leverage: reach + intent rate */}
                <div className="bp-reach">
                  <div><div className="v">{creator.followers || "—"}</div><div className="k">subscribers</div></div>
                  {scan && typeof scan.intent_rate === "number" && (
                    <div><div className="v">{scan.intent_rate}%</div><div className="k">comments buy-intent</div></div>
                  )}
                  <div><div className="v">{active.fan_count}</div><div className="k">asking for this</div></div>
                </div>
                <div className="echo-note" style={{ borderStyle: "solid", marginTop: 12 }}>
                  <b>Why a brand says yes:</b> they aren't buying a few sales — they're buying proof their exact customers convert here, plus your reach. {scan && scan.intent_rate ? `${scan.intent_rate}% of comments asking for them by name` : "Unprompted requests by name"} is a conversion signal most ad spend can't buy.
                </div>

                {/* recommended deal */}
                {offer.deal && offer.deal.recommended && (
                  <div className="bp-deal">
                    <div className="bp-deal-k">Recommended deal</div>
                    <div className="bp-deal-v">{offer.deal.recommended}</div>
                    {offer.deal.rationale && <div className="bp-deal-r">{offer.deal.rationale}</div>}
                  </div>
                )}

                {/* who to pitch */}
                {((offer.brands && offer.brands.length) || offer.where_to_pitch) && (
                  <>
                    <div className="echo-h" style={{ marginBottom: 8 }}>Who to pitch <span className="n">candidates to verify</span></div>
                    {offer.brands && offer.brands.length > 0 && (
                      <div className="echo-langs" style={{ marginBottom: 8 }}>
                        {offer.brands.map((b, i) => <span key={i} style={{ color: "var(--coral)", borderColor: "rgba(255,107,129,.3)" }}>{b}</span>)}
                      </div>
                    )}
                    {offer.where_to_pitch && <div className="bp-deal-r" style={{ marginBottom: 16 }}>{offer.where_to_pitch}</div>}
                  </>
                )}

                {/* the proof: verbatim receipts */}
                {active.receipts && active.receipts.length > 0 && (
                  <>
                    <div className="echo-h" style={{ marginBottom: 8 }}>The proof <span className="n">in their words</span></div>
                    <div className="bp-proof">
                      {active.receipts.slice(0, 3).map((r, i) => (
                        <div className="echo-receipt" key={i}><span className="q">“</span>{r}</div>
                      ))}
                    </div>
                  </>
                )}

                {offer.outreach && (
                  <>
                    <div className="echo-h" style={{ margin: "18px 0 8px" }}>Ready-to-send pitch <span className="n">to the brand</span></div>
                    <div className="echo-pitch">
                      {offer.outreach.subject && <div className="echo-pitch-sub"><span>Subject</span>{offer.outreach.subject}</div>}
                      <div className="echo-pitch-body">{offer.outreach.body}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="echo-copy" onClick={() => copyText(buildFullPitch())}>{copied ? "Copied" : "Copy full pitch"}</button>
                        <button className="echo-copy" style={{ background: "var(--gold)", color: "#1a1206" }}
                          onClick={() => {
                            const subj = encodeURIComponent(offer.outreach.subject || "Partnership inquiry");
                            const body = encodeURIComponent(buildFullPitch().replace(/^Subject:.*\n\n/, ""));
                            window.open("https://mail.google.com/mail/?view=cm&fs=1&su=" + subj + "&body=" + body, "_blank");
                            ensurePitch((offer.brands && offer.brands[0]) || offer.product, offer.product || "", "Sent");
                          }}>✉ Open in Gmail</button>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted2)", fontFamily: "'Space Mono'" }}>
                        ✦ Auto-tracked in your Outreach pipeline · opening Gmail marks it “Sent”
                      </div>
                    </div>
                  </>
                )}

                <CloneSection
                  title="answer these fans"
                  sub={<>Your Clone replies to the <b>{active.fan_count}</b> fans who asked — telling them exactly what {offer.product} is, in their language, around the clock. No selling, no spam.</>}
                />
              </>
            )}

            {/* CONTENT — fans want a video → next-video idea */}
            {offer && offer.kind === "video" && (
              <>
                <div className="echo-ready"><span className="echo-dot" style={{ background: "var(--gold)" }} /> Your next video</div>
                <div className="echo-pname echo-disp">{offer.title}</div>
                {offer.hook && <div className="echo-ptag">“{offer.hook}”</div>}

                {offer.outline && offer.outline.length > 0 && (
                  <div className="echo-bul" style={{ marginTop: 18 }}>
                    {offer.outline.map((b, i) => <div key={i}><span className="t">{i + 1}</span><span>{b}</span></div>)}
                  </div>
                )}
                {offer.why_it_works && (
                  <div className="echo-why"><b>Why it'll land:</b> {offer.why_it_works}</div>
                )}

                <CloneSection
                  title="tell these fans it's coming"
                  sub={<>Your Clone lets the <b>{active.fan_count}</b> fans who asked know the video is on the way — in their language. It builds anticipation instead of selling them anything.</>}
                />
              </>
            )}

            {/* PRODUCT — the creator's own digital good; sell only if they're a seller / fans offered to pay */}
            {offer && offer.kind === "product" && (
              <>
                <div className="echo-ready"><span className="echo-dot" style={{ background: "var(--aqua)" }} /> {sellEnabled ? "Ready to sell" : "Ready to create"}</div>
                <div className="echo-pname echo-disp">{offer.name}</div>
                {offer.tagline && <div className="echo-ptag">{offer.tagline}</div>}

                <div className="echo-prow">
                  {sellEnabled && <div className="echo-chip price"><span className="k">Suggested price</span><span className="v">₹{offer.price_inr}</span></div>}
                  <div className="echo-chip"><span className="k">Format</span><span className="v">{offer.format}</span></div>
                </div>

                {offer.description && <div className="echo-pdesc">{offer.description}</div>}

                <div className="echo-bul">
                  {(offer.listing_copy || []).map((b, i) => <div key={i}><span className="t">✓</span><span>{b}</span></div>)}
                </div>

                {offer.why_it_sells && (
                  <div className="echo-why"><b>Why your fans want it:</b> {offer.why_it_sells}</div>
                )}

                {sellEnabled ? (
                  <>
                    <div className="echo-h" style={{ marginBottom: 8 }}>Your trackable link <span className="n">live</span></div>
                    <div className="echo-link">
                      <a className="url" href={link ? link.url : "#"} target="_blank" rel="noreferrer">{link ? link.url : ""}</a>
                      <button className="echo-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
                    </div>
                    <div className="echo-track">
                      <span><b className="echo-mono">{clickStats ? clickStats.clicks : 0}</b> clicks</span>
                      <span><b className="echo-mono">{clickStats ? clickStats.views : 0}</b> product views</span>
                      <span className="echo-track-hint">open the link in a new tab — this updates live</span>
                    </div>
                    <div className="echo-pub">
                      <button onClick={() => link && window.open(link.url, "_blank")}>Open buyer page</button>
                      <button className="ghost">Send to Gumroad</button>
                    </div>
                  </>
                ) : (
                  <div className="echo-note">
                    This is something your fans want you to make — not a paid pitch, so Echo won't push a checkout at your audience. Flip on <b>Seller mode</b> (top-left) if you'd like to price it and mint a real trackable link.
                  </div>
                )}

                <CloneSection
                  title={sellEnabled ? "reply to these fans" : "tell these fans it's coming"}
                  sub={sellEnabled
                    ? <>Your Clone replies to the <b>{active.fan_count}</b> fans who asked — in their language, with the link — around the clock. It stays silent on the spam.</>
                    : <>Your Clone lets the <b>{active.fan_count}</b> fans who asked know you're making it — in their language. No price, no pressure.</>}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* DRAWER — outreach tracker */}
      {trackerOpen && (
        <div className="echo-overlay" onClick={(e) => { if (e.target.classList.contains("echo-overlay")) setTrackerOpen(false); }}>
          <div className="echo-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div className="echo-plan-k">Outreach tracker</div>
                <div className="echo-pname echo-disp" style={{ fontSize: 22 }}>Your brand pipeline</div>
              </div>
              <button className="echo-x" onClick={() => setTrackerOpen(false)}>✕</button>
            </div>

            {pitches.length === 0 ? (
              <div className="echo-note" style={{ borderStyle: "solid" }}>
                No pitches tracked yet. Open a brand opportunity and hit <b>“＋ Track this pitch”</b> to start your pipeline.
              </div>
            ) : (
              <>
                <table className="echo-trk">
                  <thead><tr><th>Brand</th><th>Status</th><th>Notes</th><th /></tr></thead>
                  <tbody>
                    {pitches.map((p) => (
                      <tr key={p.id}>
                        <td><div className="trk-brand">{p.brand}</div><div className="trk-prod">{p.product}</div></td>
                        <td>
                          <select className="trk-sel" value={p.status || "To send"} onChange={(e) => setPitchStatus(p.id, e.target.value)}>
                            {PITCH_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="trk-notes" defaultValue={p.notes || ""} placeholder="add a note…"
                            onBlur={(e) => { if (e.target.value !== (p.notes || "")) setPitchNotes(p.id, e.target.value); }} />
                        </td>
                        <td><button className="trk-del" onClick={() => removePitch(p.id)} title="Remove">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="echo-copy" style={{ marginTop: 16 }} onClick={exportPitchesCSV}>⤓ Export CSV</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="echo-foot">
        Comments → demand → the right move: a reply, a brand deal, a video, or a product.<br />
        Paste or import a real creator's comments and listen again.
      </div>
    </div>
  );
}