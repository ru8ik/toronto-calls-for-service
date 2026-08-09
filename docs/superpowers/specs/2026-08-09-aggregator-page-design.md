# Aggregator Page — Design

**Date:** 2026-08-09
**Status:** Approved for planning

## Goal

Add a page where the user selects **multiple Divisions** and **multiple Call Types**, then sees
only the matching calls, with a counts summary above the list.

## Constraints

1. **Light and simple.** No new npm dependencies. No new state-management, routing, or UI libraries.
2. **Must deploy via the existing gh-pages architecture** — `npm run deploy` (`gh-pages -d build`),
   served from `https://www.ru8iks.com/toronto-calls-for-service`. No build config changes, no
   `PUBLIC_URL` changes, no `404.html` changes.

## Out of scope

- 24-hour data retention (deferred; designed separately).
- Map on the aggregator page.
- The Neighbourhood dimension — the upstream feed has no neighbourhood field. The existing
  `NEIGHBOURHOOD_TO_DIVISION` map filters by *the divisions a neighbourhood touches*, which
  over-selects badly and would make aggregate counts irreconcilable. Not used on this page.
- Pagination on the new page.
- Unifying the two duplicated table blocks in `App.js`.
- The existing page's neighbourhood / mutual-exclusivity filter logic. Left untouched.

---

## Architecture

```
src/
  hooks/useCalls.js         NEW   fetch + normalize + 5-min poll
                                  returns { calls, loading, error, lastUpdated, refresh }
  lib/callFilters.js        NEW   pure: filterCalls(), summarize(), facetCounts()
  lib/urlState.js           NEW   pure: parseHash(), buildHash()
  pages/AggregatePage.js    NEW   selectors + summary table + call list
  App.js                    EDIT  consume useCalls(); add third toggle button;
                                  fix loading/error render branches
```

No `MultiSelect` component. Two plain scrollable checkbox lists — no open/close state, no
outside-click handling, no keyboard-nav code.

### Data flow

```
useCalls()  ->  calls[]  ->  filterCalls(calls, selection)  ->  matching[]
                                                                  |
                                           summarize(matching) <--+
                                                                  v
                                                   summary table + call list
```

`selection` is `{ divisions: Set<string>, types: Set<string> }`, synced both ways with the URL hash.

### Why the logic lives in pure modules

Filtering and counting are the only parts that can be wrong invisibly — a wrong count still looks
like a number. `lib/callFilters.js` has no React imports, so it is directly unit-testable. That is
where all tests for this change go.

---

## Routing

Hash-based, hand-rolled (~15 lines). No router dependency.

| Hash | Page |
|---|---|
| `#/` or empty | Existing page (unchanged behaviour) |
| `#/aggregate?div=D51,D52&type=ROBBERY,ASSAULT` | Aggregator |

Navigation is a third button in the existing header toggle: `Table First | Map First | Aggregate`.

**These are two separate concerns sharing one control strip, and must not be conflated in code.**
`Table First` / `Map First` switch the existing `viewMode` state *within* the main page.
`Aggregate` switches `page`. They are independent: leaving the aggregator returns the user to
whichever `viewMode` they had. Do not extend `viewMode` with a third value.

**Why hash, specifically:** GitHub Pages serves the app from the `/toronto-calls-for-service`
subpath and has no server-side rewrite. The fragment is never sent to the server, so `index.html`
is returned for every deep link and the app routes itself. Path-based routing would require
finishing the `public/404.html` SPA shim, which is currently half-installed — it redirects to
`/?/path` but `index.html` contains no decoder, so path deep links break today.

---

## Behaviour

### Selectors

Two checkbox lists side by side: Divisions, Call Types. Each option shows a live count —
`D51 (14)`, `ROBBERY (3)`.

- Options with zero current calls render greyed, not hidden, so the list does not reshuffle on
  every refresh.
- A value present in the URL stays listed even with zero calls, so opening a shared link never
  silently drops part of the selection.
- Divisions are grouped: `D11`–`D55` first, then an **Other units** group for the operational
  units that appear in the same field (`HP`, `SE1`, `TAC8`, `DARU`). `HP` alone carried 10 of 98
  calls in observed data, so these are not filtered out — hiding them would make the page's totals
  disagree with the main page.
- Each list has a "Select all / Clear" pair.

### Filter semantics

- Empty selection in a category = no constraint from that category.
- Within a category: **OR**. Across categories: **AND**.
- Comparison is **exact equality**, never substring.

> **This is a correctness requirement, not a preference.** The existing page uses
> `.includes()`. Verified collisions in live data: `ASSAULT` also matches `ASSAULT IN PROGRESS`
> and `ASSAULT JUST OCCURRED`; `THEFT` also matches `THEFT OF VEHICLE` and `THEFT JUST OCCURRED`;
> `BREAK & ENTER` also matches `ATTEMPT BREAK & ENTER`. On a page whose purpose is counting, this
> produces summary numbers that exceed the true total.

### Summary table

Rows = divisions, columns = call types, cells = counts, with row totals, column totals, and a
grand total. First column sticky; horizontal scroll when many types are selected.

Axis contents follow the selection, resolved independently per axis:

| Divisions selected? | Types selected? | Rows | Columns |
|---|---|---|---|
| no | no | all divisions present in the data | all types present in the data |
| yes | no | the selected divisions | all types present **among the matching calls** |
| no | yes | all divisions present **among the matching calls** | the selected types |
| yes | yes | the selected divisions | the selected types |

A selected value with no matching calls still gets its row/column, filled with zeros — so the
table shape stays stable as data refreshes.

### Call list

All matching rows, newest first. No pagination — ~98 records today, ~600 even with 24h retention
later; both render fine. (The existing page's pagination is itself a bug source: `currentPage` is
never clamped, so a refresh that shrinks the result set shows "No calls matching your filters"
while data exists.)

Columns: Time, Division, Type, Cross Street.

**Time is displayed with a date** — `Aug 9, 8:04 PM` — and **sorted on the numeric
`OCCURRENCE_TIME`**, never on the display string. The existing page sorts the formatted string
`"7:00 PM"` alphabetically, which orders `1:05 AM` before `10:30 PM` before `7:00 AM`.

---

## Shared fetch hook

`useCalls()` centralises what `App.js` does inline today, with two bugs fixed:

| Bug (current) | Fix |
|---|---|
| `setLoading(true)` on every poll blanks the whole UI every 5 minutes | Only the first load gates rendering; refreshes are silent |
| `setError(null)` is never called anywhere, so one failed poll shows the error screen permanently | Clear error on success |

A failed refresh that has data in hand shows a "couldn't refresh — showing data from HH:MM"
banner rather than replacing the view.

Applying these requires editing `App.js`'s render branches, not only swapping in the hook.

Poll interval stays at 5 minutes.

### Record identity

React keys use a synthetic stable key: `` `${OCCURRENCE_TIME}|${LATITUDE}|${LONGITUDE}` ``,
verified unique across all 98 live records (zero collisions, zero null lat/lon).

**`OBJECTID` must not be used as an identity.** The upstream layer is truncate-and-reloaded:
IDs run dense `1..N` and are not time-ordered. Over a 13-minute observation, **86 of 98
OBJECTIDs pointed at a different incident**. Index-based React keys (`key={index}`) are likewise
unsafe with reordering data.

---

## Edge cases

| Case | Behaviour |
|---|---|
| No matches | "No calls match your selection" + Clear button. Summary renders zeros rather than vanishing. |
| Malformed URL values | Ignored silently; the rest of the selection still applies. A shared link never throws. |
| Selected value with no current calls | Stays selected, shows `(0)`. |
| Poll arrives mid-selection | Selection is independent of data; survives untouched. |
| Upstream returns fewer records | Normal — records are deleted upstream at arbitrary ages. Page just shows fewer rows. |

---

## Testing

Unit tests on `lib/callFilters.js` and `lib/urlState.js` only. Components are presentational and
are not tested.

1. `ASSAULT` selected does **not** match `ASSAULT IN PROGRESS` or `ASSAULT JUST OCCURRED`.
2. **Invariant: the sum of all summary cells equals the filtered call count.** This is the test
   that catches double-counting.
3. Empty selection returns all calls.
4. Multi-select is OR within a category, AND across categories.
5. `buildHash` -> `parseHash` round-trips a selection unchanged.
6. `parseHash` on malformed input returns a valid empty selection instead of throwing.

Run with the existing `npm test` (react-scripts / Jest). No new test tooling.

---

## Deployment

Unchanged. `npm run deploy` builds and pushes `build/` to the `gh-pages` branch.

Note: the currently deployed build is from 2025-04-21 and predates the map-first view, so the
first deploy after this work will also ship those older changes.
