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

    // Off-Axis Projektion nach WiiDesktopVR Original:
    // Kamera bewegt sich MIT dem Kopf, aber Frustum wird asymmetrisch verschoben
    const n = near;
    
    // Frustum-Grenzen nach WiiDesktopVR.cs (Zeile 848-851):
    // left  = nearPlane*(-.5f * screenAspect + headX)/headDist
    // right = nearPlane*(.5f * screenAspect + headX)/headDist
    // bottom = nearPlane*(-.5f - headY)/headDist
    // top    = nearPlane*(.5f - headY)/headDist
    const l = n * (-halfW + headX) / headDist;  // +headX wie im Original
    const r = n * ( halfW + headX) / headDist;  // +headX wie im Original
    const b = n * (-halfH - headY) / headDist;  // -headY wie im Original
    const t = n * ( halfH - headY) / headDist;  // -headY wie im Original

    // Projektionsmatrix setzen
    const P = new THREE.Matrix4().makePerspective(l, r, t, b, n, far);
    camera.projectionMatrix.copy(P);
    camera.projectionMatrixInverse.copy(P).invert();

    // View Matrix nach WiiDesktopVR Original (Zeile 836):
    // Matrix.LookAtLH(new Vector3(headX, headY, headDist), new Vector3(headX, headY, 0), ...)
    // Kamera bewegt sich MIT dem Kopf und schaut direkt nach vorne
    camera.position.set(headX, headY, headDist);
    camera.lookAt(headX, headY, 0);
    camera.updateMatrixWorld(true);

    this._lastParams = { l, r, b, t, headDist, headX, headY };
    this._lastStatus = { ok: true, l, r, b, t, d: headDist };
    
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
