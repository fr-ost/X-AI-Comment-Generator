/* X Comment Generator — popup.js (v2.4.0) */

const DEFAULTS = {
  apiKey: "",
  model: "gpt-4o",
  dailyLimit: 60,
  cooldownSeconds: 5,
  customTone: "",
  outputMode: "insert",
  usageDate: "",
  usageCount: 0,
  lastRequestAt: 0,
  tokensInToday: 0,
  tokensOutToday: 0,
  tokensInTotal: 0,
  tokensOutTotal: 0
};

const MODEL_PRICING = {
  "gpt-4o":             { in: 2.50, out: 10.00 },
  "gpt-4o-mini":        { in: 0.15, out: 0.60  },
  "gpt-4.1":            { in: 2.00, out: 8.00  },
  "gpt-4.1-mini":       { in: 0.40, out: 1.60  },
  "gpt-4.1-nano":       { in: 0.10, out: 0.40  },
  "gpt-3.5-turbo":      { in: 0.50, out: 1.50  }
};

const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);
const clamp = (n, mn, mx) => Math.max(mn, Math.min(mx, n));

function fmtNum(n) { return Number(n || 0).toLocaleString(); }
function fmtCost(usd) {
  if (!usd) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  if (usd < 1)   return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
function estimateCost(model, inTok, outTok) {
  const p = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o"];
  return ((inTok / 1_000_000) * p.in) + ((outTok / 1_000_000) * p.out);
}

async function render() {
  const s = await chrome.storage.local.get(DEFAULTS);
  const count = Number(s.usageCount || 0);
  const limit = Math.max(1, Number(s.dailyLimit || DEFAULTS.dailyLimit));
  const pct   = clamp(Math.round((count / limit) * 100), 0, 100);
  const left  = Math.max(0, limit - count);
  const model = s.model || DEFAULTS.model;

  $("modelLine").textContent    = model;
  $("dateText").textContent     = s.usageDate || todayKey();
  $("usageBig").innerHTML       = `${count} <small>/ ${limit}</small>`;
  $("barFill").style.width      = `${pct}%`;
  $("leftText").textContent     = String(left);
  $("cooldownText").textContent = `${Number(s.cooldownSeconds ?? DEFAULTS.cooldownSeconds)}s`;
  $("apiText").textContent      = s.apiKey ? "Connected" : "Not set";

  const wrap = $("usageBarWrap");
  wrap.classList.remove("warn", "bad");
  if (pct >= 90) wrap.classList.add("bad");
  else if (pct >= 70) wrap.classList.add("warn");

  // Tokens
  const tIn  = Number(s.tokensInToday  || 0);
  const tOut = Number(s.tokensOutToday || 0);
  const lIn  = Number(s.tokensInTotal  || 0);
  const lOut = Number(s.tokensOutTotal || 0);
  $("tokIn").textContent    = fmtNum(tIn);
  $("tokOut").textContent   = fmtNum(tOut);
  $("tokTotal").textContent = fmtNum(tIn + tOut);
  $("costToday").textContent    = fmtCost(estimateCost(model, tIn,  tOut));
  $("costLifetime").textContent = fmtCost(estimateCost(model, lIn, lOut));

  const pill = $("tonePill");
  if ((s.customTone || "").trim()) {
    pill.textContent = "Custom";
    pill.classList.add("custom");
  } else {
    pill.textContent = "Default";
    pill.classList.remove("custom");
  }

  // Output-mode pill: highlights the clipboard mode in amber so the user
  // notices at a glance that replies aren't going into the box.
  const modePill = $("modePill");
  if (modePill) {
    if (s.outputMode === "clipboard") {
      modePill.textContent = "Clipboard";
      modePill.classList.add("clipboard");
    } else {
      modePill.textContent = "Insert";
      modePill.classList.remove("clipboard");
    }
  }
}

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("reset").addEventListener("click", async () => {
  await chrome.storage.local.set({
    usageDate: todayKey(),
    usageCount: 0,
    lastRequestAt: 0,
    tokensInToday: 0,
    tokensOutToday: 0
  });
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") render();
});

render();
