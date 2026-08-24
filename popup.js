import {
  dailyLimitSeconds,
  dateKey,
  formatDuration,
  isWeekend,
  totalForDay,
  usedSeconds
} from "./core.js";
import { initAmbience } from "./ambience.js";

const siteList = document.querySelector("#siteList");
const dashboardButtons = [document.querySelector("#openDashboard"), document.querySelector("#manageLimits")];

dashboardButtons.forEach((button) => button.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
}));

function progressClass(percent) {
  if (percent >= 100) return "over";
  if (percent >= 75) return "warning";
  return "";
}

function render({ rules = [], usage = {} }) {
  const today = new Date();
  const enabledRules = rules.filter((rule) => rule.enabled !== false);
  document.querySelector("#dayType").textContent = isWeekend(today) ? "Weekend limits" : "Weekday limits";
  document.querySelector("#totalToday").textContent = formatDuration(totalForDay(usage, today, rules.map((rule) => rule.id)), true);

  const onTrack = enabledRules.filter((rule) => usedSeconds(usage, rule.id, today) < dailyLimitSeconds(rule, today)).length;
  document.querySelector("#onTrackCount").textContent = `${onTrack} on track`;

  if (!rules.length) {
    siteList.innerHTML = '<div class="empty-state">No limits yet. Add your first website to start building healthier browsing habits.</div>';
    return;
  }

  siteList.replaceChildren(...rules.map((rule) => {
    const used = usedSeconds(usage, rule.id, today);
    const limit = dailyLimitSeconds(rule, today);
    const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
    const item = document.createElement("article");
    item.className = `site-item${rule.enabled === false ? " paused" : ""}`;
    item.innerHTML = `
      <div class="site-row">
        <span class="site-name"></span>
        <span class="site-time"><strong>${formatDuration(used, true)}</strong> / ${formatDuration(limit, true)}</span>
      </div>
      <div class="progress-track" aria-label="${Math.round(percent)} percent used">
        <div class="progress-fill ${progressClass(percent)}" style="width:${percent}%"></div>
      </div>`;
    item.querySelector(".site-name").textContent = rule.website;
    return item;
  }));
}

async function load() {
  if (!globalThis.chrome?.storage?.local) {
    render({
      rules: [
        { id: "preview-social", website: "instagram.com", weekdayMinutes: 45, weekendMinutes: 15, enabled: true },
        { id: "preview-video", website: "youtube.com", weekdayMinutes: 30, weekendMinutes: 20, enabled: true }
      ],
      usage: {
        [dateKey()]: { "preview-social": 1120, "preview-video": 780 }
      }
    });
    return;
  }
  try {
    const data = await chrome.runtime.sendMessage({ type: "GET_LIVE_DATA" });
    render(data || {});
  } catch {
    render(await chrome.storage.local.get({ rules: [], usage: {} }));
  }
}

initAmbience();
load();
