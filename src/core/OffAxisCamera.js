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
    
    // Letzte berechnete Werte für Debug
    this._lastParams = null;
    this._lastStatus = { ok: false, reason: 'not updated' };
  }

  /**
   * Aktualisiert die Projektion basierend auf der Augenposition
   * @param {THREE.Vector3} eyeWorld - Augenposition in Weltkoordinaten
   * @returns {{ ok: boolean, reason?: string, l?: number, r?: number, b?: number, t?: number, d?: number }}
   */
  update(eyeWorld) {
    const { screen, camera, near, far, clampNear } = this;

    // Vektoren vom Auge zu den Bildschirmecken
    const va = new THREE.Vector3().subVectors(screen.pa, eyeWorld);
    const vb = new THREE.Vector3().subVectors(screen.pb, eyeWorld);
    const vc = new THREE.Vector3().subVectors(screen.pc, eyeWorld);

    // Abstand zur Bildschirmebene
    const d = -va.dot(screen.vn);
    
    if (!Number.isFinite(d) || d <= 1e-6) {
      this._lastStatus = { ok: false, reason: 'eye behind screen or too close' };
      return this._lastStatus;
    }

    // Effektive Near-Plane (optional auf Bildschirmebene clampen)
    const effectiveNear = clampNear ? Math.min(near, d * 0.99) : near;
    const nearOverDist = effectiveNear / d;

    // Frustum-Grenzen berechnen
    const l = screen.vr.dot(va) * nearOverDist;
    const r = screen.vr.dot(vb) * nearOverDist;
    const b = screen.vu.dot(va) * nearOverDist;
    const t = screen.vu.dot(vc) * nearOverDist;

    // Projektionsmatrix setzen
    const P = new THREE.Matrix4().makePerspective(l, r, t, b, effectiveNear, far);
    camera.projectionMatrix.copy(P);
    camera.projectionMatrixInverse.copy(P).invert();

    // Kamera-Orientierung parallel zum Bildschirm
    const basis = new THREE.Matrix4().makeBasis(screen.vr, screen.vu, screen.vn);
    camera.quaternion.setFromRotationMatrix(basis);
    camera.position.copy(eyeWorld);
    camera.updateMatrixWorld(true);

    this._lastParams = { l, r, b, t, d, near: effectiveNear };
    this._lastStatus = { ok: true, l, r, b, t, d };
    
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
