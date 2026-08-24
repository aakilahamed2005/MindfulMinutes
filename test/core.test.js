import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyLimitMinutes,
  dateKey,
  matchingRule,
  normalizeWebsite,
  siteMatches,
  weeklySummary
} from "../core.js";

test("normalizes common website inputs", () => {
  assert.equal(normalizeWebsite("https://www.Instagram.com/reels/"), "instagram.com");
  assert.equal(normalizeWebsite("youtube.com/watch?v=1"), "youtube.com");
  assert.equal(normalizeWebsite("not-a-domain"), null);
});

test("matches a domain and its subdomains without matching lookalikes", () => {
  assert.equal(siteMatches("instagram.com", "instagram.com"), true);
  assert.equal(siteMatches("help.instagram.com", "instagram.com"), true);
  assert.equal(siteMatches("fakeinstagram.com", "instagram.com"), false);
});

test("finds only enabled rules for normal web URLs", () => {
  const rules = [
    { id: "a", website: "instagram.com", enabled: false },
    { id: "b", website: "youtube.com", enabled: true }
  ];
  assert.equal(matchingRule("https://m.youtube.com/watch?v=1", rules)?.id, "b");
  assert.equal(matchingRule("chrome://extensions", rules), null);
});

test("uses separate weekday and weekend limits", () => {
  const rule = { weekdayMinutes: 45, weekendMinutes: 15 };
  assert.equal(dailyLimitMinutes(rule, new Date(2026, 7, 24)), 45); // Monday
  assert.equal(dailyLimitMinutes(rule, new Date(2026, 7, 23)), 15); // Sunday
});

test("summarizes the current week and reduction from the prior week", () => {
  const now = new Date(2026, 7, 26, 12); // Wednesday
  const rules = [{ id: "social", weekdayMinutes: 30, weekendMinutes: 15, enabled: true }];
  const usage = {
    "2026-08-17": { social: 1200 },
    "2026-08-18": { social: 1200 },
    "2026-08-24": { social: 600 },
    "2026-08-25": { social: 600 }
  };
  const summary = weeklySummary(usage, rules, now, 1);
  assert.equal(summary.currentSeconds, 1200);
  assert.equal(summary.previousSeconds, 2400);
  assert.equal(summary.savedSeconds, 1200);
  assert.equal(summary.reductionPercent, 50);
  assert.equal(summary.withinLimitDays, 3);
  assert.equal(dateKey(summary.currentDays[0]), "2026-08-24");
});

test("compares only elapsed weekdays until the week is complete", () => {
  const now = new Date(2026, 7, 24, 12); // Monday
  const rules = [{ id: "social", weekdayMinutes: 30, weekendMinutes: 15, enabled: true }];
  const usage = {
    "2026-08-17": { social: 1200 },
    "2026-08-18": { social: 9999 },
    "2026-08-24": { social: 600 }
  };
  const summary = weeklySummary(usage, rules, now, 1);
  assert.equal(summary.previousSeconds, 1200);
  assert.equal(summary.currentSeconds, 600);
  assert.equal(summary.reductionPercent, 50);
});

test("does not award goal days before any limits exist", () => {
  const summary = weeklySummary({}, [], new Date(2026, 7, 24), 1);
  assert.equal(summary.withinLimitDays, 0);
});
