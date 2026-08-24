import {
  DEFAULT_SETTINGS,
  dateKey,
  dailyLimitSeconds,
  matchingRule,
  usedSeconds
} from "./core.js";

const HEARTBEAT_ALARM = "mindful-heartbeat";
const MAX_SESSION_GAP_MS = 90_000;
let queue = Promise.resolve();
let state = {
  tabId: null,
  ruleId: null,
  startedAt: Date.now(),
  focused: false,
  idleState: "active"
};

function serial(task) {
  queue = queue.then(task).catch((error) => console.error("Mindful Web Time:", error));
  return queue;
}

async function getData() {
  return chrome.storage.local.get({
    rules: [],
    usage: {},
    settings: DEFAULT_SETTINGS
  });
}

async function persistSessionState() {
  await chrome.storage.session.set({ trackerState: state });
}

async function restoreSessionState() {
  const stored = await chrome.storage.session.get("trackerState");
  if (stored.trackerState) state = { ...state, ...stored.trackerState };
}

async function addUsage(ruleId, startMs, endMs) {
  if (!ruleId || endMs <= startMs) return;
  const elapsedMs = Math.min(endMs - startMs, MAX_SESSION_GAP_MS);
  if (elapsedMs < 250) return;

  const { usage } = await getData();
  const key = dateKey(new Date(endMs));
  usage[key] ||= {};
  usage[key][ruleId] = (Number(usage[key][ruleId]) || 0) + elapsedMs / 1000;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffKey = dateKey(cutoff);
  for (const storedDay of Object.keys(usage)) {
    if (storedDay < cutoffKey) delete usage[storedDay];
  }
  await chrome.storage.local.set({ usage });
}

async function flush(now = Date.now()) {
  if (state.ruleId && state.focused && state.idleState === "active") {
    await addUsage(state.ruleId, state.startedAt, now);
  }
  state.startedAt = now;
}

async function blockTab(tab, rule) {
  if (!tab?.id || !rule) return;
  const blockedUrl = new URL(chrome.runtime.getURL("blocked.html"));
  blockedUrl.searchParams.set("site", rule.website);
  blockedUrl.searchParams.set("limit", String(dailyLimitSeconds(rule) / 60));
  if (tab.url) blockedUrl.searchParams.set("returnTo", tab.url);
  await chrome.tabs.update(tab.id, { url: blockedUrl.href });
}

async function refreshContext({ enforce = true } = {}) {
  const now = Date.now();
  await flush(now);

  const { rules, usage, settings } = await getData();
  const idleThreshold = Math.max(15, Number(settings.idleThresholdSeconds) || 60);
  state.idleState = await chrome.idle.queryState(idleThreshold);

  let windowInfo;
  try {
    windowInfo = await chrome.windows.getLastFocused();
  } catch {
    windowInfo = null;
  }
  state.focused = Boolean(windowInfo?.focused);

  let tab = null;
  if (windowInfo?.id != null) {
    [tab] = await chrome.tabs.query({ active: true, windowId: windowInfo.id });
  }
  state.tabId = tab?.id ?? null;
  const rule = tab?.url ? matchingRule(tab.url, rules) : null;

  if (rule && usedSeconds(usage, rule.id) >= dailyLimitSeconds(rule)) {
    state.ruleId = null;
    if (enforce) await blockTab(tab, rule);
  } else {
    state.ruleId = rule?.id ?? null;
  }
  state.startedAt = Date.now();
  await persistSessionState();
}

async function initialise() {
  await restoreSessionState();
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  await refreshContext();
}

chrome.runtime.onInstalled.addListener(() => serial(async () => {
  const data = await getData();
  await chrome.storage.local.set({
    rules: data.rules,
    usage: data.usage,
    settings: { ...DEFAULT_SETTINGS, ...data.settings }
  });
  await initialise();
}));

chrome.runtime.onStartup.addListener(() => serial(initialise));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) serial(() => refreshContext());
});

chrome.tabs.onActivated.addListener(() => serial(() => refreshContext()));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete" || tabId === state.tabId) {
    serial(() => refreshContext());
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === state.tabId) serial(() => refreshContext({ enforce: false }));
});

chrome.windows.onFocusChanged.addListener(() => serial(() => refreshContext()));

chrome.idle.onStateChanged.addListener((idleState) => serial(async () => {
  await flush();
  state.idleState = idleState;
  state.startedAt = Date.now();
  await persistSessionState();
}));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.rules || changes.settings)) {
    serial(() => refreshContext());
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_LIVE_DATA") {
    serial(async () => {
      await refreshContext();
      sendResponse(await getData());
    });
    return true;
  }
  if (message?.type === "OPEN_DASHBOARD") {
    chrome.runtime.openOptionsPage();
  }
  return false;
});

serial(initialise);
