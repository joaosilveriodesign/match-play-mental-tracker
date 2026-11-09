import { calculateStats, formatPercent, SCORES, TACTICS, EXECUTIONS, MOVEMENTS, DF_CAUSES } from "./stats.js";

const clean = (value = "") => String(value).replace(/[\t\r]+/g, " ").trim();
const csvCell = (value = "") => `"${String(value).replaceAll('"', '""')}"`;

export function sessionText(session, points) {
  const lines = [
    "MATCH PLAY MENTAL TRACKER",
    `Session date: ${session.date}`,
    `Player identifier: ${session.playerIdentifier || "Not provided"}`,
    `Session type: ${session.type}`,
    `Session notes: ${clean(session.notes) || "None"}`,
    `Recorded points: ${points.length}`,
    "",
    ...points.map((point) => [
      `Point ${point.number} — ${new Date(point.timestamp).toLocaleString()}`,
      `Score before point: ${point.score}`,
      `Position: ${point.position}`,
      `Tactical decision: ${point.tacticalDecision}`,
      `Execution: ${point.execution}`,
      `Movement/body language: ${point.movement}`,
      `Outcome: ${point.outcome}`,
      `Double fault likely cause: ${point.doubleFaultCause || "Not applicable"}`,
      `Coaching notes: ${clean(point.notes) || "None"}`
    ].join("\n"))
  ];
  return lines.join("\n\n");
}

export function sessionCsv(session, points) {
  const headers = ["session_id", "session_date", "player_identifier", "session_type", "session_notes", "point_number", "timestamp", "score_before_point", "position", "tactical_decision", "execution", "movement_body_language", "outcome", "double_fault_likely_cause", "coaching_notes"];
  const rows = points.map((point) => [session.id, session.date, session.playerIdentifier, session.type, session.notes, point.number, point.timestamp, point.score, point.position, point.tacticalDecision, point.execution, point.movement, point.outcome, point.doubleFaultCause, point.notes]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(session, extension) {
  const player = (session.playerIdentifier || "session").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `match-tracker-${session.date}-${player}.${extension}`;
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function reportHtml(session, points) {
  const stats = calculateStats(points);
  const scoreRows = SCORES.map((score) => {
    const item = stats.byScore[score];
    return `<tr><th>${score}</th><td>${item.total}</td><td>${item.won} / ${item.lost}</td><td>${formatPercent(item.winRate)}</td><td>${item.doubleFaults}</td></tr>`;
  }).join("");
  const notes = points.filter((point) => point.notes).map((point) => `<li><strong>Point ${point.number} (${point.score}):</strong> ${escapeHtml(point.notes)}</li>`).join("") || "<li>No point notes recorded.</li>";
  const causes = Object.entries(stats.byScore).flatMap(([score, item]) => Object.entries(item.doubleFaultCauses).filter(([, count]) => count).map(([cause, count]) => `<li>${score}: ${escapeHtml(cause)} — ${count}</li>`)).join("") || "<li>No double faults recorded.</li>";
  return `<article class="print-report"><header><p>COURTSIDE OBSERVATION REPORT</p><h1>Match Play Mental Tracker</h1></header><section class="print-meta"><div><b>Date</b><span>${session.date}</span></div><div><b>Player identifier</b><span>${escapeHtml(session.playerIdentifier || "Not provided")}</span></div><div><b>Session type</b><span>${escapeHtml(session.type)}</span></div></section><p><b>Session notes:</b> ${escapeHtml(session.notes || "None")}</p><h2>Headline statistics</h2><div class="print-stats"><div><b>${stats.total}</b><span>Points</span></div><div><b>${formatPercent(stats.winRate)}</b><span>Won (${stats.won}/${stats.total})</span></div><div><b>${formatPercent(stats.committedRate)}</b><span>Committed (${stats.committed}/${stats.observableExecutions} observable)</span></div><div><b>${stats.doubleFaults}</b><span>Double faults (${stats.servingPoints} serves)</span></div></div><h2>Statistics by score</h2><table><thead><tr><th>Score</th><th>N</th><th>Won / Lost</th><th>Win %</th><th>DF</th></tr></thead><tbody>${scoreRows}</tbody></table><h2>Double fault analysis</h2><ul>${causes}</ul><h2>Coaching notes</h2><ul>${notes}</ul><footer>Percentages include sample sizes. Small samples do not establish reliable psychological patterns. Data was recorded as coaching observation, not diagnosis.</footer></article>`;
}

export function blankSheetHtml() {
  const rows = Array.from({ length: 18 }, (_, index) => `<tr><td>${index + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  return `<article class="print-report blank-sheet"><header><p>PRINTABLE COURTSIDE SHEET</p><h1>Match Play Mental Tracker</h1></header><section class="sheet-fields"><span>Date: ____________________</span><span>Player ID: ____________________</span><span>Type: ____________________</span></section><table><thead><tr><th>#</th><th>Score</th><th>S/R</th><th>Tactic</th><th>Exec.</th><th>Move.</th><th>Result</th><th>Notes / DF cause</th></tr></thead><tbody>${rows}</tbody></table><div class="legend"><b>Legend</b><p><b>Scores:</b> 30–0, 40–0, 40–15, 40–30. <b>Tactic:</b> CP clear plan; TC too conservative; R rushed; H hesitant. <b>Execution:</b> C committed; HS hesitant/slowed; NO not observable. <b>Movement:</b> N normal; T tense/less active; NO not observable. <b>Result:</b> W won; L lost; DF double fault. <b>DF cause:</b> CP/poor execution; TC; R; H; NO/unsure.</p></div></article>`;
}

export function validateBackup(value) {
  if (!value || value.schema !== "match-play-mental-tracker-backup" || value.version !== 1 || !Array.isArray(value.sessions) || !Array.isArray(value.points)) throw new Error("This is not a valid Match Play Mental Tracker backup.");
  const sessionIds = new Set();
  for (const session of value.sessions) {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(session?.date || "") && !Number.isNaN(Date.parse(`${session.date}T12:00:00Z`));
    if (!session?.id || !validDate || !["Match Play", "Practice Match", "Tournament", "Other"].includes(session.type) || typeof session.playerIdentifier !== "string" || typeof session.notes !== "string" || !["active", "ended"].includes(session.status) || Number.isNaN(Date.parse(session.createdAt)) || sessionIds.has(session.id)) throw new Error("The backup contains an invalid or duplicate session.");
    sessionIds.add(session.id);
  }
  const pointIds = new Set();
  const sessionNumbers = new Set();
  for (const point of value.points) {
    const numberKey = `${point.sessionId}:${point.number}`;
    const outcomeValid = ["Won", "Lost", "Double Fault"].includes(point.outcome);
    const dfValid = point.outcome === "Double Fault" ? point.position === "Serving" && DF_CAUSES.includes(point.doubleFaultCause) : !point.doubleFaultCause;
    if (!point?.id || pointIds.has(point.id) || !sessionIds.has(point.sessionId) || !Number.isInteger(point.number) || point.number < 1 || sessionNumbers.has(numberKey) || Number.isNaN(Date.parse(point.timestamp)) || !SCORES.includes(point.score) || !["Serving", "Returning"].includes(point.position) || !TACTICS.includes(point.tacticalDecision) || !EXECUTIONS.includes(point.execution) || !MOVEMENTS.includes(point.movement) || !outcomeValid || !dfValid || typeof point.notes !== "string") throw new Error("The backup contains an invalid or duplicate point record.");
    pointIds.add(point.id);
    sessionNumbers.add(numberKey);
  }
  return value;
}
