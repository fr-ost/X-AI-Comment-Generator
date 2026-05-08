/* ============================================================
   X Comment Generator — options.js  (v2.4.0)
   Light UI · diagnostics panel · self-test for token tracker
   ============================================================ */

const DEFAULTS = {
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.95,
  maxTokens: 135,
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
  tokensOutTotal: 0,
  requestsTotal: 0,
  lastTokenUsage: null,
  lastTokenSource: "none"
};

const MODEL_PRICING = {
  "gpt-4o":             { in: 2.50, out: 10.00 },
  "gpt-4o-mini":        { in: 0.15, out: 0.60  },
  "gpt-4.1":            { in: 2.00, out: 8.00  },
  "gpt-4.1-mini":       { in: 0.40, out: 1.60  },
  "gpt-4.1-nano":       { in: 0.10, out: 0.40  },
  "gpt-3.5-turbo":      { in: 0.50, out: 1.50  }
};
const PRESETS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"];

const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

function setStatus(text, opts = {}) {
  const el = $("status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("is-error", Boolean(opts.error));
  const ms = opts.ms ?? 2400;
  if (ms) {
    setTimeout(() => {
      if (el.textContent === text) {
        el.textContent = "";
        el.classList.remove("is-error");
      }
    }, ms);
  }
}

function fmtNumber(n) { return Number(n || 0).toLocaleString(); }
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
function fmtRelativeTime(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 5)        return "just now";
  if (diffSec < 60)       return `${diffSec}s ago`;
  if (diffSec < 3600)     return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400)    return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleString();
}

/* ----- Renderers ------------------------------------------------ */

function updateUsage(s) {
  const date  = s.usageDate || todayKey();
  const count = Number(s.usageCount || 0);
  const limit = Math.max(1, Number(s.dailyLimit || DEFAULTS.dailyLimit));
  const left  = Math.max(0, limit - count);
  const pct   = Math.max(0, Math.min(100, Math.round((count / limit) * 100)));
  const model = s.model || DEFAULTS.model;

  $("dateText").textContent     = date;
  $("usageBig").innerHTML       = `${count} <small>/ ${limit}</small>`;
  $("usageBar").style.width     = `${pct}%`;
  $("leftCount").textContent    = `${left} left`;
  $("activeModel").textContent  = model;
  $("cooldownView").textContent = `${Number(s.cooldownSeconds ?? DEFAULTS.cooldownSeconds)}s`;
  $("keyView").textContent      = s.apiKey ? "Connected" : "Not set";
  $("toneStatus").textContent   = (s.customTone || "").trim() ? "Custom" : "Default";

  const wrap = $("usageBarWrap");
  wrap.classList.remove("warn", "bad");
  if (pct >= 90) wrap.classList.add("bad");
  else if (pct >= 70) wrap.classList.add("warn");

  // Token panel
  const tIn  = Number(s.tokensInToday  || 0);
  const tOut = Number(s.tokensOutToday || 0);
  const lIn  = Number(s.tokensInTotal  || 0);
  const lOut = Number(s.tokensOutTotal || 0);

  $("tokInToday").innerHTML    = `${fmtNumber(tIn)} <small>tok</small>`;
  $("tokOutToday").innerHTML   = `${fmtNumber(tOut)} <small>tok</small>`;
  $("tokTotalToday").innerHTML = `${fmtNumber(tIn + tOut)} <small>tok</small>`;
  $("costToday").textContent   = fmtCost(estimateCost(model, tIn, tOut));

  $("tokInTotal").innerHTML    = `${fmtNumber(lIn)} <small>tok</small>`;
  $("tokOutTotal").innerHTML   = `${fmtNumber(lOut)} <small>tok</small>`;
  $("reqTotal").textContent    = fmtNumber(s.requestsTotal || 0);
  $("costTotal").textContent   = fmtCost(estimateCost(model, lIn, lOut));

  // Diagnostics panel
  const src = String(s.lastTokenSource || "none");
  const srcEl = $("lastSource");
  srcEl.textContent = src;
  srcEl.classList.remove("good", "warn", "muted");
  if (src === "openai")        srcEl.classList.add("good");
  else if (src === "estimate") srcEl.classList.add("warn");
  else                         srcEl.classList.add("muted");

  const last = s.lastTokenUsage || {};
  $("lastIn").textContent   = last.prompt_tokens     != null ? fmtNumber(last.prompt_tokens)     : "—";
  $("lastOut").textContent  = last.completion_tokens != null ? fmtNumber(last.completion_tokens) : "—";
  $("lastWhen").textContent = fmtRelativeTime(s.lastRequestAt);
}

function updateToneCounter() {
  const text = $("customTone").value || "";
  const len  = text.length;
  const max  = 1500;
  const el   = $("toneCount");
  el.textContent = `${len} / ${max}`;
  el.classList.toggle("warn", len > max * 0.9);
}

function fillForm(s) {
  $("apiKey").value          = s.apiKey || "";
  $("model").value           = s.model || DEFAULTS.model;
  $("modelPreset").value     = PRESETS.includes(s.model) ? s.model : "custom";
  $("temperature").value     = s.temperature     ?? DEFAULTS.temperature;
  $("maxTokens").value       = s.maxTokens       ?? DEFAULTS.maxTokens;
  $("dailyLimit").value      = s.dailyLimit      ?? DEFAULTS.dailyLimit;
  $("cooldownSeconds").value = s.cooldownSeconds ?? DEFAULTS.cooldownSeconds;
  $("customTone").value      = s.customTone || "";

  // Output-mode radio. We treat anything that isn't "clipboard" as "insert".
  const mode = s.outputMode === "clipboard" ? "clipboard" : "insert";
  const insertRadio    = $("outputInsert");
  const clipboardRadio = $("outputClipboard");
  if (insertRadio)    insertRadio.checked    = (mode === "insert");
  if (clipboardRadio) clipboardRadio.checked = (mode === "clipboard");
  updateOutputModeHint(mode);

  updateToneCounter();
}

function updateOutputModeHint(mode) {
  const el = $("outputModeHint");
  if (!el) return;
  el.textContent = mode === "clipboard"
    ? "Replies are copied to your clipboard. Paste them anywhere with ⌘/Ctrl-V."
    : "Replies are typed straight into X's reply box and you review before posting.";
}

function getSelectedOutputMode() {
  const el = document.querySelector('input[name="outputMode"]:checked');
  return el?.value === "clipboard" ? "clipboard" : "insert";
}

async function loadAll() {
  const s = await chrome.storage.local.get(DEFAULTS);
  fillForm(s);
  updateUsage(s);
}
async function refreshUsageOnly() {
  const s = await chrome.storage.local.get(DEFAULTS);
  updateUsage(s);
}

/* ----- Actions -------------------------------------------------- */

async function save() {
  const temperature     = Number($("temperature").value     || DEFAULTS.temperature);
  const maxTokens       = Number($("maxTokens").value       || DEFAULTS.maxTokens);
  const dailyLimit      = Number($("dailyLimit").value      || DEFAULTS.dailyLimit);
  const cooldownSeconds = Number($("cooldownSeconds").value || DEFAULTS.cooldownSeconds);

  await chrome.storage.local.set({
    apiKey: $("apiKey").value.trim(),
    model:  $("model").value.trim() || DEFAULTS.model,
    temperature:     Number.isFinite(temperature)     ? Math.max(0,  Math.min(1.5,  temperature))     : DEFAULTS.temperature,
    maxTokens:       Number.isFinite(maxTokens)       ? Math.max(40, Math.min(240,  maxTokens))       : DEFAULTS.maxTokens,
    dailyLimit:      Number.isFinite(dailyLimit)      ? Math.max(1,  Math.min(1000, dailyLimit))      : DEFAULTS.dailyLimit,
    cooldownSeconds: Number.isFinite(cooldownSeconds) ? Math.max(0,  Math.min(120,  cooldownSeconds)) : DEFAULTS.cooldownSeconds,
    customTone: ($("customTone").value || "").slice(0, 1500),
    outputMode: getSelectedOutputMode()
  });
  setStatus("Saved.");
  // Refresh usage card so it picks up the new model name etc, but
  // do NOT clobber the form fields — user might still be typing.
  refreshUsageOnly();
}

async function clearMemory() {
  const keys = ["uniqueLabs_recentReplies_v5", "uniqueLabs_lastStyles_v3", "uniqueLabs_recentOpenings_v1"];
  try { keys.forEach((k) => localStorage.removeItem(k)); } catch (_) {}
  let cleared = 0;
  try {
    const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
    for (const tab of tabs) {
      try {
        const r = await chrome.tabs.sendMessage(tab.id, { type: "UNIQUE_XCG_CLEAR_MEMORY" });
        if (r?.ok) cleared++;
      } catch (_) {}
    }
  } catch (_) {}
  setStatus(cleared
    ? `Reply memory cleared on ${cleared} X tab${cleared > 1 ? "s" : ""}.`
    : "Memory cleared. Refresh X to clear page memory.", { ms: 4200 });
}

async function resetUsageToday() {
  await chrome.storage.local.set({
    usageDate: todayKey(),
    usageCount: 0,
    lastRequestAt: 0,
    tokensInToday: 0,
    tokensOutToday: 0
  });
  setStatus("Today's counter reset.");
  refreshUsageOnly();
}

async function resetAllTokens() {
  if (!confirm("Reset ALL token statistics, including lifetime totals? This cannot be undone.")) return;
  await chrome.storage.local.set({
    tokensInToday:  0,
    tokensOutToday: 0,
    tokensInTotal:  0,
    tokensOutTotal: 0,
    requestsTotal:  0,
    lastTokenUsage: null,
    lastTokenSource: "none"
  });
  setStatus("All token statistics reset.");
  refreshUsageOnly();
}

// Self-test: writes a fake token usage record DIRECTLY through the same code
// path that real requests use. If this works but real requests don't, the
// problem is the OpenAI response / the path in background.js, not the
// rendering or storage.
async function runSelfTest() {
  setStatus("Running self-test…", { ms: 0 });
  try {
    const fake = { prompt_tokens: 487, completion_tokens: 24, total_tokens: 511 };
    const res = await chrome.runtime.sendMessage({
      type: "UNIQUE_XCG_RECORD_USAGE_TEST",
      tokenUsage: fake
    });
    if (res?.ok) {
      setStatus("Self-test passed. Tracker is healthy.");
      refreshUsageOnly();
    } else {
      setStatus(`Self-test failed: ${res?.error || "unknown error"}`, { error: true, ms: 6000 });
    }
  } catch (e) {
    setStatus(`Self-test error: ${e?.message || e}`, { error: true, ms: 6000 });
  }
}

/* ----- Wiring --------------------------------------------------- */

$("modelPreset").addEventListener("change", () => {
  const v = $("modelPreset").value;
  if (v !== "custom") $("model").value = v;
});
$("save").addEventListener("click", save);
$("clear").addEventListener("click", clearMemory);
$("resetUsage").addEventListener("click", resetUsageToday);
$("resetTokens").addEventListener("click", resetAllTokens);
$("testTracker").addEventListener("click", runSelfTest);

$("customTone").addEventListener("input", updateToneCounter);

$("tonePresets").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const tone = chip.getAttribute("data-tone") || "";
  $("customTone").value = tone;
  updateToneCounter();
  $("customTone").focus();
});

$("diagToggle").addEventListener("click", () => $("diag").classList.toggle("open"));

// Output-mode radios: update the inline hint immediately on change, even
// before the user clicks Save. The actual persistence still happens via
// save(), so the user can revert without committing.
document.querySelectorAll('input[name="outputMode"]').forEach((el) => {
  el.addEventListener("change", () => updateOutputModeHint(getSelectedOutputMode()));
});

// Live-refresh USAGE when storage counters change.
// Critical: do NOT call loadAll() here — it would clobber form fields the
// user might be typing into. Only refresh the usage panel.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const counterKeys = [
    "usageCount", "usageDate", "tokensInToday", "tokensOutToday",
    "tokensInTotal", "tokensOutTotal", "requestsTotal", "lastRequestAt",
    "lastTokenUsage", "lastTokenSource", "model", "customTone", "apiKey"
  ];
  if (counterKeys.some((k) => k in changes)) refreshUsageOnly();
});

// Refresh "last request" relative time every 20s while the page is open.
setInterval(refreshUsageOnly, 20000);

loadAll();
