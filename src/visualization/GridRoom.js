import * as THREE from 'https://unpkg.com/three@0.182.0/build/three.module.js';

/**
 * GridRoom - Erstellt einen Linien-Gitter-Raum wie im WiiDesktopVR Original
 * 
 * Der Raum besteht aus:
 * - Rückwand (Grid)
 * - Linke und rechte Seitenwand (Grids)
 * - Boden und Decke (Grids)
 * - Optional: Fog für Tiefeneffekt
 */
export class GridRoom {
  /**
   * @param {Object} config - Raum-Konfiguration
   * @param {number} config.width - Breite (entspricht Bildschirmbreite)
   * @param {number} config.height - Höhe (entspricht Bildschirmhöhe)
   * @param {number} config.depth - Tiefe des Raums (nach hinten)
   * @param {number} [config.gridLines=10] - Anzahl Gitterlinien
   * @param {number} [config.gridColor=0xcccccc] - Farbe der Gitterlinien
   * @param {number} [config.frontDepth=0] - Wie weit der Raum vor den Bildschirm ragt
   */
  constructor(config = {}) {
    this.width = config.width ?? 1;
    this.height = config.height ?? 1;
    this.depth = config.depth ?? 2;
    this.gridLines = config.gridLines ?? 10;
    this.gridColor = config.gridColor ?? 0xcccccc;
    this.frontDepth = config.frontDepth ?? 0;

    this.group = new THREE.Group();
    this.group.name = 'GridRoom';

    this._buildRoom();
  }

  _buildRoom() {
    const { width, height, depth, gridLines, gridColor, frontDepth } = this;
    
    const hw = width / 2;
    const hh = height / 2;
    const material = new THREE.LineBasicMaterial({ color: gridColor });

    // Rückwand (bei z = -depth)
    this.group.add(this._createWallGrid(
      new THREE.Vector3(-hw, -hh, -depth),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      width, height, gridLines, material
    ));

    // Linke Wand
    this.group.add(this._createWallGrid(
      new THREE.Vector3(-hw, -hh, frontDepth),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 1, 0),
      depth + frontDepth, height, gridLines, material
    ));

    // Rechte Wand
    this.group.add(this._createWallGrid(
      new THREE.Vector3(hw, -hh, frontDepth),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 1, 0),
      depth + frontDepth, height, gridLines, material
    ));

    // Boden
    this.group.add(this._createWallGrid(
      new THREE.Vector3(-hw, -hh, frontDepth),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1),
      width, depth + frontDepth, gridLines, material
    ));

    // Decke
    this.group.add(this._createWallGrid(
      new THREE.Vector3(-hw, hh, frontDepth),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1),
      width, depth + frontDepth, gridLines, material
    ));
  }

  _createWallGrid(origin, rightDir, upDir, width, height, lines, material) {
    const points = [];
    
    // Vertikale Linien
    for (let i = 0; i <= lines; i++) {
      const t = i / lines;
      const start = origin.clone()
        .addScaledVector(rightDir, t * width);
      const end = start.clone()
        .addScaledVector(upDir, height);
      points.push(start, end);
    }

    // Horizontale Linien
    for (let i = 0; i <= lines; i++) {
      const t = i / lines;
      const start = origin.clone()
        .addScaledVector(upDir, t * height);
      const end = start.clone()
        .addScaledVector(rightDir, width);
      points.push(start, end);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, material);
  }

  /**
   * Gibt das Three.js Group-Objekt zurück
   */
  getObject3D() {
    return this.group;
  }

  /**
   * Aktualisiert die Raumgröße
   */
  setDimensions(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    
    // Raum neu aufbauen
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      child.geometry?.dispose();
      this.group.remove(child);
    }
    this._buildRoom();
  }

  /**
   * Entfernt alle Ressourcen
   */
  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}


/**
 * FloatingTargets - Schwebende Objekte vor und hinter dem Bildschirm
 * Wie im WiiDesktopVR Original
 */
export class FloatingTargets {
  constructor(config = {}) {
    this.count = config.count ?? 10;
    this.inFront = config.inFront ?? 3;  // Wie viele vor dem Bildschirm
    this.scale = config.scale ?? 0.05;
    this.roomWidth = config.roomWidth ?? 1;
    this.roomHeight = config.roomHeight ?? 1;
    this.roomDepth = config.roomDepth ?? 2;
    this.color = config.color ?? 0xffffff;
    this.showLines = config.showLines ?? true;
    this.lineColor = config.lineColor ?? 0xffffff;

    this.group = new THREE.Group();
    this.group.name = 'FloatingTargets';
    this.targets = [];

    this._generateTargets();
  }

  _generateTargets() {
    const { count, inFront, scale, roomWidth, roomHeight, roomDepth } = this;
    
    const geometry = new THREE.SphereGeometry(scale, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    const lineMaterial = new THREE.LineBasicMaterial({ color: this.lineColor });

    const depthStep = (roomDepth / 2) / count;
    const startDepth = inFront * depthStep;

    for (let i = 0; i < count; i++) {
      // Position berechnen
      const z = startDepth - i * depthStep;
      
      // Objekte vor dem Bildschirm näher am Zentrum halten
      const spreadFactor = i < inFront ? 0.3 : 0.7;
      const x = (Math.random() - 0.5) * roomWidth * spreadFactor;
      const y = (Math.random() - 0.5) * roomHeight * spreadFactor;

      // Target-Kugel
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.group.add(mesh);

      // Verbindungslinie zur Rückwand
      if (this.showLines) {
        const linePoints = [
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(x, y, -roomDepth)
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
        const line = new THREE.Line(lineGeom, lineMaterial);
        this.group.add(line);
      }

      this.targets.push({ mesh, x, y, z });
    }
  }

  /**
   * Setzt alle Targets auf neue Zufallspositionen
   */
  randomize() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      child.geometry?.dispose();
      this.group.remove(child);
    }
    this.targets = [];
    this._generateTargets();
  }

  getObject3D() {
    return this.group;
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}


/**
 * RoomFog - Dynamischer Nebel der sich mit der Kopfposition bewegt
 */
export class RoomFog {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.color = config.color ?? 0x000000;
    this.nearOffset = config.nearOffset ?? 0;  // Fog beginnt bei headZ + nearOffset
    this.range = config.range ?? 5;            // Fog-Tiefe
    
    this.fog = new THREE.Fog(this.color, 1, this.range + 1);
    this.scene.fog = this.fog;
    this.enabled = true;
  }

  /**
   * Aktualisiert die Fog-Distanzen basierend auf der Kopfposition
   */
  update(headZ) {
    if (!this.enabled) return;
    this.fog.near = headZ + this.nearOffset;
    this.fog.far = headZ + this.nearOffset + this.range;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.scene.fog = enabled ? this.fog : null;
  }

  dispose() {
    this.scene.fog = null;
  }
}

export default { GridRoom, FloatingTargets, RoomFog };
