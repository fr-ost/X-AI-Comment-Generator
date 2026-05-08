(() => {
  "use strict";

  const DEFAULT_TONE = [
    "You are a normal X user replying naturally.",
    "Write like I am personally commenting, not like an assistant, analyst, marketer, or engagement farmer.",
    "The reply should sound like my own quick thought, not a neutral AI observation.",
    "Use simple words and contractions.",
    "Do not over-explain. Do not summarize the tweet.",
    "Never use the word curious.",
    "Do not repeat the same sentence opening across replies.",
    "Do not always start with I’d, I think, I like, I wonder, or I’m.",
    "Mix tone depending on the post: practical, skeptical, witty, supportive, technical, user-focused, cost-focused, execution-focused, or community-focused.",
    "Avoid generic praise like amazing, insightful, well said, interesting, powerful, great point.",
    "Avoid robotic phrases like this highlights, it is important, overall, worth noting.",
    "Do not use em dash or en dash.",
    "Use emoji only if the tweet already has emoji and it truly fits.",
    "Best replies should feel personal: a quick reaction, small opinion, natural question, slight doubt, practical concern, or specific observation."
  ].join(" ");

  const RECENT_KEY = "uniqueLabs_recentReplies_v5";
  const STYLE_KEY = "uniqueLabs_lastStyles_v3";
  const OPENINGS_KEY = "uniqueLabs_recentOpenings_v1";
  const MEMORY_KEYS = [RECENT_KEY, STYLE_KEY, OPENINGS_KEY];

  function hasExtensionRuntime() {
    return typeof chrome !== "undefined" && chrome?.runtime && typeof chrome.runtime.sendMessage === "function";
  }

  function extensionContextError() {
    return new Error("Extension context is not available on this X tab. Refresh the X page after loading/updating the extension, then try again.");
  }

  // Fetch user's custom tone string from extension storage. Falls back gracefully
  // if storage is unreachable (extension reload, etc).
  async function getCustomTone() {
    try {
      if (chrome?.storage?.local?.get) {
        const s = await chrome.storage.local.get({ customTone: "" });
        return String(s.customTone || "").trim();
      }
      if (hasExtensionRuntime()) {
        const res = await chrome.runtime.sendMessage({ type: "UNIQUE_XCG_GET_TONE" });
        return String(res?.customTone || "").trim();
      }
    } catch (_) {}
    return "";
  }

  // Fetch the user's output-delivery mode: "insert" (default) drops the
  // reply directly into X's reply box; "clipboard" copies it instead and
  // leaves the box untouched.
  async function getOutputMode() {
    try {
      if (chrome?.storage?.local?.get) {
        const s = await chrome.storage.local.get({ outputMode: "insert" });
        return s.outputMode === "clipboard" ? "clipboard" : "insert";
      }
    } catch (_) {}
    return "insert";
  }

  if (typeof chrome !== "undefined" && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type !== "UNIQUE_XCG_CLEAR_MEMORY") return false;
      try { MEMORY_KEYS.forEach((key) => localStorage.removeItem(key)); } catch {}
      sendResponse({ ok: true });
      toast("Reply memory cleared.");
      return true;
    });
  }

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function getRecentReplies() {
    const v = lsGet(RECENT_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  function addRecentReply(t) {
    const txt = String(t || "").trim();
    if (!txt) return;
    const list = getRecentReplies();
    list.unshift(txt);
    lsSet(RECENT_KEY, [...new Set(list)].slice(0, 160));
  }

  const STYLE_ID = "unique-labs-x-comment-generator-2-style";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    // Light, minimalist buttons that read as part of X's UI but stand on their
    // own. Single accent color, hairline borders, ripple on click, no glow.
    // The accent is driven by --xcg-accent which we override per-button to
    // implement the gas-gauge: green → amber → red as the daily limit nears.
    style.textContent = `
.unique-xcg-wrap{display:inline-flex;align-items:center;gap:6px;margin-left:8px;flex-wrap:wrap}
.unique-xcg-btn{
  --xcg-accent:#0f172a;
  --xcg-accent-soft:rgba(15,23,42,.06);
  position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-height:30px;padding:6px 13px;border-radius:999px;
  border:1px solid rgba(15,23,42,.18);
  background:#ffffff;color:var(--xcg-accent);
  cursor:pointer;font-size:13px;font-weight:600;line-height:16px;
  white-space:nowrap;user-select:none;overflow:hidden;isolation:isolate;
  transition:transform .14s ease, background .14s ease, border-color .14s ease, color .14s ease, box-shadow .14s ease;
}
.unique-xcg-btn .xcg-ico{width:13px;height:13px;display:inline-block;flex:none}
.unique-xcg-btn:hover{
  background:var(--xcg-accent);color:#ffffff;border-color:var(--xcg-accent);
  transform:translateY(-1px);
  box-shadow:0 6px 16px rgba(15,23,42,.12);
}
.unique-xcg-btn:active{transform:translateY(0) scale(.97);transition-duration:.06s}
.unique-xcg-btn[data-busy="1"]{cursor:wait;opacity:.85;pointer-events:none}
.unique-xcg-btn[data-busy="1"] .xcg-ico{animation:uniqueXcgSpin .8s linear infinite}
.unique-xcg-btn.gauge-warn{--xcg-accent:#b45309;border-color:rgba(180,83,9,.35);color:#b45309}
.unique-xcg-btn.gauge-warn:hover{background:#b45309;color:#fff;border-color:#b45309}
.unique-xcg-btn.gauge-bad {--xcg-accent:#b91c1c;border-color:rgba(185,28,28,.35);color:#b91c1c}
.unique-xcg-btn.gauge-bad:hover {background:#b91c1c;color:#fff;border-color:#b91c1c}
.unique-xcg-ripple{position:absolute;width:14px;height:14px;border-radius:999px;background:currentColor;opacity:.18;transform:translate(-50%,-50%) scale(0);pointer-events:none;animation:uniqueXcgRipple .55s ease-out forwards;z-index:5}

/* Floating regenerate button — sits next to the composer textbox */
.unique-xcg-regen{
  position:absolute;z-index:99999;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  width:32px;height:32px;padding:0;border-radius:999px;
  background:#ffffff;color:#0f172a;border:1px solid rgba(15,23,42,.16);
  cursor:pointer;
  box-shadow:0 4px 14px rgba(15,23,42,.10);
  transition:transform .14s ease, background .14s ease, color .14s ease, box-shadow .14s ease;
}
.unique-xcg-regen:hover{background:#0f172a;color:#ffffff;transform:translateY(-1px) rotate(-25deg);box-shadow:0 8px 22px rgba(15,23,42,.18)}
.unique-xcg-regen:active{transform:translateY(0) rotate(-25deg) scale(.95)}
.unique-xcg-regen[data-busy="1"]{pointer-events:none;opacity:.7}
.unique-xcg-regen[data-busy="1"] .xcg-ico{animation:uniqueXcgSpin .7s linear infinite}
.unique-xcg-regen .xcg-ico{width:15px;height:15px}

/* Toast — calm, light, no emoji prefix */
.unique-xcg-toast{
  position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999999;
  background:#0f172a;color:#fff;
  padding:10px 16px;border-radius:999px;
  font-size:13px;font-weight:500;letter-spacing:-.005em;
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  max-width:90vw;text-align:center;
  box-shadow:0 10px 30px rgba(0,0,0,.20);
  animation:uniqueXcgToastPop .18s ease-out;
}
.unique-xcg-toast.error{background:#b91c1c}

@keyframes uniqueXcgSpin{to{transform:rotate(360deg)}}
@keyframes uniqueXcgRipple{to{transform:translate(-50%,-50%) scale(14);opacity:0}}
@keyframes uniqueXcgToastPop{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

@media(prefers-color-scheme: dark){
  .unique-xcg-btn{--xcg-accent:#e7e9ee;background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.18);color:#e7e9ee}
  .unique-xcg-btn:hover{background:#e7e9ee;color:#0f172a;border-color:#e7e9ee}
  .unique-xcg-btn.gauge-warn{--xcg-accent:#fbbf24;border-color:rgba(251,191,36,.40);color:#fbbf24}
  .unique-xcg-btn.gauge-warn:hover{background:#fbbf24;color:#0f172a}
  .unique-xcg-btn.gauge-bad{--xcg-accent:#f87171;border-color:rgba(248,113,113,.45);color:#f87171}
  .unique-xcg-btn.gauge-bad:hover{background:#f87171;color:#0f172a}
  .unique-xcg-regen{background:#15181f;color:#e7e9ee;border-color:rgba(255,255,255,.18)}
  .unique-xcg-regen:hover{background:#e7e9ee;color:#0f172a;border-color:#e7e9ee}
  .unique-xcg-toast{background:#e7e9ee;color:#0f172a}
  .unique-xcg-toast.error{background:#f87171;color:#0f172a}
}
`;
    document.head.appendChild(style);
  }

  function toast(msg, opts = {}) {
    document.querySelector(".unique-xcg-toast")?.remove();
    const el = document.createElement("div");
    el.className = "unique-xcg-toast" + (opts.error ? " error" : "");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), opts.ms ?? 2800);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  const BANNED_PHRASES = [
    "curious", "i'm curious", "i am curious", "curious how", "curious if", "curious whether", "curious to see", "curious about",
    "sounds like", "it sounds like", "seems like", "it seems like", "looks like", "it looks like", "feels like", "it feels like",
    "as an ai", "overall", "in conclusion", "one thing to note", "this highlights", "it's important", "it is important",
    "from my perspective", "i would suggest", "i recommend", "well said", "insightful", "intriguing", "great point",
    "powerful", "valuable insight", "couldn't agree more", "this is huge", "game changer", "big if true", "love to see it",
    "thanks for sharing", "very informative", "nicely explained", "absolutely", "definitely worth", "super interesting",
    "exciting times", "massive update", "huge opportunity", "strong fundamentals", "promising project", "the future is bright",
    "keep building", "great thread", "excited", "excited to see", "i'm excited", "super excited", "interesting to see",
    "will be interesting", "watching this closely", "worth watching", "keen to see", "looking forward", "can't wait to see",
    "strong update", "huge update", "big move"
  ];

  const EMOJI_RE = /(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;
  function hasEmoji(t) { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(String(t || "")); }
  function stripEmoji(t) { EMOJI_RE.lastIndex = 0; return String(t || "").replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim(); }

  // Collapses repeated text into a single copy. Iterates to a fixed point so
  // 8x repeats reduce to 1x in a single call (previously each call only
  // halved). Two strategies:
  //   1. If the string is exactly the same content twice, return half.
  //   2. Otherwise, dedupe sentence-by-sentence, dropping any sentence whose
  //      normalised form matches the previous one.
  // Loops until the output stops shrinking.
  function collapseExactDuplication(t) {
    let s = String(t || "").replace(/\s+/g, " ").trim();
    if (!s) return s;
    const onePass = (input) => {
      // Strategy 1: exact-half mirror
      for (let i = Math.floor(input.length / 2); i >= 8; i--) {
        const a = input.slice(0, i).trim();
        const b = input.slice(i).trim();
        if (a && b && a.toLowerCase() === b.toLowerCase()) return a;
      }
      // Strategy 2: dedupe consecutive identical sentences
      const parts = input.match(/[^.!?]+[.!?]?/g) || [input];
      const out = [];
      for (const part of parts) {
        const clean = part.trim();
        if (!clean) continue;
        const norm = clean.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const prev = out.length ? out[out.length - 1].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "";
        if (norm && norm === prev) continue;
        out.push(clean);
      }
      return out.join(" ").replace(/\s+/g, " ").trim();
    };
    // Iterate to a fixed point. Cap at 10 to avoid pathological loops.
    for (let i = 0; i < 10; i++) {
      const next = onePass(s);
      if (next === s) break;
      s = next;
    }
    return s;
  }

  function sanitizeText(t) {
    let s = String(t || "").trim();
    s = s.replace(/[—–]/g, ",").replace(/["“”]/g, "");
    s = s.replace(/^\s*(ad|ads)\s*\d+\s*[,.:;-]?\s*/i, "");
    s = s.replace(/\b(ad|ads)\s*\d+\b/gi, " ");
    s = s.replace(/(^|\s)(?:\d+\s*,\s*){2,}\d+(\s|$)/g, " ");
    s = s.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1");
    for (const p of BANNED_PHRASES) {
      const re = new RegExp("\\b" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "ig");
      s = s.replace(re, "");
    }
    s = s.replace(/\s{2,}/g, " ").trim().replace(/^[,.:;!?]+/, "").trim();
    s = collapseExactDuplication(s);
    return s;
  }

  function killCuriousPatterns(t) {
    let s = String(t || "").trim();
    const patterns = [/\bi['’]?m curious\b/gi, /\bi am curious\b/gi, /\bcurious how\b/gi, /\bcurious if\b/gi, /\bcurious whether\b/gi, /\bcurious to see\b/gi, /\bcurious about\b/gi, /\bcurious\b/gi];
    for (const re of patterns) s = s.replace(re, "");
    return s.replace(/\s{2,}/g, " ").trim().replace(/^[,.:;!?]+/, "").trim();
  }

  /**
   * Detects "gibberish" output where the model has drifted into other
   * scripts mid-reply (CJK, Bengali, Devanagari, IPA, Cyrillic, etc.)
   * because of overly-aggressive presence/frequency penalties or noise.
   *
   * We're permissive about emoji (handled separately) and tolerate up to
   * one stray non-Latin character total — sometimes the model legitimately
   * uses one, e.g. an é or a € symbol. More than that is a hard reject.
   *
   * Returns true if the text should be regenerated.
   */
  function containsGibberish(t) {
    const s = String(t || "");
    if (!s) return false;
    // Strip emoji first so we don't false-positive on emoji-heavy replies.
    EMOJI_RE.lastIndex = 0;
    const noEmoji = s.replace(EMOJI_RE, "");
    // Match characters from non-Latin scripts that the model has no business
    // producing in an English X reply.
    //   \u0400-\u04FF  Cyrillic
    //   \u0500-\u052F  Cyrillic supplement
    //   \u0590-\u05FF  Hebrew
    //   \u0600-\u06FF  Arabic
    //   \u0700-\u074F  Syriac
    //   \u0900-\u097F  Devanagari
    //   \u0980-\u09FF  Bengali
    //   \u0A00-\u0A7F  Gurmukhi
    //   \u0A80-\u0AFF  Gujarati
    //   \u0B00-\u0B7F  Oriya
    //   \u0B80-\u0BFF  Tamil
    //   \u0C00-\u0C7F  Telugu
    //   \u0E00-\u0E7F  Thai
    //   \u1100-\u11FF  Hangul Jamo
    //   \u3040-\u309F  Hiragana
    //   \u30A0-\u30FF  Katakana
    //   \u3100-\u312F  Bopomofo
    //   \u3400-\u4DBF  CJK Extension A
    //   \u4E00-\u9FFF  CJK Unified Ideographs
    //   \uAC00-\uD7AF  Hangul Syllables
    //   \u0250-\u02AF  IPA Extensions  (the ɖʌʙ characters seen in the bug)
    const NON_LATIN = /[\u0250-\u02AF\u0400-\u052F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0900-\u097F\u0980-\u09FF\u0A00-\u0AFF\u0B00-\u0BFF\u0C00-\u0C7F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/g;
    const matches = noEmoji.match(NON_LATIN) || [];
    if (matches.length > 1) return true;
    // Also reject text with too many private-use or replacement characters.
    if (/[\uFFFD\uE000-\uF8FF]/.test(noEmoji)) return true;
    // Also reject if the text has mojibake-like patterns (long runs of mixed
    // case mid-word with no spaces). This catches "ɖʌʙ mpl" style failures.
    if (/[a-z][A-Z]{2,}[a-z]/.test(noEmoji)) {
      // But allow normal acronyms like "BTC" or "NFT" which are surrounded
      // by spaces.
      const tokens = noEmoji.split(/\s+/);
      const badToken = tokens.some((tok) => /^[a-z]+[A-Z]{2,}[a-z]+/.test(tok) && !/^[A-Za-z]{1,3}$/.test(tok));
      if (badToken) return true;
    }
    return false;
  }

  const wordCount = (t) => (String(t || "").match(/\b[\w’']+\b/g) || []).length;
  function trimWords(t, max) {
    const words = String(t || "").trim().split(/\s+/);
    if (words.length <= max) return String(t || "").trim();
    return words.slice(0, max).join(" ").replace(/[,:;]+$/g, "").trim();
  }
  function applyEndPunct(t, punct) {
    let s = String(t || "").trim().replace(/[.?!]+$/g, "").trim();
    return s ? s + punct : s;
  }
  function tokenize(t) { return (String(t || "").toLowerCase().match(/\b[\w’']+\b/g) || []).filter(Boolean); }

  function tooSimilar(candidate) {
    const recent = getRecentReplies().slice(0, 22);
    const A = new Set(tokenize(candidate));
    if (A.size < 4) return false;
    for (const r of recent) {
      const B = new Set(tokenize(r));
      let inter = 0;
      for (const x of A) if (B.has(x)) inter++;
      const union = A.size + B.size - inter;
      if ((union ? inter / union : 0) >= 0.52) return true;
    }
    return false;
  }

  function getOpeningKey(t) {
    const s = String(t || "").trim().toLowerCase();
    if (s.startsWith("i’d ") || s.startsWith("i'd ")) return "id";
    if (s.startsWith("i’m ") || s.startsWith("i'm ")) return "im";
    if (s.startsWith("i am ")) return "iam";
    if (s.startsWith("i think")) return "ithink";
    if (s.startsWith("i like")) return "ilike";
    if (s.startsWith("i wonder")) return "iwonder";
    if (s.startsWith("i want")) return "iwant";
    if (s.startsWith("i still")) return "istill";
    if (s.startsWith("this ")) return "this";
    if (s.startsWith("that ")) return "that";
    if (s.startsWith("the ")) return "the";
    if (s.startsWith("fees ")) return "fees";
    if (s.startsWith("speed ")) return "speed";
    if (s.startsWith("users ")) return "users";
    if (s.startsWith("execution ")) return "execution";
    if (s.startsWith("honestly")) return "honestly";
    if (s.startsWith("ngl")) return "ngl";
    if (s.startsWith("lowkey")) return "lowkey";
    if (s.startsWith("fair")) return "fair";
    if (s.startsWith("not gonna lie")) return "ngl-long";
    return s.split(/\s+/)[0] || "";
  }
  function hasRepeatedOpening(t) {
    const key = getOpeningKey(t);
    if (!key) return false;
    const recentOpenings = lsGet(OPENINGS_KEY, []);
    return recentOpenings.slice(0, 5).includes(key);
  }
  function saveOpening(t) {
    const key = getOpeningKey(t);
    if (!key) return;
    const recentOpenings = lsGet(OPENINGS_KEY, []);
    lsSet(OPENINGS_KEY, [key, ...recentOpenings].slice(0, 12));
  }

  function hasOverusedPattern(t) {
    const s = String(t || "").toLowerCase();
    const patterns = ["curious", "i'm curious", "i am curious", "curious how", "curious if", "curious whether", "curious to see", "excited", "excited to see", "interesting to see", "will be interesting", "watching this", "watching closely", "worth watching", "promising", "strong update", "huge update", "big move", "game changer", "love to see", "looking forward", "can't wait"];
    if (patterns.some((p) => s.includes(p))) return true;
    const repeatedStarts = [/^i['’]?d\b/i, /^i would\b/i, /^i think\b/i, /^i like\b/i, /^i wonder\b/i, /^i['’]?m\b/i];
    const recentReplies = getRecentReplies().slice(0, 6).join("\n").toLowerCase();
    for (const re of repeatedStarts) {
      if (re.test(s)) {
        const sameCount = recentReplies.split("\n").filter((r) => re.test(r.trim())).length;
        if (sameCount >= 1) return true;
      }
    }
    return false;
  }

  function enforceQuestion(t) {
    let raw = killCuriousPatterns(String(t || ""));
    const words = (raw.match(/\b[\w’']+\b/g) || []).slice(0, 10);
    let s = words.join(" ").trim();
    if (!/^(why|how|what|when|where|who|which|is|are|was|were|do|does|did|can|could|should|would|will|any)\b/i.test(s)) {
      const starters = ["Do you think", "Would this", "Could this", "Any idea if", "Does this", "Is there", "How much"];
      s = `${starters[Math.floor(Math.random() * starters.length)]} ${words.join(" ")}`.trim().split(/\s+/).slice(0, 10).join(" ");
    }
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return applyEndPunct(s, "?");
  }

  const HUMAN_OPENERS = ["Honestly,", "Ngl,", "Wait,", "Okay,", "Lowkey,", "Fair,", "That part matters,", "Not gonna lie,"];
  function maybeAddHumanOpener(reply, tweetText) {
    let out = String(reply || "").trim();
    if (!out) return out;
    if (/^(honestly|ngl|wait|okay|lowkey|fair|lol|lmao|damn|wow|bro|not gonna lie|i'm|i am|i like|i think|i wonder|i feel|i’d|i'd|that|this|fees|speed|execution|users|the)\b/i.test(out)) return out;
    let chance = 0.09;
    const tweetLen = String(tweetText || "").length;
    if (tweetLen > 250) chance -= 0.04;
    if (tweetLen < 90) chance += 0.02;
    if (/[?!]/.test(tweetText)) chance += 0.02;
    chance = Math.max(0.03, Math.min(0.16, chance));
    if (Math.random() > chance) return out;
    const opener = HUMAN_OPENERS[Math.floor(Math.random() * HUMAN_OPENERS.length)];
    return `${opener} ${out}`.replace(/\s{2,}/g, " ").trim();
  }

  function pickReplyStyle(tweetText) {
    const text = String(tweetText || "").toLowerCase();
    const pools = {
      general: ["personal opinion", "short reaction", "small observation", "soft disagreement", "practical angle", "user perspective", "casual thought", "light skepticism", "specific detail reaction", "simple conversational reply", "direct statement", "non-first-person observation", "plainspoken reaction", "slight doubt", "real-world impact angle"],
      crypto: ["skeptical but fair", "practical user-focused", "fee and speed focused", "casual trader reaction", "quietly bullish", "cautious optimism", "realistic concern", "simple user perspective", "utility-focused", "adoption-focused", "liquidity angle", "market reaction angle", "friction-focused"],
      ai: ["technical but casual", "real-world use case focused", "skeptical about execution", "data-quality focused", "practical observation", "human behavior angle", "quietly impressed", "infrastructure-focused", "slightly doubtful", "future-use focused", "model quality angle", "workflow angle"],
      reward: ["participant perspective", "reward structure focused", "competition angle", "fairness-focused", "casual opportunity reaction", "leaderboard-focused", "risk-reward angle", "community-focused", "user incentive angle", "simple personal reaction", "grind angle", "reward clarity angle"],
      funny: ["dry humor", "playful", "casual joke", "slightly sarcastic", "short punchy reaction", "meme-like but natural", "friendly teasing"],
      problem: ["cautious", "skeptical", "concerned", "realistic", "risk-focused", "user-protection focused", "trust-focused", "execution concern", "tradeoff angle"]
    };
    let pool = [...pools.general];
    if (/(token|airdrop|staking|defi|web3|chain|cross-chain|fees|gas|protocol|wallet|btc|eth|solana|base|listing)/i.test(text)) pool = pool.concat(pools.crypto);
    if (/(ai|agent|model|robot|data|training|automation|infra|compute|llm)/i.test(text)) pool = pool.concat(pools.ai);
    if (/(reward|campaign|contest|leaderboard|usdc|earn|quest|points|season|beta)/i.test(text)) pool = pool.concat(pools.reward);
    if (/(lol|lmao|funny|meme|joke|😂|🤣)/i.test(text)) pool = pool.concat(pools.funny);
    if (/(risk|issue|problem|delay|hack|scam|bug|glitch|failed|loss|concern|exploit)/i.test(text)) pool = pool.concat(pools.problem);
    const lastStyles = lsGet(STYLE_KEY, []);
    const filtered = pool.filter((s) => !lastStyles.includes(s));
    const finalPool = filtered.length ? filtered : pool;
    const picked = finalPool[Math.floor(Math.random() * finalPool.length)];
    lsSet(STYLE_KEY, [picked, ...lastStyles].slice(0, 10));
    return picked;
  }

  function cleanPart(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function addUniquePart(parts, text) {
    const t = cleanPart(text);
    if (!t || t.length < 2) return;
    if (!parts.some((p) => p.toLowerCase() === t.toLowerCase())) parts.push(t);
  }

  function extractTweet(article) {
    let author = "user";
    const userArea = article.querySelector('[data-testid="User-Name"]');
    if (userArea) {
      const handle = [...userArea.querySelectorAll("span")].map((s) => cleanPart(s.innerText || s.textContent)).find((t) => /^@[\w_]+$/.test(t));
      if (handle) author = handle.replace("@", "");
    }

    const parts = [];
    article.querySelectorAll('[data-testid="tweetText"]').forEach((el, idx) => {
      const prefix = idx > 0 ? "Quoted/attached text: " : "";
      addUniquePart(parts, prefix + (el.innerText || el.textContent || ""));
    });

    article.querySelectorAll('img[alt]').forEach((img) => {
      const alt = cleanPart(img.getAttribute("alt"));
      if (alt && !/^(image|photo|avatar|profile picture)$/i.test(alt) && alt.length > 3) {
        addUniquePart(parts, "Image alt: " + alt);
      }
    });

    article.querySelectorAll('a[href]').forEach((a) => {
      const txt = cleanPart(a.innerText || a.textContent);
      const href = a.getAttribute("href") || "";
      if (txt.length > 8 && !txt.startsWith("@") && !/^\d+[smhd]?$/.test(txt) && !/\/status\//.test(href)) {
        addUniquePart(parts, "Link/card text: " + txt);
      }
    });

    article.querySelectorAll('[data-testid="card.wrapper"], [data-testid="previewInterstitial"], [data-testid="tweetPhoto"], [data-testid="videoComponent"]').forEach((el) => {
      const txt = cleanPart(el.innerText || el.textContent);
      if (txt.length > 8) addUniquePart(parts, "Media/card context: " + txt);
    });

    const tweetText = parts.join("\n").slice(0, 1800);
    return { author, tweetText };
  }

  // Maps keywords found in the user's customTone (or nature of tweet) to an
  // emoji policy. AI tends to over-emoji which is a major bot tell, so we set
  // explicit caps. Returns the rule string we'll splice into the system prompt.
  function pickEmojiPolicy({ customTone, tweetHasEmoji }) {
    const t = String(customTone || "").toLowerCase();
    // Strict-no-emoji vibes
    if (/skeptic|blunt|founder|analytic|critical|technical|cynic|dry|serious|professional|bear/.test(t)) {
      return "Do not use emoji. Even if the tweet has emoji, do not add any.";
    }
    // Single-emoji-allowed vibes
    if (/dev|engineer|practical|trader|realist|observ|grounded/.test(t)) {
      return tweetHasEmoji
        ? "Use at most one emoji, only if it adds real meaning. Often zero is better."
        : "Do not use emoji.";
    }
    // Slightly-more-emoji vibes
    if (/witty|playful|sarcas|hum(o|ou)r|fun/.test(t)) {
      return "Use at most one emoji. Skip emoji if the joke lands without one.";
    }
    if (/support|warm|friendly|kind|enthusi|excite|community|hype|positive/.test(t)) {
      return tweetHasEmoji
        ? "Up to two emoji are allowed if they truly fit the warmth. Never more than two."
        : "At most one emoji, only if it feels natural. Often zero is better.";
    }
    // Fallback to existing behaviour: tweet had emoji → at most 1, else none.
    return tweetHasEmoji
      ? "Emoji is allowed, but use at most one and only if it feels natural."
      : "Do not use emoji.";
  }

  function buildMessages({ author, tweetText, mode, strict, customTone, rejectedReply }) {
    const tweetHasEmoji = hasEmoji(tweetText);
    const replyStyle = pickReplyStyle(tweetText);
    const emojiRule = pickEmojiPolicy({ customTone, tweetHasEmoji });
    const recentOpenings = lsGet(OPENINGS_KEY, []);
    const tonePref = (customTone && customTone.trim()) ? customTone.trim() : DEFAULT_TONE;
    const systemBase = [
      "You write extremely natural X replies.",
      "You are not an assistant.",
      "You are not writing marketing copy.",
      "You are not explaining the tweet.",
      "You are not farming engagement.",
      "You are a real person leaving a quick personal comment.",
      "Write in plain English using only standard Latin letters, digits, and punctuation.",
      "Do not include Chinese, Japanese, Korean, Arabic, Bengali, Hindi, Cyrillic, IPA, or any other non-Latin script.",
      "Do not include foreign words unless they are common English loanwords.",
      "Do not include random uppercase letter sequences inside words.",
      "Never use the word curious.",
      "Do not repeat the same opening style.",
      "Output only the final reply text."
    ].join(" ");
    // The user's custom tone goes into the system message so it has the strongest
    // influence on the model, while still being constrained by the safety rails.
    const customToneBlock = (customTone && customTone.trim())
      ? `\n\nUSER PERSONA AND TONE (follow this voice):\n${customTone.trim()}`
      : "";
    const emojiPolicyBlock = `\n\nEMOJI POLICY: ${emojiRule}`;
    const system = systemBase + customToneBlock + emojiPolicyBlock;

    const common = `
CORE STYLE:
- Sound like a real X user speaking naturally.
- First-person is allowed, but do not overuse it.
- Do not start every reply with I’d, I think, I like, I wonder, or I’m.
- Mix sentence openings naturally.
- The comment should sound like my own thought, not a neutral AI observation.
- Be specific to the tweet.
- Do not summarize the tweet.
- Do not repeat the tweet wording too much.
- Do not use generic praise.
- Do not sound polished, corporate, motivational, academic, or like an AI tool.
- Do not write like a bot trying to increase engagement.
- Use simple natural English.
- Use contractions when natural.
- Preserve meaningful numbers, prices, dates, APR, rankings, percentages, reward amounts, and campaign names.
- Never use em dash or en dash.
- Never use the word "curious".
- Avoid repeated mood words like excited, interesting, watching, huge, strong, promising.
- ${emojiRule}

RECENT OPENING TYPES TO AVOID:
${recentOpenings.slice(0, 5).join(", ") || "none"}

ANGLE SELECTION:
Choose one angle only, based on the tweet:
- Personal opinion
- Practical concern
- User benefit
- Execution angle
- Cost/speed angle
- Trust angle
- Community angle
- Competition angle
- Skeptical angle
- Simple direct reaction
- Non-first-person observation
- Short witty reaction
- Risk/reward angle
Do not use the same angle repeatedly.

HUMAN QUALITY:
- The reply should feel like something I personally typed.
- Use first-person voice sometimes, but not every single reply.
- It can be slightly imperfect, but still clear.
- It should have one small human angle: doubt, humor, realism, usefulness, cost, speed, trust, execution, community, or a real opinion.
- Avoid neutral AI-style observations.
- Avoid forced positivity.
- Avoid ending every reply with hype.
- Avoid using the author's handle unless necessary.
- Avoid sounding like customer support.
- Avoid saying the obvious.
- Make the reply feel tied to one detail in the tweet.

BANNED PHRASES:
${BANNED_PHRASES.join(", ")}

TARGET STYLE:
${replyStyle}`.trim();
    const recent = getRecentReplies().slice(0, 16);
    const antiRepeat = recent.length ? `\nRECENT REPLIES TO AVOID COPYING:\n${recent.map((r) => "- " + r).join("\n")}\n\nDo not reuse their structure, opening, main wording, or angle.` : "";

    const normalTask = `
TASK:
Generate 10 possible replies silently.
Each reply must use a DIFFERENT tone, opening, and structure.
Reject replies that sound similar to recent outputs.
Reject replies that use the word "curious".
Reject replies that start with the same opening type as recent replies.
Reject replies that overuse words like excited, interesting, watching, huge, strong, promising.
Choose the reply that sounds most natural for this exact tweet.
Return only the best one.

STYLE VARIETY RULES:
- Never use the word "curious" in the final reply.
- Do not start with "I’d" if recent replies used "I’d".
- Do not always start with "I like", "I think", "I wonder", or "I’m".
- Mix sentence openings: This, That, The, Users, Fees, Speed, Execution, Honestly, Ngl, direct opinion without first-person, short skeptical reaction, practical user-focused sentence.
- Mix reply types: personal opinion, slight doubt, practical user angle, casual reaction, technical observation, soft disagreement, witty reaction, risk/reward, community angle, execution angle.
- Pick only one style that fits the tweet.
- Avoid sounding like a template.

RULES FOR FINAL REPLY:
- 8 to 22 words.
- One sentence preferred.
- Must react to one concrete detail from the tweet.
- Should sound like I am personally talking, but not always first-person.
- Should not sound like an AI-generated comment.
- Should not sound like a promotional shill.
- No hashtags unless the tweet itself is hashtag-heavy.
- No quotation marks around the reply.
${strict ? "- Be more casual, more varied, less polished, and more direct. Still never use curious or repeated openings." : ""}`.trim();

    const questionTask = `
TASK:
Write one natural short question.

STYLE VARIETY RULES:
- Never use the word "curious" in the final question.
- Vary question openings: Do you think, Would this, Could this, Is there, How much, What happens if, Any idea if, Does this.
- Ask about one specific detail from the tweet.
- Avoid generic engagement questions.

RULES FOR FINAL QUESTION:
- 5 to 10 words.
- Must end with ?.
- Do not ask generic questions like "What do you think?" or "How do you feel?"
- Do not sound like engagement farming.
- No quotation marks around the question.
${strict ? "- Make it more direct, personal, and natural. Still never use curious." : ""}`.trim();

    const rejectedBlock = (rejectedReply && rejectedReply.trim())
      ? `\n\nREJECTED DRAFT (the user did NOT like this — write something COMPLETELY different in tone, structure, opening, and angle):\n"""${rejectedReply.trim()}"""\n`
      : "";

    const user = `${common}\n\n${mode === "question" ? questionTask : normalTask}\n${antiRepeat}${rejectedBlock}\n\nTWEET:\nAuthor: @${author}\nText:\n"""${tweetText}"""\n\nUSER TONE PREFERENCE:\n${tonePref}\n\nReturn only the final reply.`.trim();
    return [{ role: "system", content: system }, { role: "user", content: user }];
  }

  async function callOpenAI({ tweetText, author, mode = "normal", strict = false, customTone = null, rejectedReply = null }) {
    // Fetch custom tone once per top-level call; reuse on retries to avoid extra storage hits.
    if (customTone === null) customTone = await getCustomTone();
    const messages = buildMessages({ author, tweetText, mode, strict, customTone, rejectedReply });
    if (!hasExtensionRuntime()) throw extensionContextError();

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: "OPENAI_CHAT_COMPLETION",
        messages,
        maxTokens: mode === "question" ? 60 : undefined,
        presencePenalty: 0.6,
        frequencyPenalty: 0.5,
        allowImmediateRetry: strict
      });
    } catch (e) {
      // The most common cause is the service worker being asleep or the
      // extension having been reloaded. Surface a helpful message.
      throw new Error("Could not reach the extension background. Reload the X tab and try again.");
    }

    if (!response) throw new Error("Empty response from background. Reload the X tab.");
    if (!response.ok) throw new Error(response.error || "OpenAI request failed.");

    let out = response.output;
    const tweetHasEmoji = hasEmoji(tweetText);

    // Gibberish guard — if the model drifted into other scripts or produced
    // mojibake, regenerate immediately. We don't try to "clean" it because
    // any rescue would still leave a half-broken sentence.
    if (containsGibberish(out) && !strict) {
      console.warn("[XCG] gibberish detected, regenerating:", out.slice(0, 100));
      return callOpenAI({ tweetText, author, mode, strict: true, customTone, rejectedReply });
    }

    out = sanitizeText(out);
    out = killCuriousPatterns(out);
    if (!tweetHasEmoji) out = stripEmoji(out);

    // Second-pass gibberish check after sanitisation. If a sanitised reply is
    // STILL gibberish on a strict retry, fall through with a clean fallback
    // rather than infinite-looping.
    if (containsGibberish(out)) {
      if (!strict) return callOpenAI({ tweetText, author, mode, strict: true, customTone, rejectedReply });
      // Strict already failed — strip non-Latin and hope what's left is OK.
      out = out.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "").replace(/\s{2,}/g, " ").trim();
    }

    if (mode === "question") {
      out = enforceQuestion(out);
      out = killCuriousPatterns(out);
    } else {
      out = maybeAddHumanOpener(out, tweetText);
      out = sanitizeText(out);
      out = killCuriousPatterns(out);
      out = trimWords(out, 22);
      if (!/[.?!]$/.test(out)) out = applyEndPunct(out, ".");
      if (wordCount(out) < 8 && !strict) return callOpenAI({ tweetText, author, mode, strict: true, customTone, rejectedReply });
    }

    if ((tooSimilar(out) || hasOverusedPattern(out) || hasRepeatedOpening(out)) && !strict) {
      return callOpenAI({ tweetText, author, mode, strict: true, customTone, rejectedReply });
    }

    out = sanitizeText(out);
    out = killCuriousPatterns(out);
    saveOpening(out);
    return out.trim();
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }

  const TEXTBOX_SELECTOR = ['div[data-testid^="tweetTextarea_"][role="textbox"]', 'div[role="textbox"][contenteditable="true"]'].join(",");
  function getActiveTextbox() {
    const active = document.activeElement;
    if (active?.matches?.(TEXTBOX_SELECTOR) && isVisible(active)) return active;
    const focusedBox = active?.closest?.(TEXTBOX_SELECTOR);
    return focusedBox && isVisible(focusedBox) ? focusedBox : null;
  }
  function textboxScore(box, article) {
    const br = box.getBoundingClientRect();
    const ar = article?.getBoundingClientRect?.();
    if (!ar) return 0;
    const bx = br.left + br.width / 2;
    const by = br.top + br.height / 2;
    const ax = ar.left + ar.width / 2;
    const ay = ar.top + ar.height / 2;
    const distance = Math.hypot(bx - ax, by - ay);
    const visibleBonus = br.top > -20 && br.top < window.innerHeight + 20 ? 500 : 0;
    const dialogBonus = box.closest('[role="dialog"]') ? 350 : 0;
    return visibleBonus + dialogBonus - distance;
  }

  function getExistingTextbox(article) {
    const activeBox = getActiveTextbox();
    if (activeBox) return activeBox;
    const boxes = [...document.querySelectorAll(TEXTBOX_SELECTOR)].filter(isVisible);
    if (!boxes.length) return null;
    return boxes.sort((a, b) => textboxScore(b, article) - textboxScore(a, article))[0];
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function findOrOpenReplyBox(article) {
    let box = getExistingTextbox(article);
    if (box) return box;
    const replyButton = findReplyButton(article);
    if (replyButton) {
      replyButton.click();
      for (let i = 0; i < 16; i++) {
        await wait(180);
        box = getExistingTextbox(article);
        if (box) return box;
      }
    }
    return getExistingTextbox(article);
  }

  function getTextboxPlainText(box) {
    return (box?.innerText || box?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function selectTextboxContents(box) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function stablePlainText(t) {
    return String(t || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function fireComposerInput(box, inputType) {
    let event;
    try {
      event = new InputEvent("input", {
        bubbles: true,
        cancelable: false,
        composed: true,
        inputType,
        data: null // Crucial: avoid doubling by letting React sync with DOM
      });
    } catch (_) {
      event = new Event("input", { bubbles: true, cancelable: false, composed: true });
    }
    box.dispatchEvent(event);
  }

  function clearTextbox(box) {
    box.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    fireComposerInput(box, "deleteContentBackward");
  }

  function placeCaretAtEnd(el) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function focusComposerBox(box) {
    box.scrollIntoView({ block: "center", inline: "nearest" });
    try { box.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, view: window })); } catch (_) {}
    box.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    box.focus({ preventScroll: true });
    try { box.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, view: window })); } catch (_) {}
    box.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    box.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    box.focus({ preventScroll: true });
  }

  function dispatchPaste(box, text) {
    try {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, composed: true, clipboardData: data });
      box.dispatchEvent(event);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Stable replacement of the textbox contents.
   *
   * The duplication bug we keep hitting:
   *   `execCommand("insertText")` on a Slate/Lexical-based editor does NOT
   *   reliably honor the browser's DOM selection. When the box has existing
   *   text and we range-select all of it, Slate's beforeinput handler often
   *   ignores the "delete selection then insert" semantics and instead just
   *   inserts at its own internal caret position (start or end of doc). The
   *   visible result: existing text + inserted text concatenated. Two
   *   identical-looking copies one after the other.
   *
   * The fix used here:
   *   Three explicit phases, each verified before moving on:
   *     1. CLEAR — selectAll + delete via execCommand. Verify empty.
   *     2. INSERT — synthetic paste event (Slate has a native onPaste path
   *        that goes through its proper edit pipeline and updates internal
   *        state correctly). Fall back to insertText if paste does nothing.
   *     3. VERIFY — read box text. If it doesn't match, ONE more attempt
   *        with a heavier clear (Ctrl-A + Backspace via execCommand).
   *   We also detect the specific "text appears twice in a row" failure
   *   mode and trigger the retry.
   *
   *   A per-box re-entrancy lock prevents the rapid-click compounding bug.
   */
  async function insertReply(box, text) {
    if (!box || box.getAttribute("contenteditable") !== "true") return false;

    if (box.dataset.xcgInserting === "1") {
      console.warn("[XCG] insertReply skipped — previous insert still in flight");
      return false;
    }
    box.dataset.xcgInserting = "1";

    const cleanText = collapseExactDuplication(String(text || "").trim());
    if (!cleanText) {
      box.dataset.xcgInserting = "0";
      return false;
    }

    try {
      const ok = await performInsert(box, cleanText, /*attempt*/ 1);
      return ok;
    } catch (e) {
      console.error("insertReply failed:", e);
      return false;
    } finally {
      setTimeout(() => { box.dataset.xcgInserting = "0"; }, 80);
    }
  }

  // Explicit clear → paste → verify. Returns true on success.
  async function performInsert(box, cleanText, attempt) {
    // Plain focus, no synthetic clicks (synthetic clicks can open X's modal).
    box.focus({ preventScroll: true });

    // -------- Phase 1: CLEAR --------
    await clearBoxCompletely(box);

    // Yield once so Slate can flush its internal state after the clear.
    await wait(0);

    // -------- Phase 2: INSERT --------
    // Try paste event first — Slate has dedicated paste handling that
    // updates its internal model correctly. Fall back to insertText if
    // paste produces no change.
    const beforeInsertText = stablePlainText(getTextboxPlainText(box));
    const pasted = dispatchPaste(box, cleanText);
    await wait(0);

    let afterInsertText = stablePlainText(getTextboxPlainText(box));
    if (afterInsertText === beforeInsertText) {
      // Paste was ignored. Use insertText as a fallback.
      try {
        document.execCommand("insertText", false, cleanText);
      } catch (_) {}
      await wait(0);
      afterInsertText = stablePlainText(getTextboxPlainText(box));
    }

    // -------- Phase 3: VERIFY --------
    const expected = stablePlainText(cleanText);
    if (afterInsertText === expected) return true;

    // Failure mode A: contains the expected text but with leftovers/duplicates.
    // Failure mode B: completely different text (paste landed elsewhere).
    if (attempt < 2) {
      // Try a heavier clear and retry once.
      console.warn("[XCG] insert verify failed, retrying. got:", afterInsertText.slice(0, 80));
      await heavyClearBox(box);
      await wait(20);
      return performInsert(box, cleanText, attempt + 1);
    }

    // Last-resort: if the text we want is at least PRESENT in the box,
    // call it good even if there are leftovers — better than nothing.
    return afterInsertText.includes(expected);
  }

  // Phase-1 clear: standard select-all + delete via execCommand.
  async function clearBoxCompletely(box) {
    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}
    fireComposerInput(box, "deleteContentBackward");
  }

  // Phase-3-retry heavy clear: dispatch a real Backspace key via DataTransfer
  // when execCommand alone left content behind. Loops up to 30 times so even
  // Slate trees with stubborn nested nodes get fully drained.
  async function heavyClearBox(box) {
    box.focus({ preventScroll: true });
    for (let i = 0; i < 30; i++) {
      const before = getTextboxPlainText(box);
      if (!before) return;
      try {
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
      } catch (_) {}
      // Some Slate versions ignore the first delete; nudge with input event.
      fireComposerInput(box, "deleteContentBackward");
      await wait(8);
      const after = getTextboxPlainText(box);
      if (!after) return;
      if (after === before) {
        // Nothing changed; further loops won't help.
        break;
      }
    }
  }

  function findReplyButton(article) {
    return article.querySelector('[data-testid="reply"]') || [...article.querySelectorAll('button, div[role="button"]')].find((el) => /reply/i.test(el.getAttribute("aria-label") || ""));
  }
  function findActionBar(article) {
    const reply = findReplyButton(article);
    if (reply) {
      const group = reply.closest('[role="group"]');
      if (group) return group;
      const p1 = reply.parentElement, p2 = p1?.parentElement, p3 = p2?.parentElement;
      if (p3) return p3;
      if (p2) return p2;
      if (p1) return p1;
    }
    const groups = [...article.querySelectorAll('[role="group"]')].filter(isVisible);
    if (groups.length) return groups[groups.length - 1];
    const textEl = article.querySelector('[data-testid="tweetText"]');
    return textEl?.parentElement || null;
  }

  function buttonRipple(e, btn) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "unique-xcg-ripple";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  /* ----------------------------------------------------------------
     Regenerate floating button
     A small circular-arrow button that appears anchored to the reply
     box after a successful insert. Click → sends the previously
     inserted draft back to OpenAI with a "make this completely
     different" instruction, then types the new draft into the box.
     Auto-removes when the user starts editing or the box disappears.
     ---------------------------------------------------------------- */
  function attachRegenerateButton(box, article) {
    if (!box) return;
    // Remove any previous regenerate button — only one at a time.
    document.querySelectorAll(".unique-xcg-regen").forEach((el) => el.remove());

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "unique-xcg-regen";
    btn.title = "Regenerate — write something different";
    btn.innerHTML = ICON_REGEN;

    const positionBtn = () => {
      const r = box.getBoundingClientRect();
      // Anchor to the OUTSIDE top-right of the textbox so the button never
      // overlaps the editable surface and steals clicks.
      btn.style.top  = `${window.scrollY + r.top - 4}px`;
      btn.style.left = `${window.scrollX + r.right - 14}px`;
    };
    positionBtn();
    document.body.appendChild(btn);

    // Reposition on resize/scroll. Cheap RAF throttle.
    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; positionBtn(); });
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    // Self-destruct conditions.
    let destroyed = false;
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      box.removeEventListener("input", onUserInput);
      observer.disconnect();
      btn.remove();
    };

    // If user types or modifies the text, remove the button — they're
    // editing manually now and don't want our overlay in the way.
    const initialText = stablePlainText(getTextboxPlainText(box));
    const onUserInput = (e) => {
      // Our own execCommand insert fires `input` events too; we ignore those
      // checking that the event came from a real keystroke or paste.
      if (e.isTrusted) destroy();
    };
    box.addEventListener("input", onUserInput);

    // If the textbox is removed from the DOM (X destroys/recreates it),
    // tear ourselves down.
    const observer = new MutationObserver(() => {
      if (!document.body.contains(box)) destroy();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    btn.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (btn.getAttribute("data-busy") === "1") return;
      btn.setAttribute("data-busy", "1");
      try {
        const { author, tweetText } = extractTweet(article);
        if (!tweetText) {
          toast("Tweet text not found.", { error: true });
          return;
        }
        const previous = stablePlainText(getTextboxPlainText(box));
        const reply = await callOpenAI({
          tweetText,
          author,
          mode: "normal",
          rejectedReply: previous || undefined
        });
        // Single-shot insertion — clears existing text first.
        const ok = await insertReply(box, reply);
        if (!ok) {
          await copyText(reply);
          toast("Could not replace text. Draft copied to clipboard.", { error: true });
          return;
        }
        addRecentReply(reply);
        // Reattach so it stays available for another regenerate.
        // (destroy fires on user input, but execCommand input is !isTrusted.)
      } catch (err) {
        console.error(err);
        toast(err?.message || "Regenerate failed.", { error: true });
      } finally {
        btn.removeAttribute("data-busy");
      }
    });
  }

  async function handleGenerate(article, btn, mode) {
    if (btn.dataset.xcgBusy === "1") return;
    btn.dataset.xcgBusy = "1";
    btn.setAttribute("data-busy", "1");
    const labelEl = btn.querySelector(".xcg-label");
    const originalLabel = labelEl ? labelEl.textContent : btn.textContent;
    try {
      const { author, tweetText } = extractTweet(article);
      if (!tweetText) {
        toast("No readable text, alt text, quote, or card context found.", { error: true });
        return;
      }
      btn.disabled = true;
      if (labelEl) labelEl.textContent = "Writing…"; else btn.textContent = "Writing…";

      const reply = await callOpenAI({ tweetText, author, mode });
      const outputMode = await getOutputMode();

      // Clipboard-only mode: copy and stop. Don't open the reply box, don't
      // attach the regenerate floater (regenerate needs a previous draft in
      // the box, which we deliberately aren't writing in this mode).
      if (outputMode === "clipboard") {
        await copyText(reply);
        addRecentReply(reply);
        toast("Reply copied. Paste it where you want.");
        return;
      }

      // Default: insert into the reply box.
      const box = await findOrOpenReplyBox(article);
      if (!box) {
        await copyText(reply);
        toast("Could not open the reply box. Draft copied to clipboard.", { error: true });
        return;
      }

      const ok = await insertReply(box, reply);
      if (!ok) {
        await copyText(reply);
        toast("Insert failed. Draft copied to clipboard.", { error: true });
        return;
      }
      addRecentReply(reply);
      // Floating regenerate button — auto-removes when user starts editing.
      attachRegenerateButton(box, article);
      toast("Draft inserted. Review before posting.");
    } catch (e) {
      console.error(e);
      toast(e?.message || "Something went wrong.", { error: true });
    } finally {
      btn.disabled = false;
      btn.removeAttribute("data-busy");
      btn.dataset.xcgBusy = "0";
      if (labelEl) labelEl.textContent = originalLabel;
      else btn.textContent = originalLabel;
    }
  }

  // Inline SVG icons used by the buttons. Strokes use currentColor so the
  // gas-gauge tint flows through automatically.
  const ICON_SPARK = `<svg class="xcg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M3.4 12.6l2.1-2.1M10.5 5.5l2.1-2.1"/></svg>`;
  const ICON_QUESTION = `<svg class="xcg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 5.5a2.5 2.5 0 1 1 3.6 2.25c-.7.34-1.1.9-1.1 1.6V10"/><circle cx="8" cy="13" r=".7" fill="currentColor" stroke="none"/></svg>`;
  const ICON_REGEN = `<svg class="xcg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 8a6 6 0 1 1-1.76-4.24"/><path d="M14 2.5V6h-3.5"/></svg>`;

  // Reads the daily-usage state and applies a tint class to the button.
  // <70% normal, 70-89% amber, >=90% red. Failures fall through silently.
  async function applyGasGauge(btn) {
    try {
      if (!chrome?.storage?.local?.get) return;
      const s = await chrome.storage.local.get({ usageCount: 0, dailyLimit: 60 });
      const limit = Math.max(1, Number(s.dailyLimit || 60));
      const pct = Math.min(100, Math.max(0, (Number(s.usageCount || 0) / limit) * 100));
      btn.classList.remove("gauge-warn", "gauge-bad");
      if (pct >= 90) btn.classList.add("gauge-bad");
      else if (pct >= 70) btn.classList.add("gauge-warn");
      btn.title = `${Math.floor(s.usageCount || 0)}/${limit} requests used today`;
    } catch (_) { /* ignore */ }
  }

  function createButtons(article) {
    const wrap = document.createElement("div");
    wrap.className = "unique-xcg-wrap";

    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "unique-xcg-btn ai";
    aiBtn.innerHTML = `${ICON_SPARK}<span class="xcg-label">AI Reply</span>`;
    aiBtn.title = "Generate a human-style reply and insert it into the comment box";

    const qBtn = document.createElement("button");
    qBtn.type = "button";
    qBtn.className = "unique-xcg-btn q";
    qBtn.innerHTML = `${ICON_QUESTION}<span class="xcg-label">Question</span>`;
    qBtn.title = "Generate a natural question and insert it into the comment box";

    aiBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      buttonRipple(e, aiBtn);
      handleGenerate(article, aiBtn, "normal").finally(() => applyGasGauge(aiBtn));
    });
    qBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      buttonRipple(e, qBtn);
      handleGenerate(article, qBtn, "question").finally(() => applyGasGauge(qBtn));
    });

    wrap.appendChild(aiBtn);
    wrap.appendChild(qBtn);
    applyGasGauge(aiBtn);
    applyGasGauge(qBtn);
    return wrap;
  }

  function addButtons(article) {
    if (!article || article.getAttribute("data-unique-xcg-added") === "1") return;
    const actionBar = findActionBar(article);
    if (!actionBar) return;
    article.setAttribute("data-unique-xcg-added", "1");
    actionBar.appendChild(createButtons(article));
  }

  function scan() {
    injectStyles();
    for (const article of [...document.querySelectorAll("article")]) addButtons(article);
  }

  let timer = null;
  function scheduleScan() {
    clearTimeout(timer);
    timer = setTimeout(scan, 300);
  }
  new MutationObserver(scheduleScan).observe(document.body || document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 2500);
  setTimeout(scan, 800);
  setTimeout(scan, 2000);
  setTimeout(scan, 5000);

  // Live-update the gas gauge when the daily counter changes (e.g. another
  // tab made a request, or the user reset their counter from settings).
  try {
    chrome?.storage?.onChanged?.addListener?.((changes, area) => {
      if (area !== "local") return;
      if (!("usageCount" in changes) && !("dailyLimit" in changes)) return;
      document.querySelectorAll(".unique-xcg-btn").forEach(applyGasGauge);
    });
  } catch (_) {}

  console.log("X Comment Generator 2.5 loaded — A product of Unique Labs.");
})();
