import * as THREE from 'https://unpkg.com/three@0.182.0/build/three.module.js';

function makeCanvasTexture({ mode='grid', size=512, stepPx=64, linePx=3, borderPx=12 }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // background
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0,0,size,size);

  if (mode === 'checker') {
    const cells = Math.max(2, Math.floor(size / stepPx));
    const cell = size / cells;
    for (let y=0; y<cells; y++) {
      for (let x=0; x<cells; x++) {
        const on = (x+y) % 2 === 0;
        ctx.fillStyle = on ? '#121926' : '#394152';
        ctx.fillRect(x*cell, y*cell, cell, cell);
      }
    }
  }

  if (mode === 'grid') {
    ctx.strokeStyle = 'rgba(240, 248, 255, 0.55)';
    ctx.lineWidth = linePx;
    for (let x=0; x<=size; x+=stepPx) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke();
    }
    for (let y=0; y<=size; y+=stepPx) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke();
    }
  }

  // white border (like Unity alignment texture)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = borderPx;
  ctx.strokeRect(borderPx*0.5, borderPx*0.5, size-borderPx, size-borderPx);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildRoom({ screenW, screenH, depth, gridStep, mode='grid' }) {
  const group = new THREE.Group();

  const tex = makeCanvasTexture({
    mode,
    size: 512,
    // Roughly map gridStep meters to stepPx
    // We'll set repeat based on meters anyway; this just sets a nice base pattern.
    stepPx: 64,
    linePx: 3,
    borderPx: 14
  });

  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: false });

  const hw = screenW * 0.5;
  const hh = screenH * 0.5;
  const d = depth;

  // Repeat counts so one tile ≈ gridStep meters
  const repX = Math.max(1, screenW / gridStep);
  const repY = Math.max(1, screenH / gridStep);
  const repD_X = Math.max(1, d / gridStep);

  function plane(w,h) {
    const g = new THREE.PlaneGeometry(w, h);
    const m = mat.clone();
    m.map = tex.clone();
    m.map.repeat.set(Math.max(1, w / gridStep), Math.max(1, h / gridStep));
    m.map.needsUpdate = true;
    const mesh = new THREE.Mesh(g, m);
    return mesh;
  }

  // Back wall (z = -d), facing camera (+z)
  const back = plane(screenW, screenH);
  back.position.set(0, 0, -d);
  group.add(back);

  // Left wall (x = -hw), spans depth × height, rotated so its plane is Y×Z
  const left = plane(d, screenH);
  left.position.set(-hw, 0, -d*0.5);
  left.rotation.y = Math.PI / 2;
  group.add(left);

  const right = plane(d, screenH);
  right.position.set(+hw, 0, -d*0.5);
  right.rotation.y = -Math.PI / 2;
  group.add(right);

  // Ceiling (y = +hh), spans width × depth
  const top = plane(screenW, d);
  top.position.set(0, +hh, -d*0.5);
  top.rotation.x = Math.PI / 2;
  group.add(top);

  const bottom = plane(screenW, d);
  bottom.position.set(0, -hh, -d*0.5);
  bottom.rotation.x = -Math.PI / 2;
  group.add(bottom);

  // Edges (white lines)
  const edges = new THREE.Group();
  group.add(edges);

  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

  const cornersFront = [
    new THREE.Vector3(-hw, -hh, 0),
    new THREE.Vector3(+hw, -hh, 0),
    new THREE.Vector3(-hw, +hh, 0),
    new THREE.Vector3(+hw, +hh, 0),
  ];
  const cornersBack = cornersFront.map(v => v.clone().setZ(-d));

  const segs = [];
  // front rectangle
  segs.push(cornersFront[0], cornersFront[1], cornersFront[1], cornersFront[3], cornersFront[3], cornersFront[2], cornersFront[2], cornersFront[0]);
  // back rectangle
  segs.push(cornersBack[0], cornersBack[1], cornersBack[1], cornersBack[3], cornersBack[3], cornersBack[2], cornersBack[2], cornersBack[0]);
  // connecting edges
  for (let i=0;i<4;i++) segs.push(cornersFront[i], cornersBack[i]);

  const edgeGeo = new THREE.BufferGeometry().setFromPoints(segs);
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.add(edgeLines);

  return { group, tex };
}
