// AR Campus Wayfinder v2 - Main Application Logic (Simplified A-Frame Version)
// Uses direct locar-camera gpsupdate events as per locar-aframe examples
// Supports mock GPS for desktop debugging via window.mockGPSLocation

import 'locar-aframe';

const THREE = window.THREE;
const LOCATIONS_URL = './locations.json';

let locations = [];
let firstLocation = true;

// Get DOM elements
const locarCamera = document.querySelector('[locar-camera]');
const scene = document.querySelector('a-scene');
const loadingEl = document.getElementById('loading');

// Store POI entities
const poiEntities = {};

// GPS smoothing - store recent positions and average them
const gpsHistory = [];
const GPS_HISTORY_SIZE = 5; // Average last 5 positions

function addGPSPosition(lat, lng) {
  gpsHistory.push({ lat, lng });
  if (gpsHistory.length > GPS_HISTORY_SIZE) {
    gpsHistory.shift();
  }
  
  // Return averaged position
  const sum = gpsHistory.reduce((acc, pos) => ({
    lat: acc.lat + pos.lat,
    lng: acc.lng + pos.lng
  }), { lat: 0, lng: 0 });
  
  return {
    lat: sum.lat / gpsHistory.length,
    lng: sum.lng / gpsHistory.length
  };
}

function createPOIs() {
  console.log('[createPOIs] Creating POI markers...');

  if (!scene || locations.length === 0) {
    return;
  }

  const colors = [0xff0000, 0xffff00, 0x00ffff, 0x00ff00, 0xff00ff, 0x0000ff];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    
    // Create an entity with locar-entity-place component
    const entity = document.createElement('a-entity');
    entity.setAttribute('locar-entity-place', {
      latitude: loc.lat,
      longitude: loc.lng
    });
    
    // Add visual marker - larger box for visibility
    const box = document.createElement('a-box');
    box.setAttribute('material', {
      color: colors[i % colors.length],
      opacity: 0.75
    });
    box.setAttribute('position', '0 1 0'); // Box sits on ground, half-height up (height=2)
    box.setAttribute('scale', '3 2 3'); // Larger boxes (3x width/depth, 2x height)
    
    entity.appendChild(box);
    
    // Add name text above the marker
    const text = document.createElement('a-text');
    text.setAttribute('value', loc.name);
    text.setAttribute('color', '#000');
    text.setAttribute('anchor', 'center');
    text.setAttribute('baseline', 'middle');
    text.setAttribute('position', '0 3.5 0'); // Position above box (box top is at y=2, text baseline at y=3.5)
    text.setAttribute('scale', '4 4 4'); // Larger scale for readability
    entity.appendChild(text);
    
    scene.appendChild(entity);
    
    poiEntities[loc.id] = {
      el: entity,
      location: loc
    };
    
    console.log(`[createPOIs] Created marker for ${loc.name} at lat=${loc.lat}, lng=${loc.lng}`);
  }

  console.log('[createPOIs] Done creating POI markers');
}

// GPS update handler - called when locar-camera gets GPS data
function onGPSUpdate(e) {
  const rawLat = e.detail.position.coords.latitude;
  const rawLng = e.detail.position.coords.longitude;

  // Ignore default 0,0 location
  if (rawLat === 0 && rawLng === 0) {
    return;
  }

  // Apply smoothing
  const { lat, lng } = addGPSPosition(rawLat, rawLng);
  
  console.log(`[GPS] Raw: ${rawLat.toFixed(6)},${rawLng.toFixed(6)} | Smoothed: ${lat.toFixed(6)},${lng.toFixed(6)}`);

  if (firstLocation) {
    firstLocation = false;
    
    // Hide loading screen
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    // Create POI markers when we get valid GPS
    createPOIs();
  }
}

// Mock GPS handler for desktop testing - injects fake GPS updates periodically
function setupMockGPS() {
  const mockLocation = window.mockGPSLocation;
  if (!mockLocation) return;

  console.log('[Mock GPS] Setting up mock location:', mockLocation);

  // Emit a single gpsupdate event with the mock location
  const event = new CustomEvent('gpsupdate', {
    detail: {
      position: {
        coords: {
          latitude: mockLocation.lat,
          longitude: mockLocation.lng,
          accuracy: 10
        }
      }
    }
  });

  locarCamera.dispatchEvent(event);

  // Also emit periodic updates to simulate GPS jitter and smoothing
  setInterval(() => {
    const lat = mockLocation.lat + (Math.random() - 0.5) * 0.00001;
    const lng = mockLocation.lng + (Math.random() - 0.5) * 0.00001;

    const event = new CustomEvent('gpsupdate', {
      detail: {
        position: {
          coords: {
            latitude: lat,
            longitude: lng,
            accuracy: 10
          }
        }
      }
    });

    locarCamera.dispatchEvent(event);
  }, 1000);

  // Mark as first location so POIs get created
  if (firstLocation) {
    firstLocation = false;
    if (loadingEl) loadingEl.style.display = 'none';
    createPOIs();
  }
}

async function updateVersionDisplay() {
  try {
    const response = await fetch('/version.json');
    if (response.ok) {
      const info = await response.json();
      const versionEl = document.getElementById('version-display');
      if (versionEl) {
        versionEl.textContent = `v${info.version} (${info.branchName || 'prod'})`;
      }
    }
  } catch (e) {
    console.log('[updateVersionDisplay] Could not load version info');
  }
}

async function init() {
  try {
    await updateVersionDisplay();

    // Check for mock GPS before fetching locations
    if (window.mockGPSLocation) {
      console.log('[Mock GPS] Detected - will use mock location');
    }

    const response = await fetch(LOCATIONS_URL);
    if (response.ok) {
      locations = await response.json();
    } else {
      // Fallback data for testing
      locations = [
        { id: "building-a", name: "HC", lat: 48.764939, lng: -122.510277 },
        { id: "building-b", name: "CS", lat: 48.765179, lng: -122.509049 },
        { id: "building-c", name: "CC", lat: 48.765620, lng: -122.510458 }
      ];
    }

    console.log(`[init] Loaded ${locations.length} locations`);

    // Show loading while waiting for GPS
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    // Check for mock GPS first - if present, use it instead of real GPS
    if (window.mockGPSLocation) {
      setupMockGPS();
    } else {
      // Listen for real GPS updates on locar-camera
      locarCamera.addEventListener('gpsupdate', onGPSUpdate);
      console.log('[init] Listening for real GPS updates...');
    }

  } catch (error) {
    console.error('[init] Initialization error:', error);
    
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    alert(`Failed to initialize AR: ${error.message}`);
  }
}

// Expose for global use
window.initARApp = init;
export { init as initARApp };
