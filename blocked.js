import { nextLocalMidnight } from "./core.js";
import { initAmbience } from "./ambience.js";

const params = new URLSearchParams(location.search);
const site = params.get("site") || "this website";
const limit = Number(params.get("limit"));
const returnTo = params.get("returnTo");
const unlockAt = nextLocalMidnight();
document.querySelector("#site").textContent = site;
document.querySelector("#limit").textContent = Number.isFinite(limit) ? `${limit}-minute` : "daily";

function updateCountdown() {
  const difference = Math.max(0, unlockAt.getTime() - Date.now());
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  const seconds = Math.floor((difference % 60_000) / 1000);
  document.querySelector("#countdown").textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (difference === 0 && returnTo) {
    try {
      const target = new URL(returnTo);
      if (target.protocol === "http:" || target.protocol === "https:") location.replace(target.href);
    } catch { /* The saved destination was not a valid web URL. */ }
  }
}

document.querySelector("#goBack").addEventListener("click", async () => {
  const currentTab = await chrome.tabs.getCurrent();
  await chrome.tabs.create({ active: true });
  if (currentTab?.id) await chrome.tabs.remove(currentTab.id);
});
document.querySelector("#viewProgress").addEventListener("click", () => chrome.runtime.openOptionsPage());
updateCountdown();
setInterval(updateCountdown, 1000);
initAmbience();
