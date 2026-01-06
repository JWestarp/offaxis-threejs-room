import * as THREE from 'https://unpkg.com/three@0.182.0/build/three.module.js';

/**
 * Screen - Repräsentiert den physischen Bildschirm als Ebene im 3D-Raum
 * 
 * Standard-Konfiguration:
 * - Bildschirm liegt in der Z=0 Ebene
 * - Normale zeigt in +Z Richtung (zum Betrachter)
 * - Zentrum bei (0, 0, 0)
 * 
 * Ecken:
 *   pc ──────── pd
 *    │          │
 *    │  center  │
 *    │          │
 *   pa ──────── pb
 */
export class Screen {
  /**
   * @param {Object} config - Bildschirm-Konfiguration
   * @param {number} config.widthM - Breite in Metern
   * @param {number} config.heightM - Höhe in Metern
   * @param {THREE.Vector3} [config.center] - Mittelpunkt (default: 0,0,0)
   * @param {THREE.Vector3} [config.normal] - Normale (default: 0,0,1)
   */
  constructor({ widthM, heightM, center = new THREE.Vector3(0, 0, 0), normal = new THREE.Vector3(0, 0, 1) }) {
    this.widthM = widthM;
    this.heightM = heightM;
    this.center = center.clone();
    
    // Basis-Vektoren (rechts, hoch, normal)
    this.vr = new THREE.Vector3(1, 0, 0);
    this.vu = new THREE.Vector3(0, 1, 0);
    this.vn = normal.clone().normalize();
    
    // Ecken berechnen
    this._computeCorners();
  }

  _computeCorners() {
    const hw = this.widthM * 0.5;
    const hh = this.heightM * 0.5;

    // pa = bottom-left, pb = bottom-right, pc = top-left, pd = top-right
    this.pa = this.center.clone().addScaledVector(this.vr, -hw).addScaledVector(this.vu, -hh);
    this.pb = this.center.clone().addScaledVector(this.vr, +hw).addScaledVector(this.vu, -hh);
    this.pc = this.center.clone().addScaledVector(this.vr, -hw).addScaledVector(this.vu, +hh);
    this.pd = this.center.clone().addScaledVector(this.vr, +hw).addScaledVector(this.vu, +hh);
  }

  /**
   * Aktualisiert die Bildschirmgröße
   */
  setSize(widthM, heightM) {
    this.widthM = widthM;
    this.heightM = heightM;
    this._computeCorners();
  }

  /**
   * Berechnet Größe aus Diagonale und Seitenverhältnis
   * @param {number} diagInches - Diagonale in Zoll
   * @param {number} aspect - Breite/Höhe Verhältnis
   */
  static fromDiagonal(diagInches, aspect) {
    const diagM = diagInches * 0.0254;
    const widthM = diagM * (aspect / Math.sqrt(aspect * aspect + 1));
    const heightM = diagM * (1 / Math.sqrt(aspect * aspect + 1));
    return new Screen({ widthM, heightM });
  }

  /**
   * Erstellt ein Three.js Mesh zur Visualisierung
   */
  createDebugMesh(color = 0x00ff00, opacity = 0.2) {
    const geometry = new THREE.PlaneGeometry(this.widthM, this.heightM);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      wireframe: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.center);
    return mesh;
  }

  /**
   * Erstellt Wireframe-Rahmen
   */
  createFrameMesh(color = 0xffffff) {
    const points = [
      this.pa.clone(),
      this.pb.clone(),
      this.pd.clone(),
      this.pc.clone(),
      this.pa.clone()
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geometry, material);
  }
}

export default Screen;
