/**
 * Smoothing Utilities - Filter für flüssige Kopfbewegungen
 * 
 * Basierend auf den Techniken aus WiiDesktopVR, angepasst für
 * MediaPipe Face Tracking.
 */

/**
 * Exponential Moving Average (EMA) Smoother
 * Einfach und effektiv für die meisten Anwendungsfälle
 */
export class EMASmoother {
  /**
   * @param {number} alpha - Glättungsfaktor (0-1). Höher = weniger Glättung
   * @param {Object} initial - Startwert { x, y, z }
   */
  constructor(alpha = 0.3, initial = { x: 0, y: 0, z: 0.5 }) {
    this.alpha = alpha;
    this.value = { ...initial };
  }

  /**
   * Aktualisiert und gibt geglätteten Wert zurück
   */
  update(newValue) {
    this.value.x = this.alpha * newValue.x + (1 - this.alpha) * this.value.x;
    this.value.y = this.alpha * newValue.y + (1 - this.alpha) * this.value.y;
    this.value.z = this.alpha * newValue.z + (1 - this.alpha) * this.value.z;
    return { ...this.value };
  }

  /**
   * Setzt den Glättungsfaktor
   */
  setAlpha(alpha) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  /**
   * Setzt den Wert zurück
   */
  reset(value = { x: 0, y: 0, z: 0.5 }) {
    this.value = { ...value };
  }

  /**
   * Gibt aktuellen geglätteten Wert zurück
   */
  get current() {
    return { ...this.value };
  }
}


/**
 * Double Exponential Smoother (Holt's Method)
 * Bessere Reaktion auf Trends/Bewegungen
 */
export class DoubleExponentialSmoother {
  /**
   * @param {number} alpha - Glättungsfaktor für Wert (0-1)
   * @param {number} beta - Glättungsfaktor für Trend (0-1)
   */
  constructor(alpha = 0.5, beta = 0.4, initial = { x: 0, y: 0, z: 0.5 }) {
    this.alpha = alpha;
    this.beta = beta;
    this.value = { ...initial };
    this.trend = { x: 0, y: 0, z: 0 };
    this.initialized = false;
  }

  update(newValue) {
    if (!this.initialized) {
      this.value = { ...newValue };
      this.initialized = true;
      return { ...this.value };
    }

    const prevValue = { ...this.value };

    // Update für jede Dimension
    ['x', 'y', 'z'].forEach(dim => {
      const newVal = this.alpha * newValue[dim] + (1 - this.alpha) * (this.value[dim] + this.trend[dim]);
      this.trend[dim] = this.beta * (newVal - prevValue[dim]) + (1 - this.beta) * this.trend[dim];
      this.value[dim] = newVal;
    });

    return { ...this.value };
  }

  reset(value = { x: 0, y: 0, z: 0.5 }) {
    this.value = { ...value };
    this.trend = { x: 0, y: 0, z: 0 };
    this.initialized = false;
  }

  get current() {
    return { ...this.value };
  }
}


/**
 * One Euro Filter
 * Adaptiver Filter: wenig Lag bei langsamen Bewegungen, wenig Jitter bei schnellen
 * https://cristal.univ-lille.fr/~casiez/1euro/
 */
export class OneEuroFilter {
  constructor({
    minCutoff = 1.0,    // Minimum Cutoff-Frequenz
    beta = 0.0,          // Cutoff-Slope (wie stark cutoff mit Geschwindigkeit steigt)
    dCutoff = 1.0,       // Cutoff für Geschwindigkeitsschätzung
    initial = { x: 0, y: 0, z: 0.5 }
  } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    
    this.xFilter = new LowPassFilter(this._alpha(minCutoff), initial.x);
    this.yFilter = new LowPassFilter(this._alpha(minCutoff), initial.y);
    this.zFilter = new LowPassFilter(this._alpha(minCutoff), initial.z);
    
    this.dxFilter = new LowPassFilter(this._alpha(dCutoff), 0);
    this.dyFilter = new LowPassFilter(this._alpha(dCutoff), 0);
    this.dzFilter = new LowPassFilter(this._alpha(dCutoff), 0);
    
    this.lastTime = null;
    this.lastValue = { ...initial };
  }

  _alpha(cutoff, dt = 1/60) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  update(newValue, timestamp = performance.now()) {
    const dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 1/60;
    this.lastTime = timestamp;

    if (dt <= 0) return this.current;

    // Geschwindigkeiten schätzen
    const dx = (newValue.x - this.lastValue.x) / dt;
    const dy = (newValue.y - this.lastValue.y) / dt;
    const dz = (newValue.z - this.lastValue.z) / dt;

    // Geschwindigkeiten filtern
    const edx = this.dxFilter.update(dx, this._alpha(this.dCutoff, dt));
    const edy = this.dyFilter.update(dy, this._alpha(this.dCutoff, dt));
    const edz = this.dzFilter.update(dz, this._alpha(this.dCutoff, dt));

    // Adaptive Cutoffs berechnen
    const cutoffX = this.minCutoff + this.beta * Math.abs(edx);
    const cutoffY = this.minCutoff + this.beta * Math.abs(edy);
    const cutoffZ = this.minCutoff + this.beta * Math.abs(edz);

    // Werte filtern
    const x = this.xFilter.update(newValue.x, this._alpha(cutoffX, dt));
    const y = this.yFilter.update(newValue.y, this._alpha(cutoffY, dt));
    const z = this.zFilter.update(newValue.z, this._alpha(cutoffZ, dt));

    this.lastValue = { x, y, z };
    return { x, y, z };
  }

  reset(value = { x: 0, y: 0, z: 0.5 }) {
    this.xFilter.reset(value.x);
    this.yFilter.reset(value.y);
    this.zFilter.reset(value.z);
    this.dxFilter.reset(0);
    this.dyFilter.reset(0);
    this.dzFilter.reset(0);
    this.lastValue = { ...value };
    this.lastTime = null;
  }

  get current() {
    return { ...this.lastValue };
  }
}


/**
 * Einfacher Low-Pass Filter (Hilfklasse für OneEuroFilter)
 */
class LowPassFilter {
  constructor(alpha = 0.5, initial = 0) {
    this.alpha = alpha;
    this.value = initial;
    this.initialized = false;
  }

  update(newValue, alpha = this.alpha) {
    if (!this.initialized) {
      this.value = newValue;
      this.initialized = true;
      return this.value;
    }
    this.value = alpha * newValue + (1 - alpha) * this.value;
    return this.value;
  }

  reset(value = 0) {
    this.value = value;
    this.initialized = false;
  }
}


/**
 * Factory-Funktion für Smoother
 */
export function createSmoother(type = 'ema', options = {}) {
  switch (type.toLowerCase()) {
    case 'ema':
      return new EMASmoother(options.alpha ?? 0.3, options.initial);
    case 'double':
      return new DoubleExponentialSmoother(options.alpha ?? 0.5, options.beta ?? 0.4, options.initial);
    case 'oneeuro':
      return new OneEuroFilter(options);
    case 'none':
      return {
        update: (v) => ({ ...v }),
        reset: () => {},
        get current() { return { x: 0, y: 0, z: 0.5 }; }
      };
    default:
      throw new Error(`Unknown smoother type: ${type}`);
  }
}

export default { EMASmoother, DoubleExponentialSmoother, OneEuroFilter, createSmoother };
