# Toronto Calls for Service Viewer

A React application that displays Toronto Police Service calls for service in real-time using data from an ArcGIS API.

## Features

- Real-time display of Toronto police service calls
- Automatic data refresh every 5 minutes
- Sorting by any column (time, division, type, location)
- Filtering by:
  - Division
  - Call type
  - Location
  - Date range
- Responsive design works on desktop and mobile devices

## Technology Stack

- React 18
- Axios for API requests
- date-fns for date formatting

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```
4. Build for production:
   ```
   npm run build
   ```

## API Information

This application uses the Toronto Police Service public API:
```
https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/C4S_Public_NoGO/FeatureServer/0/query?where=1=1&outFields=*&f=json
```

## License

MIT

## Disclaimer

Not affiliated with Toronto Police Services, Toronto Fire Services, or The City of Toronto. In case of Emergency call 911.
