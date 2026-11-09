export const SCORES = ["30–0", "40–0", "40–15", "40–30"];
export const TACTICS = ["Clear plan", "Too conservative", "Rushed", "Hesitant"];
export const EXECUTIONS = ["Committed", "Hesitant or slowed down", "Not observable"];
export const MOVEMENTS = ["Normal", "Tense or less active", "Not observable"];
export const DF_CAUSES = ["Clear plan, poor execution", "Too conservative", "Rushed", "Hesitant", "Not observable / Unsure"];

export function percentage(part, whole) {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function formatPercent(value, digits = 0) {
  return value === null || Number.isNaN(value) ? "N/A" : `${value.toFixed(digits)}%`;
}

export function distribution(points, field, options) {
  return Object.fromEntries(options.map((option) => [option, points.filter((point) => point[field] === option).length]));
}

export function calculateStats(inputPoints, role = "All") {
  const points = role === "All" ? inputPoints : inputPoints.filter((point) => point.position === role);
  const won = points.filter((point) => point.outcome === "Won").length;
  const lost = points.length - won;
  const committed = points.filter((point) => point.execution === "Committed").length;
  const observableExecutions = points.filter((point) => point.execution !== "Not observable").length;
  const serving = points.filter((point) => point.position === "Serving");
  const doubleFaults = points.filter((point) => point.outcome === "Double Fault").length;

  const summarize = (subset) => {
    const subsetWon = subset.filter((point) => point.outcome === "Won").length;
    const subsetServing = subset.filter((point) => point.position === "Serving");
    const subsetDf = subset.filter((point) => point.outcome === "Double Fault");
    return {
      total: subset.length,
      won: subsetWon,
      lost: subset.length - subsetWon,
      winRate: percentage(subsetWon, subset.length),
      tactical: distribution(subset, "tacticalDecision", TACTICS),
      execution: distribution(subset, "execution", EXECUTIONS),
      movement: distribution(subset, "movement", MOVEMENTS),
      doubleFaults: subsetDf.length,
      doubleFaultRate: percentage(subsetDf.length, subsetServing.length),
      doubleFaultCauses: distribution(subsetDf, "doubleFaultCause", DF_CAUSES)
    };
  };

  return {
    filter: role,
    total: points.length,
    won,
    lost,
    winRate: percentage(won, points.length),
    committed,
    observableExecutions,
    committedRate: percentage(committed, observableExecutions),
    servingPoints: serving.length,
    doubleFaults,
    doubleFaultRate: percentage(doubleFaults, serving.length),
    byScore: Object.fromEntries(SCORES.map((score) => [score, summarize(points.filter((point) => point.score === score))]))
  };
}

export function sessionSummary(session, points) {
  const stats = calculateStats(points);
  return { ...session, ...stats };
}
