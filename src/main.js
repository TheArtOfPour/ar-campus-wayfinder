import { App } from 'locar';

// Use THREE from A-Frame (loaded globally)
const THREE = window.THREE;

// Campus locations data (GPS coordinates + info)
const LOCATIONS_URL = './locations.json';

// Store for loaded locations and POI objects
let locations = [];
let pois = {};
let currentLocAR;
let selectedLocationId = null;
let appInstance = null;

// Create POI marker with text and icon
function createPOIMarker(location, isHighlighted = false) {
  const group = new THREE.Group();

  // Main marker - floating circle above the ground
  const radius = isHighlighted ? 0.5 : 0.3;
  const geometry = new THREE.CircleGeometry(radius, 32);
  const color = isHighlighted ? 0x4facfe : 0x00f260;

  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });

  const circle = new THREE.Mesh(geometry, material);
  circle.position.y = radius;
  group.add(circle);

  // Add text sprite for the location name
  if (location.name) {
    const textSprite = createTextSprite(location.name, isHighlighted ? '#ffffff' : '#000000');
    textSprite.position.set(0, radius + 0.5, 0);
    group.add(textSprite);
  }

  return group;
}

// Create text sprite from canvas
function createTextSprite(message, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = 'Bold 14px Arial';
  const padding = 6;
  const metrics = ctx.measureText(message);
  const textWidth = metrics.width;

  canvas.width = textWidth + padding * 2;
  canvas.height = 28;

  ctx.fillStyle = color;
  ctx.font = 'Bold 14px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.5, 1, 1);

  return sprite;
}

// Load locations from JSON file
async function loadLocations() {
  try {
    const response = await fetch(LOCATIONS_URL);
    if (!response.ok) throw new Error('Failed to load locations.json');
    return await response.json();
  } catch (error) {
    console.error('Error loading locations:', error);
    // Default sample data for debugging
    return [
      { id: "R", name: "Revels", lat: 48.711359, lng: -122.489252 },
      { id: "S", name: "S & S", lat: 48.711321, lng: -122.488509 },
      { id: "M", name: "M & M", lat: 48.711314, lng: -122.487736 },
      { id: "RR", name: "Roger", lat: 48.713721, lng: -122.489305 },
      { id: "H", name: "H & L", lat: 48.711920, lng: -122.491269 }
    ];
  }
}

// Initialize AR app
async function initAR() {
  const app = new App({
    cameraOptions: { hFov: 80, near: 0.001, far: 1000 },
    rendererOptions: { alpha: true, antialias: true }
  });

  try {
    currentLocAR = await app.start();

    // Load locations first (we need these for POIs)
    locations = await loadLocations();
    console.log('Loaded', locations.length, 'locations');

    // CRITICAL: Establish a world origin BEFORE adding POIs!
    // locar.add() requires an initial position to be established via startGps()
    // We use fakeGps with the first location to establish world origin immediately
    await currentLocAR.startGps();
    
    // Use the first location's coordinates to establish world origin
    if (locations.length > 0) {
      const [firstLocation] = locations;
      // fakeGps(lon, lat, elevation, accuracy)
      currentLocAR.fakeGps(firstLocation.lng, firstLocation.lat, 0, 10);
      console.log('World origin established with fakeGPS at', firstLocation.name);
    }
    
    console.log('GPS tracking started');

    // Now add POI markers for each location using locar.add()
    locations.forEach(location => {
      const marker = createPOIMarker(location, false);
      pois[location.id] = marker;
      
      // Use locar.add() to position POIs by GPS coordinates
      currentLocAR.add(marker, location.lng, location.lat);
      console.log(`Added POI: ${location.name} at (${location.lat}, ${location.lng})`);
    });

    console.log('AR app initialized with', locations.length, 'POIs');
    appInstance = app;

    return { app, currentLocAR };
  } catch (error) {
    console.error('Error initializing AR:', error);
    alert(`AR initialization failed: ${error.message}`);
    throw error;
  }
}

// Handle user selecting a location
function selectLocation(id) {
  selectedLocationId = id;
  
  // Show only the selected POI
  Object.keys(pois).forEach(key => {
    pois[key].visible = (key === id);
  });

  document.getElementById('search-input').value = '';
  renderLocationInfo(id);
}

// Handle user deselection (show all)
function setShowAllLocations() {
  selectedLocationId = null;
  
  // Show all POIs
  Object.keys(pois).forEach(key => {
    pois[key].visible = true;
  });

  document.getElementById('location-info').innerHTML = `
    <h3>Campus Wayfinder</h3>
    <p style="margin-top:10px;">Select a location on the map or search to find buildings and points of interest.</p>
  `;
}

// Render location info in the UI panel
function renderLocationInfo(id) {
  const location = locations.find(l => l.id === id);
  if (!location) return;

  document.getElementById('location-info').innerHTML = `
    <h3>${location.name}</h3>
    <p style="margin-top:10px;">GPS: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
    <button class="reset-button" onclick="window.app.resetToAll()" style="margin-top:15px;">View All Locations</button>
  `;
}

// Search functionality
function searchLocations(query) {
  const normalizedQuery = query.toLowerCase();
  return locations.filter(location => location.name.toLowerCase().includes(normalizedQuery));
}

// Main initialization function called from HTML
export async function init() {
  try {
    await initAR();

    // Show all locations initially
    Object.keys(pois).forEach(key => pois[key].visible = true);

    // Set up search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const resultsContainer = document.getElementById('search-results');

      if (!query) {
        setShowAllLocations();
        resultsContainer.innerHTML = '';
        return;
      }

      const results = searchLocations(query);
      resultsContainer.innerHTML = '';

      if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="padding:15px;">No locations found</p>';
      } else {
        results.forEach(result => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `<strong>${result.name}</strong>`;
          item.onclick = () => selectLocation(result.id);
          resultsContainer.appendChild(item);
        });
      }
    });

    // Expose reset function globally
    window.app = {
      resetToAll: setShowAllLocations,
      locations: locations
    };

  } catch (error) {
    console.error('Failed to initialize:', error);
    document.body.innerHTML = `
      <div style="padding:20px;color:red;">
        <h1>Error</h1>
        <p>AR initialization failed. Please ensure you are using a device with GPS and compass support.</p>
        <p><strong>Note:</strong> This app requires HTTPS or localhost to work properly.</p>
      </div>`;
  }
}

// Expose init globally
window.initARApp = init;
