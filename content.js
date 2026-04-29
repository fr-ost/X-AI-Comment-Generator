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
    style.textContent = `
.unique-xcg-wrap{display:inline-flex;align-items:center;gap:7px;margin-left:8px;flex-wrap:wrap;padding:2px;border-radius:999px;background:linear-gradient(135deg,rgba(29,155,240,.08),rgba(139,92,246,.07));backdrop-filter:blur(10px)}
.unique-xcg-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:6px 12px;border-radius:999px;border:1px solid rgba(29,155,240,.50);background:linear-gradient(135deg,rgba(29,155,240,.17),rgba(99,102,241,.14));color:rgb(29,155,240);cursor:pointer;font-size:12px;font-weight:850;line-height:16px;white-space:nowrap;user-select:none;overflow:hidden;isolation:isolate;box-shadow:0 0 0 rgba(29,155,240,0),inset 0 1px 0 rgba(255,255,255,.15);transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease,filter .18s ease,opacity .18s ease}
.unique-xcg-btn.ai::after{content:"✦";font-size:11px;opacity:.82}.unique-xcg-btn.q::after{content:"?";font-size:12px;font-weight:950;opacity:.9}.unique-xcg-btn::before{content:"";position:absolute;inset:-50%;background:linear-gradient(120deg,transparent 0%,transparent 35%,rgba(255,255,255,.44) 50%,transparent 65%,transparent 100%);transform:translateX(-125%) rotate(18deg);pointer-events:none;z-index:-1}.unique-xcg-btn:hover{transform:translateY(-1px) scale(1.035);background:linear-gradient(135deg,rgba(29,155,240,.25),rgba(99,102,241,.22));border-color:rgba(29,155,240,.85);box-shadow:0 0 18px rgba(29,155,240,.26),0 8px 22px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.22)}.unique-xcg-btn:hover::before{animation:uniqueXcgShimmer .85s ease forwards}.unique-xcg-btn:active{transform:translateY(0) scale(.95);filter:brightness(1.15)}.unique-xcg-btn.q{border-color:rgba(168,85,247,.58);background:linear-gradient(135deg,rgba(168,85,247,.18),rgba(236,72,153,.14));color:rgb(192,132,252)}.unique-xcg-btn.q:hover{background:linear-gradient(135deg,rgba(168,85,247,.26),rgba(236,72,153,.22));border-color:rgba(192,132,252,.88);box-shadow:0 0 18px rgba(168,85,247,.28),0 8px 22px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.22)}.unique-xcg-btn[disabled]{opacity:.78;cursor:wait;animation:uniqueXcgGlowPulse 1.15s ease-in-out infinite}.unique-xcg-btn[disabled]::before{animation:uniqueXcgShimmer 1.15s linear infinite}.unique-xcg-btn[disabled]::after{content:"";width:11px;height:11px;border-radius:999px;border:2px solid currentColor;border-right-color:transparent;animation:uniqueXcgSpin .7s linear infinite}.unique-xcg-ripple{position:absolute;width:16px;height:16px;border-radius:999px;background:rgba(255,255,255,.68);transform:translate(-50%,-50%) scale(0);pointer-events:none;animation:uniqueXcgRipple .62s ease-out forwards;z-index:5}.unique-xcg-spark{position:fixed;width:5px;height:5px;border-radius:999px;pointer-events:none;z-index:99999999;background:currentColor;box-shadow:0 0 6px currentColor,0 0 12px currentColor;animation:uniqueXcgSpark .72s ease-out forwards}.unique-xcg-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999999;background:linear-gradient(135deg,rgba(15,23,42,.97),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.22);color:white;padding:11px 15px;border-radius:999px;font-size:13px;font-weight:720;max-width:90vw;text-align:center;box-shadow:0 18px 42px rgba(0,0,0,.34),0 0 24px rgba(29,155,240,.18);animation:uniqueXcgToastPop .22s ease-out}.unique-xcg-toast::before{content:"✨ ";}@keyframes uniqueXcgSpin{to{transform:rotate(360deg)}}@keyframes uniqueXcgShimmer{0%{transform:translateX(-130%) rotate(18deg)}100%{transform:translateX(130%) rotate(18deg)}}@keyframes uniqueXcgGlowPulse{0%,100%{box-shadow:0 0 10px rgba(29,155,240,.16),0 0 0 rgba(29,155,240,0),inset 0 1px 0 rgba(255,255,255,.12)}50%{box-shadow:0 0 22px rgba(29,155,240,.40),0 0 36px rgba(168,85,247,.18),inset 0 1px 0 rgba(255,255,255,.22)}}@keyframes uniqueXcgRipple{to{transform:translate(-50%,-50%) scale(12);opacity:0}}@keyframes uniqueXcgSpark{0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1}100%{transform:translate(var(--sx),var(--sy)) scale(.15) rotate(180deg);opacity:0}}@keyframes uniqueXcgToastPop{from{opacity:0;transform:translateX(-50%) translateY(8px) scale(.96)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}`
    document.head.appendChild(style);
  }

  function toast(msg, ms = 2800) {
    document.querySelector(".unique-xcg-toast")?.remove();
    const el = document.createElement("div");
    el.className = "unique-xcg-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
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

  function collapseExactDuplication(t) {
    let s = String(t || "").replace(/\s+/g, " ").trim();
    if (!s) return s;
    for (let i = Math.floor(s.length / 2); i >= 8; i--) {
      const a = s.slice(0, i).trim();
      const b = s.slice(i).trim();
      if (a && b && a.toLowerCase() === b.toLowerCase()) return a;
    }
    const parts = s.match(/[^.!?]+[.!?]?/g) || [s];
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

  function buildMessages({ author, tweetText, mode, strict }) {
    const tweetHasEmoji = hasEmoji(tweetText);
    const replyStyle = pickReplyStyle(tweetText);
    const emojiRule = tweetHasEmoji ? "Emoji is allowed, but use at most one and only if it feels natural." : "Do not use emoji.";
    const recentOpenings = lsGet(OPENINGS_KEY, []);
    const system = [
      "You write extremely natural X replies.",
      "You are not an assistant.",
      "You are not writing marketing copy.",
      "You are not explaining the tweet.",
      "You are not farming engagement.",
      "You are a real person leaving a quick personal comment.",
      "Never use the word curious.",
      "Do not repeat the same opening style.",
      "Output only the final reply text."
    ].join(" ");

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

    const user = `${common}\n\n${mode === "question" ? questionTask : normalTask}\n${antiRepeat}\n\nTWEET:\nAuthor: @${author}\nText:\n"""${tweetText}"""\n\nUSER TONE PREFERENCE:\n${DEFAULT_TONE}\n\nReturn only the final reply.`.trim();
    return [{ role: "system", content: system }, { role: "user", content: user }];
  }

  async function callOpenAI({ tweetText, author, mode = "normal", strict = false }) {
    const messages = buildMessages({ author, tweetText, mode, strict });
    if (!hasExtensionRuntime()) throw extensionContextError();

    const response = await chrome.runtime.sendMessage({
      type: "OPENAI_CHAT_COMPLETION",
      messages,
      maxTokens: mode === "question" ? 60 : undefined,
      presencePenalty: 1.05,
      frequencyPenalty: 0.85,
      allowImmediateRetry: strict
    });

    if (!response?.ok) throw new Error(response?.error || "OpenAI request failed.");

    let out = response.output;
    const tweetHasEmoji = hasEmoji(tweetText);
    out = sanitizeText(out);
    out = killCuriousPatterns(out);
    if (!tweetHasEmoji) out = stripEmoji(out);

    if (mode === "question") {
      out = enforceQuestion(out);
      out = killCuriousPatterns(out);
    } else {
      out = maybeAddHumanOpener(out, tweetText);
      out = sanitizeText(out);
      out = killCuriousPatterns(out);
      out = trimWords(out, 22);
      if (!/[.?!]$/.test(out)) out = applyEndPunct(out, ".");
      if (wordCount(out) < 8 && !strict) return callOpenAI({ tweetText, author, mode, strict: true });
    }

    if ((tooSimilar(out) || hasOverusedPattern(out) || hasRepeatedOpening(out)) && !strict) {
      return callOpenAI({ tweetText, author, mode, strict: true });
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

  function normalizeComposerIfDoubled(box, cleanText) {
    const expected = stablePlainText(cleanText);
    let got = stablePlainText(getTextboxPlainText(box));
    if (!expected || !got) return;

    const doubledNoSpace = stablePlainText(expected + expected);
    const doubledSpace = stablePlainText(expected + " " + expected);
    if (got === doubledNoSpace || got === doubledSpace) {
      clearTextbox(box);
      document.execCommand("insertText", false, cleanText);
      fireComposerInput(box, "insertText");
    }
  }

  function insertText(box, text) {
    if (!box || box.getAttribute("contenteditable") !== "true") return false;

    const cleanText = collapseExactDuplication(String(text || "").trim());
    if (!cleanText) return false;

    try {
      focusComposerBox(box);

      // 1. Clear content via editor commands
      clearTextbox(box);

      // 2. Best path: Synthetic paste for state sync
      dispatchPaste(box, cleanText);

      // 3. Fallback: execCommand if paste failed
      let after = stablePlainText(getTextboxPlainText(box));
      if (!after || !after.includes(stablePlainText(cleanText))) {
        document.execCommand("insertText", false, cleanText);
        fireComposerInput(box, "insertText");
      }

      // 4. Double check for ghost doubling
      normalizeComposerIfDoubled(box, cleanText);
      placeCaretAtEnd(box);

      after = stablePlainText(getTextboxPlainText(box));
      return after.includes(stablePlainText(cleanText));
    } catch (e) {
      console.error("Insert failed:", e);
      return false;
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
    setTimeout(() => ripple.remove(), 700);
  }
  function sparkleBurst(btn) {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ["rgb(29,155,240)", "rgb(168,85,247)", "rgb(236,72,153)", "rgb(34,197,94)", "rgb(251,191,36)"];
    for (let i = 0; i < 14; i++) {
      const spark = document.createElement("span");
      spark.className = "unique-xcg-spark";
      const angle = (Math.PI * 2 * i) / 14;
      const distance = 22 + Math.random() * 26;
      spark.style.left = `${cx}px`;
      spark.style.top = `${cy}px`;
      spark.style.color = colors[Math.floor(Math.random() * colors.length)];
      spark.style.setProperty("--sx", `${Math.cos(angle) * distance}px`);
      spark.style.setProperty("--sy", `${Math.sin(angle) * distance}px`);
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 800);
    }
  }

  async function handleGenerate(article, btn, mode) {
    if (btn.dataset.xcgBusy === "1") return;
    btn.dataset.xcgBusy = "1";
    const original = btn.textContent;
    try {
      const { author, tweetText } = extractTweet(article);
      if (!tweetText) {
        toast("No readable text, alt text, quote, or card context found.");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Writing...";
      const reply = await callOpenAI({ tweetText, author, mode });
      const box = await findOrOpenReplyBox(article);
      if (!box) {
        await copyText(reply);
        toast("Could not open/find the comment box. Draft copied to clipboard.");
        return;
      }
      const ok = insertText(box, reply);
      if (!ok) {
        await copyText(reply);
        toast("Could not insert text. Draft copied to clipboard.");
        return;
      }
      addRecentReply(reply);
      toast("Draft inserted. Review before posting.");
    } catch (e) {
      console.error(e);
      toast(e?.message || "Something went wrong.");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      btn.dataset.xcgBusy = "0";
    }
  }

  function createButtons(article) {
    const wrap = document.createElement("div");
    wrap.className = "unique-xcg-wrap";
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "unique-xcg-btn ai";
    aiBtn.textContent = "AI Reply";
    aiBtn.title = "Generate a varied human-style reply and insert into the existing comment box";
    const qBtn = document.createElement("button");
    qBtn.type = "button";
    qBtn.className = "unique-xcg-btn q";
    qBtn.textContent = "Question";
    qBtn.title = "Generate a varied natural question and insert into the existing comment box";
    aiBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); buttonRipple(e, aiBtn); sparkleBurst(aiBtn); handleGenerate(article, aiBtn, "normal"); });
    qBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); buttonRipple(e, qBtn); sparkleBurst(qBtn); handleGenerate(article, qBtn, "question"); });
    wrap.appendChild(aiBtn);
    wrap.appendChild(qBtn);
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
  console.log("X Comment Generator 2.0 Chrome Extension loaded. A product of Unique Labs.");
})();