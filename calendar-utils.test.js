const test = require("node:test");
const assert = require("node:assert/strict");

// The browser module exposes pure date helpers; load it with a minimal window shim.
global.window = {};
require("../src/apex-appointment-calendar.js");
const u = window.ApexAppointmentCalendar.utils;

test("parses and formats DD/MM/YYYY without timezone conversion", () => {
  const date = u.parsePageDate("13/11/2026", "DD/MM/YYYY");
  assert.equal(u.toIsoLocal(date), "2026-11-13");
  assert.equal(u.formatPageDate(date, "DD/MM/YYYY"), "13/11/2026");
});

test("rejects impossible calendar dates", () => {
  assert.equal(u.parsePageDate("31/02/2026", "DD/MM/YYYY"), null);
});

test("parses ISO dates as local dates", () => {
  assert.equal(u.toIsoLocal(u.parseIsoLocal("2026-12-01")), "2026-12-01");
});

test("past-date comparison is date-only", () => {
  const now = new Date(2026, 10, 13, 18, 45);
  assert.equal(u.isBeforeToday(new Date(2026, 10, 12, 23, 59), now), true);
  assert.equal(u.isBeforeToday(new Date(2026, 10, 13, 0, 1), now), false);
});
