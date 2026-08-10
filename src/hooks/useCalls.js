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
