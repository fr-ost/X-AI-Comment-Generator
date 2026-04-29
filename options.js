const DEFAULTS = {
  apiKey: "",
  model: "gpt-4o",
  temperature: 1.18,
  maxTokens: 135,
  dailyLimit: 60,
  cooldownSeconds: 5,
  usageDate: "",
  usageCount: 0
};

const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

function setStatus(text, ms = 2400) {
  $("status").textContent = text;
  if (ms) setTimeout(() => ($("status").textContent = ""), ms);
}

function updateUsage(settings) {
  const date = settings.usageDate || todayKey();
  const count = Number(settings.usageCount || 0);
  const limit = Math.max(1, Number(settings.dailyLimit || DEFAULTS.dailyLimit));
  const left = Math.max(0, limit - count);
  const pct = Math.max(0, Math.min(100, Math.round((count / limit) * 100)));
  $("usageBig").textContent = `${count}/${limit}`;
  $("usageDate").textContent = date;
  $("usageBar").style.width = `${pct}%`;
  $("leftCount").textContent = `${left} left`;
  $("activeModel").textContent = settings.model || DEFAULTS.model;
  $("cooldownView").textContent = `${Number(settings.cooldownSeconds ?? DEFAULTS.cooldownSeconds)}s`;
  $("keyView").textContent = settings.apiKey ? "Connected" : "Not set";
}

async function load() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  $("apiKey").value = settings.apiKey || "";
  $("model").value = settings.model || DEFAULTS.model;
  $("modelPreset").value = ["gpt-4o", "gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"].includes(settings.model) ? settings.model : "custom";
  $("temperature").value = settings.temperature ?? DEFAULTS.temperature;
  $("maxTokens").value = settings.maxTokens ?? DEFAULTS.maxTokens;
  $("dailyLimit").value = settings.dailyLimit ?? DEFAULTS.dailyLimit;
  $("cooldownSeconds").value = settings.cooldownSeconds ?? DEFAULTS.cooldownSeconds;
  updateUsage(settings);
}

async function save() {
  const temperature = Number($("temperature").value || DEFAULTS.temperature);
  const maxTokens = Number($("maxTokens").value || DEFAULTS.maxTokens);
  const dailyLimit = Number($("dailyLimit").value || DEFAULTS.dailyLimit);
  const cooldownSeconds = Number($("cooldownSeconds").value || DEFAULTS.cooldownSeconds);

  await chrome.storage.local.set({
    apiKey: $("apiKey").value.trim(),
    model: $("model").value.trim() || DEFAULTS.model,
    temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1.5, temperature)) : DEFAULTS.temperature,
    maxTokens: Number.isFinite(maxTokens) ? Math.max(40, Math.min(240, maxTokens)) : DEFAULTS.maxTokens,
    dailyLimit: Number.isFinite(dailyLimit) ? Math.max(1, Math.min(1000, dailyLimit)) : DEFAULTS.dailyLimit,
    cooldownSeconds: Number.isFinite(cooldownSeconds) ? Math.max(0, Math.min(120, cooldownSeconds)) : DEFAULTS.cooldownSeconds
  });

  setStatus("Saved.");
  load();
}

async function clearMemory() {
  const keys = ["uniqueLabs_recentReplies_v5", "uniqueLabs_lastStyles_v3", "uniqueLabs_recentOpenings_v1"];
  try { keys.forEach((key) => localStorage.removeItem(key)); } catch {}

  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
  let clearedTabs = 0;
  for (const tab of tabs) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: "UNIQUE_XCG_CLEAR_MEMORY" });
      if (res?.ok) clearedTabs++;
    } catch {}
  }

  setStatus(clearedTabs ? `Reply memory cleared on ${clearedTabs} X tab(s).` : "Options memory cleared. Open/refresh X to clear page memory there.", 4200);
}

async function resetUsage() {
  await chrome.storage.local.set({ usageDate: todayKey(), usageCount: 0, lastRequestAt: 0 });
  setStatus("Today’s API counter reset.");
  load();
}

$("modelPreset").addEventListener("change", () => {
  if ($("modelPreset").value !== "custom") $("model").value = $("modelPreset").value;
});
$("save").addEventListener("click", save);
$("clear").addEventListener("click", clearMemory);
$("resetUsage").addEventListener("click", resetUsage);
load();