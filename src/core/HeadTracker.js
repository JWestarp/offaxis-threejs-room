/**
 * HeadTracker - Abstrakte Basisklasse für Kopf-Tracking
 * 
 * Definiert das Interface für verschiedene Tracking-Methoden:
 * - MediaPipe Face Landmarker
 * - Wiimote IR (über WebHID)
 * - Maus-Fallback
 * - etc.
 */
export class HeadTracker {
  constructor() {
    if (new.target === HeadTracker) {
      throw new Error('HeadTracker ist eine abstrakte Klasse');
    }
    
    this._callbacks = [];
    this._running = false;
    this._confidence = 0;
    this._lastPosition = { x: 0, y: 0, z: 0.5 };
  }

  /**
   * Startet das Tracking
   * @returns {Promise<void>}
   */
  async start() {
    throw new Error('start() muss implementiert werden');
  }

  /**
   * Stoppt das Tracking
   */
  stop() {
    throw new Error('stop() muss implementiert werden');
  }

  /**
   * Registriert einen Callback für Position-Updates
   * @param {function({x: number, y: number, z: number})} callback
   */
  onUpdate(callback) {
    this._callbacks.push(callback);
  }

  /**
   * Entfernt einen Callback
   */
  offUpdate(callback) {
    const idx = this._callbacks.indexOf(callback);
    if (idx !== -1) this._callbacks.splice(idx, 1);
  }

  /**
   * Benachrichtigt alle Callbacks
   * @protected
   */
  _notifyUpdate(position) {
    this._lastPosition = { ...position };
    for (const cb of this._callbacks) {
      cb(position);
    }
  }

  /**
   * Gibt zurück, ob das Tracking läuft
   */
  get isRunning() {
    return this._running;
  }

  /**
   * Gibt die Tracking-Konfidenz zurück (0-1)
   */
  get confidence() {
    return this._confidence;
  }

  /**
   * Gibt die letzte bekannte Position zurück
   */
  get lastPosition() {
    return { ...this._lastPosition };
  }
}

export default HeadTracker;
