import * as THREE from 'https://unpkg.com/three@0.182.0/build/three.module.js';
import vision from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
import { applyOffAxisToCamera, makeScreenPlane } from './offaxis.js';
import { emptySlot, computeSlotMapping, mapToScreenMeters, interpolateByEyeDist, saveCalibToLocalStorage, loadCalibFromLocalStorage } from './calib.js';
import { buildRoom } from './room.js';

const { FaceLandmarker, FilesetResolver } = vision;

const $ = (id) => document.getElementById(id);
const statusLine = $('statusLine');
const debugLine = $('debugLine');

const canvas = $('c');
const video = $('webcam');

const ui = {
  diagIn: $('diagIn'),
  resX: $('resX'),
  resY: $('resY'),
  screenW: $('screenW'),
  screenH: $('screenH'),
  useWindowAspect: $('useWindowAspect'),

  roomDepth: $('roomDepth'),
  gridStep: $('gridStep'),
  useChecker: $('useChecker'),
  showHelpers: $('showHelpers'),

  near: $('near'),
  far: $('far'),
  clampNear: $('clampNear'),
  smooth: $('smooth'),

  mirrorX: $('mirrorX'),
  useMouseFallback: $('useMouseFallback'),
  showVideo: $('showVideo'),

  calibrationSlots: $('calibrationSlots'),
  saveCalib: $('saveCalib'),
  loadCalib: $('loadCalib'),
  resetCalib: $('resetCalib')
};

// -------- Screen metrics (meters) ----------
function computeScreenMeters({ diagInches, aspect }) {
  const diagM = diagInches * 0.0254;
  const wM = diagM * (aspect / Math.sqrt(aspect*aspect + 1));
  const hM = diagM * (1 / Math.sqrt(aspect*aspect + 1));
  return { wM, hM };
}
function currentAspect() {
  const rx = Number(ui.resX.value);
  const ry = Number(ui.resY.value);
  const nativeAspect = rx / ry;
  const winAspect = window.innerWidth / window.innerHeight;
  return ui.useWindowAspect.checked ? winAspect : nativeAspect;
}
function refreshScreenReadout() {
  const aspect = currentAspect();
  const { wM, hM } = computeScreenMeters({ diagInches: Number(ui.diagIn.value), aspect });
  ui.screenW.value = wM.toFixed(3);
  ui.screenH.value = hM.toFixed(3);
  return { wM, hM };
}
['input','change'].forEach(ev => {
  ui.diagIn.addEventListener(ev, refreshScreenReadout);
  ui.resX.addEventListener(ev, refreshScreenReadout);
  ui.resY.addEventListener(ev, refreshScreenReadout);
  ui.useWindowAspect.addEventListener(ev, refreshScreenReadout);
});

// -------- Calibration ----------
const calib = { slots: [ emptySlot(0.42), emptySlot(0.50), emptySlot(0.62) ] };
function slotLabel(i) { return `Slot ${i+1}`; }
function slotReadyText(slot) {
  const s = slot.samples;
  const got = ['center','left','right','up','down'].filter(k => !!s[k]).length;
  return got === 5 ? 'bereit ✅' : `Samples: ${got}/5`;
}

function renderSlots() {
  ui.calibrationSlots.innerHTML = '';
  calib.slots.forEach((slot, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `
      <div class="slot__head">
        <div class="slot__title">${slotLabel(i)}</div>
        <div class="slot__meta" id="slotMeta${i}">Z=${slot.zMeters.toFixed(2)}m · ${slotReadyText(slot)}</div>
      </div>
      <div class="slot__grid">
        <label>Z Distanz (m)
          <input id="slotZ${i}" type="number" step="0.01" value="${slot.zMeters}">
        </label>
        <label>EyeDist (px, center)
          <input id="slotEyePx${i}" type="number" step="0.1" value="${slot.samples.center?.eyeDistPx?.toFixed(1) ?? ''}" disabled>
        </label>
      </div>
      <div class="slot__buttons">
        <button data-slot="${i}" data-pos="center">Center</button>
        <button data-slot="${i}" data-pos="left">Left</button>
        <button data-slot="${i}" data-pos="right">Right</button>
        <button data-slot="${i}" data-pos="up">Up</button>
        <button data-slot="${i}" data-pos="down">Down</button>
      </div>
      <div class="hint" id="slotHint${i}"></div>
    `;
    ui.calibrationSlots.appendChild(el);

    const zInput = el.querySelector(`#slotZ${i}`);
    zInput.addEventListener('input', () => {
      slot.zMeters = Number(zInput.value);
      updateSlotHint(i);
    });

    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => recordCalib(i, btn.dataset.pos));
    });

    updateSlotHint(i);
  });
}

function updateSlotHint(i) {
  const slot = calib.slots[i];
  const mapping = computeSlotMapping(slot);
  const hintEl = document.getElementById(`slotHint${i}`);
  const metaEl = document.getElementById(`slotMeta${i}`);
  const eyePxEl = document.getElementById(`slotEyePx${i}`);

  eyePxEl.value = slot.samples.center?.eyeDistPx?.toFixed(1) ?? '';
  metaEl.textContent = `Z=${slot.zMeters.toFixed(2)}m · ${slotReadyText(slot)}`;

  if (!mapping) {
    hintEl.textContent = 'Noch nicht vollständig – nimm Center + Left/Right + Up/Down auf.';
  } else {
    hintEl.textContent = `x:[${mapping.xMin.toFixed(3)}..${mapping.xMax.toFixed(3)}] y:[${mapping.yMin.toFixed(3)}..${mapping.yMax.toFixed(3)}] · EyeDist≈${mapping.eyeDistPx.toFixed(1)}px`;
  }
}

ui.saveCalib.addEventListener('click', () => {
  saveCalibToLocalStorage(calib);
  statusLine.textContent = 'Kalibrierung gespeichert (localStorage).';
});
ui.loadCalib.addEventListener('click', () => {
  const loaded = loadCalibFromLocalStorage();
  if (loaded?.slots?.length === 3) {
    calib.slots = loaded.slots;
    renderSlots();
    statusLine.textContent = 'Kalibrierung geladen.';
  } else {
    statusLine.textContent = 'Keine gespeicherte Kalibrierung gefunden.';
  }
});
ui.resetCalib.addEventListener('click', () => {
  calib.slots = [ emptySlot(0.35), emptySlot(0.55), emptySlot(0.75) ];
  renderSlots();
  statusLine.textContent = 'Kalibrierung zurückgesetzt.';
});

// -------- MediaPipe Face Landmarker ----------
let faceLandmarker = null;
let webcamRunning = false;
let lastVideoTime = -1;

const MP_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MP_WASM_URL  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';

async function setupFaceLandmarker() {
  statusLine.textContent = 'MediaPipe: lade WASM + Model…';
  const filesetResolver = await FilesetResolver.forVisionTasks(MP_WASM_URL);
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: MP_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1
  });
  statusLine.textContent = 'MediaPipe: bereit. Starte Webcam…';
}
async function setupWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  video.srcObject = stream;
  await video.play();
  webcamRunning = true;
  statusLine.textContent = 'Webcam läuft. Face Tracking…';
}

const IDX = { le0: 33, le1: 133, re0: 263, re1: 362 };
function getEyeSample(result) {
  const faces = result.faceLandmarks;
  if (!faces || !faces.length) return null;
  const lm = faces[0];
  const le0 = lm[IDX.le0], le1 = lm[IDX.le1], re0 = lm[IDX.re0], re1 = lm[IDX.re1];
  if (!le0 || !le1 || !re0 || !re1) return null;

  const leftEye = { x: (le0.x + le1.x) * 0.5, y: (le0.y + le1.y) * 0.5 };
  const rightEye = { x: (re0.x + re1.x) * 0.5, y: (re0.y + re1.y) * 0.5 };
  const center = { x: (leftEye.x + rightEye.x) * 0.5, y: (leftEye.y + rightEye.y) * 0.5 };

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const dx = (rightEye.x - leftEye.x) * w;
  const dy = (rightEye.y - leftEye.y) * h;
  const eyeDistPx = Math.hypot(dx, dy);

  return { x: center.x, y: center.y, eyeDistPx };
}

let latestSample = null;
function predictWebcam() {
  if (!webcamRunning || !faceLandmarker) return;
  const now = performance.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = faceLandmarker.detectForVideo(video, now);
    latestSample = getEyeSample(result);
  }
  requestAnimationFrame(predictWebcam);
}

// Webcam preview toggle
ui.showVideo.addEventListener('change', () => {
  if (ui.showVideo.checked) video.classList.add('preview'), video.classList.remove('hidden');
  else video.classList.remove('preview'), video.classList.add('hidden');
});

// -------- three.js scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 8);

// Helpers group (screen outline, frustum rays, eye marker)
const helperGroup = new THREE.Group();
scene.add(helperGroup);

let screenOutline = null;
let frustumLines = null;
let eyeMarker = null;

function rebuildHelpers(screen) {
  helperGroup.clear();

  // Screen rectangle outline
  const pts = [screen.pa, screen.pb, screen.pd, screen.pc, screen.pa].map(v => v.clone());
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  screenOutline = new THREE.Line(geo, mat);
  helperGroup.add(screenOutline);

  // Eye marker
  const eyeG = new THREE.SphereGeometry(0.01, 18, 14);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  eyeMarker = new THREE.Mesh(eyeG, eyeM);
  helperGroup.add(eyeMarker);

  // Frustum rays (eye->screen corners)
  const frG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const frM = new THREE.LineBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.75 });
  frustumLines = new THREE.LineSegments(frG, frM);
  helperGroup.add(frustumLines);
}

function updateFrustumLines(screen, eye) {
  const pts = [eye, screen.pa, eye, screen.pb, eye, screen.pc, eye, screen.pd].map(v => v.clone());
  frustumLines.geometry.dispose();
  frustumLines.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Mouse fallback
let mouse = { x: 0.5, y: 0.5, zMeters: 0.50 };
window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX / window.innerWidth;
  mouse.y = e.clientY / window.innerHeight;
});
window.addEventListener('wheel', (e) => {
  mouse.zMeters = Math.max(0.20, Math.min(1.5, mouse.zMeters + (e.deltaY > 0 ? 0.03 : -0.03)));
}, { passive: true });

// Smoothing
const filtered = { xM: 0, yM: 0, zM: 0.50 };
function smoothTo(target, alpha) {
  filtered.xM += (target.xM - filtered.xM) * alpha;
  filtered.yM += (target.yM - filtered.yM) * alpha;
  filtered.zM += (target.zM - filtered.zM) * alpha;
}

// Room
let room = null;
let roomParamsKey = '';
function rebuildRoomIfNeeded(screenW, screenH) {
  const depth = Number(ui.roomDepth.value);
  const step = Math.max(0.01, Number(ui.gridStep.value));
  const mode = ui.useChecker.checked ? 'checker' : 'grid';
  const key = [screenW.toFixed(4), screenH.toFixed(4), depth.toFixed(3), step.toFixed(3), mode].join('|');
  if (key === roomParamsKey && room) return;
  roomParamsKey = key;

  if (room) {
    scene.remove(room.group);
    room = null;
  }
  room = buildRoom({ screenW, screenH, depth, gridStep: step, mode });
  scene.add(room.group);
}

// -------- Main loop ----------
let screen = null;

function computeContinuousEyePose(sample, mappings, screenW, screenH, mirrorX) {
  const ready = mappings.filter(Boolean);
  if (!ready.length || !sample || sample.eyeDistPx <= 0) return null;

  const br = interpolateByEyeDist(ready, sample.eyeDistPx);
  if (!br) return null;

  const a = br.a;
  const b = br.b;
  const t = br.t;

  const pa = mapToScreenMeters({ x: sample.x, y: sample.y }, a, screenW, screenH, mirrorX);
  const pb = mapToScreenMeters({ x: sample.x, y: sample.y }, b, screenW, screenH, mirrorX);

  const lerp = (x,y,t) => x + (y-x)*t;

  return {
    xM: lerp(pa.xM, pb.xM, t),
    yM: lerp(pa.yM, pb.yM, t),
    zM: lerp(a.zMeters, b.zMeters, t),
    info: { t, aZ: a.zMeters, bZ: b.zMeters, aEye: a.eyeDistPx, bEye: b.eyeDistPx, clamped: br.clamped }
  };
}

function tick() {
  const { wM, hM } = refreshScreenReadout();
  screen = makeScreenPlane({ widthM: wM, heightM: hM, center: new THREE.Vector3(0,0,0) });

  if (!screenOutline) rebuildHelpers(screen);
  helperGroup.visible = ui.showHelpers.checked;

  // Rebuild room if params changed
  rebuildRoomIfNeeded(wM, hM);

  const nearBase = Number(ui.near.value);
  const far = Number(ui.far.value);
  const alpha = Number(ui.smooth.value);

  // Decide sample source
  let sample = latestSample;
  let source = 'face';
  if (ui.useMouseFallback.checked || !sample) {
    sample = { x: mouse.x, y: mouse.y, eyeDistPx: 0 };
    source = 'mouse';
  }

  // Build mappings from calibration
  const mappings = calib.slots.map(computeSlotMapping);

  // Compute pose
  let pose = null;

  if (source === 'face') {
    pose = computeContinuousEyePose(sample, mappings, wM, hM, ui.mirrorX.checked);
  }

  if (!pose) {
    // Fallback: map mouse to meters directly
    const xM = (sample.x - 0.5) * wM * (ui.mirrorX.checked ? -1 : 1);
    const yM = (0.5 - sample.y) * hM;
    pose = { xM, yM, zM: (source === 'mouse') ? mouse.zMeters : 0.55, info: null };
  }

  smoothTo(pose, alpha);

  const eyeWorld = new THREE.Vector3(filtered.xM, filtered.yM, filtered.zM);

  const d = filtered.zM; // eye z to screen z=0
  const near = ui.clampNear.checked ? Math.max(0.01, d) : nearBase;

  const res = applyOffAxisToCamera({ camera, eyeWorld, screen, near, far });

  // Helpers update
  if (eyeMarker) eyeMarker.position.copy(eyeWorld);
  if (frustumLines) updateFrustumLines(screen, eyeWorld);

  // Debug
  const extra = pose.info ? ` · interp t=${pose.info.t.toFixed(2)} z=[${pose.info.aZ.toFixed(2)}..${pose.info.bZ.toFixed(2)}]` : '';
  debugLine.textContent = `src=${source} · eye=(${filtered.xM.toFixed(3)},${filtered.yM.toFixed(3)},${filtered.zM.toFixed(3)})m${extra}`;
  if (!faceLandmarker) statusLine.textContent = 'MediaPipe init…';
  else if (!webcamRunning) statusLine.textContent = 'Webcam init…';
  else statusLine.textContent = res.ok ? `Frustum d=${res.d.toFixed(3)}m · l=${res.l.toFixed(3)} r=${res.r.toFixed(3)} t=${res.t.toFixed(3)} b=${res.b.toFixed(3)}` : `Frustum invalid (${res.reason})`;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Record calibration
function recordCalib(slotIndex, pos) {
  if (!latestSample) {
    statusLine.textContent = 'Kein Face Sample. Starte Webcam/Face Tracking oder aktiviere Maus-Fallback.';
    return;
  }
  const slot = calib.slots[slotIndex];
  slot.samples[pos] = { x: latestSample.x, y: latestSample.y, eyeDistPx: latestSample.eyeDistPx };
  updateSlotHint(slotIndex);
  statusLine.textContent = `Aufgenommen: ${slotLabel(slotIndex)} · ${pos}`;
}

// Init
renderSlots();
refreshScreenReadout();

(async function boot() {
  try {
    await setupFaceLandmarker();
    await setupWebcam();
    predictWebcam();
  } catch (err) {
    console.error(err);
    statusLine.textContent = 'Face Tracking init fehlgeschlagen – Maus-Fallback aktiv.';
    ui.useMouseFallback.checked = true;
  } finally {
    tick();
  }
})();
