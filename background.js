const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const DEFAULTS = {
  apiKey: "",
  model: "gpt-4o",
  temperature: 1.18,
  maxTokens: 135,
  dailyLimit: 60,
  cooldownSeconds: 5,
  enableSafetyRetry: true,
  usageDate: "",
  usageCount: 0,
  lastRequestAt: 0
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getSettings() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  const today = todayKey();
  if (settings.usageDate !== today) {
    settings.usageDate = today;
    settings.usageCount = 0;
    await chrome.storage.local.set({ usageDate: today, usageCount: 0 });
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

async function incrementUsage() {
  const settings = await getSettings();
  const count = Number(settings.usageCount || 0) + 1;
  const now = Date.now();
  await chrome.storage.local.set({ usageDate: todayKey(), usageCount: count, lastRequestAt: now });
  return { usageDate: todayKey(), usageCount: count, lastRequestAt: now };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ usageDate: todayKey() });
  chrome.runtime.openOptionsPage().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "OPENAI_CHAT_COMPLETION") return false;

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
        presence_penalty: Number(message.presencePenalty ?? 1.05),
        frequency_penalty: Number(message.frequencyPenalty ?? 0.85)
      };

      const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const usage = await incrementUsage();
      const raw = await res.text();

      if (!res.ok) {
        throw new Error(`OpenAI error ${res.status}: ${raw}`);
      }

      if (raw.trim().startsWith("<")) {
        throw new Error("OpenAI returned HTML, not JSON. Check endpoint/API key.");
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("OpenAI response was not valid JSON.");
      }

      const output = data?.choices?.[0]?.message?.content?.trim();
      if (!output) throw new Error("No output returned from OpenAI.");

      sendResponse({ ok: true, output, usage, tokenUsage: data?.usage || null });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "Unknown error" });
    }
  })();

  return true;
});