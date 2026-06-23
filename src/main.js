// AR Campus Wayfinder v2 - Main Application Logic (A-Frame Version)
// This file is loaded via import in index.html

import { App } from 'locar';
import 'aframe';
import 'aframe-look-at-component';
import 'locar-aframe';

const THREE = window.THREE;
const LOCATIONS_URL = './locations.json';

let locations = [];
let currentLocAR;
let poiEntities = {};
let firstLocation = true;

const locarCamera = document.querySelector('[locar-camera]');
const scene = document.querySelector('a-scene');

async function initGPS() {
  console.log('[initGPS] Starting GPS initialization...');

  const app = new App({
    cameraOptions: { hFov: 80, near: 0.1, far: 1000 }
  });

  try {
    currentLocAR = await app.start();

    // Establish world origin with fake GPS
    if (locations.length > 0) {
      const [originLocation] = locations;
      currentLocAR.fakeGps(originLocation.lng, originLocation.lat, 0, 10);
    }

    await currentLocAR.startGps();


    // Listen for first GPS update to initialize panel
    const onFirstGPSUpdate = (data) => {
      currentLocAR.off('gpsupdate', onFirstGPSUpdate);

      // Create boxes for each location when GPS is first received
      if (firstLocation && locations.length > 0) {
        const gps = currentLocAR.gps;
        if (gps && gps.latitude !== 0 && gps.longitude !== 0) {
          console.log(`[GPS] Got initial location: latitude ${gps.latitude}, longitude ${gps.longitude}`);

          // Create boxes for each location
          const colors = [0xff0000, 0xffff00, 0x00ffff, 0x00ff00, 0xff00ff, 0x0000ff];
          locations.forEach((loc, index) => {
            const box = document.createElement('a-box');
            box.setAttribute('locar-entity-place', {
              latitude: loc.lat,
              longitude: loc.lng
            });
            box.setAttribute('material', {
              color: colors[index % colors.length]
            });
            box.setAttribute('scale', {
              x: 10,
              y: 10,
              z: 10
            });
            box.setAttribute('data-location-id', loc.id);
            scene.appendChild(box);

            poiEntities[loc.id] = {
              el: box,
              location: loc
            };

            console.log(`[createPOIs] Created box for ${loc.name} at ${loc.lat}, ${loc.lng}`);
          });

          firstLocation = false;
        }
      }
    };

    currentLocAR.on('gpsupdate', onFirstGPSUpdate);
    return app;
  } catch (error) {
    console.error('GPS initialization error:', error);
    throw error;
  }
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');

  input.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();

    if (!query) {
      filteredLocationId = null;
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('open');

      Object.keys(poiEntities).forEach(id => {
        if (poiEntities[id] && poiEntities[id].el) {
          poiEntities[id].el.setAttribute('visible', 'true');
        }
      });
      return;
    }

    const matches = locations.filter(l =>
      l.name.toLowerCase().includes(query)
    );

    resultsContainer.innerHTML = '';

    if (matches.length > 0) {
      resultsContainer.classList.add('open');

      matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.innerHTML = `
          <strong>${match.name}</strong>
          ${match.description ? `<span>${match.description.substring(0, 60)}...</span>` : ''}
        `;

        item.addEventListener('click', () => {
          selectLocation(match.id);
        });

        resultsContainer.appendChild(item);
      });
    } else {
      resultsContainer.classList.remove('open');
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target)) {
      resultsContainer.classList.remove('open');
    }
  });
}

function selectLocation(id) {
  filteredLocationId = id;

  Object.keys(poiEntities).forEach(key => {
    const poiEntry = poiEntities[key];
    if (poiEntry && poiEntry.el) {
      // Use A-Frame's setAttribute for visibility
      const visibleState = (key === id);
      poiEntry.el.setAttribute('visible', visibleState.toString());

      // Also set children visibility recursively
      if (poiEntry.el.object3DMap) {
        Object.values(poiEntry.el.object3DMap).forEach(obj => {
          obj.traverse(child => {
            child.visible = visibleState;
          });
        });
      }
    }
  });

  const loc = locations.find(l => l.id === id);
  if (loc) {
    document.getElementById('card-title').textContent = loc.name;

    const descEl = document.getElementById('card-description');
    if (loc.description) {
      descEl.textContent = loc.description;
      descEl.style.display = 'block';
    } else {
      descEl.style.display = 'none';
    }

    document.getElementById('location-card').classList.add('visible');
  }

  document.getElementById('search-input').value = '';
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
    console.log('Could not load version info');
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
        {
          "id": "R",
          "name": "Revels",
          "lat": 48.711359,
          "lng": -122.489252,
          "description": "R",
          "icon": null
        },
        {
          "id": "S",
          "name": "S & S",
          "lat": 48.711321,
          "lng": -122.488509,
          "description": "S",
          "icon": null
        },
        {
          "id": "M",
          "name": "M & M",
          "lat": 48.711314,
          "lng": -122.487736,
          "description": "M",
          "icon": null
        }
      ];
    }

    await initGPS();

    setupSearch();

    console.log('AR Wayfinder v2 (A-Frame) initialized successfully');

  } catch (error) {
    console.error('Initialization error:', error);
    alert(`Failed to initialize AR: ${error.message}`);
  }
}

// Expose for global use and ES modules
window.initARApp = init;
export { init as initARApp };
