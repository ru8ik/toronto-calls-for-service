import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// Neighbourhood to Division mapping
const NEIGHBOURHOOD_TO_DIVISION = {
  "South Parkdale (11/14)": ["11", "14"],
  "Junction Area (11/12)": ["11", "12"],
  "Runnymede-Bloor West Village (11)": ["11"],
  "Roncesvalles (11)": ["11"],
  "Dovercourt-Wallace Emerson-Junction (11/13/14)": ["11", "13", "14"],
  "High Park North (11)": ["11"],
  "High Park–Swansea (11)": ["11"],
  "Weston–Pelham Park (11/12)": ["11", "12"],
  "Lambton–Baby Point (11)": ["11"],
  "Rockcliffe–Smythe (11/12)": ["11", "12"],
  "Dufferin Grove (11/14)": ["11", "14"],
  "Little Portugal (11/14)": ["11", "14"],
  "Rustic (12)": ["12"],
  "Keelesdale–Eglinton West (12)": ["12"],
  "Mount Dennis (12)": ["12"],
  "Beechborough–Greenbrook (12)": ["12"],
  "Pelmo Park–Humberlea (12/31)": ["12", "31"],
  "Weston (12)": ["12"],
  "Brookhaven–Amesbury (12)": ["12"],
  "Maple Leaf (12)": ["12"],
  "Yorkdale–Glen Park (13/32)": ["13", "32"],
  "Humewood–Cedarvale (13)": ["13"],
  "Corso Italia–Davenport (13)": ["13"],
  "Forest Hill North (13/53)": ["13", "53"],
  "Casa Loma (13/53)": ["13", "53"],
  "Forest Hill South (13/53)": ["13", "53"],
  "Caledonia–Fairbank (13)": ["13"],
  "Oakwood Village (13)": ["13"],
  "Englemount–Lawrence (13/32)": ["13", "32"],
  "Wychwood (13)": ["13"],
  "Briar Hill–Belgravia (13)": ["13"],
  "Trinity–Bellwoods (14)": ["14"],
  "Waterfront Communities–The Island (14/51/52)": ["14", "51", "52"],
  "Kensington–Chinatown (14/52)": ["14", "52"],
  "Annex (14/53)": ["14", "53"],
  "University (14/52)": ["14", "52"],
  "Niagara (14)": ["14"],
  "Palmerston–Little Italy (14)": ["14"],
  "Fort York–Liberty Village (14)": ["14"],
  "Stonegate–Queensway (22)": ["22"],
  "Islington–City Centre West (22)": ["22"],
  "Princess–Rosethorn (22)": ["22"],
  "Etobicoke West Mall (22)": ["22"],
  "Kingsway South (22)": ["22"],
  "Humber Heights–Westmount (22/23)": ["22", "23"],
  "Edenbridge–Humber Valley (22/23)": ["22", "23"],
  "Eringate–Centennial–West Deane (22/23)": ["22", "23"],
  "Alderwood (22)": ["22"],
  "New Toronto (22)": ["22"],
  "Long Branch (22)": ["22"],
  "Markland Wood (22)": ["22"],
  "Mimico (22)": ["22"],
  "Thistletown–Beaumond Heights (23)": ["23"],
  "Humbermede (23/31)": ["23", "31"],
  "West Humber–Clairville (23)": ["23"],
  "Kingsview Village–The Westway (23)": ["23"],
  "Elms–Old Rexdale (23)": ["23"],
  "Mount Olive–Silverstone–Jamestown (23)": ["23"],
  "Rexdale–Kipling (23)": ["23"],
  "Willowridge–Martin Grove–Richview (23)": ["23"],
  "York University Heights (31/32)": ["31", "32"],
  "Humber Summit (31)": ["31"],
  "Glenfield–Jane Heights (31)": ["31"],
  "Oakdale–Beverley Heights (31/32)": ["31", "32"],
  "Black Creek (31)": ["31"],
  "Lansing–Westgate (32)": ["32"],
  "St. Andrew–Windfields (32/33)": ["32", "33"],
  "Westminster–Branson (32)": ["32"],
  "Clanton Park (32)": ["32"],
  "Newtonbrook West (32)": ["32"],
  "Bathurst Manor (32)": ["32"],
  "Willowdale East (32)": ["32"],
  "Willowdale West (32)": ["32"],
  "Bedford Park–Nortown (32/53)": ["32", "53"],
  "Bridle Path–Sunnybrook–York Mills (32/33/53)": ["32", "33", "53"],
  "Lawrence Park North (32)": ["32"],
  "Newtonbrook East (32)": ["32"],
  "Victoria Village (33/55)": ["33", "55"],
  "Bayview Woods–Steeles (33)": ["33"],
  "Henry Farm (33)": ["33"],
  "Hillcrest Village (33)": ["33"],
  "Banbury–Don Mills (33)": ["33"],
  "Parkwoods–Donalda (33)": ["33"],
  "Bayview Village (33)": ["33"],
  "Don Valley Village (33)": ["33"],
  "Pleasant View (33)": ["33"],
  "Leaside–Bennington (33/53/55)": ["33", "53", "55"],
  "Tam O'Shanter–Sullivan (42)": ["42"],
  "Centennial Scarborough (42/43)": ["42", "43"],
  "Agincourt North (42)": ["42"],
  "Agincourt South–Malvern West (42)": ["42"],
  "L'Amoreaux (42)": ["42"],
  "Rouge (42/43)": ["42", "43"],
  "Malvern (42)": ["42"],
  "Steeles (42)": ["42"],
  "Milliken (42)": ["42"],
  "Scarborough Village (43)": ["43"],
  "Cliffcrest (43)": ["43"],
  "Guildwood (43)": ["43"],
  "West Hill (43)": ["43"],
  "Highland Creek (43)": ["43"],
  "Eglinton East (43)": ["43"],
  "Bendale (43)": ["43"],
  "Woburn (43)": ["43"],
  "Morningside (43)": ["43"],
  "South Riverdale (51/55)": ["51", "55"],
  "Church–Yonge Corridor (51)": ["51"],
  "North St. James Town (51)": ["51"],
  "Regent Park (51)": ["51"],
  "Cabbagetown–South St. James Town (51)": ["51"],
  "Moss Park (51)": ["51"],
  "St. Lawrence–East Bayfront–The Islands (51)": ["51"],
  "Downtown Yonge East (51)": ["51"],
  "Bay Street Corridor (52)": ["52"],
  "Yonge–St. Clair (53)": ["53"],
  "Thorncliffe Park (53)": ["53"],
  "Broadview North (53/55)": ["53", "55"],
  "Rosedale–Moore Park (53)": ["53"],
  "Mount Pleasant East (53)": ["53"],
  "Mount Pleasant West (53)": ["53"],
  "Lawrence Park South (53)": ["53"],
  "Yonge–Eglinton (53)": ["53"],
  "The Beaches (55)": ["55"],
  "Danforth East York (55)": ["55"],
  "Danforth (55)": ["55"],
  "Taylor–Massey (55)": ["55"],
  "Flemingdon Park (55)": ["55"],
  "North Riverdale (55)": ["55"],
  "Greenwood–Coxwell (55)": ["55"],
  "O'Connor–Parkview (55)": ["55"],
  "Old East York (55)": ["55"],
  "Blake–Jones (55)": ["55"],
  "East End–Danforth (55)": ["55"],
  "Playter Estates–Danforth (55)": ["55"],
  "Woodbine–Lumsden (55)": ["55"],
  "Woodbine Corridor (55)": ["55"]
};

// Map helper component to update the map view when center changes
function MapUpdater({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, {
        duration: 1.5, // animation duration in seconds
        easeLinearity: 0.25
      });
    }
  }, [center, zoom, map]);
  
  return null;
}

function App() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
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
  const prevCallsRef = useRef([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

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
      // Handle filtering by either division or neighbourhood
      if (filters.neighbourhood) {
        // If neighbourhood is selected, check if the call's division is in the list of divisions for this neighbourhood
        const divisionsForNeighbourhood = NEIGHBOURHOOD_TO_DIVISION[filters.neighbourhood] || [];
        
        // Extract division number, removing 'D' prefix if it exists
        const callDivision = call.DIVISION?.toString() || '';
        const normalizedCallDivision = callDivision.replace(/^D/, '');
        
        // Check if the call's division (with or without D prefix) matches any of the divisions for this neighbourhood
        if (!divisionsForNeighbourhood.some(div => div === normalizedCallDivision || `D${div}` === callDivision)) {
          return false;
        }
      } else if (filters.division && !call.DIVISION?.toString().toLowerCase().includes(filters.division.toLowerCase())) {
        // If only division filter is active (no neighbourhood), filter by division as before
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
    
    // Create a copy of the current filters
    const newFilters = { ...filters };
    
    // Set the changed filter value
    newFilters[name] = value;
    
    // If division is being set, clear neighbourhood and vice versa
    if (name === 'division' && value !== '') {
      newFilters.neighbourhood = '';
    } else if (name === 'neighbourhood' && value !== '') {
      newFilters.division = '';
    }
    
    // Reset to page 1 when filters change
    setCurrentPage(1);
    
    setFilters(newFilters);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      division: '',
      neighbourhood: '',
      type: ''
    });
    setCurrentPage(1);
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
      
      // Scroll to map section
      const mapSection = document.querySelector('.map-container');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Close notification
  const closeNotification = () => {
    setShowNotification(false);
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCalls.slice(indexOfFirstItem, indexOfLastItem);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: document.querySelector('.table-container').offsetTop - 20, behavior: 'smooth' });
  };

  // Check if a call is an emergency based on keywords
  const isEmergencyCall = (callType) => {
    if (!callType) return false;
    const keywords = ['gun', 'knife', 'stabb', 'shoot', 'homicide', 'break', 'enter'];
    const lowercaseType = callType.toLowerCase();
    return keywords.some(keyword => lowercaseType.includes(keyword));
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
        <p className="last-updated">
          Last updated: {lastUpdated ? format(lastUpdated, 'MMM d, yyyy h:mm:ss a') : 'Loading...'}
        </p>
        <p className="disclaimer">
          Not affiliated with any Toronto emergency services
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
              disabled={filters.neighbourhood !== ''}
            >
              <option value="">All Divisions</option>
              {divisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Neighbourhood:</label>
            <select 
              name="neighbourhood" 
              value={filters.neighbourhood} 
              onChange={handleFilterChange}
              disabled={filters.division !== ''}
            >
              <option value="">All Neighbourhoods</option>
              {Object.keys(NEIGHBOURHOOD_TO_DIVISION).sort().map(neighbourhood => (
                <option key={neighbourhood} value={neighbourhood}>{neighbourhood}</option>
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
        <div className="filter-info">
          <p>The Division and Neighbourhood filters are mutually exclusive - selecting one disables the other.</p>
          <p>The filter page refreshes automatically every 5 minutes.</p>
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
                {currentItems.length > 0 ? (
                  currentItems.map((call, index) => (
                    <tr 
                      key={index} 
                      onClick={() => handleRowClick(call)}
                      className={`
                        ${selectedCall && selectedCall.OBJECTID === call.OBJECTID ? 'selected-row' : ''}
                        ${isEmergencyCall(call.CALL_TYPE) ? 'emergency-call' : ''}
                      `}
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
            <p className="table-info">Showing {currentItems.length} of {filteredCalls.length} calls</p>
          </div>
          
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, index) => (
              <button 
                key={index + 1} 
                onClick={() => handlePageChange(index + 1)}
                className={currentPage === index + 1 ? 'active' : ''}
                disabled={currentPage === index + 1}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <div className="map-container">
            <h3>Call Location Map <span className="section-accent">Toronto Area</span></h3>
            <p className="map-instruction">Click on a row above to view its location on the map</p>
            <MapContainer center={mapCenter} zoom={13} className="leaflet-container">
              <MapUpdater center={mapCenter} zoom={14} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {selectedCall && (
                <Marker 
                  position={[selectedCall.LATITUDE, selectedCall.LONGITUDE]}
                  eventHandlers={{
                    mouseover: (e) => {
                      e.target.openPopup();
                    }
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <div className={`popup-header ${isEmergencyCall(selectedCall.CALL_TYPE) ? 'emergency-header' : ''}`}>
                        Incident Details
                        {isEmergencyCall(selectedCall.CALL_TYPE) && (
                          <span className="emergency-badge">Emergency</span>
                        )}
                      </div>
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
              <p className="made-by">Made by Ru8ik</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
