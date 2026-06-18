# AR Campus Wayfinder

An augmented reality campus wayfinder using LocAR.js and A-Frame.

## Features

- Real-time AR navigation on campus
- GPS-based location tracking with 3D markers
- Search functionality to find specific buildings
- Toggle between showing all locations or a single selected one
- Responsive UI for mobile devices
- Simple JSON file to configure campus locations

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A device with GPS and compass support
- HTTPS connection (required for device sensors)

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Then open your browser to `https://localhost:5173` (or the port shown in the terminal).

**Important:** This app requires:
1. HTTPS or localhost to access device sensors
2. Device with GPS and compass/magnetometer
3. Browser permissions for camera, location, and orientation

### Production Build

```bash
npm run build
```

The built files will be in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Grant Permissions**: When prompted, allow access to:
   - Camera (for AR view)
   - Location/GPS (to determine your position)
   - Orientation/Sensors (for head tracking)

2. **Explore**: Look around to see POI markers floating above real-world locations

3. **Search**: Use the search bar to find specific buildings by name

4. **Select**: Click a result in the search dropdown to focus on that location only

5. **View All**: Click "View All Locations" to show all POIs again

## Project Structure

```
ar-campus-wayfinder/
├── index.html          # Main HTML with A-Frame scene
├── locations.json      # GPS coordinates and info for each POI
├── src/
│   └── main.js         # Application logic (AR setup, markers, UI)
├── vite.config.js      # Vite bundler configuration
└── package.json        # Dependencies
```

## Customizing Locations

Edit `locations.json` to add your own campus locations:

```json
[
  {
    "id": "building-x",
    "name": "Building Name",
    "lat": 51.0505,
    "lng": -0.72,
    "description": "Optional description",
    "icon": null
  }
]
```

- `lat`: Latitude coordinate
- `lng`: Longitude coordinate  
- `name`: Display name for the location
- `description`: Optional additional info
- `icon`: Optional icon (data URL or null)

## Technical Details

- **LocAR.js**: Handles GPS-to-world coordinate conversion and AR camera setup
- **A-Frame**: Provides the 3D scene graph and rendering
- **Three.js**: Underlying 3D graphics library
- **Vite**: Fast development server and bundler

## Browser Support

Tested on:
- Chrome (Android)
- Safari (iOS)

**Note:** Firefox does not fully implement the Device Orientation API and may not work.

## License

ISC
