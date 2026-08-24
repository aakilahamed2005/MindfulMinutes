import {
  DEFAULT_SETTINGS,
  dateKey,
  formatDuration,
  normalizeWebsite,
  weeklySummary
} from "./core.js";
import { initAmbience } from "./ambience.js";

let data = { rules: [], usage: {}, settings: DEFAULT_SETTINGS };
let editingRuleId = null;
const form = document.querySelector("#limitForm");
const errorNode = document.querySelector("#formError");

function showError(message = "") {
  errorNode.textContent = message;
  errorNode.classList.toggle("visible", Boolean(message));
}

function renderStats() {
  const summary = weeklySummary(data.usage, data.rules, new Date(), data.settings.weekStartsOn);
  document.querySelector("#currentWeek").textContent = formatDuration(summary.currentSeconds, true);
  document.querySelector("#timeSaved").textContent = formatDuration(summary.savedSeconds, true);
  document.querySelector("#goalsMet").textContent = `${summary.withinLimitDays} / ${summary.elapsedDays}`;
  document.querySelector("#reductionLabel").textContent = summary.previousSeconds
    ? `${summary.reductionPercent}% less than last week`
    : "compared with last week";

  const maximum = Math.max(60, ...summary.currentDaily);
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const todayKey = dateKey();
  const chart = document.querySelector("#weeklyChart");
  chart.replaceChildren(...summary.currentDays.map((day, index) => {
    const seconds = summary.currentDaily[index];
    const height = Math.max(2, (seconds / maximum) * 100);
    const column = document.createElement("div");
    column.className = `chart-day${dateKey(day) === todayKey ? " today" : ""}`;
    column.innerHTML = `
      <span class="bar-value">${seconds >= 60 ? formatDuration(seconds, true) : ""}</span>
      <div class="bar-wrap"><div class="bar" style="height:${height}%"></div></div>
      <span>${formatter.format(day)}</span>`;
    return column;
  }));
}

function renderRules() {
  const rulesList = document.querySelector("#rulesList");
  document.querySelector("#ruleCount").textContent = `${data.rules.length} ${data.rules.length === 1 ? "website" : "websites"}`;
  if (!data.rules.length) {
    rulesList.innerHTML = '<div class="empty-state">Your website limits will appear here. Add one above to begin.</div>';
    return;
  }

  rulesList.replaceChildren(...data.rules.map((rule) => {
    const card = document.createElement("article");
    card.className = `rule-card${rule.enabled === false ? " disabled" : ""}`;
    card.innerHTML = `
      <div class="rule-site"><span class="site-icon"></span><div><strong></strong><small>${rule.enabled === false ? "Paused" : "Blocking enabled"}</small></div></div>
      <div class="limit-value"><span>Weekdays</span><strong>${rule.weekdayMinutes} min</strong></div>
      <div class="limit-value"><span>Weekends</span><strong>${rule.weekendMinutes} min</strong></div>
      <div class="rule-actions">
        <button class="toggle ${rule.enabled === false ? "" : "on"}" type="button" role="switch" aria-checked="${rule.enabled === false ? "false" : "true"}" title="Pause or resume"></button>
        <button class="text-button edit-button" type="button">Edit</button>
        <button class="text-button" type="button">Remove</button>
      </div>`;
    card.querySelector(".site-icon").textContent = rule.website.charAt(0);
    card.querySelector(".rule-site strong").textContent = rule.website;
    card.querySelector(".toggle").addEventListener("click", () => toggleRule(rule.id));
    card.querySelector(".edit-button").addEventListener("click", () => beginEdit(rule.id));
    card.querySelectorAll(".text-button")[1].addEventListener("click", () => removeRule(rule.id));
    return card;
  }));
}

function render() {
  renderStats();
  renderRules();
}

async function saveRules() {
  await chrome.storage.local.set({ rules: data.rules });
  render();
}

async function toggleRule(id) {
  data.rules = data.rules.map((rule) => rule.id === id ? { ...rule, enabled: rule.enabled === false } : rule);
  await saveRules();
}

async function removeRule(id) {
  data.rules = data.rules.filter((rule) => rule.id !== id);
  if (editingRuleId === id) resetForm();
  await saveRules();
}

function beginEdit(id) {
  const rule = data.rules.find((item) => item.id === id);
  if (!rule) return;
  editingRuleId = id;
  document.querySelector("#website").value = rule.website;
  document.querySelector("#weekdayMinutes").value = rule.weekdayMinutes;
  document.querySelector("#weekendMinutes").value = rule.weekendMinutes;
  document.querySelector("#formSubmit").textContent = "Save changes";
  document.querySelector("#cancelEdit").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  document.querySelector("#website").focus();
}

function resetForm() {
  editingRuleId = null;
  form.reset();
  document.querySelector("#weekdayMinutes").value = 45;
  document.querySelector("#weekendMinutes").value = 15;
  document.querySelector("#formSubmit").textContent = "Add website limit";
  document.querySelector("#cancelEdit").hidden = true;
  showError();
}

document.querySelector("#cancelEdit").addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError();
  const values = new FormData(form);
  const website = normalizeWebsite(values.get("website"));
  const weekdayMinutes = Number(values.get("weekdayMinutes"));
  const weekendMinutes = Number(values.get("weekendMinutes"));

  if (!website) return showError("Enter a valid website, such as instagram.com.");
  if (![weekdayMinutes, weekendMinutes].every((value) => Number.isFinite(value) && value >= 1 && value <= 1440)) {
    return showError("Limits must be between 1 and 1,440 minutes.");
  }
  if (data.rules.some((rule) => rule.website === website && rule.id !== editingRuleId)) return showError("That website already has a limit.");

  if (editingRuleId) {
    data.rules = data.rules.map((rule) => rule.id === editingRuleId
      ? { ...rule, website, weekdayMinutes, weekendMinutes }
      : rule);
  } else {
    data.rules.push({
      id: crypto.randomUUID(),
      website,
      weekdayMinutes,
      weekendMinutes,
      enabled: true,
      createdAt: new Date().toISOString()
    });
  }
  await saveRules();
  resetForm();
  document.querySelector("#website").focus();
});

if (globalThis.chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.usage) data.usage = changes.usage.newValue || {};
    if (changes.rules) data.rules = changes.rules.newValue || [];
    render();
  });
}

function previewData() {
  const rules = [
    { id: "preview-social", website: "instagram.com", weekdayMinutes: 45, weekendMinutes: 15, enabled: true },
    { id: "preview-video", website: "youtube.com", weekdayMinutes: 30, weekendMinutes: 20, enabled: true }
  ];
  const usage = {};
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const samples = [1650, 2280, 1260, 1940, 1020, 740, 560];
  for (let index = 0; index <= ((today.getDay() + 6) % 7); index += 1) {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    usage[dateKey(day)] = {
      "preview-social": samples[index] * .62,
      "preview-video": samples[index] * .38
    };
    const previous = new Date(day);
    previous.setDate(previous.getDate() - 7);
    usage[dateKey(previous)] = {
      "preview-social": samples[index] * .84,
      "preview-video": samples[index] * .56
    };
  }
  return { rules, usage, settings: DEFAULT_SETTINGS };
}

async function load() {
  if (!globalThis.chrome?.storage?.local) {
    data = previewData();
    render();
    return;
  }
  try {
    data = { ...data, ...(await chrome.runtime.sendMessage({ type: "GET_LIVE_DATA" })) };
  } catch {
    data = { ...data, ...(await chrome.storage.local.get(data)) };
  }
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  render();
}

initAmbience();
load();
