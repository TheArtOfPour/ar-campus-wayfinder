import * as THREE from 'three';
import { App } from 'locar';

// Campus locations data (GPS coordinates + info)
const LOCATIONS_URL = './locations.json';

// Store for loaded locations and POI objects
let locations = [];
let pois = {};
let currentLocAR;
let selectedLocationId = null;
let showAllLocations = true;

// Scene setup with A-Frame style component pattern
function createScene(app) {
  const scene = app.scene;
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);
  
  return scene;
}

// Create POI marker with text and icon
function createPOIMarker(location, isHighlighted = false) {
  const group = new THREE.Group();
  
  // Main marker - floating circle above the ground
  const radius = isHighlighted ? 0.8 : 0.5;
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
  
  // Add a smaller dot in the center
  const dotGeometry = new THREE.CircleGeometry(radius * 0.3, 16);
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dot = new THREE.Mesh(dotGeometry, dotMaterial);
  dot.position.y = radius;
  group.add(dot);
  
  // Create text sprite for the location name
  if (location.name) {
    const textSprite = createTextSprite(location.name, isHighlighted ? '#ffffff' : '#000000');
    textSprite.position.set(0, radius + 1.2, 0);
    group.add(textSprite);
  }
  
  // Add optional icon
  if (location.icon) {
    const iconSprite = createIconSprite(location.icon);
    iconSprite.position.set(radius * 0.6, radius - 0.2, 0);
    group.add(iconSprite);
  }
  
  return group;
}

// Create text sprite from canvas
function createTextSprite(message, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = 'Bold 16px Arial';
  const padding = 8;
  const metrics = ctx.measureText(message);
  const textWidth = metrics.width;
  
  canvas.width = textWidth + padding * 2;
  canvas.height = 32;
  
  ctx.fillStyle = color;
  ctx.font = 'Bold 16px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, padding, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1); // Adjust scale for text
  
  return sprite;
}

// Create icon sprite (using placeholder if no actual image)
function createIconSprite(iconData) {
  let canvas, ctx, texture, material, sprite;
  
  // Use a simple placeholder icon if no valid image
  canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  canvas.width = 48;
  canvas.height = 48;
  
  // Draw a pin icon
  ctx.fillStyle = '#ff5722';
  ctx.beginPath();
  ctx.arc(24, 16, 10, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ff5722';
  ctx.fillRect(20, 26, 8, 22);
  ctx.beginPath();
  ctx.moveTo(20, 26);
  ctx.lineTo(14, 38);
  ctx.lineTo(26, 38);
  ctx.fill();
  
  texture = new THREE.CanvasTexture(canvas);
  material = new THREE.SpriteMaterial({ map: texture });
  sprite = new THREE.Sprite(material);
  sprite.scale.set(2.5, 2.5, 1);
  
  return sprite;
}

// Update all POI positions based on current GPS position
function updatePOIs() {
  if (!currentLocAR || !selectedLocationId) return;
  
  const selected = locations.find(l => l.id === selectedLocationId);
  if (!selected) return;
  
  // Show only the selected location
  Object.keys(pois).forEach(key => {
    if (key === selectedLocationId) {
      pois[key].visible = true;
    } else {
      pois[key].visible = false;
    }
  });
}

// Load locations from JSON file
async function loadLocations() {
  try {
    const response = await fetch(LOCATIONS_URL);
    if (!response.ok) throw new Error('Failed to load locations.json');
    
    locations = await response.json();
    console.log('Loaded', locations.length, 'locations');
    
    return locations;
  } catch (error) {
    console.error('Error loading locations:', error);
    // Return default sample data if fetch fails
    return [
      { id: 'building-a', name: 'Science Building', lat: 51.0505, lng: -0.72, icon: null },
      { id: 'building-b', name: 'Library', lat: 51.0510, lng: -0.721, icon: null },
      { id: 'building-c', name: 'Student Center', lat: 51.0498, lng: -0.719, icon: null },
      { id: 'field', name: 'Sports Field', lat: 51.0492, lng: -0.722, icon: null }
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
    // Start the AR app (this will request permissions)
    currentLocAR = await app.start();
    
    const scene = createScene(app);
    
    // Load locations
    const loadedLocations = await loadLocations();
    locations = loadedLocations;
    
    // Create POI markers for each location
    locations.forEach(location => {
      const marker = createPOIMarker(location, false);
      
      // Store the marker and its location reference
      pois[location.id] = marker;
      scene.add(marker);
    });
    
    console.log('AR app initialized with', locations.length, 'POIs');
    
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
  showAllLocations = false;
  
  // Update POI visibility and highlighting
  Object.keys(pois).forEach(key => {
    if (key === id) {
      pois[key].visible = true;
    } else {
      pois[key].visible = false;
    }
  });
  
  // Update UI to show selection state
  document.getElementById('search-input').value = '';
  renderLocationInfo(id);
}

// Handle user deselection (show all)
function setShowAllLocations() {
  selectedLocationId = null;
  showAllLocations = true;
  
  Object.keys(pois).forEach(key => {
    pois[key].visible = true;
  });
  
  // Clear selection UI
  document.getElementById('location-info').innerHTML = '<h3>Campus Wayfinder</h3><p style="margin-top:10px;">Select a location on the map or search to find buildings and points of interest.</p>';
}

// Render location info in the UI panel
function renderLocationInfo(id) {
  const location = locations.find(l => l.id === id);
  if (!location) return;
  
  const infoPanel = document.getElementById('location-info');
  infoPanel.innerHTML = `
    <h3>${location.name}</h3>
    <p style="margin-top:10px;">GPS Coordinates: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
    <button class="reset-button" onclick="window.app.resetToAll()" style="margin-top:15px;">View All Locations</button>
  `;
}

// Search functionality
function searchLocations(query) {
  const normalizedQuery = query.toLowerCase();
  return locations.filter(location => 
    location.name.toLowerCase().includes(normalizedQuery)
  );
}

// Update POI positions based on GPS
function updatePOIPositions() {
  if (!currentLocAR || !locations.length) return;
  
  // For each location, calculate its position relative to user's current GPS
  locations.forEach(location => {
    const marker = pois[location.id];
    if (marker) {
      try {
        const vector = currentLocAR.convertGpsCoordsToVector3(location.lng, location.lat);
        marker.position.copy(vector);
      } catch (e) {
        console.warn('Could not convert GPS coords for', location.name, e);
      }
    }
  });
}

// Main initialization function called from HTML
export async function init() {
  try {
    const { currentLocAR: locarInstance } = await initAR();
    
    // Set up event listeners
    document.getElementById('search-input').addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const resultsContainer = document.getElementById('search-results');
      
      if (!query) {
        setShowAllLocations();
        resultsContainer.innerHTML = '';
        return;
      }
      
      // Show search results
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
    
    // Expose reset function globally for the UI
    window.app = {
      resetToAll: setShowAllLocations,
      locations: locations
    };
    
    // Show all locations initially
    Object.keys(pois).forEach(key => {
      pois[key].visible = true;
    });
    
  } catch (error) {
    console.error('Failed to initialize:', error);
    document.body.innerHTML = '<div style="padding:20px;color:red;"><h1>Error</h1><p>AR initialization failed. Please ensure you are using a device with GPS and compass support, and that you have granted the necessary permissions.</p><p><strong>Note:</strong> This app requires HTTPS or localhost to work properly due to browser security requirements for sensor access.</p></div>';
  }
}

// Expose init globally
window.initARApp = init;
