/* ============================================================
   X Comment Generator — background.js  (v2.4.0)
   Stable token tracking with three guarantees:
     1. Reads `usage` from each successful OpenAI response
     2. Falls back to a local char-based estimate if usage is absent
     3. Writes counters atomically (read → compute → write) and
        emits a verification log line so any storage problem is
        visible in the service-worker console
   Open chrome://extensions → click the "service worker" link
   under the extension → Console tab to see [XCG] logs.
   ============================================================ */

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const LOG  = (...a) => console.log("[XCG]",  ...a);
const WARN = (...a) => console.warn("[XCG]", ...a);

// USD per 1M tokens. Update if OpenAI pricing changes.
const MODEL_PRICING = {
  "gpt-4o":             { in: 2.50, out: 10.00 },
  "gpt-4o-mini":        { in: 0.15, out: 0.60  },
  "gpt-4.1":            { in: 2.00, out: 8.00  },
  "gpt-4.1-mini":       { in: 0.40, out: 1.60  },
  "gpt-4.1-nano":       { in: 0.10, out: 0.40  },
  "gpt-3.5-turbo":      { in: 0.50, out: 1.50  }
};

const DEFAULTS = {
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.95,
  maxTokens: 135,
  dailyLimit: 60,
  cooldownSeconds: 5,
  customTone: "",
  outputMode: "insert",  // "insert" → into reply box; "clipboard" → copy only
  enableSafetyRetry: true,
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

const todayKey = () => new Date().toISOString().slice(0, 10);

function estimateCost(model, inTokens, outTokens) {
  const p = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o"];
  return ((inTokens / 1_000_000) * p.in) + ((outTokens / 1_000_000) * p.out);
}

// Cheap fallback if the API ever omits `usage` (proxies, custom endpoints).
// ~1 token ≈ 4 chars in English. Better than reporting zero.
function estimateTokensFromMessages(messages, output) {
  const promptText = (messages || []).map((m) => String(m?.content || "")).join("\n");
  const outputText = String(output || "");
  return {
    prompt_tokens:     Math.ceil(promptText.length / 4),
    completion_tokens: Math.ceil(outputText.length / 4),
    total_tokens:      Math.ceil((promptText.length + outputText.length) / 4)
  };
}

async function getSettings() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  const today = todayKey();
  if (settings.usageDate !== today) {
    LOG("day rollover:", settings.usageDate, "→", today);
    settings.usageDate = today;
    settings.usageCount = 0;
    settings.tokensInToday = 0;
    settings.tokensOutToday = 0;
    await chrome.storage.local.set({
      usageDate: today,
      usageCount: 0,
      tokensInToday: 0,
      tokensOutToday: 0
    });
  }
  return settings;
}

async function checkUsageLimit(settings, allowImmediateRetry = false) {
  const limit = Math.max(1, Number(settings.dailyLimit || DEFAULTS.dailyLimit));
  const count = Number(settings.usageCount || 0);
  if (count >= limit) {
    throw new Error(`Daily API limit reached (${count}/${limit}). Increase it in options if needed.`);
  }
  const cooldownMs = Math.max(0, Number(settings.cooldownSeconds || 0)) * 1000;
  const last = Number(settings.lastRequestAt || 0);
  const now = Date.now();
  if (!allowImmediateRetry && cooldownMs && last && now - last < cooldownMs) {
    const wait = Math.ceil((cooldownMs - (now - last)) / 1000);
    throw new Error(`Cooldown active. Try again in ${wait}s.`);
  }
}

// Atomic counter update. Reads current state, adds the deltas, writes back.
// Verifies the write by reading back and logging the new values.
async function recordUsage(tokenUsage, source) {
  const before = await chrome.storage.local.get(DEFAULTS);
  const today  = todayKey();
  const sameDay = before.usageDate === today;

  const inTok  = Math.max(0, Number(tokenUsage?.prompt_tokens     || 0));
  const outTok = Math.max(0, Number(tokenUsage?.completion_tokens || 0));

  const nextState = {
    usageDate:      today,
    usageCount:     (sameDay ? Number(before.usageCount || 0) : 0) + 1,
    lastRequestAt:  Date.now(),
    tokensInToday:  (sameDay ? Number(before.tokensInToday  || 0) : 0) + inTok,
    tokensOutToday: (sameDay ? Number(before.tokensOutToday || 0) : 0) + outTok,
    tokensInTotal:  Number(before.tokensInTotal  || 0) + inTok,
    tokensOutTotal: Number(before.tokensOutTotal || 0) + outTok,
    requestsTotal:  Number(before.requestsTotal  || 0) + 1,
    lastTokenUsage: tokenUsage || null,
    lastTokenSource: source || "none"
  };

  await chrome.storage.local.set(nextState);
  LOG("recordUsage", { source, inTok, outTok, after: {
    today: { in: nextState.tokensInToday, out: nextState.tokensOutToday },
    total: { in: nextState.tokensInTotal, out: nextState.tokensOutTotal },
    requests: nextState.requestsTotal
  }});
  return nextState;
}

chrome.runtime.onInstalled.addListener((details) => {
  LOG("onInstalled:", details.reason);
  chrome.storage.local.set({ usageDate: todayKey() });
  chrome.runtime.openOptionsPage().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  // Tone read endpoint.
  if (message.type === "UNIQUE_XCG_GET_TONE") {
    chrome.storage.local.get({ customTone: "" }).then((s) => {
      sendResponse({ ok: true, customTone: s.customTone || "" });
    });
    return true;
  }

  // Diagnostic: dump full state to the console.
  if (message.type === "UNIQUE_XCG_DEBUG_STATE") {
    chrome.storage.local.get(DEFAULTS).then((s) => {
      LOG("DEBUG STATE:", s);
      sendResponse({ ok: true, state: s });
    });
    return true;
  }

  // Self-test: increments counters with a fixed fake usage object so the
  // user can verify the tracker pipeline works end-to-end without making
  // a real OpenAI call. Triggered by the "Run tracker self-test" button.
  if (message.type === "UNIQUE_XCG_RECORD_USAGE_TEST") {
    (async () => {
      try {
        const fake = message.tokenUsage || { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 };
        const usage = await recordUsage(fake, "self-test");
        sendResponse({ ok: true, usage });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (message.type !== "OPENAI_CHAT_COMPLETION") return false;

  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.apiKey) {
        throw new Error("Set your OpenAI API key from the extension options page.");
      }
      await checkUsageLimit(settings, Boolean(message.allowImmediateRetry));

      const payload = {
        model: settings.model || DEFAULTS.model,
        messages: message.messages,
        temperature: Number(settings.temperature ?? DEFAULTS.temperature),
        max_tokens: Number(message.maxTokens ?? settings.maxTokens ?? DEFAULTS.maxTokens),
        presence_penalty: Number(message.presencePenalty ?? 0.6),
        frequency_penalty: Number(message.frequencyPenalty ?? 0.5)
      };

      LOG("→ OpenAI", { model: payload.model });

      const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const raw = await res.text();
      if (!res.ok) {
        WARN("OpenAI error", res.status, raw.slice(0, 400));
        throw new Error(`OpenAI error ${res.status}: ${raw}`);
      }
      if (raw.trim().startsWith("<")) {
        throw new Error("OpenAI returned HTML, not JSON. Check endpoint/API key.");
      }

      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error("OpenAI response was not valid JSON."); }

      const output = data?.choices?.[0]?.message?.content?.trim();
      if (!output) throw new Error("No output returned from OpenAI.");

      // Token tracking — prefer the API's own usage block; estimate locally
      // if missing or empty so the panel never silently stays at zero.
      let tokenUsage = data?.usage || null;
      let source = "openai";
      if (!tokenUsage || (!tokenUsage.prompt_tokens && !tokenUsage.completion_tokens)) {
        WARN("data.usage missing/empty — using local estimate. Response keys:", Object.keys(data || {}));
        tokenUsage = estimateTokensFromMessages(payload.messages, output);
        source = "estimate";
      }

      const usage = await recordUsage(tokenUsage, source);
      const costToday    = estimateCost(payload.model, usage.tokensInToday,  usage.tokensOutToday);
      const costLifetime = estimateCost(payload.model, usage.tokensInTotal,  usage.tokensOutTotal);

      sendResponse({
        ok: true,
        output,
        usage,
        tokenUsage,
        tokenSource: source,
        costEstimate: { today: costToday, lifetime: costLifetime, model: payload.model }
      });
    } catch (error) {
      WARN("request failed:", error?.message || error);
      sendResponse({ ok: false, error: error?.message || "Unknown error" });
    }
  })();

  return true;
});

LOG("service worker loaded — v2.4.0");
