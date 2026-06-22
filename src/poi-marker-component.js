// Custom A-Frame component for POI markers with billboarded text labels
// Usage: <a-entity poi-marker="lat: 48.711; lng: -122.49; name: 'Building Name'"></a-entity>

import 'locar-aframe';

AFRAME.registerComponent('poi-marker', {
  schema: {
    lat: { type: 'number', default: 0 },
    lng: { type: 'number', default: 0 },
    name: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    icon: { type: 'src', default: null }
  },

  init() {
    // Create the marker container that LocAR will position
    this.el.setAttribute('locar-entity-place', {
      latitude: this.data.lat,
      longitude: this.data.lng
    });

    // Build the marker hierarchy
    this.buildMarker();
  },

  buildMarker() {
    const el = this.el;
    
    // Clear any existing children
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }

    // 1. Teardrop marker body (stretched sphere)
    const teardropBody = document.createElement('a-entity');
    teardropBody.setAttribute('geometry', 'primitive: sphere; radius: 0.75; segment-width: 24; segment-height: 16');
    teardropBody.setAttribute('material', 'color: #667eea; opacity: 0.95');
    teardropBody.setAttribute('scale', '1 2 1'); // Stretch vertically to make teardrop shape
    el.appendChild(teardropBody);

    // 2. White border (back-face culling to show only from outside)
    const border = document.createElement('a-entity');
    border.setAttribute('geometry', 'primitive: sphere; radius: 0.8; segment-width: 24; segment-height: 16');
    border.setAttribute('material', 'color: #ffffff; side: back');
    border.setAttribute('scale', '1 2 1');
    el.appendChild(border);

    // 3. Top pointed tip
    const tip = document.createElement('a-entity');
    tip.setAttribute('geometry', 'primitive: cone; radius: 0.35; height: 1; segments: 8');
    tip.setAttribute('material', 'color: #667eea');
    tip.setAttribute('position', '0 2.4 0'); // Positioned at top of teardrop
    el.appendChild(tip);

    // 4. Text label container (billboarded to face camera)
    const textContainer = document.createElement('a-entity');
    
    // Backplane for contrast (white rectangle behind text)
    const backplane = document.createElement('a-plane');
    backplane.setAttribute('width', '3.5');
    backplane.setAttribute('height', '0.8');
    backplane.setAttribute('color', '#ffffff');
    backplane.setAttribute('position', '0 3.4 0');
    
    // Text label
    const labelText = document.createElement('a-text');
    labelText.setAttribute('value', this.data.name);
    labelText.setAttribute('align', 'center');
    labelText.setAttribute('color', '#000000');
    labelText.setAttribute('width', '3');
    labelText.setAttribute('position', '0 3.4 0.02'); // Slightly in front of backplane
    
    textContainer.appendChild(backplane);
    textContainer.appendChild(labelText);
    
    // Make the whole container billboarded to face camera
    textContainer.setAttribute('look-at', '[camera]');
    
    el.appendChild(textContainer);

    // Store distance text entity for updates
    this.distanceEntity = labelText;
  },

  updateDistance(km) {
    if (!this.distanceEntity) return;
    
    let distanceText;
    if (km < 0.5) {
      distanceText = `${Math.round(km * 1000)} m`;
    } else if (km < 10) {
      distanceText = `${(Math.round(km * 10) / 10).toFixed(1)} km`;
    } else {
      distanceText = `${km.toFixed(1)} km`;
    }
    
    this.distanceEntity.setAttribute('text', 'value', distanceText);
  },

  remove() {
    // Cleanup if needed
  }
});
