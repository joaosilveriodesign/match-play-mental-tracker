import { db, newId } from "./db.js";
import { calculateStats, formatPercent, SCORES, TACTICS, EXECUTIONS, MOVEMENTS, DF_CAUSES } from "./stats.js";
import { blankSheetHtml, download, reportHtml, safeFilename, sessionCsv, sessionText, validateBackup } from "./exports.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const form = $("#point-form");
const toast = $("#toast");
const state = {
  sessions: [],
  points: [],
  activeSession: null,
  editingPointId: null,
  detailSessionId: null,
  statsRole: "All",
  comparisons: new Set(),
  submitting: false,
  lastSubmission: null
};

const HELP = {
  all: `<dl><dt>Clear plan</dt><dd>An identifiable, appropriate tactical choice without an obvious pressure-related alteration.</dd><dt>Too conservative</dt><dd>Unnecessarily passive or excessively safe compared with the intended tactical approach.</dd><dt>Rushed</dt><dd>Preparation, decision-making, or execution is accelerated unnecessarily.</dd><dt>Hesitant</dt><dd>Uncertainty, delayed decision, or visible indecision.</dd><dt>Committed execution</dt><dd>The chosen action is executed decisively, regardless of whether the point is won or lost.</dd><dt>Hesitant or slowed down</dt><dd>Visible reduction in commitment, speed, or decisiveness during execution.</dd><dt>Normal movement</dt><dd>Movement, readiness, and body language match the player's usual behaviour.</dd><dt>Tense or less active</dt><dd>Reduced footwork, visible stiffness, or unusual tension.</dd><dt>Not observable</dt><dd>There is not enough information to evaluate reliably.</dd></dl>`,
  tactics: `<dl><dt>Clear plan</dt><dd>An identifiable, appropriate tactical choice without an obvious pressure-related alteration.</dd><dt>Too conservative</dt><dd>Unnecessarily passive or excessively safe compared with the intended tactical approach.</dd><dt>Rushed</dt><dd>Preparation, decision-making, or execution is accelerated unnecessarily.</dd><dt>Hesitant</dt><dd>Uncertainty, delayed decision, or visible indecision.</dd></dl>`,
  execution: `<dl><dt>Committed</dt><dd>The chosen action is executed decisively, regardless of whether the point is won or lost.</dd><dt>Hesitant or slowed down</dt><dd>Visible reduction in commitment, speed, or decisiveness during execution.</dd><dt>Not observable</dt><dd>The coach cannot evaluate execution reliably.</dd></dl>`,
  movement: `<dl><dt>Normal</dt><dd>Movement, readiness, and body language match the player's usual behaviour.</dd><dt>Tense or less active</dt><dd>Reduced footwork, visible stiffness, or unusual tension.</dd><dt>Not observable</dt><dd>There is not enough information to evaluate reliably.</dd></dl>`
};

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function displayDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pointsFor(sessionId) {
  return state.points.filter((point) => point.sessionId === sessionId).sort((a, b) => a.number - b.number);
}

function sessionById(id) {
  return state.sessions.find((session) => session.id === id) || null;
}

function pointById(id) {
  return state.points.find((point) => point.id === id) || null;
}

function showToast(message) {
  clearTimeout(showToast.timer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

async function refreshData() {
  [state.sessions, state.points] = await Promise.all([db.sessions(), db.allPoints()]);
  state.activeSession = state.sessions.find((session) => session.status === "active") || null;
  renderAll();
}

function sessionLabel(session) {
  return `${session.playerIdentifier || "No player ID"} · ${session.type}`;
}

function fillSessionSelect(select, includeAll = false) {
  const previous = select.value;
  const options = [includeAll ? `<option value="All">All sessions</option>` : "", ...state.sessions.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(displayDate(session.date))} — ${escapeHtml(sessionLabel(session))}</option>`)].join("");
  select.innerHTML = options || `<option value="">No sessions yet</option>`;
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  else if (state.activeSession && [...select.options].some((option) => option.value === state.activeSession.id)) select.value = state.activeSession.id;
}

function navigate(page) {
  $$(".page").forEach((element) => { element.hidden = element.id !== `${page}-page`; element.classList.toggle("is-active", !element.hidden); });
  $$(".bottom-nav button").forEach((button) => button.classList.toggle("is-active", button.dataset.page === page));
  if (page === "statistics") renderStatistics();
  if (page === "history") renderHistory();
  if (page === "reports") renderReports();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function pointMarkup(point, showActions = true) {
  return `<article class="point-item" data-point-id="${point.id}"><div class="point-top"><strong>#${point.number} · ${point.score} · ${point.position}</strong><span class="result ${point.outcome === "Won" ? "" : "lost"}">${escapeHtml(point.outcome)}</span></div><div class="point-meta"><span>${escapeHtml(point.tacticalDecision)}</span><span>${escapeHtml(point.execution)}</span><span>${escapeHtml(point.movement)}</span>${point.doubleFaultCause ? `<span>DF cause: ${escapeHtml(point.doubleFaultCause)}</span>` : ""}<span>${new Date(point.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>${point.notes ? `<p class="point-note">${escapeHtml(point.notes)}</p>` : ""}${showActions ? `<div class="point-actions"><button data-action="edit-point" type="button">Edit</button><button class="delete-point" data-action="delete-point" type="button">Delete</button></div>` : ""}</article>`;
}

function renderTrack() {
  const editingPoint = state.editingPointId ? pointById(state.editingPointId) : null;
  const trackSession = editingPoint ? sessionById(editingPoint.sessionId) : state.activeSession;
  $("#session-setup").hidden = Boolean(trackSession);
  $("#active-session-area").hidden = !trackSession;
  $("#track-count").textContent = trackSession ? `${pointsFor(trackSession.id).length} point${pointsFor(trackSession.id).length === 1 ? "" : "s"}` : "No active session";
  if (!trackSession) return;
  $("#active-session-name").textContent = sessionLabel(trackSession);
  const trackPointCount = pointsFor(trackSession.id).length;
  $("#active-session-meta").textContent = `${displayDate(trackSession.date)} · ${trackPointCount} point${trackPointCount === 1 ? "" : "s"}${editingPoint && trackSession.status !== "active" ? " · Historical edit" : ""}`;
  $("#end-session").hidden = trackSession.status !== "active" || Boolean(editingPoint);
  const points = pointsFor(trackSession.id).slice(-5).reverse();
  $("#recent-points").innerHTML = points.length ? points.map((point) => pointMarkup(point)).join("") : `<div class="empty-state">No points yet. Completed observations will appear here.</div>`;
  $("#undo-point").disabled = !points.length || Boolean(editingPoint);
}

function selected(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function setSelected(name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(value || "")}"]`);
  if (input) input.checked = true;
}

function updateDoubleFaultUi() {
  const serving = selected("position") === "Serving";
  const dfInput = form.querySelector('input[name="outcome"][value="Double Fault"]');
  dfInput.disabled = !serving;
  $("#df-position-note").hidden = serving;
  if (!serving && dfInput.checked) dfInput.checked = false;
  const isDf = selected("outcome") === "Double Fault";
  $("#df-cause-field").hidden = !isDf;
  $("#notes-number").textContent = isDf ? "8" : "7";
  if (!isDf) $$('input[name="doubleFaultCause"]', form).forEach((input) => { input.checked = false; });
}

function resetPointForm(preserveBasics = false) {
  const score = preserveBasics ? selected("score") : "";
  const position = preserveBasics ? selected("position") : "";
  form.reset();
  if (score) setSelected("score", score);
  if (position) setSelected("position", position);
  state.editingPointId = null;
  $("#point-form-kicker").textContent = "New observation";
  $("#point-form-title").textContent = "Record a point";
  $("#add-point").firstChild.textContent = "Add point ";
  $("#cancel-edit").hidden = true;
  $("#form-error").textContent = "";
  $$(".field-error", form).forEach((element) => element.classList.remove("field-error"));
  updateDoubleFaultUi();
}

function startEditingPoint(id) {
  const point = pointById(id);
  if (!point) return;
  state.editingPointId = id;
  form.reset();
  ["score", "position", "tacticalDecision", "execution", "movement", "outcome", "doubleFaultCause"].forEach((field) => setSelected(field, point[field]));
  form.elements.notes.value = point.notes || "";
  updateDoubleFaultUi();
  $("#point-form-kicker").textContent = `Point ${point.number}`;
  $("#point-form-title").textContent = "Edit observation";
  $("#add-point").firstChild.textContent = "Save changes ";
  $("#cancel-edit").hidden = false;
  $("#session-dialog").close();
  navigate("track");
  renderTrack();
  form.scrollIntoView({ block: "start" });
}

function validatePoint() {
  const fields = ["score", "position", "tacticalDecision", "execution", "movement", "outcome"];
  if (selected("outcome") === "Double Fault") fields.push("doubleFaultCause");
  $$(".field-error", form).forEach((element) => element.classList.remove("field-error"));
  const missing = fields.find((field) => !selected(field));
  if (missing) {
    const fieldset = form.querySelector(`[data-field="${missing}"]`);
    fieldset.classList.add("field-error");
    fieldset.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#form-error").textContent = "Choose an option in every required section.";
    return false;
  }
  if (selected("outcome") === "Double Fault" && selected("position") !== "Serving") {
    $("#form-error").textContent = "A double fault can only be recorded while Serving.";
    return false;
  }
  return true;
}

async function savePoint(event) {
  event.preventDefault();
  if (state.submitting || !validatePoint()) return;
  const existing = state.editingPointId ? pointById(state.editingPointId) : null;
  const session = existing ? sessionById(existing.sessionId) : state.activeSession;
  if (!session) return showToast("Start or resume a session first.");
  const values = {
    score: selected("score"), position: selected("position"), tacticalDecision: selected("tacticalDecision"), execution: selected("execution"), movement: selected("movement"), outcome: selected("outcome"),
    doubleFaultCause: selected("outcome") === "Double Fault" ? selected("doubleFaultCause") : "", notes: form.elements.notes.value.trim()
  };
  const signature = JSON.stringify({ sessionId: session.id, ...values });
  if (!existing && state.lastSubmission?.signature === signature && Date.now() - state.lastSubmission.time < 2000) return showToast("Duplicate tap ignored.");
  state.submitting = true;
  $("#add-point").disabled = true;
  try {
    const sessionPoints = pointsFor(session.id);
    const point = existing ? { ...existing, ...values, updatedAt: new Date().toISOString() } : { id: newId("point"), sessionId: session.id, number: Math.max(0, ...sessionPoints.map((item) => item.number)) + 1, timestamp: new Date().toISOString(), ...values };
    await db.savePoint(point);
    state.lastSubmission = { signature, time: Date.now() };
    resetPointForm(!existing);
    await refreshData();
    showToast(existing ? `Point ${point.number} updated.` : `Point ${point.number} saved.`);
  } catch (error) {
    console.error(error);
    $("#form-error").textContent = "The point could not be saved. Please try again.";
  } finally {
    state.submitting = false;
    $("#add-point").disabled = false;
  }
}

async function deletePoint(id, requireConfirmation = true) {
  const point = pointById(id);
  if (!point || (requireConfirmation && !confirm(`Delete point ${point.number}? This cannot be undone.`))) return;
  await db.deletePoint(id);
  if (state.editingPointId === id) resetPointForm();
  await refreshData();
  if (state.detailSessionId) renderSessionDetail();
  showToast(requireConfirmation ? "Point deleted." : `Point ${point.number} undone.`);
}

function metricCard(label, value, sample, primary = false) {
  return `<div class="stat-card ${primary ? "primary" : ""}"><span>${label}</span><strong>${value}</strong><small>${sample}</small></div>`;
}

function renderDistribution(title, values, total) {
  return `<div class="distribution"><h3>${title}</h3>${Object.entries(values).map(([label, count]) => `<div class="dist-row"><span title="${escapeHtml(label)}">${escapeHtml(label)}</span><b>${count}</b><span>${formatPercent(total ? count / total * 100 : null)}</span><div class="bar"><i style="width:${total ? count / total * 100 : 0}%"></i></div></div>`).join("")}</div>`;
}

function renderStatistics() {
  const select = $("#stats-session");
  fillSessionSelect(select, true);
  let points = select.value === "All" ? state.points : pointsFor(select.value);
  const stats = calculateStats(points, state.statsRole);
  $("#overall-stats").innerHTML = [
    metricCard("Recorded points", stats.total, `n=${stats.total}`, true),
    metricCard("Points won", `${stats.won}`, `${formatPercent(stats.winRate)} · ${stats.won}/${stats.total}`),
    metricCard("Points lost", `${stats.lost}`, `Includes ${stats.doubleFaults} double fault${stats.doubleFaults === 1 ? "" : "s"}`),
    metricCard("Committed execution", formatPercent(stats.committedRate), `${stats.committed}/${stats.observableExecutions} observable`),
    metricCard("Double faults", stats.doubleFaults, `${formatPercent(stats.doubleFaultRate)} · ${stats.doubleFaults}/${stats.servingPoints} serves`)
  ].join("");
  $("#score-stats").innerHTML = SCORES.map((score, index) => {
    const item = stats.byScore[score];
    return `<details class="panel score-card" ${index === 0 ? "open" : ""}><summary><strong>${score}</strong><span>n=${item.total} · ${formatPercent(item.winRate)} won</span></summary><div class="score-detail"><div class="mini-headline"><div><b>${item.total}</b><small>Points</small></div><div><b>${item.won}</b><small>Won</small></div><div><b>${item.lost}</b><small>Lost</small></div><div><b>${item.doubleFaults}</b><small>DF</small></div></div>${renderDistribution("Tactical decisions", item.tactical, item.total)}${renderDistribution("Execution", item.execution, item.total)}${renderDistribution("Movement and body language", item.movement, item.total)}${renderDistribution("Double fault likely causes", item.doubleFaultCauses, item.doubleFaults)}<p class="sample-warning">Win: ${formatPercent(item.winRate)} (${item.won}/${item.total}). Double faults: ${formatPercent(item.doubleFaultRate)} (${item.doubleFaults}/${points.filter((p) => (state.statsRole === "All" || p.position === state.statsRole) && p.score === score && p.position === "Serving").length} serving points).</p></div></details>`;
  }).join("");
}

function filteredHistoryPoints(sessionId) {
  const score = $("#history-score").value;
  const role = $("#history-role").value;
  return pointsFor(sessionId).filter((point) => (score === "All" || point.score === score) && (role === "All" || point.position === role));
}

function renderComparison() {
  const panel = $("#comparison-panel");
  const sessions = [...state.comparisons].map(sessionById).filter(Boolean);
  panel.hidden = sessions.length < 2;
  if (sessions.length < 2) return;
  panel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Filtered comparison</p><h2>${sessions.length} sessions</h2></div><button id="clear-comparison" class="text-button" type="button">Clear</button></div><table><thead><tr><th>Session</th><th>N</th><th>Win</th><th>Committed</th><th>DF</th></tr></thead><tbody>${sessions.map((session) => { const stats = calculateStats(filteredHistoryPoints(session.id)); return `<tr><td>${displayDate(session.date)}<br><small>${escapeHtml(session.playerIdentifier || session.type)}</small></td><td>${stats.total}</td><td>${formatPercent(stats.winRate)}<br><small>${stats.won}/${stats.total}</small></td><td>${formatPercent(stats.committedRate)}<br><small>${stats.committed}/${stats.observableExecutions}</small></td><td>${stats.doubleFaults}<br><small>${stats.doubleFaults}/${stats.servingPoints} serves</small></td></tr>`; }).join("")}</tbody></table>`;
}

function renderHistory() {
  renderComparison();
  const list = $("#session-list");
  if (!state.sessions.length) { list.innerHTML = `<div class="empty-state">No saved sessions yet. Start one from Track.</div>`; return; }
  list.innerHTML = state.sessions.map((session) => {
    const stats = calculateStats(filteredHistoryPoints(session.id));
    return `<article class="session-card" data-session-id="${session.id}"><div class="session-card-top"><div><p class="eyebrow">${displayDate(session.date)}</p><h2>${escapeHtml(session.playerIdentifier || session.type)}</h2><p>${escapeHtml(session.playerIdentifier ? session.type : "No player identifier")} · ${pointsFor(session.id).length} total records</p></div>${session.status === "active" ? `<span class="active-tag">Active</span>` : ""}</div><div class="session-metrics"><div><b>${stats.total}</b><span>Filtered N</span></div><div><b>${formatPercent(stats.winRate)}</b><span>Won</span></div><div><b>${formatPercent(stats.committedRate)}</b><span>Committed</span></div><div><b>${stats.doubleFaults}</b><span>DF</span></div></div><div class="session-actions"><label class="compare-check"><input type="checkbox" data-action="compare" ${state.comparisons.has(session.id) ? "checked" : ""}/> Compare</label><button data-action="open-session" type="button">Open</button>${session.status !== "active" ? `<button data-action="resume-session" type="button">Resume</button>` : ""}<button data-action="export-session" type="button">Export</button><button class="delete-session" data-action="delete-session" type="button">Delete</button></div></article>`;
  }).join("");
}

function renderSessionDetail() {
  const session = sessionById(state.detailSessionId);
  if (!session) return $("#session-dialog").close();
  const score = $("#detail-score").value;
  const role = $("#detail-role").value;
  const points = pointsFor(session.id).filter((point) => (score === "All" || point.score === score) && (role === "All" || point.position === role));
  $("#session-dialog-title").textContent = `${displayDate(session.date)} · ${session.playerIdentifier || session.type}`;
  $("#session-detail").innerHTML = points.length ? `<div class="point-list">${points.map((point) => pointMarkup(point)).join("")}</div>` : `<div class="empty-state">No points match these filters.</div>`;
}

function renderReports() {
  fillSessionSelect($("#report-session"));
  $$('[data-report]:not([data-report="backup"]):not([data-report="blank"])').forEach((button) => { button.disabled = !state.sessions.length; });
}

function renderAll() {
  renderTrack();
  renderStatistics();
  renderHistory();
  renderReports();
  if (state.detailSessionId && $("#session-dialog").open) renderSessionDetail();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = Object.assign(document.createElement("textarea"), { value: text });
  textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.append(textarea); textarea.select();
  const succeeded = document.execCommand("copy"); textarea.remove();
  if (!succeeded) throw new Error("Copy failed");
}

function sessionBackup(session) {
  return { schema: "match-play-mental-tracker-backup", version: 1, exportedAt: new Date().toISOString(), sessions: [session], points: pointsFor(session.id) };
}

async function reportAction(action) {
  if (action === "blank") { $("#print-root").innerHTML = blankSheetHtml(); return setTimeout(() => window.print(), 50); }
  if (action === "backup") {
    const backup = { schema: "match-play-mental-tracker-backup", version: 1, exportedAt: new Date().toISOString(), sessions: state.sessions, points: state.points };
    download(`match-tracker-backup-${localDate()}.json`, JSON.stringify(backup, null, 2), "application/json");
    return showToast("Full backup exported.");
  }
  const session = sessionById($("#report-session").value);
  if (!session) return showToast("Select a session first.");
  const points = pointsFor(session.id);
  if (action === "copy") { await copyText(sessionText(session, points)); return showToast("Session records copied."); }
  if (action === "csv") download(safeFilename(session, "csv"), sessionCsv(session, points), "text/csv;charset=utf-8");
  if (action === "json") download(safeFilename(session, "json"), JSON.stringify(sessionBackup(session), null, 2), "application/json");
  if (action === "print") { $("#print-root").innerHTML = reportHtml(session, points); setTimeout(() => window.print(), 50); }
}

async function importFile(file) {
  if (!file) return;
  try {
    const backup = validateBackup(JSON.parse(await file.text()));
    const result = await db.importBackup(backup.sessions, backup.points);
    await refreshData();
    showToast(`Imported ${result.addedSessions} session(s), ${result.addedPoints} point(s). ${result.skippedSessions} duplicate(s) skipped.`);
  } catch (error) {
    alert(error.message || "The backup could not be imported.");
  } finally {
    $("#import-file").value = "";
  }
}

function updateConnection() {
  const status = $("#connection-status");
  status.classList.toggle("is-offline", !navigator.onLine);
  $("span", status).textContent = navigator.onLine ? "Online" : "Offline ready";
}

function bindEvents() {
  $$(".bottom-nav button").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
  $("#session-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const sessionForm = event.currentTarget; const data = new FormData(sessionForm);
    const session = { id: newId("session"), date: data.get("date"), playerIdentifier: String(data.get("playerIdentifier") || "").trim(), type: data.get("type"), notes: String(data.get("notes") || "").trim(), status: "active", createdAt: new Date().toISOString(), endedAt: null };
    await db.saveSession(session); sessionForm.reset(); $("#session-date").value = localDate(); await refreshData(); showToast("Session started. Ready to record.");
  });
  $("#end-session").addEventListener("click", async () => {
    if (!state.activeSession || !confirm("End this session? It will remain available in History and can be resumed later.")) return;
    await db.saveSession({ ...state.activeSession, status: "ended", endedAt: new Date().toISOString() }); resetPointForm(); await refreshData(); showToast("Session ended and saved.");
  });
  form.addEventListener("change", updateDoubleFaultUi);
  form.addEventListener("submit", savePoint);
  $("#cancel-edit").addEventListener("click", () => { resetPointForm(); renderTrack(); });
  $("#undo-point").addEventListener("click", () => { const points = state.activeSession ? pointsFor(state.activeSession.id) : []; const last = points.at(-1); if (last) deletePoint(last.id, false); });
  $("#recent-points").addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); const id = event.target.closest("[data-point-id]")?.dataset.pointId; if (button?.dataset.action === "edit-point") startEditingPoint(id); if (button?.dataset.action === "delete-point") deletePoint(id); });
  $("#stats-session").addEventListener("change", renderStatistics);
  $("#stats-role").addEventListener("click", (event) => { const button = event.target.closest("button[data-role]"); if (!button) return; state.statsRole = button.dataset.role; $$("button", event.currentTarget).forEach((item) => item.classList.toggle("is-selected", item === button)); renderStatistics(); });
  [$("#history-score"), $("#history-role")].forEach((select) => select.addEventListener("change", renderHistory));
  $("#session-list").addEventListener("change", (event) => { if (event.target.dataset.action !== "compare") return; const id = event.target.closest("[data-session-id]").dataset.sessionId; event.target.checked ? state.comparisons.add(id) : state.comparisons.delete(id); renderHistory(); });
  $("#session-list").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const id = button.closest("[data-session-id]").dataset.sessionId; const session = sessionById(id);
    if (button.dataset.action === "open-session") { state.detailSessionId = id; $("#detail-score").value = "All"; $("#detail-role").value = "All"; renderSessionDetail(); $("#session-dialog").showModal(); }
    if (button.dataset.action === "resume-session") {
      if (state.activeSession && !confirm(`End the current active session and resume the ${displayDate(session.date)} session?`)) return;
      if (state.activeSession) await db.saveSession({ ...state.activeSession, status: "ended", endedAt: new Date().toISOString() });
      await db.saveSession({ ...session, status: "active", endedAt: null }); await refreshData(); navigate("track"); showToast("Session resumed.");
    }
    if (button.dataset.action === "export-session") { download(safeFilename(session, "json"), JSON.stringify(sessionBackup(session), null, 2), "application/json"); showToast("Session exported."); }
    if (button.dataset.action === "delete-session" && confirm(`Delete the ${displayDate(session.date)} session and all of its points? This cannot be undone.`)) { await db.deleteSession(id); state.comparisons.delete(id); await refreshData(); showToast("Session deleted."); }
  });
  $("#comparison-panel").addEventListener("click", (event) => { if (event.target.id === "clear-comparison") { state.comparisons.clear(); renderHistory(); } });
  $("#close-session-dialog").addEventListener("click", () => $("#session-dialog").close());
  [$("#detail-score"), $("#detail-role")].forEach((select) => select.addEventListener("change", renderSessionDetail));
  $("#session-detail").addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); const id = event.target.closest("[data-point-id]")?.dataset.pointId; if (button?.dataset.action === "edit-point") startEditingPoint(id); if (button?.dataset.action === "delete-point") deletePoint(id); });
  $$('[data-report]').forEach((button) => button.addEventListener("click", () => reportAction(button.dataset.report).catch((error) => { console.error(error); showToast("That action could not be completed."); })));
  $("#import-file").addEventListener("change", (event) => importFile(event.target.files[0]));
  $("#help-button").addEventListener("click", () => { $("#help-content").innerHTML = HELP.all; $("#help-dialog").showModal(); });
  $$(".info-trigger").forEach((button) => button.addEventListener("click", () => { $("#help-content").innerHTML = HELP[button.dataset.help]; $("#help-dialog").showModal(); }));
  $("#theme-toggle").addEventListener("click", () => { const dark = document.documentElement.dataset.theme !== "dark"; document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("mpt-theme", dark ? "dark" : "light"); $("#theme-toggle").textContent = dark ? "☀" : "☾"; });
  window.addEventListener("online", updateConnection); window.addEventListener("offline", updateConnection);
}

async function init() {
  $("#session-date").value = localDate();
  const theme = localStorage.getItem("mpt-theme") || "light";
  document.documentElement.dataset.theme = theme;
  $("#theme-toggle").textContent = theme === "dark" ? "☀" : "☾";
  bindEvents(); updateConnection(); updateDoubleFaultUi();
  try { await refreshData(); } catch (error) { console.error(error); alert("Local storage could not be opened. Check that Safari is not blocking website data, then reload."); }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => console.error("Service worker registration failed", error));
}

init();
