import * as THREE from 'https://unpkg.com/three@0.182.0/build/three.module.js';

/**
 * OffAxisCamera - Verwaltet Off-Axis (Generalized Perspective) Projektion
 * 
 * Basiert auf Robert Kooima's "Generalized Perspective Projection" und
 * dem WiiDesktopVR-Projekt von Johnny Chung Lee.
 * 
 * @example
 * const screen = new Screen({ widthM: 0.6, heightM: 0.35 });
 * const offAxisCam = new OffAxisCamera(camera, screen);
 * offAxisCam.update(eyePosition);
 */
export class OffAxisCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera - Three.js Kamera
   * @param {Screen} screen - Bildschirm-Definition
   * @param {Object} options - Konfiguration
   */
  constructor(camera, screen, options = {}) {
    this.camera = camera;
    this.screen = screen;
    
    this.near = options.near ?? 0.01;
    this.far = options.far ?? 100;
    this.clampNear = options.clampNear ?? true;
    
    // Faktor für Tiefenwahrnehmung (1.0 = normal, 0 = keine Tiefenänderung bei Z-Bewegung)
    this.depthFactor = options.depthFactor ?? 1.0;
    // Basis-Distanz für Tiefenberechnung (der Raum hat "normale" Tiefe bei dieser Distanz)
    this.baseDistance = options.baseDistance ?? 0.5;
    
    // Letzte berechnete Werte für Debug
    this._lastParams = null;
    this._lastStatus = { ok: false, reason: 'not updated' };
  }

  /**
   * Aktualisiert die Projektion basierend auf der Augenposition
   * 
   * Der Trick: Die Kamera bleibt bei Z=headDist, aber die Projektion
   * wird asymmetrisch verschoben. Dadurch bleibt der "Bildschirmrahmen"
   * fix, aber man sieht "um die Ecke" wenn man den Kopf bewegt.
   * 
   * @param {THREE.Vector3} eyeWorld - Augenposition in Weltkoordinaten (Meter)
   * @returns {{ ok: boolean, reason?: string }}
   */
  update(eyeWorld) {
    const { screen, camera, near, far } = this;

    // Abstand vom Auge zur Bildschirmebene (in Metern)
    const headDist = eyeWorld.z;
    
    if (!Number.isFinite(headDist) || headDist <= 0.05) {
      this._lastStatus = { ok: false, reason: 'eye behind screen or too close' };
      return this._lastStatus;
    }

    // Kopfposition relativ zum Bildschirm-Zentrum
    const headX = eyeWorld.x;
    const headY = eyeWorld.y;
    
    // Halbe Bildschirmbreite/-höhe (in Metern)
    const halfW = screen.widthM / 2;
    const halfH = screen.heightM / 2;

    // Off-Axis Projektion für Three.js (Right-Handed Coordinate System)
    // Unterschied zu DirectX LH: X-Vorzeichen ist invertiert
    const n = near;
    
    // Tiefenwahrnehmung: Mische zwischen tatsächlicher Distanz und Basis-Distanz
    // depthFactor = 1.0: volle Tiefenänderung bei Z-Bewegung
    // depthFactor = 0: keine Tiefenänderung (Raum bleibt konstant tief)
    const effectiveDist = this.baseDistance + (headDist - this.baseDistance) * this.depthFactor;
    
    // Skalierungsfaktor für Frustum-Grenzen
    const scale = n / effectiveDist;

    // Frustum-Grenzen für Three.js RH:
    // Wenn Kopf nach LINKS (headX < 0) → weniger linke Wand sehen
    // Das erfordert -headX in der Formel (Gegenteil von DirectX LH)
    const l = scale * (-halfW - headX);
    const r = scale * ( halfW - headX);
    const b = scale * (-halfH - headY);
    const t = scale * ( halfH - headY);

    // Projektionsmatrix setzen
    const P = new THREE.Matrix4().makePerspective(l, r, t, b, n, far);
    camera.projectionMatrix.copy(P);
    camera.projectionMatrixInverse.copy(P).invert();

    // View Matrix: Kamera bewegt sich mit dem Kopf, schaut auf Bildschirmmitte
    camera.position.set(headX, headY, effectiveDist);
    camera.lookAt(headX, headY, 0);
    camera.updateMatrixWorld(true);

    this._lastParams = { l, r, b, t, headDist, effectiveDist, headX, headY };
    this._lastStatus = { ok: true, l, r, b, t, d: effectiveDist };
    
    return this._lastStatus;
  }

  /**
   * Setzt Near/Far Clipping Planes
   */
  setNearFar(near, far) {
    this.near = near;
    this.far = far;
  }

  /**
   * Aktiviert/Deaktiviert Near-Plane Clamping
   * Wenn aktiv, wird near auf max. 99% des Bildschirmabstands begrenzt
   */
  setClampNear(enabled) {
    this.clampNear = enabled;
  }

  /**
   * Setzt den Tiefenwahrnehmungs-Faktor
   * @param {number} factor - 0 = keine Tiefenänderung, 1 = volle Tiefenänderung
   */
  setDepthFactor(factor) {
    this.depthFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * Setzt die Basis-Distanz (Raum hat "normale" Tiefe bei dieser Distanz)
   * @param {number} distance - Distanz in Metern
   */
  setBaseDistance(distance) {
    this.baseDistance = Math.max(0.1, distance);
  }

  /**
   * Gibt die letzten Projektionsparameter zurück (für Debug)
   */
  getProjectionParams() {
    return this._lastParams;
  }

  /**
   * Gibt den letzten Status zurück
   */
  getStatus() {
    return this._lastStatus;
  }
}

export default OffAxisCamera;
