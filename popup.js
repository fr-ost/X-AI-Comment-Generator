const DEFAULTS = { apiKey: "", model: "gpt-4o", dailyLimit: 60, cooldownSeconds: 5, usageCount: 0, usageDate: "" };
const todayKey = () => new Date().toISOString().slice(0, 10);
const $ = (id) => document.getElementById(id);

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

async function render() {
  const s = await chrome.storage.local.get(DEFAULTS);
  const count = Number(s.usageCount || 0);
  const limit = Math.max(1, Number(s.dailyLimit || DEFAULTS.dailyLimit));
  const pct = clamp(Math.round((count / limit) * 100), 0, 100);
  const left = Math.max(0, limit - count);

  $("modelName").textContent = s.model || DEFAULTS.model;
  $("dateText").textContent = s.usageDate || todayKey();
  $("ring").style.setProperty("--p", pct);
  $("ring").setAttribute("data-value", `${pct}%`);
  $("barFill").style.width = `${pct}%`;
  $("usageText").textContent = `${count}/${limit} requests`;
  $("leftText").textContent = `${left} left`;
  $("cooldownText").textContent = `${Number(s.cooldownSeconds ?? DEFAULTS.cooldownSeconds)}s cooldown`;
  $("apiText").textContent = s.apiKey ? "Connected" : "Not set";
}

document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.getElementById("reset").addEventListener("click", async () => {
  await chrome.storage.local.set({ usageDate: todayKey(), usageCount: 0, lastRequestAt: 0 });
  render();
});
render();