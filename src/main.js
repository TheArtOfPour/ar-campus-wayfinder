// AR Campus Wayfinder v2 - Main Application Logic
// This file is loaded via import in index.html

import { App } from 'locar';

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
  if (km < 10) return `${(km * 10).toFixed(1) / 10} km`;
  return `${km.toFixed(1)} km`;
}

// Create teardrop marker geometry
function createTeardropGeometry(color = '#667eea', customIconUrl = null) {
  const group = new THREE.Group();

  if (customIconUrl) {
    const texture = new THREE.TextureLoader().load(customIconUrl);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.5, 2, 1);
    group.add(sprite);
  } else {
    // Create teardrop using path
    const path = new THREE.Shape();
    path.moveTo(0, -1);
    path.bezierCurveTo(-1.2, -1, -1.5, 0.8, 0, 2);
    path.bezierCurveTo(1.5, 0.8, 1.2, -1, 0, -1);

    const extrudeSettings = {
      steps: 2,
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.3,
      bevelSegments: 4
    };

    const geometry = new THREE.ExtrudeGeometry(path, extrudeSettings);
    geometry.center();

    const material = new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.3,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // White border for visibility
    const borderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      side: THREE.BackSide
    });
    const borderMesh = new THREE.Mesh(geometry.clone(), borderMaterial);
    borderMesh.scale.set(1.05, 1.05, 1.05);
    group.add(borderMesh);

    // Arrow indicator on top
    const arrowGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.y = 1;
    group.add(arrow);
  }

  return group;
}

function updateDistances() {
  if (!currentLocAR || locations.length === 0) return;

  const gpsData = currentLocAR.gps;
  if (!gpsData || !gpsData.latitude || !gpsData.longitude) return;

  Object.keys(poiEntities).forEach(id => {
    const poiEntity = poiEntities[id];
    if (poiEntity && poiEntity.location) {
      const loc = poiEntity.location;
      const distance = calculateDistance(
        gpsData.latitude, gpsData.longitude,
        loc.lat, loc.lng
      );
      
      if (poiEntity.distanceTextEntity) {
        poiEntity.distanceTextEntity.setAttribute('text', 'value', formatDistance(distance));
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
    // Create POI marker - locar.add() will add it to the scene automatically
    const markerGroup = createTeardropMarker(loc.lat, loc.lng, loc.name, loc.description, loc.icon);

    poiEntities[loc.id] = markerGroup;
    markerGroup.location = loc;

    // Distance text entity (added as child of marker group)
    const distanceTextEntity = document.createElement('a-text');
    distanceTextEntity.setAttribute('position', '0 -2 0');
    distanceTextEntity.setAttribute('color', '#ffffff');
    distanceTextEntity.setAttribute('align', 'center');
    distanceTextEntity.setAttribute('width', '4');
    markerGroup.appendChild(distanceTextEntity);

    poiEntities[loc.id].distanceTextEntity = distanceTextEntity;
  }

  console.log(`Created ${locations.length} POI entities`);
}

function createTeardropMarker(lat, lng, name, description, customIconUrl) {
  const group = new THREE.Group();
  
  // Create the marker geometry first
  const markerGeometry = createTeardropGeometry('#667eea', customIconUrl);
  group.add(markerGeometry);

  // Add to LocAR which will position it at GPS coordinates
  currentLocAR.add(group, lng, lat);

  return group;
}

function getHoveredPOI() {
  const camera = document.getElementById('cameraRig').object3D;
  const raycaster = new THREE.Raycaster();
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  const pois = Object.values(poiEntities).filter(p => p && p.visible !== false);
  if (pois.length === 0) return null;

  const intersectedMeshes = [];
  pois.forEach(p => {
    p.traverse(child => { if (child.isMesh) intersectedMeshes.push(child); });
  });

  const intersects = raycaster.intersectObjects(intersectedMeshes);

  if (intersects.length > 0 && intersects[0].distance < 8) {
    for (const poi of pois) {
      if (poi === intersects[0].object || 
          poi.children.includes(intersects[0].object)) {
        return poi;
      }
    }
  }
  
  return null;
}

function updateArrowIndicator() {
  const camera = document.getElementById('cameraRig').object3D;
  const cameraRotationY = camera.rotation.y;

  if (filteredLocationId && poiEntities[filteredLocationId]) {
    const targetPOI = poiEntities[filteredLocationId];
    const targetPos = new THREE.Vector3();
    targetPOI.getWorldPosition(targetPos);

    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const dx = targetPos.x - cameraPos.x;
    const dz = targetPos.z - cameraPos.z;
    let angle = Math.atan2(dx, dz);
    
    let arrowRotation = (angle * 180 / Math.PI) - (cameraRotationY * 180 / Math.PI);
    arrowRotation = ((arrowRotation % 360) + 360) % 360;

    const arrowEl = document.getElementById('arrow-indicator');
    arrowEl.setAttribute('rotation', `0 ${arrowRotation} 0`);
    
    const dist = calculateDistance(
      currentLocAR.gps.latitude,
      currentLocAR.gps.longitude,
      poiEntities[filteredLocationId].location.lat,
      poiEntities[filteredLocationId].location.lng
    );

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
        if (poiEntities[id]) poiEntities[id].visible = true;
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
    const poig = poiEntities[key];
    if (poig && poig.children) {
      poig.visible = (key === id);
      poig.children.forEach(child => {
        child.visible = (key === id);
      });
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

    console.log('AR Wayfinder v2 initialized successfully');

  } catch (error) {
    console.error('Initialization error:', error);
    alert(`Failed to initialize AR: ${error.message}`);
  }
}

// Expose for global use
window.initARApp = init;
