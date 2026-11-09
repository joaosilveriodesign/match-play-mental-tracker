import test from "node:test";
import assert from "node:assert/strict";
import { sessionCsv, sessionText, validateBackup } from "../src/js/exports.js";

const session = { id: "session_1", date: "2026-11-08", playerIdentifier: "P-14", type: "Match Play", notes: "Windy", status: "ended", createdAt: "2026-11-08T16:00:00.000Z", endedAt: "2026-11-08T18:00:00.000Z" };
const point = { id: "point_1", sessionId: "session_1", number: 1, timestamp: "2026-11-08T17:00:00.000Z", score: "40–15", position: "Serving", tacticalDecision: "Rushed", execution: "Hesitant or slowed down", movement: "Tense or less active", outcome: "Double Fault", doubleFaultCause: "Rushed", notes: "Reduced racket-head speed." };

test("CSV and copy records include every point-level field", () => {
  const csv = sessionCsv(session, [point]);
  const text = sessionText(session, [point]);
  for (const value of [point.score, point.position, point.tacticalDecision, point.execution, point.movement, point.outcome, point.doubleFaultCause, point.notes]) {
    assert.ok(csv.includes(value));
    assert.ok(text.includes(value));
  }
});

test("backup validation accepts the supported schema", () => {
  const backup = { schema: "match-play-mental-tracker-backup", version: 1, sessions: [session], points: [point] };
  assert.equal(validateBackup(backup), backup);
});

test("backup validation rejects orphan points and duplicate session ids", () => {
  assert.throws(() => validateBackup({ schema: "match-play-mental-tracker-backup", version: 1, sessions: [session], points: [{ ...point, sessionId: "missing" }] }));
  assert.throws(() => validateBackup({ schema: "match-play-mental-tracker-backup", version: 1, sessions: [session, session], points: [] }));
});

test("backup validation rejects an impossible returning double fault", () => {
  const impossible = { ...point, position: "Returning" };
  assert.throws(() => validateBackup({ schema: "match-play-mental-tracker-backup", version: 1, sessions: [session], points: [impossible] }));
});
