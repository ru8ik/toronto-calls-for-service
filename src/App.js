import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './App.css';

function App() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'OCCURRENCE_TIME', direction: 'desc' });
  const [filters, setFilters] = useState({
    division: '',
    type: ''
  });

  const API_URL = 'https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/C4S_Public_NoGO/FeatureServer/0/query?where=1=1&outFields=*&f=json';

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL);
      
      if (response.data && response.data.features) {
        // Debug: Log the first feature to see its structure
        if (response.data.features.length > 0) {
          const firstRecord = response.data.features[0].attributes;
          console.log('API Response Sample:', firstRecord);
        }
        
        // Process and format the data
        const formattedCalls = response.data.features.map((feature) => {
          const attributes = feature.attributes;
          try {
            // Handle date formatting - use OCCURRENCE_TIME field
            let callDate;
            if (typeof attributes.OCCURRENCE_TIME === 'number') {
              callDate = new Date(attributes.OCCURRENCE_TIME);
            } else if (typeof attributes.OCCURRENCE_TIME_AGOL === 'number') {
              callDate = new Date(attributes.OCCURRENCE_TIME_AGOL);
            } else {
              callDate = new Date(0);
            }
            
            // Format time with hours and minutes
            const formattedTime = isNaN(callDate.getTime()) 
              ? 'Unknown' 
              : format(callDate, 'h:mm a');  // Format as "7:00 PM"
              
            return {
              ...attributes,
              formattedTime,
              // Use the correct fields from the API
              DIVISION: attributes.DIVISION || '',
              CALL_TYPE: attributes.CALL_TYPE || '',
              CROSS_STREETS: attributes.CROSS_STREETS || ''
            };
          } catch (dateError) {
            console.error('Error formatting date:', dateError);
            return {
              ...attributes,
              formattedTime: 'Unknown',
              DIVISION: attributes.DIVISION || '',
              CALL_TYPE: attributes.CALL_TYPE || '',
              CROSS_STREETS: attributes.CROSS_STREETS || ''
            };
          }
        });
        
        setCalls(formattedCalls);
        setLastUpdated(new Date());
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data. Please try again later.');
      setLoading(false);
      console.error('Error fetching data:', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCalls();
    
    // Set up auto-refresh every 5 minutes
    const intervalId = setInterval(fetchCalls, 5 * 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting to calls data
  const sortedCalls = React.useMemo(() => {
    const sortableCalls = [...calls];
    if (sortConfig.key) {
      sortableCalls.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableCalls;
  }, [calls, sortConfig]);

  // Apply filters
  const filteredCalls = React.useMemo(() => {
    return sortedCalls.filter(call => {
      // Filter by division
      if (filters.division && !call.DIVISION?.toString().toLowerCase().includes(filters.division.toLowerCase())) {
        return false;
      }
      
      // Filter by type
      if (filters.type && !call.CALL_TYPE?.toLowerCase().includes(filters.type.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [sortedCalls, filters]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      division: '',
      type: ''
    });
  };

  // Extract unique divisions for filter dropdown
  const divisions = React.useMemo(() => {
    const uniqueDivisions = new Set();
    calls.forEach(call => {
      if (call.DIVISION) {
        uniqueDivisions.add(call.DIVISION.toString());
      }
    });
    return Array.from(uniqueDivisions).sort();
  }, [calls]);

  // Extract unique call types for filter dropdown
  const callTypes = React.useMemo(() => {
    const uniqueTypes = new Set();
    calls.forEach(call => {
      if (call.CALL_TYPE) {
        uniqueTypes.add(call.CALL_TYPE);
      }
    });
    return Array.from(uniqueTypes).sort();
  }, [calls]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Toronto Calls for Service</h1>
        <p className="last-updated">
          Last updated: {lastUpdated ? format(lastUpdated, 'MMM d, yyyy h:mm:ss a') : 'Loading...'}
        </p>
        <p className="disclaimer">
          Not affiliated with Toronto Police Services, Toronto Fire Services, or The City of Toronto - In case of Emergency call 911
        </p>
      </header>

      <div className="filter-container">
        <h3>Filter Calls</h3>
        <div className="filter-controls">
          <div className="filter-group">
            <label>Division:</label>
            <select 
              name="division" 
              value={filters.division} 
              onChange={handleFilterChange}
            >
              <option value="">All Divisions</option>
              {divisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Call Type:</label>
            <select 
              name="type" 
              value={filters.type} 
              onChange={handleFilterChange}
            >
              <option value="">All Types</option>
              {callTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button className="reset-button" onClick={resetFilters}>Reset Filters</button>
          <button className="refresh-button" onClick={fetchCalls}>Refresh Now</button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading calls for service...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="table-container">
          <table className="calls-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('formattedTime')}>
                  Time {sortConfig.key === 'formattedTime' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('DIVISION')}>
                  Division {sortConfig.key === 'DIVISION' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('CALL_TYPE')}>
                  Type {sortConfig.key === 'CALL_TYPE' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('CROSS_STREETS')}>
                  Cross Street {sortConfig.key === 'CROSS_STREETS' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCalls.length > 0 ? (
                filteredCalls.map((call, index) => (
                  <tr key={index}>
                    <td>{call.formattedTime}</td>
                    <td>{call.DIVISION || ''}</td>
                    <td>{call.CALL_TYPE || ''}</td>
                    <td>{call.CROSS_STREETS || ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-results">No calls matching your filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <footer>
        <p>© {new Date().getFullYear()} Toronto Calls for Service Viewer</p>
      </footer>
    </div>
  );
}

export default App;
