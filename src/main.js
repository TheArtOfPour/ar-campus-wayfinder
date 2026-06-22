// AR Campus Wayfinder v2 - Main Application Logic (A-Frame Version)
// This file is loaded via import in index.html

import { App } from 'locar';
import 'locar-aframe';

const THREE = window.THREE;
const LOCATIONS_URL = './locations.json';

let locations = [];
let currentLocAR;
let poiEntities = {};
let filteredLocationId = null;

// Helper to calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDistance(km) {
  if (km < 0.5) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${(Math.round(km * 10) / 10).toFixed(1)} km`;
  return `${km.toFixed(1)} km`;
}

// Update distances for all POIs
function updateDistances() {
  if (!currentLocAR || locations.length === 0) return;

  const gpsData = currentLocAR.gps;
  if (!gpsData || !gpsData.latitude || !gpsData.longitude) return;

  // Find entities with poi-marker component and update their distance display
  document.querySelectorAll('[poi-marker]').forEach(el => {
    const entityEl = el;
    const locationId = entityEl.getAttribute('data-location-id');
    
    if (locationId) {
      const loc = locations.find(l => l.id === locationId);
      if (loc) {
        const dist = calculateDistance(
          gpsData.latitude, gpsData.longitude,
          loc.lat, loc.lng
        );
        
        // Find the distance text entity within this marker's children
        entityEl.querySelectorAll('[text]').forEach(textEl => {
          if (textEl.getAttribute('value') && !textEl.hasAttribute('billboard-text')) {
            // This is a distance display (not name), update it
            textEl.setAttribute('text', 'value', formatDistance(dist));
          }
        });
      }
    }
  });
}

setInterval(updateDistances, 5000);

async function initGPS() {
  const app = new App({
    cameraOptions: { hFov: 80, near: 0.1, far: 1000 }
  });

  try {
    currentLocAR = await app.start();
    
    // Establish world origin with fake GPS
    if (locations.length > 0) {
      const [firstLocation] = locations;
      currentLocAR.fakeGps(firstLocation.lng, firstLocation.lat, 0, 10);
    }
    
    await currentLocAR.startGps();

    currentLocAR.on('gpsupdate', (data) => {
      if (data.heading !== null && !isNaN(data.heading)) {
        const needle = document.getElementById('compass-needle');
        if (needle) {
          needle.style.transform = `translate(-50%, -50%) rotate(${360 - data.heading}deg)`;
        }
      }
    });

    return app;
  } catch (error) {
    console.error('GPS initialization error:', error);
    throw error;
  }
}

function createPOIs() {
  const container = document.getElementById('poi-container');
  
  if (!currentLocAR || !THREE) return;

  for (const loc of locations) {
    // Create A-Frame entity with poi-marker component
    const markerEl = document.createElement('a-entity');
    
    // Set attributes on the A-Frame element
    markerEl.setAttribute('poi-marker', `lat: ${loc.lat}; lng: ${loc.lng}; name: "${loc.name}"`);
    markerEl.setAttribute('data-location-id', loc.id);
    
    container.appendChild(markerEl);
    
    poiEntities[loc.id] = {
      el: markerEl,
      location: loc
    };
  }

  console.log(`Created ${locations.length} POI entities using A-Frame components`);
}

function getHoveredPOI() {
  const camera = document.getElementById('cameraRig').object3D;
  const raycaster = new THREE.Raycaster();
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  const pois = Object.values(poiEntities).filter(p => p && p.el && p.el.visible !== false);
  if (pois.length === 0) return null;
  
  // Get all marker meshes
  const intersectedMeshes = [];
  pois.forEach(p => {
    if (p.el.object3DMap) {
      Object.values(p.el.object3DMap).forEach(obj => {
        obj.traverse(child => { if (child.isMesh) intersectedMeshes.push(child); });
      });
    }
  });
  
  const intersects = raycaster.intersectObjects(intersectedMeshes);
  if (intersects.length > 0 && intersects[0].distance < 8) {
    for (const poi of pois) {
      if (poi.el.object3DMap) {
        const markerObj = Object.values(poi.el.object3DMap)[0];
        if (markerObj === intersects[0].object || 
            markerObj.children.includes(intersects[0].object)) {
          return poi;
        }
      }
    }
  }
  
  return null;
}

function updateArrowIndicator() {
  const camera = document.getElementById('cameraRig').object3D;
  
  if (filteredLocationId && poiEntities[filteredLocationId]) {
    const targetPOI = poiEntities[filteredLocationId];
    if (!targetPOI.location) return;

    // Calculate bearing from current GPS position to target POI
    const gpsData = currentLocAR.gps;
    if (!gpsData || !gpsData.latitude || !gpsData.longitude) return;

    const loc = targetPOI.location;
    
    // Calculate bearing using haversine formula
    const dLat = (loc.lat - gpsData.latitude) * Math.PI / 180;
    const dLon = (loc.lng - gpsData.longitude) * Math.PI / 180;
    const lat1 = gpsData.latitude * Math.PI / 180;
    const lat2 = loc.lat * Math.PI / 180;
    
    let bearing = Math.atan2(
      Math.sin(dLon) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) - 
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    ) * 180 / Math.PI;

    // Convert to compass bearing (0-360 degrees)
    bearing = (bearing + 360) % 360;

    // Get camera's yaw rotation
    const yaw = (camera.rotation.y * 180 / Math.PI + 360) % 360;
    
    // Arrow should point toward the target relative to where camera is facing
    let arrowRotation = bearing - yaw;
    if (arrowRotation < -180) arrowRotation += 360;
    else if (arrowRotation > 180) arrowRotation -= 360;

    const arrowEl = document.getElementById('arrow-indicator');
    arrowEl.setAttribute('rotation', `0 ${-arrowRotation} 0`);
    arrowEl.setAttribute('visible', 'true');

    // Calculate distance to determine when to show/hide
    const dist = calculateDistance(gpsData.latitude, gpsData.longitude, loc.lat, loc.lng);

    // Hide if close enough to the target (within ~2 meters)
    arrowEl.setAttribute('visible', dist > 1.5);
  } else {
    document.getElementById('arrow-indicator').setAttribute('visible', 'false');
  }
}

function updateHoverUI(hoveredPOI) {
  const card = document.getElementById('location-card');
  
  if (hoveredPOI && hoveredPOI.location) {
    const loc = hoveredPOI.location;
    
    document.getElementById('card-title').textContent = loc.name;
    
    const distanceEl = document.getElementById('card-distance');
    const descEl = document.getElementById('card-description');

    if (filteredLocationId === loc.id) {
      distanceEl.textContent = 'Selected location';
      if (loc.description) {
        descEl.textContent = loc.description;
        descEl.style.display = 'block';
      } else {
        descEl.style.display = 'none';
      }
    } else {
      const gpsData = currentLocAR?.gps;
      if (gpsData) {
        const dist = calculateDistance(
          gpsData.latitude, gpsData.longitude,
          loc.lat, loc.lng
        );
        distanceEl.textContent = formatDistance(dist);
      }
      
      descEl.style.display = 'none';
    }

    const iconEl = document.getElementById('card-icon');
    if (loc.icon) {
      iconEl.className = 'location-icon custom';
      iconEl.style.backgroundImage = `url(${loc.icon})`;
    } else {
      iconEl.className = 'location-icon';
      iconEl.textContent = '📍';
    }

    card.classList.add('visible');
  } else if (!filteredLocationId) {
    card.classList.remove('visible');
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
    updateDistances();
    
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
        { id: "R", name: "Revels Hall", lat: 48.711359, lng: -122.489252 },
        { id: "S", name: "Student Union", lat: 48.711321, lng: -122.488509 },
        { id: "M", name: "Main Building", lat: 48.711314, lng: -122.487736 }
      ];
    }

    await initGPS();
    createPOIs();
    setupSearch();
    updateDistances();

    console.log('AR Wayfinder v2 (A-Frame) initialized successfully');

  } catch (error) {
    console.error('Initialization error:', error);
    alert(`Failed to initialize AR: ${error.message}`);
  }
}

// Expose for global use and ES modules
window.initARApp = init;
export { init as initARApp };
