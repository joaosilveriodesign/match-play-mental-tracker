import test from "node:test";
import assert from "node:assert/strict";
import { calculateStats, percentage } from "../src/js/stats.js";

const point = (overrides = {}) => ({
  score: "30–0", position: "Serving", tacticalDecision: "Clear plan", execution: "Committed", movement: "Normal", outcome: "Won", doubleFaultCause: "", ...overrides
});

test("undefined percentages use a null sentinel", () => {
  assert.equal(percentage(0, 0), null);
  const stats = calculateStats([]);
  assert.equal(stats.winRate, null);
  assert.equal(stats.committedRate, null);
  assert.equal(stats.doubleFaultRate, null);
});

test("double faults count once as a lost point and once as a double fault", () => {
  const stats = calculateStats([point({ outcome: "Double Fault", doubleFaultCause: "Rushed" })]);
  assert.equal(stats.total, 1);
  assert.equal(stats.won, 0);
  assert.equal(stats.lost, 1);
  assert.equal(stats.doubleFaults, 1);
  assert.equal(stats.doubleFaultRate, 100);
  assert.equal(stats.byScore["30–0"].doubleFaultCauses.Rushed, 1);
});

test("committed rate excludes not-observable executions", () => {
  const stats = calculateStats([
    point(),
    point({ execution: "Hesitant or slowed down", outcome: "Lost" }),
    point({ execution: "Not observable", outcome: "Lost" })
  ]);
  assert.equal(stats.committed, 1);
  assert.equal(stats.observableExecutions, 2);
  assert.equal(stats.committedRate, 50);
});

test("serving and returning filters use serving points for double-fault denominator", () => {
  const points = [
    point({ position: "Serving", outcome: "Double Fault", doubleFaultCause: "Not observable / Unsure" }),
    point({ position: "Serving" }),
    point({ position: "Returning" })
  ];
  assert.equal(calculateStats(points).doubleFaultRate, 50);
  assert.equal(calculateStats(points, "Serving").doubleFaultRate, 50);
  assert.equal(calculateStats(points, "Returning").doubleFaultRate, null);
});

test("each required score receives independent statistics", () => {
  const stats = calculateStats([
    point({ score: "30–0" }),
    point({ score: "40–0", outcome: "Lost" }),
    point({ score: "40–15" }),
    point({ score: "40–30", position: "Returning" })
  ]);
  assert.deepEqual(Object.keys(stats.byScore), ["30–0", "40–0", "40–15", "40–30"]);
  assert.equal(stats.byScore["40–0"].lost, 1);
  assert.equal(stats.byScore["40–30"].won, 1);
});
