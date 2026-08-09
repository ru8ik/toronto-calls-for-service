// Pure helpers for filtering and counting calls.
// Deliberately imports nothing so its tests run without the CRA/axios ESM issue.

/**
 * Stable identity for a call.
 * OBJECTID is NOT usable: the upstream layer is truncate-and-reloaded and
 * reassigns IDs to different incidents within minutes.
 */
export function callKey(call) {
  return `${call.OCCURRENCE_TIME}|${call.LATITUDE}|${call.LONGITUDE}`;
}

/**
 * OR within a category, AND across categories. An empty Set means "no constraint".
 * Comparison is exact equality — substring matching would conflate
 * ASSAULT with ASSAULT IN PROGRESS and break every count on the page.
 */
export function filterCalls(calls, selection) {
  const { divisions, types } = selection;
  return calls.filter(
    (call) =>
      (divisions.size === 0 || divisions.has(call.DIVISION)) &&
      (types.size === 0 || types.has(call.CALL_TYPE))
  );
}

const DIVISION_RE = /^D\d+$/;

function divisionRank(value) {
  const match = /^D(\d+)$/.exec(value);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

/** Geographic divisions first in numeric order, then other units alphabetically. */
export function sortDivisions(values) {
  return [...values].sort((a, b) => {
    const rankA = divisionRank(a);
    const rankB = divisionRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });
}

/** Split into geographic divisions (D11..D55) and operational units (HP, SE1, TAC8, DARU). */
export function groupDivisions(values) {
  const sorted = sortDivisions(values);
  return {
    divisions: sorted.filter((v) => DIVISION_RE.test(v)),
    other: sorted.filter((v) => !DIVISION_RE.test(v)),
  };
}
