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
