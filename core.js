export const DEFAULT_SETTINGS = Object.freeze({
  weekStartsOn: 1,
  idleThresholdSeconds: 60
});

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeWebsite(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function hostnameFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function siteMatches(hostname, website) {
  if (!hostname || !website) return false;
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const site = website.toLowerCase().replace(/^www\./, "");
  return host === site || host.endsWith(`.${site}`);
}

export function matchingRule(url, rules = []) {
  const hostname = hostnameFromUrl(url);
  if (!hostname) return null;
  return rules.find((rule) => rule.enabled !== false && siteMatches(hostname, rule.website)) || null;
}

export function isWeekend(date = new Date()) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function dailyLimitMinutes(rule, date = new Date()) {
  const value = isWeekend(date) ? rule.weekendMinutes : rule.weekdayMinutes;
  return Math.max(0, Number(value) || 0);
}

export function dailyLimitSeconds(rule, date = new Date()) {
  return dailyLimitMinutes(rule, date) * 60;
}

export function usedSeconds(usage, ruleId, date = new Date()) {
  return Math.max(0, Number(usage?.[dateKey(date)]?.[ruleId]) || 0);
}

export function startOfWeek(date = new Date(), weekStartsOn = 1) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const difference = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - difference);
  return start;
}

export function weekDays(date = new Date(), offset = 0, weekStartsOn = 1) {
  const first = startOfWeek(date, weekStartsOn);
  first.setDate(first.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}

export function totalForDay(usage, day, ruleIds = null) {
  const values = usage?.[dateKey(day)] || {};
  if (!ruleIds) return Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return ruleIds.reduce((sum, id) => sum + (Number(values[id]) || 0), 0);
}

export function weeklySummary(usage = {}, rules = [], date = new Date(), weekStartsOn = 1) {
  const ids = rules.map((rule) => rule.id);
  const currentDays = weekDays(date, 0, weekStartsOn);
  const previousDays = weekDays(date, -1, weekStartsOn);
  const currentDaily = currentDays.map((day) => totalForDay(usage, day, ids));
  const previousDaily = previousDays.map((day) => totalForDay(usage, day, ids));
  const elapsedCurrentDays = currentDays.filter((day) => day <= date);
  const elapsedCount = elapsedCurrentDays.length;
  const currentSeconds = currentDaily.slice(0, elapsedCount).reduce((sum, value) => sum + value, 0);
  const previousSeconds = previousDaily.slice(0, elapsedCount).reduce((sum, value) => sum + value, 0);
  const savedSeconds = Math.max(0, previousSeconds - currentSeconds);
  const reductionPercent = previousSeconds > 0
    ? Math.max(0, Math.round((savedSeconds / previousSeconds) * 100))
    : 0;

  const withinLimitDays = rules.length ? elapsedCurrentDays.filter((day) => rules.every((rule) => {
    if (rule.enabled === false) return true;
    return usedSeconds(usage, rule.id, day) <= dailyLimitSeconds(rule, day);
  })).length : 0;

  return {
    currentDays,
    currentDaily,
    previousSeconds,
    currentSeconds,
    savedSeconds,
    reductionPercent,
    withinLimitDays,
    elapsedDays: elapsedCurrentDays.length
  };
}

export function formatDuration(seconds, compact = false) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (compact) {
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m`;
    return `${safeSeconds}s`;
  }
  if (hours) return `${hours} hr ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${safeSeconds} sec`;
}

export function nextLocalMidnight(date = new Date()) {
  const next = new Date(date);
  next.setHours(24, 0, 0, 0);
  return next;
}
