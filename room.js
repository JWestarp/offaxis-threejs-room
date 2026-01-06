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

export function buildRoom({ screenW, screenH, depth, gridStep, mode, minDepth = 0.1 }) {
  const group = new THREE.Group();
  group.name = 'Room';

  const gridColor = 0x444444;
  const checkerColor1 = 0x333333;
  const checkerColor2 = 0x4c4c4c;

  const effectiveDepth = Math.max(minDepth, depth);

  // Back wall
  const backZ = -effectiveDepth;
  if (mode === 'grid') {
    group.add(makeGrid({ width: screenW, height: screenH, step: gridStep, color: gridColor, z: backZ }));
  } else {
    group.add(makeCheckerboard({ width: screenW, height: screenH, step: gridStep, color1: checkerColor1, color2: checkerColor2, z: backZ }));
  }

  // Side walls
  const wallDepth = effectiveDepth;
  if (mode === 'grid') {
    group.add(makeGrid({ width: wallDepth, height: screenH, step: gridStep, color: gridColor, rotation: [0, Math.PI/2, 0], position: [-screenW/2, 0, -wallDepth/2] }));
    group.add(makeGrid({ width: wallDepth, height: screenH, step: gridStep, color: gridColor, rotation: [0, -Math.PI/2, 0], position: [screenW/2, 0, -wallDepth/2] }));
  } else {
    group.add(makeCheckerboard({ width: wallDepth, height: screenH, step: gridStep, color1: checkerColor1, color2: checkerColor2, rotation: [0, Math.PI/2, 0], position: [-screenW/2, 0, -wallDepth/2] }));
    group.add(makeCheckerboard({ width: wallDepth, height: screenH, step: gridStep, color1: checkerColor1, color2: checkerColor2, rotation: [0, -Math.PI/2, 0], position: [screenW/2, 0, -wallDepth/2] }));
  }

  // Floor and ceiling
  if (mode === 'grid') {
    group.add(makeGrid({ width: screenW, height: wallDepth, step: gridStep, color: gridColor, rotation: [-Math.PI/2, 0, 0], position: [0, -screenH/2, -wallDepth/2] }));
    group.add(makeGrid({ width: screenW, height: wallDepth, step: gridStep, color: gridColor, rotation: [Math.PI/2, 0, 0], position: [0, screenH/2, -wallDepth/2] }));
  } else {
    group.add(makeCheckerboard({ width: screenW, height: wallDepth, step: gridStep, color1: checkerColor1, color2: checkerColor2, rotation: [-Math.PI/2, 0, 0], position: [0, -screenH/2, -wallDepth/2] }));
    group.add(makeCheckerboard({ width: screenW, height: wallDepth, step: gridStep, color1: checkerColor1, color2: checkerColor2, rotation: [Math.PI/2, 0, 0], position: [0, screenH/2, -wallDepth/2] }));
  }

  return { group };
}
