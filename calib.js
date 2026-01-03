// Vorkalibrierte Slots mit echten Werten vom Screenshot
export function emptySlot(zMeters = 0.55) {
  return {
    zMeters,
    samples: { center: null, left: null, right: null, up: null, down: null }
  };
}

export function precalibratedSlot1() {
  return {
    zMeters: 0.25,
    samples: {
      center: { x: 0.528, y: 0.664, eyeDistPx: 134.9 },
      left: { x: 0.222, y: 0.664, eyeDistPx: 134.9 },
      right: { x: 0.835, y: 0.664, eyeDistPx: 134.9 },
      up: { x: 0.528, y: 0.459, eyeDistPx: 134.9 },
      down: { x: 0.528, y: 0.868, eyeDistPx: 134.9 }
    }
  };
}

export function precalibratedSlot2() {
  return {
    zMeters: 0.50,
    samples: {
      center: { x: 0.539, y: 0.590, eyeDistPx: 74.2 },
      left: { x: 0.234, y: 0.590, eyeDistPx: 74.2 },
      right: { x: 0.845, y: 0.590, eyeDistPx: 74.2 },
      up: { x: 0.539, y: 0.318, eyeDistPx: 74.2 },
      down: { x: 0.539, y: 0.862, eyeDistPx: 74.2 }
    }
  };
}

export function precalibratedSlot3() {
  return {
    zMeters: 1.00,
    samples: {
      center: { x: 0.538, y: 0.584, eyeDistPx: 31.5 },
      left: { x: 0.386, y: 0.584, eyeDistPx: 31.5 },
      right: { x: 0.690, y: 0.584, eyeDistPx: 31.5 },
      up: { x: 0.538, y: 0.363, eyeDistPx: 31.5 },
      down: { x: 0.538, y: 0.805, eyeDistPx: 31.5 }
    }
  };
}

export function isSlotReady(slot) {
  const s = slot.samples;
  return !!(s.center && s.left && s.right && s.up && s.down);
}

export function computeSlotMapping(slot) {
  if (!isSlotReady(slot)) return null;

  const { center, left, right, up, down } = slot.samples;
  const xMin = Math.min(left.x, right.x);
  const xMax = Math.max(left.x, right.x);
  const yMin = Math.min(up.y, down.y);
  const yMax = Math.max(up.y, down.y);

  return { zMeters: slot.zMeters, eyeDistPx: center.eyeDistPx, xMin, xMax, yMin, yMax };
}

export function mapToScreenMeters({ x, y }, mapping, screenW, screenH, mirrorX = true) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;

  const x01 = (clamp(x, mapping.xMin, mapping.xMax) - mapping.xMin) / (mapping.xMax - mapping.xMin + 1e-9);
  const y01 = (clamp(y, mapping.yMin, mapping.yMax) - mapping.yMin) / (mapping.yMax - mapping.yMin + 1e-9);

  let xM = lerp(-screenW/2, screenW/2, x01);
  if (mirrorX) xM *= -1;
  const yM = lerp(screenH/2, -screenH/2, y01);

  return { xM, yM };
}

export function interpolateByEyeDist(mappingsReady, currentEyeDistPx) {
  const ms = mappingsReady.filter(Boolean).slice();
  if (ms.length === 0) return null;

  // EyeDistPx: größer => näher. Sortiere absteigend.
  ms.sort((a,b) => b.eyeDistPx - a.eyeDistPx);

  if (ms.length === 1 || currentEyeDistPx <= 0) {
    return { a: ms[0], b: ms[0], t: 0, clamped: true };
  }

  // Clamp außerhalb der Range
  if (currentEyeDistPx >= ms[0].eyeDistPx) return { a: ms[0], b: ms[0], t: 0, clamped: true };
  if (currentEyeDistPx <= ms[ms.length-1].eyeDistPx) return { a: ms[ms.length-1], b: ms[ms.length-1], t: 0, clamped: true };

  // Find bracket
  for (let i=0; i<ms.length-1; i++) {
    const hi = ms[i];     // näher (größer eyeDist)
    const lo = ms[i+1];   // weiter weg
    if (currentEyeDistPx <= hi.eyeDistPx && currentEyeDistPx >= lo.eyeDistPx) {
      const t = (currentEyeDistPx - lo.eyeDistPx) / (hi.eyeDistPx - lo.eyeDistPx + 1e-9);
      return { a: lo, b: hi, t, clamped: false }; // t=0 -> lo (far), t=1 -> hi (near)
    }
  }
  return { a: ms[0], b: ms[0], t: 0, clamped: true };
}

export function saveCalibToLocalStorage(calib, key = 'offaxis_calib_v2') {
  localStorage.setItem(key, JSON.stringify(calib));
}
export function loadCalibFromLocalStorage(key = 'offaxis_calib_v2') {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
