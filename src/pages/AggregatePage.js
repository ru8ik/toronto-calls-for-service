import React from 'react';
import {
  filterCalls,
  summarize,
  facetCounts,
  groupDivisions,
} from '../lib/callFilters';
import { useKnownCallTypes } from '../hooks/useKnownCallTypes';
import { isEmergencyCall } from '../lib/severity';

function toggleValue(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function CheckboxGroup({ label, values, counts, selected, onToggle, isSevere }) {
  if (values.length === 0) return null;
  return (
    <div className="agg-group">
      {label && <div className="agg-group-label">{label}</div>}
      {values.map((value) => {
        const count = counts[value] || 0;
        const severe = isSevere ? isSevere(value) : false;
        return (
          <label
            key={value}
            className={`agg-option${severe ? ' agg-option-severe' : ''}`}
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

  const liveTypes = React.useMemo(
    () => calls.map((c) => c.CALL_TYPE).filter(Boolean),
    [calls]
  );
  const knownTypes = useKnownCallTypes(liveTypes);

  // Always offer every known call type, even ones with zero calls right
  // now, so a type can be selected pre-emptively before it occurs.
  const typeOptions = React.useMemo(() => {
    const values = new Set(knownTypes);
    selection.types.forEach((v) => values.add(v));
    return [...values].sort();
  }, [knownTypes, selection.types]);

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
              isSevere={isEmergencyCall}
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
                <tr
                  key={c.key}
                  className={isEmergencyCall(c.CALL_TYPE) ? 'emergency-call' : ''}
                >
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
