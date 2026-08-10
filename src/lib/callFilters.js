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

/**
 * Counts matrix of divisions x call types.
 * `counts` is dense (every row has every column, zero-filled) so renderers
 * never need existence checks.
 */
export function summarize(matching, selection) {
  const rows =
    selection.divisions.size > 0
      ? sortDivisions([...selection.divisions])
      : sortDivisions([...new Set(matching.map((c) => c.DIVISION))]);

  const columns =
    selection.types.size > 0
      ? [...selection.types].sort()
      : [...new Set(matching.map((c) => c.CALL_TYPE))].sort();

  const counts = {};
  rows.forEach((row) => {
    counts[row] = {};
    columns.forEach((col) => {
      counts[row][col] = 0;
    });
  });

  matching.forEach((c) => {
    const row = counts[c.DIVISION];
    if (row && row[c.CALL_TYPE] !== undefined) {
      row[c.CALL_TYPE] += 1;
    }
  });

  const rowTotals = {};
  rows.forEach((row) => {
    rowTotals[row] = columns.reduce((sum, col) => sum + counts[row][col], 0);
  });

  const colTotals = {};
  columns.forEach((col) => {
    colTotals[col] = rows.reduce((sum, row) => sum + counts[row][col], 0);
  });

  const grandTotal = rows.reduce((sum, row) => sum + rowTotals[row], 0);

  return { rows, columns, counts, rowTotals, colTotals, grandTotal };
}

const NO_VALUES = new Set();

function tally(calls, field) {
  const result = {};
  calls.forEach((c) => {
    result[c[field]] = (result[c[field]] || 0) + 1;
  });
  return result;
}

/**
 * Counts shown beside each checkbox. Cross-filtered: each category's counts
 * apply the *other* category's selection only, so a number answers
 * "how many would ticking this add?".
 */
export function facetCounts(calls, selection) {
  return {
    byDivision: tally(
      filterCalls(calls, { divisions: NO_VALUES, types: selection.types }),
      'DIVISION'
    ),
    byType: tally(
      filterCalls(calls, { divisions: selection.divisions, types: NO_VALUES }),
      'CALL_TYPE'
    ),
  };
}
