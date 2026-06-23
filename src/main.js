// AR Campus Wayfinder v2 - Main Application Logic (Simplified A-Frame Version)
// Uses locarCamera.addEventListener('gpsupdate') pattern from locar-aframe examples

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

async function initGPS() {
  console.log('[initGPS] Starting GPS initialization...');

  try {
    // Start the LocAR app
    const App = (await import('locar')).App;
    const app = new App({
      cameraOptions: { hFov: 80, near: 0.1, far: 1000 }
    });

    await app.start();
    console.log('[initGPS] LocAR app started');

    // Don't fake GPS - just start the real GPS
    await app.startGps();
    console.log('[initGPS] GPS started');

    // Show loading message while waiting for GPS signal
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    // Listen for GPS updates using addEventListener pattern
    const onGPSUpdate = (e) => {
      console.log('[gpsupdate] Event received');
      
      // Check if we have valid GPS data (not 0,0)
      const lat = e.detail.position.coords.latitude;
      const lng = e.detail.position.coords.longitude;

      if (lat !== 0 && lng !== 0 && firstLocation) {
        console.log(`[GPS] Got initial location: lat ${lat}, lng ${lng}`);
        firstLocation = false;
        
        // Hide loading screen
        if (loadingEl) {
          loadingEl.style.display = 'none';
        }
        
        // Remove listener to avoid duplicates
        locarCamera.removeEventListener('gpsupdate', onGPSUpdate);
        
        // Create POI markers
        createPOIs();
      }
    };

    locarCamera.addEventListener('gpsupdate', onGPSUpdate);

    return app;
  } catch (error) {
    console.error('[initGPS] Error:', error);
    throw error;
  }
}

function createPOIs() {
  console.log('[createPOIs] Creating POI markers...');

  if (!locarCamera || !scene || locations.length === 0) {
    return;
  }

  const colors = [0xff0000, 0xffff00, 0x00ffff, 0x00ff00, 0xff00ff, 0x0000ff];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    
    // Create a box for each location
    const entity = document.createElement('a-entity');
    
    // Use composite component pattern with locar-entity-place
    entity.setAttribute('locar-entity-place', {
      latitude: loc.lat,
      longitude: loc.lng
    });
    
    // Add visual marker - smaller box for visibility
    const box = document.createElement('a-box');
    box.setAttribute('material', {
      color: colors[i % colors.length],
      opacity: 0.9
    });
    box.setAttribute('scale', '3 6 3'); // Smaller, visible boxes
    
    entity.appendChild(box);
    
    // Add name text above the marker
    const text = document.createElement('a-text');
    text.setAttribute('value', loc.name);
    text.setAttribute('color', '#000');
    text.setAttribute('width', 4);
    text.setAttribute('position', '0 3.5 0');
    entity.appendChild(text);
    
    scene.appendChild(entity);
    
    poiEntities[loc.id] = {
      el: entity,
      location: loc
    };
    
    console.log(`[createPOIs] Created marker for ${loc.name} at ${loc.lat}, ${loc.lng}`);
  }

  console.log('[createPOIs] Done creating POI markers');
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

    await initGPS();

    console.log('[init] AR Wayfinder initialized successfully');
  } catch (error) {
    console.error('[init] Initialization error:', error);
    
    // Hide loading screen on error
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    alert(`Failed to initialize AR: ${error.message}`);
  }
}

// Expose for global use
window.initARApp = init;
export { init as initARApp };
