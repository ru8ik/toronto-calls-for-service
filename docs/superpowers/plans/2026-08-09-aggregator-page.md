# Aggregator Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page where the user selects multiple Divisions and multiple Call Types and sees a counts summary plus only the matching calls.

**Architecture:** All filtering/counting logic goes in dependency-free modules under `src/lib/` (pure functions, directly unit-testable). Data fetching moves out of `App.js` into `src/hooks/useCalls.js`, shared by both pages. The new page is `src/pages/AggregatePage.js`. Navigation is hand-rolled hash routing — the URL is the single source of truth for the selection.

**Tech Stack:** React 19, CRA 5 (react-scripts), Jest via `react-scripts test`, axios, date-fns. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-09-aggregator-page-design.md`

## Global Constraints

- **No new npm dependencies.** Not for routing, state, UI, or testing.
- **Deployment must stay exactly `npm run deploy` (`gh-pages -d build`).** No changes to `package.json` build config, `PUBLIC_URL`, `public/404.html`, or `public/index.html`.
- **Routing must be hash-based** (`#/aggregate?...`). GitHub Pages serves from the `/toronto-calls-for-service` subpath with no server rewrites; the fragment never reaches the server.
- **Filter comparison is exact equality, never substring.** `.includes()` is a correctness bug here: `ASSAULT` matches `ASSAULT IN PROGRESS`/`ASSAULT JUST OCCURRED`, `THEFT` matches `THEFT OF VEHICLE`/`THEFT JUST OCCURRED`, `BREAK & ENTER` matches `ATTEMPT BREAK & ENTER`.
- **Never use `OBJECTID` as a record identity.** The upstream layer is truncate-and-reloaded; 86 of 98 OBJECTIDs pointed at a different incident within 13 minutes. Use `callKey()`.
- **Do not modify** the existing page's neighbourhood filter, `NEIGHBOURHOOD_TO_DIVISION`, the map components, or its pagination.
- **Modules under `src/lib/` must import nothing** — no React, no axios, no date-fns. This is what keeps their tests runnable (see Task 1).
- Test files live beside their source: `src/lib/callFilters.test.js`.

---

### Task 1: Repair the test suite, add `callKey` and `filterCalls`

**Files:**
- Delete: `src/App.test.js`
- Create: `src/lib/callFilters.js`
- Test: `src/lib/callFilters.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `callKey(call: object) => string`
  - `filterCalls(calls: object[], selection: {divisions: Set<string>, types: Set<string>}) => object[]`

**Why delete `src/App.test.js`:** it is the unmodified CRA template test asserting a "learn react" link that does not exist in this app, and it currently fails to even parse (`SyntaxError: Cannot use import statement outside a module` — axios v1 is ESM, CRA 5's Jest does not transform it). It has never tested anything. Leaving it makes `npm test` permanently red, so you could not distinguish your failures from it.

- [ ] **Step 1: Delete the broken template test**

```bash
rm src/App.test.js
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/callFilters.test.js`:

```js
import { callKey, filterCalls } from './callFilters';

const call = (over = {}) => ({
  OCCURRENCE_TIME: 1786293091000,
  LATITUDE: 43.65,
  LONGITUDE: -79.38,
  DIVISION: 'D51',
  CALL_TYPE: 'ROBBERY',
  CROSS_STREETS: 'A ST - B ST',
  ...over,
});

const sel = (divisions = [], types = []) => ({
  divisions: new Set(divisions),
  types: new Set(types),
});

describe('callKey', () => {
  test('combines time and coordinates', () => {
    expect(callKey(call())).toBe('1786293091000|43.65|-79.38');
  });

  test('distinguishes two calls at the same location at different times', () => {
    const a = callKey(call());
    const b = callKey(call({ OCCURRENCE_TIME: 1786293099000 }));
    expect(a).not.toBe(b);
  });
});

describe('filterCalls', () => {
  const calls = [
    call({ DIVISION: 'D51', CALL_TYPE: 'ROBBERY' }),
    call({ DIVISION: 'D52', CALL_TYPE: 'ASSAULT' }),
    call({ DIVISION: 'D14', CALL_TYPE: 'FRAUD' }),
    call({ DIVISION: 'HP', CALL_TYPE: 'FIRE' }),
  ];

  test('empty selection returns everything', () => {
    expect(filterCalls(calls, sel())).toHaveLength(4);
  });

  test('ORs within the division category', () => {
    const result = filterCalls(calls, sel(['D51', 'D52']));
    expect(result.map((c) => c.DIVISION)).toEqual(['D51', 'D52']);
  });

  test('ANDs across categories', () => {
    const result = filterCalls(calls, sel(['D51', 'D52'], ['ASSAULT']));
    expect(result).toHaveLength(1);
    expect(result[0].DIVISION).toBe('D52');
  });

  test('matches call types exactly, not by substring', () => {
    const typed = [
      call({ CALL_TYPE: 'ASSAULT' }),
      call({ CALL_TYPE: 'ASSAULT IN PROGRESS' }),
      call({ CALL_TYPE: 'ASSAULT JUST OCCURRED' }),
    ];
    const result = filterCalls(typed, sel([], ['ASSAULT']));
    expect(result).toHaveLength(1);
    expect(result[0].CALL_TYPE).toBe('ASSAULT');
  });

  test('matches divisions exactly, not by substring', () => {
    const typed = [call({ DIVISION: 'D5' }), call({ DIVISION: 'D51' })];
    const result = filterCalls(typed, sel(['D5']));
    expect(result).toHaveLength(1);
    expect(result[0].DIVISION).toBe('D5');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`

If `cross-env` is unavailable, use PowerShell: `$env:CI="true"; npx react-scripts test --watchAll=false --testPathPattern="callFilters"`

Expected: FAIL — `Cannot find module './callFilters'`

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/callFilters.js`:

```js
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: PASS — 7 tests passed

- [ ] **Step 6: Confirm the whole suite is now green**

Run: `npx cross-env CI=true react-scripts test --watchAll=false`
Expected: PASS — 1 suite, 7 tests. No failing suites.

- [ ] **Step 7: Commit**

```bash
git add src/lib/callFilters.js src/lib/callFilters.test.js
git add -u src/App.test.js
git commit -m "feat: add callKey and exact-match filterCalls; remove broken CRA template test"
```

---

### Task 2: Division sorting and grouping

**Files:**
- Modify: `src/lib/callFilters.js`
- Test: `src/lib/callFilters.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (same file, independent functions).
- Produces:
  - `sortDivisions(values: string[]) => string[]`
  - `groupDivisions(values: string[]) => { divisions: string[], other: string[] }`

The `DIVISION` field carries geographic divisions (`D11`…`D55`) and operational units (`HP`, `SE1`, `TAC8`, `DARU`) in the same field. `HP` alone carried 10 of 98 observed calls, so these are grouped separately, never hidden — hiding them would make this page's totals disagree with the main page.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/callFilters.test.js`:

```js
import { sortDivisions, groupDivisions } from './callFilters';

describe('sortDivisions', () => {
  test('sorts numerically, not lexically', () => {
    expect(sortDivisions(['D51', 'D14', 'D9', 'D32'])).toEqual([
      'D9',
      'D14',
      'D32',
      'D51',
    ]);
  });

  test('places non-division units after all divisions, alphabetically', () => {
    expect(sortDivisions(['TAC8', 'D51', 'HP', 'D14', 'DARU'])).toEqual([
      'D14',
      'D51',
      'DARU',
      'HP',
      'TAC8',
    ]);
  });
});

describe('groupDivisions', () => {
  test('splits geographic divisions from operational units', () => {
    expect(groupDivisions(['HP', 'D51', 'TAC8', 'D14'])).toEqual({
      divisions: ['D14', 'D51'],
      other: ['HP', 'TAC8'],
    });
  });

  test('returns empty groups for empty input', () => {
    expect(groupDivisions([])).toEqual({ divisions: [], other: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: FAIL — `sortDivisions is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/callFilters.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: PASS — 11 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/callFilters.js src/lib/callFilters.test.js
git commit -m "feat: add division sorting and grouping helpers"
```

---

### Task 3: `summarize` — the counts matrix

**Files:**
- Modify: `src/lib/callFilters.js`
- Test: `src/lib/callFilters.test.js`

**Interfaces:**
- Consumes: `sortDivisions` (Task 2).
- Produces: `summarize(matching: object[], selection) => { rows: string[], columns: string[], counts: {[division]: {[type]: number}}, rowTotals: {[division]: number}, colTotals: {[type]: number}, grandTotal: number }`

`counts` is dense and zero-filled for every row × column, so the renderer never checks for missing keys.

Axis resolution (from the spec):

| Divisions selected? | Types selected? | Rows | Columns |
|---|---|---|---|
| no | no | all divisions present in `matching` | all types present in `matching` |
| yes | no | the selected divisions | all types present in `matching` |
| no | yes | all divisions present in `matching` | the selected types |
| yes | yes | the selected divisions | the selected types |

- [ ] **Step 1: Write the failing test**

Append to `src/lib/callFilters.test.js`:

```js
import { summarize } from './callFilters';

describe('summarize', () => {
  const calls = [
    call({ DIVISION: 'D51', CALL_TYPE: 'ROBBERY' }),
    call({ DIVISION: 'D51', CALL_TYPE: 'ROBBERY' }),
    call({ DIVISION: 'D51', CALL_TYPE: 'ASSAULT' }),
    call({ DIVISION: 'D52', CALL_TYPE: 'ASSAULT' }),
  ];

  test('builds a dense zero-filled matrix with totals', () => {
    const s = summarize(calls, sel());
    expect(s.rows).toEqual(['D51', 'D52']);
    expect(s.columns).toEqual(['ASSAULT', 'ROBBERY']);
    expect(s.counts.D51.ROBBERY).toBe(2);
    expect(s.counts.D51.ASSAULT).toBe(1);
    expect(s.counts.D52.ROBBERY).toBe(0);
    expect(s.rowTotals.D51).toBe(3);
    expect(s.colTotals.ASSAULT).toBe(2);
    expect(s.grandTotal).toBe(4);
  });

  test('INVARIANT: every cell summed equals the number of matching calls', () => {
    const selection = sel(['D51', 'D52'], ['ROBBERY', 'ASSAULT']);
    const matching = filterCalls(calls, selection);
    const s = summarize(matching, selection);
    const summed = s.rows.reduce(
      (total, row) =>
        total + s.columns.reduce((rowSum, col) => rowSum + s.counts[row][col], 0),
      0
    );
    expect(summed).toBe(matching.length);
    expect(s.grandTotal).toBe(matching.length);
  });

  test('a selected value with no matching calls still gets a zero-filled axis entry', () => {
    const selection = sel(['D51', 'D99'], ['ROBBERY']);
    const s = summarize(filterCalls(calls, selection), selection);
    expect(s.rows).toEqual(['D51', 'D99']);
    expect(s.counts.D99.ROBBERY).toBe(0);
    expect(s.rowTotals.D99).toBe(0);
    expect(s.grandTotal).toBe(2);
  });

  test('empty matching set produces empty axes and zero total', () => {
    const s = summarize([], sel());
    expect(s.rows).toEqual([]);
    expect(s.columns).toEqual([]);
    expect(s.grandTotal).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: FAIL — `summarize is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/callFilters.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: PASS — 15 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/callFilters.js src/lib/callFilters.test.js
git commit -m "feat: add summarize counts matrix with row/column totals"
```

---

### Task 4: `facetCounts` — cross-filtered option counts

**Files:**
- Modify: `src/lib/callFilters.js`
- Test: `src/lib/callFilters.test.js`

**Interfaces:**
- Consumes: `filterCalls` (Task 1).
- Produces: `facetCounts(calls, selection) => { byDivision: {[division]: number}, byType: {[type]: number} }`

Counts are cross-filtered: a division's count reflects the *type* selection but ignores the division selection, so the number answers "how many would I add by ticking this?" rather than going to zero for everything you have not ticked.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/callFilters.test.js`:

```js
import { facetCounts } from './callFilters';

describe('facetCounts', () => {
  const calls = [
    call({ DIVISION: 'D51', CALL_TYPE: 'ROBBERY' }),
    call({ DIVISION: 'D51', CALL_TYPE: 'ASSAULT' }),
    call({ DIVISION: 'D52', CALL_TYPE: 'ROBBERY' }),
  ];

  test('with nothing selected, counts every call', () => {
    const f = facetCounts(calls, sel());
    expect(f.byDivision).toEqual({ D51: 2, D52: 1 });
    expect(f.byType).toEqual({ ROBBERY: 2, ASSAULT: 1 });
  });

  test('division counts respect the type selection', () => {
    const f = facetCounts(calls, sel([], ['ROBBERY']));
    expect(f.byDivision).toEqual({ D51: 1, D52: 1 });
  });

  test('type counts ignore the type selection but respect the division selection', () => {
    const f = facetCounts(calls, sel(['D51'], ['ROBBERY']));
    expect(f.byType).toEqual({ ROBBERY: 1, ASSAULT: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: FAIL — `facetCounts is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/callFilters.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="callFilters"`
Expected: PASS — 18 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/callFilters.js src/lib/callFilters.test.js
git commit -m "feat: add cross-filtered facet counts for selector labels"
```

---

### Task 5: URL hash state

**Files:**
- Create: `src/lib/urlState.js`
- Test: `src/lib/urlState.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseHash(hash: string) => { page: 'main'|'aggregate', selection: {divisions: Set<string>, types: Set<string>} }`
  - `buildHash(page: string, selection) => string`
  - `emptySelection() => {divisions: Set, types: Set}`

**Do not use `URLSearchParams` here.** It decodes percent-escapes before you split on `,`, so a value containing a literal comma would be split in half. Each value is encoded individually and joined with a raw `,`; parsing splits on the raw `,` first, then decodes. Call types contain spaces and ampersands (`BREAK & ENTER`), so encoding is mandatory.

- [ ] **Step 1: Write the failing test**

Create `src/lib/urlState.test.js`:

```js
import { parseHash, buildHash, emptySelection } from './urlState';

const sel = (divisions = [], types = []) => ({
  divisions: new Set(divisions),
  types: new Set(types),
});

const sorted = (set) => [...set].sort();

describe('parseHash', () => {
  test('empty hash is the main page', () => {
    expect(parseHash('').page).toBe('main');
    expect(parseHash('#/').page).toBe('main');
  });

  test('reads the aggregate page with no selection', () => {
    const r = parseHash('#/aggregate');
    expect(r.page).toBe('aggregate');
    expect(r.selection.divisions.size).toBe(0);
    expect(r.selection.types.size).toBe(0);
  });

  test('reads divisions and types', () => {
    const r = parseHash('#/aggregate?div=D51,D52&type=ROBBERY');
    expect(sorted(r.selection.divisions)).toEqual(['D51', 'D52']);
    expect(sorted(r.selection.types)).toEqual(['ROBBERY']);
  });

  test('decodes values containing spaces and ampersands', () => {
    const r = parseHash('#/aggregate?type=BREAK%20%26%20ENTER');
    expect(sorted(r.selection.types)).toEqual(['BREAK & ENTER']);
  });

  test('malformed input returns an empty main-page route instead of throwing', () => {
    expect(() => parseHash('#/aggregate?div=%E0%A4%A')).not.toThrow();
    expect(parseHash('#####').page).toBe('main');
    expect(parseHash(undefined).page).toBe('main');
  });

  test('drops empty values', () => {
    const r = parseHash('#/aggregate?div=,,D51,');
    expect(sorted(r.selection.divisions)).toEqual(['D51']);
  });
});

describe('buildHash', () => {
  test('main page is #/', () => {
    expect(buildHash('main', sel(['D51']))).toBe('#/');
  });

  test('omits empty categories', () => {
    expect(buildHash('aggregate', sel())).toBe('#/aggregate');
    expect(buildHash('aggregate', sel(['D51']))).toBe('#/aggregate?div=D51');
  });

  test('encodes special characters', () => {
    expect(buildHash('aggregate', sel([], ['BREAK & ENTER']))).toBe(
      '#/aggregate?type=BREAK%20%26%20ENTER'
    );
  });
});

describe('round trip', () => {
  test('buildHash -> parseHash preserves the selection', () => {
    const original = sel(['D51', 'HP'], ['BREAK & ENTER', 'THEFT OF VEHICLE']);
    const result = parseHash(buildHash('aggregate', original));
    expect(sorted(result.selection.divisions)).toEqual(sorted(original.divisions));
    expect(sorted(result.selection.types)).toEqual(sorted(original.types));
  });
});

describe('emptySelection', () => {
  test('returns independent empty sets each call', () => {
    const a = emptySelection();
    a.divisions.add('D51');
    expect(emptySelection().divisions.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="urlState"`
Expected: FAIL — `Cannot find module './urlState'`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/urlState.js`:

```js
// Hash-based route + selection state.
// Hash routing is required: GitHub Pages serves this app from a subpath with
// no server-side rewrites, so the fragment is the only safe place for state.
// Imports nothing, so its tests run without the CRA/axios ESM issue.

export function emptySelection() {
  return { divisions: new Set(), types: new Set() };
}

function mainRoute() {
  return { page: 'main', selection: emptySelection() };
}

/**
 * Read one raw (still percent-encoded) query value.
 * URLSearchParams is deliberately avoided: it decodes before we split on ",",
 * which would split any value containing an encoded comma in half.
 */
function rawParam(query, name) {
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return '';
}

function decodeList(raw) {
  if (!raw) return new Set();
  const values = raw
    .split(',')
    .map((value) => {
      try {
        return decodeURIComponent(value).trim();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return new Set(values);
}

export function parseHash(hash) {
  try {
    const raw = String(hash || '').replace(/^#/, '');
    const [path, query = ''] = raw.split('?');
    if (path !== '/aggregate') return mainRoute();
    return {
      page: 'aggregate',
      selection: {
        divisions: decodeList(rawParam(query, 'div')),
        types: decodeList(rawParam(query, 'type')),
      },
    };
  } catch {
    return mainRoute();
  }
}

function encodeList(values) {
  return [...values].map(encodeURIComponent).join(',');
}

export function buildHash(page, selection) {
  if (page !== 'aggregate') return '#/';
  const parts = [];
  if (selection.divisions.size > 0) parts.push(`div=${encodeList(selection.divisions)}`);
  if (selection.types.size > 0) parts.push(`type=${encodeList(selection.types)}`);
  return parts.length > 0 ? `#/aggregate?${parts.join('&')}` : '#/aggregate';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx cross-env CI=true react-scripts test --watchAll=false --testPathPattern="urlState"`
Expected: PASS — 11 tests passed

- [ ] **Step 5: Run the full suite**

Run: `npx cross-env CI=true react-scripts test --watchAll=false`
Expected: PASS — 2 suites, 29 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/urlState.js src/lib/urlState.test.js
git commit -m "feat: add hash-based route and selection encoding"
```

---

### Task 6: Shared `useCalls` hook

**Files:**
- Create: `src/hooks/useCalls.js`

**Interfaces:**
- Consumes: `callKey` (Task 1).
- Produces: `useCalls(intervalMs?: number) => { calls, loading, error, lastUpdated, refresh }`

Each normalized call carries: every original attribute, plus `key` (stable id), `occurredAt` (number, ms), `formattedTime` (`'7:00 PM'` — preserves the existing page's display exactly), and `formattedDateTime` (`'Aug 9, 7:00 PM'` — used by the aggregator).

Two bugs are fixed here versus the inline version in `App.js`:
1. `setLoading(true)` currently fires on *every* poll, blanking the whole UI every 5 minutes. Here `loading` is true only until the first attempt settles.
2. `setError(null)` is currently never called anywhere, so one failed poll shows the error screen forever. Here it clears on every success.

No test for this task — it is React + axios, which is exactly what CRA 5's Jest cannot transform. It is verified manually in Task 9.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useCalls.js`:

```js
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { callKey } from '../lib/callFilters';

const API_URL =
  'https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/C4S_Public_NoGO/FeatureServer/0/query?where=1=1&outFields=*&f=json';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

function normalize(feature) {
  const attributes = feature.attributes || {};

  const rawTime =
    typeof attributes.OCCURRENCE_TIME === 'number'
      ? attributes.OCCURRENCE_TIME
      : typeof attributes.OCCURRENCE_TIME_AGOL === 'number'
      ? attributes.OCCURRENCE_TIME_AGOL
      : null;

  const date = rawTime === null ? null : new Date(rawTime);
  const valid = date !== null && !Number.isNaN(date.getTime());

  return {
    ...attributes,
    DIVISION: attributes.DIVISION || '',
    CALL_TYPE: attributes.CALL_TYPE || '',
    CROSS_STREETS: attributes.CROSS_STREETS || '',
    occurredAt: valid ? rawTime : 0,
    formattedTime: valid ? format(date, 'h:mm a') : 'Unknown',
    formattedDateTime: valid ? format(date, 'MMM d, h:mm a') : 'Unknown',
    key: callKey(attributes),
  };
}

export function useCalls(intervalMs = DEFAULT_INTERVAL_MS) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await axios.get(API_URL);
      if (!mounted.current) return;
      const features = (response.data && response.data.features) || [];
      setCalls(features.map(normalize));
      setLastUpdated(new Date());
      setError(null); // must clear, or one failure sticks forever
    } catch (err) {
      if (!mounted.current) return;
      setError('Failed to fetch data. Please try again later.');
    } finally {
      if (mounted.current) setLoading(false); // only gates the FIRST load
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const intervalId = setInterval(refresh, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(intervalId);
    };
  }, [refresh, intervalMs]);

  return { calls, loading, error, lastUpdated, refresh };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx cross-env CI=true react-scripts build`
Expected: `Compiled successfully.` (warnings about unused variables in `App.js` are fine at this point)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCalls.js
git commit -m "feat: extract shared useCalls hook; fix refresh-blanks-UI and sticky-error bugs"
```

---

### Task 7: `AggregatePage` component

**Files:**
- Create: `src/pages/AggregatePage.js`

**Interfaces:**
- Consumes: `filterCalls`, `summarize`, `facetCounts`, `groupDivisions` (Tasks 1–4). Calls carry `key`, `occurredAt`, `formattedDateTime` from Task 6.
- Produces: default export `AggregatePage({ calls, selection, onSelectionChange })`.

Option lists are the union of values present in `calls` and values present in `selection`, so opening a shared link never silently drops a selection whose calls have aged out. Zero-count options render greyed rather than disappearing, so the list does not reshuffle on every refresh.

- [ ] **Step 1: Write the component**

Create `src/pages/AggregatePage.js`:

```js
import React from 'react';
import {
  filterCalls,
  summarize,
  facetCounts,
  groupDivisions,
} from '../lib/callFilters';

function toggleValue(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function CheckboxGroup({ label, values, counts, selected, onToggle }) {
  if (values.length === 0) return null;
  return (
    <div className="agg-group">
      {label && <div className="agg-group-label">{label}</div>}
      {values.map((value) => {
        const count = counts[value] || 0;
        return (
          <label
            key={value}
            className={`agg-option${count === 0 ? ' agg-option-zero' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.has(value)}
              onChange={() => onToggle(value)}
            />
            <span className="agg-option-name">{value}</span>
            <span className="agg-option-count">({count})</span>
          </label>
        );
      })}
    </div>
  );
}

function AggregatePage({ calls, selection, onSelectionChange }) {
  const matching = React.useMemo(
    () => filterCalls(calls, selection),
    [calls, selection]
  );

  const summary = React.useMemo(
    () => summarize(matching, selection),
    [matching, selection]
  );

  const facets = React.useMemo(
    () => facetCounts(calls, selection),
    [calls, selection]
  );

  // Union of what is present now and what the URL selected, so a shared link
  // never silently loses a selection whose calls have aged out.
  const divisionOptions = React.useMemo(() => {
    const values = new Set(calls.map((c) => c.DIVISION).filter(Boolean));
    selection.divisions.forEach((v) => values.add(v));
    return groupDivisions([...values]);
  }, [calls, selection.divisions]);

  const typeOptions = React.useMemo(() => {
    const values = new Set(calls.map((c) => c.CALL_TYPE).filter(Boolean));
    selection.types.forEach((v) => values.add(v));
    return [...values].sort();
  }, [calls, selection.types]);

  const sortedCalls = React.useMemo(
    () => [...matching].sort((a, b) => b.occurredAt - a.occurredAt),
    [matching]
  );

  const setDivisions = (divisions) =>
    onSelectionChange({ divisions, types: selection.types });
  const setTypes = (types) =>
    onSelectionChange({ divisions: selection.divisions, types });

  const allDivisions = [...divisionOptions.divisions, ...divisionOptions.other];
  const hasSelection = selection.divisions.size > 0 || selection.types.size > 0;

  return (
    <div className="aggregate-page">
      <div className="agg-selectors">
        <div className="agg-selector">
          <div className="agg-selector-header">
            <h3>Divisions</h3>
            <div className="agg-selector-actions">
              <button onClick={() => setDivisions(new Set(allDivisions))}>
                All
              </button>
              <button onClick={() => setDivisions(new Set())}>Clear</button>
            </div>
          </div>
          <div className="agg-option-list">
            <CheckboxGroup
              label={null}
              values={divisionOptions.divisions}
              counts={facets.byDivision}
              selected={selection.divisions}
              onToggle={(v) => setDivisions(toggleValue(selection.divisions, v))}
            />
            <CheckboxGroup
              label="Other units"
              values={divisionOptions.other}
              counts={facets.byDivision}
              selected={selection.divisions}
              onToggle={(v) => setDivisions(toggleValue(selection.divisions, v))}
            />
          </div>
        </div>

        <div className="agg-selector">
          <div className="agg-selector-header">
            <h3>Call Types</h3>
            <div className="agg-selector-actions">
              <button onClick={() => setTypes(new Set(typeOptions))}>All</button>
              <button onClick={() => setTypes(new Set())}>Clear</button>
            </div>
          </div>
          <div className="agg-option-list">
            <CheckboxGroup
              label={null}
              values={typeOptions}
              counts={facets.byType}
              selected={selection.types}
              onToggle={(v) => setTypes(toggleValue(selection.types, v))}
            />
          </div>
        </div>
      </div>

      <div className="agg-summary">
        <h3>
          Summary <span className="section-accent">{summary.grandTotal} calls</span>
        </h3>
        {summary.rows.length === 0 || summary.columns.length === 0 ? (
          <p className="no-data">Nothing to summarise for this selection.</p>
        ) : (
          <div className="agg-summary-scroll">
            <table className="agg-summary-table">
              <thead>
                <tr>
                  <th className="agg-sticky">Division</th>
                  {summary.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                  <th className="agg-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row}>
                    <th className="agg-sticky">{row}</th>
                    {summary.columns.map((col) => (
                      <td key={col}>{summary.counts[row][col]}</td>
                    ))}
                    <td className="agg-total">{summary.rowTotals[row]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="agg-sticky">Total</th>
                  {summary.columns.map((col) => (
                    <td key={col}>{summary.colTotals[col]}</td>
                  ))}
                  <td className="agg-total">{summary.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="agg-list table-container">
        <div className="table-header">
          <h3>
            Matching Calls{' '}
            <span className="section-accent">{sortedCalls.length} results</span>
          </h3>
        </div>
        <table className="calls-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Division</th>
              <th>Type</th>
              <th>Cross Street</th>
            </tr>
          </thead>
          <tbody>
            {sortedCalls.length > 0 ? (
              sortedCalls.map((c) => (
                <tr key={c.key}>
                  <td>{c.formattedDateTime}</td>
                  <td>{c.DIVISION}</td>
                  <td>{c.CALL_TYPE}</td>
                  <td>{c.CROSS_STREETS}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="no-data">
                  No calls match your selection.
                  {hasSelection && (
                    <button
                      className="reset-button"
                      onClick={() =>
                        onSelectionChange({
                          divisions: new Set(),
                          types: new Set(),
                        })
                      }
                    >
                      Clear selection
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AggregatePage;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx cross-env CI=true react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 3: Commit**

```bash
git add src/pages/AggregatePage.js
git commit -m "feat: add AggregatePage with multi-select, counts matrix, and results list"
```

---

### Task 8: Wire routing into `App.js`

**Files:**
- Modify: `src/App.js`

**Interfaces:**
- Consumes: `useCalls` (Task 6), `parseHash`/`buildHash` (Task 5), `AggregatePage` (Task 7).
- Produces: nothing consumed by later tasks.

`viewMode` and `page` are **separate axes** sharing one control strip. `Table First`/`Map First` switch `viewMode` within the main page; `Aggregate` switches `page`. Do not add a third `viewMode` value — that would lose the user's view preference on every visit to the aggregator.

- [ ] **Step 1: Replace the imports at the top of `src/App.js`**

Replace lines 1–7:

```js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
```

with:

```js
import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useCalls } from './hooks/useCalls';
import { parseHash, buildHash } from './lib/urlState';
import AggregatePage from './pages/AggregatePage';
import './App.css';
```

- [ ] **Step 2: Replace the state block and fetch logic**

In `function App()`, delete the `calls`/`loading`/`error`/`lastUpdated` `useState` declarations, the `API_URL` constant, the entire `fetchCalls` function, and the initial-fetch `useEffect` (originally lines 216–329). Replace that whole span with:

```js
  const { calls, loading, error, lastUpdated, refresh } = useCalls();

  const [sortConfig, setSortConfig] = useState({ key: 'OCCURRENCE_TIME', direction: 'desc' });
  const [filters, setFilters] = useState({
    division: '',
    neighbourhood: '',
    type: ''
  });
  const [selectedCall, setSelectedCall] = useState(null);
  const [mapCenter, setMapCenter] = useState([43.6532, -79.3832]); // Toronto center
  const [showNotification, setShowNotification] = useState(false);
  const [newCallsCount, setNewCallsCount] = useState(0);
  const prevKeysRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  const [viewMode, setViewMode] = useState('standard'); // 'standard' or 'map-first'
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  // Hash routing. The URL is the single source of truth for page + selection.
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const goToAggregate = (selection) => {
    window.location.hash = buildHash('aggregate', selection);
  };

  const goToMain = (mode) => {
    setViewMode(mode);
    if (route.page === 'aggregate') window.location.hash = '#/';
  };

  // New-call detection, keyed on the stable synthetic key.
  // OBJECTID cannot be used: upstream recycles it across incidents.
  useEffect(() => {
    if (calls.length === 0) return;
    const keys = new Set(calls.map((c) => c.key));
    if (prevKeysRef.current) {
      const added = [...keys].filter((k) => !prevKeysRef.current.has(k)).length;
      if (added > 0) {
        setNewCallsCount(added);
        setShowNotification(true);
      }
    }
    prevKeysRef.current = keys;
  }, [calls]);

  // Auto-hide the notification; cleanup prevents overlapping timers.
  useEffect(() => {
    if (!showNotification) return undefined;
    const timerId = setTimeout(() => setShowNotification(false), 5000);
    return () => clearTimeout(timerId);
  }, [showNotification, newCallsCount]);
```

- [ ] **Step 3: Point the Refresh button at the hook**

Find:

```jsx
          <button className="refresh-button" onClick={fetchCalls}>Refresh Now</button>
```

Replace with:

```jsx
          <button className="refresh-button" onClick={refresh}>Refresh Now</button>
```

- [ ] **Step 4: Add the Aggregate button to the header toggle**

Replace the `view-toggle` block:

```jsx
        <div className="view-toggle">
          <button 
            className={viewMode === 'standard' ? 'active' : ''} 
            onClick={() => setViewMode('standard')}
          >
            Table First
          </button>
          <button 
            className={viewMode === 'map-first' ? 'active' : ''} 
            onClick={() => setViewMode('map-first')}
          >
            Map First
          </button>
        </div>
```

with:

```jsx
        <div className="view-toggle">
          <button
            className={route.page === 'main' && viewMode === 'standard' ? 'active' : ''}
            onClick={() => goToMain('standard')}
          >
            Table First
          </button>
          <button
            className={route.page === 'main' && viewMode === 'map-first' ? 'active' : ''}
            onClick={() => goToMain('map-first')}
          >
            Map First
          </button>
          <button
            className={route.page === 'aggregate' ? 'active' : ''}
            onClick={() => goToAggregate(route.selection)}
          >
            Aggregate
          </button>
        </div>
```

- [ ] **Step 5: Hide the old filter bar on the aggregator page**

Wrap the existing `<div className="filter-container">…</div>` block so it only renders on the main page. Change its opening from:

```jsx
      <div className="filter-container">
```

to:

```jsx
      {route.page === 'main' && (
      <div className="filter-container">
```

and its matching closing `</div>` (the one immediately after the `filter-info` block) to:

```jsx
      </div>
      )}
```

- [ ] **Step 6: Replace the loading/error render branch and add the aggregate route**

Find:

```jsx
      {loading ? (
        <div className="loading">Loading calls for service...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          {viewMode === 'standard' ? (
```

Replace with:

```jsx
      {loading ? (
        <div className="loading">Loading calls for service...</div>
      ) : error && calls.length === 0 ? (
        <div className="error">{error}</div>
      ) : (
        <>
          {error && (
            <div className="stale-banner">
              Couldn't refresh — showing data from{' '}
              {lastUpdated ? format(lastUpdated, 'h:mm a') : 'earlier'}
            </div>
          )}
          {route.page === 'aggregate' ? (
            <AggregatePage
              calls={calls}
              selection={route.selection}
              onSelectionChange={goToAggregate}
            />
          ) : viewMode === 'standard' ? (
```

The existing `) : (` before the map-first block and the closing `)}` before `<footer>` stay as they are — this turns the two-way conditional into a three-way one.

- [ ] **Step 7: Verify it compiles with no warnings about removed symbols**

Run: `npx cross-env CI=true react-scripts build`
Expected: `Compiled successfully.` with no `'axios' is defined but never used` or `'fetchCalls' is not defined` errors.

- [ ] **Step 8: Run the full test suite**

Run: `npx cross-env CI=true react-scripts test --watchAll=false`
Expected: PASS — 2 suites, 29 tests

- [ ] **Step 9: Commit**

```bash
git add src/App.js
git commit -m "feat: add hash routing and Aggregate page; fix new-call detection to use stable keys"
```

---

### Task 9: Styles and manual verification

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Consumes: class names emitted by Task 7 and Task 8.
- Produces: nothing.

- [ ] **Step 1: Append the styles**

Append to `src/App.css`:

```css
/* ---------- Aggregate page ---------- */

.stale-banner {
  margin: 0 auto 15px;
  max-width: 1200px;
  padding: 8px 15px;
  border-radius: 4px;
  background: #fff3cd;
  color: #856404;
  font-size: 0.9rem;
  text-align: center;
}

.aggregate-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 15px;
}

.agg-selectors {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 25px;
}

.agg-selector {
  flex: 1 1 300px;
  min-width: 0;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
}

.agg-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
}

.agg-selector-header h3 {
  margin: 0;
  font-size: 1rem;
}

.agg-selector-actions button {
  margin-left: 6px;
  padding: 3px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #f7f7f7;
}

.agg-option-list {
  max-height: 260px;
  overflow-y: auto;
  padding: 8px 12px;
}

.agg-group-label {
  margin: 10px 0 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
}

.agg-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  cursor: pointer;
  font-size: 0.9rem;
}

.agg-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agg-option-count {
  color: #888;
  font-variant-numeric: tabular-nums;
}

.agg-option-zero .agg-option-name,
.agg-option-zero .agg-option-count {
  color: #bbb;
}

.agg-summary {
  margin-bottom: 25px;
}

.agg-summary-scroll {
  overflow-x: auto;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
}

.agg-summary-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.88rem;
}

.agg-summary-table th,
.agg-summary-table td {
  padding: 7px 12px;
  border-bottom: 1px solid #eee;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.agg-summary-table thead th {
  background: #f7f7f7;
  text-align: right;
}

.agg-summary-table .agg-sticky {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #fff;
  text-align: left;
}

.agg-summary-table thead .agg-sticky {
  background: #f7f7f7;
}

.agg-summary-table tfoot th,
.agg-summary-table tfoot td,
.agg-summary-table .agg-total {
  font-weight: 700;
  background: #fafafa;
}

@media (max-width: 700px) {
  .agg-selectors {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: Start the dev server**

Run: `npm start`
Expected: opens `http://localhost:3000`

- [ ] **Step 3: Manual verification checklist**

Confirm each, in order:

1. Main page loads and looks unchanged; the Time column still shows `7:00 PM` (no date).
2. Click **Aggregate** — URL becomes `#/aggregate`; old filter bar is hidden; both checkbox lists appear with counts.
3. Divisions list shows `D11`…`D55` in numeric order, then an **Other units** group containing `HP` and friends.
4. Tick two divisions — URL updates to `#/aggregate?div=…`; summary and list narrow to those divisions only.
5. Tick a call type — URL gains `&type=…`; results are the AND of both categories.
6. Tick `ASSAULT` **only**. Confirm the list contains **no** rows reading `ASSAULT IN PROGRESS` or `ASSAULT JUST OCCURRED`. *(This is the substring bug the whole page depends on not having.)*
7. **Add up the summary table's cells by hand and confirm the grand total matches the "N results" count on the list.**
8. Tick `BREAK & ENTER` — URL shows `BREAK%20%26%20ENTER`; results are correct.
9. Copy the URL, open it in a new tab — the same selection is restored.
10. Reload with a nonsense hash (`#/aggregate?div=%%%`) — page loads without crashing, empty selection.
11. Click **Table First** — returns to the main page, `#/`, with the table view.
12. Leave the tab open past one 5-minute refresh — confirm the UI does **not** blank out and the map does not remount.

- [ ] **Step 4: Production build check**

Run: `npx cross-env CI=true react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 5: Commit**

```bash
git add src/App.css
git commit -m "style: add aggregate page styles and stale-data banner"
```

---

### Task 10: Deploy

**Files:** none modified.

- [ ] **Step 1: Confirm the deploy path is unchanged**

Run: `git diff HEAD~9 --stat -- package.json public/`
Expected: **no output.** If anything appears, a global constraint was violated — `package.json` and `public/` must be untouched.

- [ ] **Step 2: Deploy**

Run: `npm run deploy`
Expected: builds, then `Published`.

Note: the currently live build is from 2025-04-21 and predates the map-first view, so this deploy also ships those earlier changes.

- [ ] **Step 3: Verify live**

Open `https://www.ru8iks.com/toronto-calls-for-service/#/aggregate`
Expected: the aggregator loads directly from the deep link — this is the check that hash routing works on GitHub Pages without touching `404.html`.

---

## Notes for the implementer

- **`cross-env` is not a dependency.** The `npx cross-env` commands above will fetch it on demand. If you would rather not, use PowerShell's `$env:CI="true"; npx react-scripts test --watchAll=false` instead. Without `CI=true`, `react-scripts test` starts in watch mode and will not exit.
- **Do not add tests that import `App.js`, `useCalls.js`, or `AggregatePage.js`.** CRA 5's Jest cannot transform axios v1's ESM, so any test that transitively imports axios fails with `SyntaxError: Cannot use import statement outside a module`. This is why all logic lives in `src/lib/`.
- **Do not "fix" the existing page's filters.** `NEIGHBOURHOOD_TO_DIVISION` and the division/neighbourhood mutual exclusivity are known-flawed but explicitly out of scope.
- **Tasks 2–4 append a second `import … from './callFilters'` line to the test file.** That is valid and runs fine; consolidating them into the Task 1 import statement at the end is optional tidying, not a fix.
- **Expected test counts are cumulative:** 7 after Task 1, 11 after Task 2, 15 after Task 3, 18 after Task 4, and 29 across both suites after Task 5.
