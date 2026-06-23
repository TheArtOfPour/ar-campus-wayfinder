// AR Campus Wayfinder v2 - Main Application Logic (Simplified A-Frame Version)
// Uses direct locar-camera gpsupdate events as per locar-aframe examples

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
    
    // Add visual marker - smaller box for visibility
    const box = document.createElement('a-box');
    box.setAttribute('material', {
      color: colors[i % colors.length],
      opacity: 0.75
    });
    box.setAttribute('position', '0 1 0');
    box.setAttribute('scale', '2 2 2'); // Smaller, visible boxes
    
    entity.appendChild(box);
    
    // Add name text above the marker
    const text = document.createElement('a-text');
    text.setAttribute('value', loc.name);
    text.setAttribute('color', '#000');
    // text.setAttribute('width', 4);
    text.setAttribute('position', '0 2 0');
    text.setAttribute('scale', '10 10 10'); 
    // Billboard effect: text always faces camera
    text.setAttribute('look-at', '[locar-camera]');
    entity.appendChild(text);
    
    scene.appendChild(entity);
    
    poiEntities[loc.id] = {
      el: entity,
      location: loc
    };    
  }
}

// GPS update handler - called when locar-camera gets GPS data
function onGPSUpdate(e) {
  
  const lat = e.detail.position.coords.latitude;
  const lng = e.detail.position.coords.longitude;

  // Ignore default 0,0 location
  if (lat === 0 && lng === 0) {
    return;
  }

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

    const response = await fetch(LOCATIONS_URL);
    if (response.ok) {
      locations = await response.json();
    } else {
      // Fallback data for testing
      locations = [
        { id: "R", name: "Revels", lat: 48.711359, lng: -122.489252 },
        { id: "S", name: "S & S", lat: 48.711321, lng: -122.488509 },
        { id: "M", name: "M & M", lat: 48.711314, lng: -122.487736 }
      ];
    }

    console.log(`[init] Loaded ${locations.length} locations`);

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

// Expose for global use
window.initARApp = init;
export { init as initARApp };
