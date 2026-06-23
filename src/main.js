// AR Campus Wayfinder v2 - Main Application Logic (Simplified A-Frame Version)
// Uses direct locar-camera gpsupdate events as per locar-aframe examples

import 'locar-aframe';

const THREE = window.THREE;
const LOCATIONS_BASE_URL = './locations';
const LOCATIONS_EXT = '.json';

let locations = [];
let firstLocation = true;

// Get DOM elements
const locarCamera = document.querySelector('[locar-camera]');
const scene = document.querySelector('a-scene');
const loadingEl = document.getElementById('loading');
const locationSelectEl = document.getElementById('location-select');

// Store POI entities
const poiEntities = {};
let currentLocationsFile = 'south'; // Default

// Available location files
const LOCATION_FILES = {
  south: { name: 'South Campus', url: LOCATIONS_BASE_URL + '-south' + LOCATIONS_EXT },
  btc: { name: 'BTC', url: LOCATIONS_BASE_URL + '-btc' + LOCATIONS_EXT }
};

function createPOIs() {
  console.log('[createPOIs] Creating POI markers...');

  if (!scene || locations.length === 0) {
    return;
  }

  // Remove existing POIs first
  Object.values(poiEntities).forEach(entityObj => {
    if (entityObj.el && entityObj.el.parentNode) {
      scene.removeChild(entityObj.el);
    }
  });
  poiEntities.length = 0;

  const colors = [0xff0000, 0xffff00, 0x00ffff, 0x00ff00, 0xff00ff, 0x0000ff];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    
    // Create an entity with locar-entity-place component
    const entity = document.createElement('a-entity');
    entity.setAttribute('locar-entity-place', {
      latitude: loc.lat,
      longitude: loc.lng
    });
    
    // Add visual marker - smaller box for visibility
    const box = document.createElement('a-box');
    box.setAttribute('material', {
      color: colors[i % colors.length],
      opacity: 0.75
    });
    box.setAttribute('position', '0 0.5 0'); // Box sits on ground, half-height up
    box.setAttribute('scale', '2 1 2');
    
    entity.appendChild(box);
    
    // Add name text above the marker - A-Frame text defaults to facing negative Z (up)
    const text = document.createElement('a-text');
    text.setAttribute('value', loc.name);
    text.setAttribute('color', '#000');
    text.setAttribute('anchor', 'center');
    text.setAttribute('baseline', 'middle');
    text.setAttribute('position', '0 1.8 0'); // Position above box
    text.setAttribute('scale', '2 2 2');
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

function clearPOIs() {
  Object.values(poiEntities).forEach(entityObj => {
    if (entityObj.el && entityObj.el.parentNode) {
      scene.removeChild(entityObj.el);
    }
  });
  poiEntities.length = 0;
}

// GPS update handler - called when locar-camera gets GPS data
function onGPSUpdate(e) {
  const lat = e.detail.position.coords.latitude;
  const lng = e.detail.position.coords.longitude;

  // Ignore default 0,0 location
  if (lat === 0 && lng === 0) {
    return;
  }

  console.log(`[GPS] Got location: lat=${lat}, lng=${lng}`);

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

async function loadLocations(fileKey) {
  const fileConfig = LOCATION_FILES[fileKey];
  if (!fileConfig) {
    console.error(`[loadLocations] Unknown location file: ${fileKey}`);
    return false;
  }

  try {
    console.log(`[loadLocations] Loading locations from: ${fileConfig.url}`);
    const response = await fetch(fileConfig.url);
    
    if (response.ok) {
      locations = await response.json();
      currentLocationsFile = fileKey;
      console.log(`[loadLocations] Loaded ${locations.length} locations from ${fileConfig.name}`);
      return true;
    } else {
      console.error(`[loadLocations] Failed to load: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('[loadLocations] Error:', error);
    // Fallback data for testing
    if (fileKey === 'btc') {
      locations = [
        { id: "building-a", name: "HC", lat: 48.764939, lng: -122.510277 },
        { id: "building-b", name: "CS", lat: 48.765179, lng: -122.509049 },
        { id: "building-c", name: "CC", lat: 48.765620, lng: -122.510458 }
      ];
    } else {
      locations = [
        { id: "R", name: "Revels", lat: 48.711359, lng: -122.489252 },
        { id: "S", name: "S & S", lat: 48.711321, lng: -122.488509 },
        { id: "M", name: "M & M", lat: 48.711314, lng: -122.487736 }
      ];
    }
    return true;
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

    // Load default locations
    const locationSelectEl = document.getElementById('location-select');
    const initialSelection = locationSelectEl ? locationSelectEl.value : 'south';
    
    console.log(`[init] Initial location selection: ${initialSelection}`);
    await loadLocations(initialSelection);

    // Show loading while waiting for GPS
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    // Listen for GPS updates directly on locar-camera
    locarCamera.addEventListener('gpsupdate', onGPSUpdate);

    console.log('[init] Listening for GPS updates...');

  } catch (error) {
    console.error('[init] Initialization error:', error);
    
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    alert(`Failed to initialize AR: ${error.message}`);
  }
}

// Handle location selection change
function handleLocationChange(event) {
  const newSelection = event.target.value;
  console.log(`[handleLocationChange] Switching from '${currentLocationsFile}' to '${newSelection}'`);
  
  // Clear existing POIs before loading new ones
  clearPOIs();
  
  // Show loading while switching
  if (loadingEl) {
    loadingEl.style.display = 'flex';
    loadingEl.querySelector('.loading-text').textContent = `Switching to ${LOCATION_FILES[newSelection].name}...`;
  }
  
  loadLocations(newSelection).then(success => {
    firstLocation = true; // Reset so POIs will be created on next GPS update
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    console.log(`[handleLocationChange] Switched to ${newSelection}, waiting for GPS...`);
  });
}

// Setup location select change listener when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const selectEl = document.getElementById('location-select');
  if (selectEl) {
    selectEl.addEventListener('change', handleLocationChange);
    console.log('[DOM] Location selector change listener attached');
  }
});

// Expose for global use
window.initARApp = init;
export { init as initARApp, loadLocations };
