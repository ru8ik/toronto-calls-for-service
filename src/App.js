import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

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
  const [selectedCall, setSelectedCall] = useState(null);
  const [mapCenter, setMapCenter] = useState([43.6532, -79.3832]); // Toronto center
  const [showNotification, setShowNotification] = useState(false);
  const [newCallsCount, setNewCallsCount] = useState(0);
  const prevCallsRef = useRef([]);

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

        // Check for new calls (compare with previous calls)
        if (prevCallsRef.current.length > 0) {
          const currentCallIds = new Set(formattedCalls.map(call => call.OBJECTID));
          const prevCallIds = new Set(prevCallsRef.current.map(call => call.OBJECTID));
          
          const newCalls = formattedCalls.filter(call => !prevCallIds.has(call.OBJECTID));
          
          if (newCalls.length > 0) {
            setNewCallsCount(newCalls.length);
            setShowNotification(true);
            
            // Auto-hide notification after 5 seconds
            setTimeout(() => {
              setShowNotification(false);
            }, 5000);
          }
        }
        
        // Update the previous calls reference
        prevCallsRef.current = formattedCalls;
        
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

  // Handle row click to show on map
  const handleRowClick = (call) => {
    if (call.LATITUDE && call.LONGITUDE) {
      setSelectedCall(call);
      setMapCenter([call.LATITUDE, call.LONGITUDE]);
    }
  };

  // Limit table to 30 rows per page
  const limitedCalls = filteredCalls.slice(0, 30);

  // Close notification
  const closeNotification = () => {
    setShowNotification(false);
  };

  return (
    <div className="App">
      {showNotification && (
        <div className="notification">
          <div className="notification-content">
            <span className="notification-message">
              {newCallsCount} new call{newCallsCount !== 1 ? 's' : ''} added to the list!
            </span>
            <button className="close-button" onClick={closeNotification}>×</button>
          </div>
        </div>
      )}

      <header className="App-header">
        <h1>Toronto Calls for Service</h1>
        <div className="header-tagline">INDUSTRY LEADING SECURITY INTELLIGENCE</div>
        <p className="last-updated">
          Last updated: {lastUpdated ? format(lastUpdated, 'MMM d, yyyy h:mm:ss a') : 'Loading...'}
        </p>
        <p className="disclaimer">
          Powered by OZ Security Group | Not affiliated with any Toronto emergency services
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
        <>
          <div className="table-container">
            <div className="table-header">
              <h3>Active Calls <span className="section-accent">Real-Time Monitoring</span></h3>
            </div>
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
                {limitedCalls.length > 0 ? (
                  limitedCalls.map((call, index) => (
                    <tr 
                      key={index} 
                      onClick={() => handleRowClick(call)}
                      className={selectedCall && selectedCall.OBJECTID === call.OBJECTID ? 'selected-row' : ''}
                    >
                      <td>{call.formattedTime}</td>
                      <td>{call.DIVISION}</td>
                      <td>{call.CALL_TYPE}</td>
                      <td>{call.CROSS_STREETS}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-data">No calls matching your filters</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="table-info">Showing {limitedCalls.length} of {filteredCalls.length} calls</p>
          </div>
          
          <div className="map-container">
            <h3>Call Location Map <span className="section-accent">Toronto Area</span></h3>
            <p className="map-instruction">Click on a row above to view its location on the map</p>
            <MapContainer center={mapCenter} zoom={13} style={{ height: '400px', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {selectedCall && (
                <Marker position={[selectedCall.LATITUDE, selectedCall.LONGITUDE]}>
                  <Popup>
                    <div className="map-popup">
                      <div className="popup-header">Incident Details</div>
                      <div className="popup-content">
                        <strong>Division:</strong> {selectedCall.DIVISION}<br />
                        <strong>Type:</strong> {selectedCall.CALL_TYPE}<br />
                        <strong>Location:</strong> {selectedCall.CROSS_STREETS}<br />
                        <strong>Time:</strong> {selectedCall.formattedTime}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          <footer className="App-footer">
            <div className="footer-content">
              <div className="footer-tagline">COMMITTED TO INNOVATION AND EXCELLENCE</div>
              <p className="footer-description">IN SECURITY RISK MITIGATION & PROTECTION SERVICES</p>
              <p className="made-by">Made by Ru8ik</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
