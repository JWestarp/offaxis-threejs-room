import * as THREE from 'https://unpkg.com/three@0.182.0/build/three.module.js';

/**
 * Off-Axis / Generalized Perspective (wie im Unity-Artikel nach Kooima):
 *   d = -dot(va, vn)
 *   nearOverDist = n / d
 *   l = dot(vr, va) * nearOverDist
 *   r = dot(vr, vb) * nearOverDist
 *   b = dot(vu, va) * nearOverDist
 *   t = dot(vu, vc) * nearOverDist
 *
 * Wichtig:
 * - camera.projectionMatrix wird manuell gesetzt
 * - Kamera bleibt parallel zur Bildschirmfläche (kein lookAt)
 */
export function applyOffAxisToCamera({ camera, eyeWorld, screen, near, far }) {
  const va = new THREE.Vector3().subVectors(screen.pa, eyeWorld);
  const vb = new THREE.Vector3().subVectors(screen.pb, eyeWorld);
  const vc = new THREE.Vector3().subVectors(screen.pc, eyeWorld);

  const d = -va.dot(screen.vn);
  if (!Number.isFinite(d) || d <= 1e-6) return { ok: false, reason: 'eye behind screen or too close' };

  const nearOverDist = near / d;

  const l = screen.vr.dot(va) * nearOverDist;
  const r = screen.vr.dot(vb) * nearOverDist;
  const b = screen.vu.dot(va) * nearOverDist;
  const t = screen.vu.dot(vc) * nearOverDist;

  const P = new THREE.Matrix4().makePerspective(l, r, t, b, near, far);
  camera.projectionMatrix.copy(P);
  camera.projectionMatrixInverse.copy(P).invert();

  // Kamera-Achsen parallel zum Screen
  const basis = new THREE.Matrix4().makeBasis(screen.vr, screen.vu, screen.vn);
  camera.quaternion.setFromRotationMatrix(basis);
  camera.position.copy(eyeWorld);
  camera.updateMatrixWorld(true);

  return { ok: true, l, r, b, t, d };
}

export function makeScreenPlane({ widthM, heightM, center = new THREE.Vector3(0,0,0), normal = new THREE.Vector3(0,0,1) }) {
  const vr = new THREE.Vector3(1, 0, 0);
  const vu = new THREE.Vector3(0, 1, 0);
  const vn = normal.clone().normalize();

  const hw = widthM * 0.5;
  const hh = heightM * 0.5;

  const pa = center.clone().addScaledVector(vr, -hw).addScaledVector(vu, -hh); // bottom-left
  const pb = center.clone().addScaledVector(vr, +hw).addScaledVector(vu, -hh); // bottom-right
  const pc = center.clone().addScaledVector(vr, -hw).addScaledVector(vu, +hh); // top-left
  const pd = center.clone().addScaledVector(vr, +hw).addScaledVector(vu, +hh); // top-right

  return { pa, pb, pc, pd, vr, vu, vn, widthM, heightM, center };
}
