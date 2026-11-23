(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'aria-pressed') n.setAttribute(k, String(v));
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    });
    kids.flat().forEach((c) => { if (c !== null && c !== undefined) n.append(c); });
    return n;
  }

  if (!window.THREE || !THREE.OrbitControls) {
    $('stage').append(el('div', { class: 'fatal' }, '3D 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'));
    return;
  }

  const state = clone(window.SCHOOL_DATA);

  /* ---------- 3D 장면 ---------- */
  const stage = $('stage');
  const canvas = $('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    stage.append(el('div', { class: 'fatal' }, '이 브라우저에서는 3D 화면을 표시할 수 없습니다.'));
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dcebf0');
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 2000);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 25;
  controls.maxDistance = 650;
  controls.autoRotateSpeed = 0.7;

  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b39f', 0.5));
  const sun = new THREE.DirectionalLight('#fff4df', 0.5);
  sun.position.set(-110, 190, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -210, right: 210, top: 210, bottom: -210, near: 10, far: 560 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const groundGroup = new THREE.Group();
  const buildingsGroup = new THREE.Group();
  scene.add(groundGroup, buildingsGroup);

  const texLoader = new THREE.TextureLoader();
  function photoTexture(url) {
    const t = texLoader.load(url);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  const windowTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#3f5d6e';
    g.fillRect(24, 34, 80, 56);
    g.fillStyle = '#7fa3b5';
    g.fillRect(28, 38, 34, 48);
    g.fillRect(66, 38, 34, 48);
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, 124, 128, 4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  })();

  function sampleGroundTexture(w, h) {
    const s = 6;
    const c = document.createElement('canvas');
    c.width = w * s;
    c.height = h * s;
    const g = c.getContext('2d');
    g.scale(s, s);
    g.translate(w / 2, h / 2);
    g.fillStyle = '#b9d29a';
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = '#ece6d8';
    g.lineCap = 'round';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-112, 20); g.lineTo(112, -18);
    g.moveTo(-46, -30); g.lineTo(-46, 75);
    g.moveTo(16, -30); g.lineTo(16, -8);
    g.stroke();
    g.fillStyle = '#c0694e';
    g.beginPath(); g.roundRect(-2, -1, 100, 66, 33); g.fill();
    g.fillStyle = '#74a95f';
    g.beginPath(); g.roundRect(8, 9, 80, 46, 23); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = .6;
    g.beginPath(); g.roundRect(3, 4, 90, 56, 28); g.stroke();
    g.beginPath(); g.moveTo(48, 9); g.lineTo(48, 55); g.stroke();
    g.beginPath(); g.arc(48, 32, 8, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function disposeGroup(group) {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map && m.map !== windowTexture) m.map.dispose();
          m.dispose();
        });
      }
    });
    group.clear();
  }

  let groundMesh;
  function buildGround() {
    disposeGroup(groundGroup);
    const { width: w, height: h, image, sample } = state.ground;
    const base = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshLambertMaterial({ color: '#cfdccb' }));
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.2;
    groundGroup.add(base);
    const opts = { color: '#c8d8ae' };
    if (image) { opts.map = photoTexture(image); opts.color = '#ffffff'; }
    else if (sample) { opts.map = sampleGroundTexture(w, h); opts.color = '#ffffff'; }
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial(opts));
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundGroup.add(groundMesh);
  }

  /* ---------- 건물 ---------- */
  const built = new Map();
  let selected = { id: null, floor: null };
  let hoveredId = null;

  function signedArea(pts) {
    let a = 0;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; });
    return a / 2;
  }
  const oriented = (pts) => (signedArea(pts) > 0 ? pts.slice().reverse() : pts.slice());

  function centroid(pts) {
    const a = signedArea(pts);
    if (Math.abs(a) < 1e-6) return [pts[0][0], pts[0][1]];
    let x = 0, z = 0;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const f = p[0] * q[1] - q[0] * p[1];
      x += (p[0] + q[0]) * f;
      z += (p[1] + q[1]) * f;
    });
    return [x / (6 * a), z / (6 * a)];
  }

  function wallGeometry(pts, y0, y1, floorIndex, floors, usePhoto) {
    const pos = [], nor = [], uv = [];
    let run = 0;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const u0 = usePhoto ? 0 : run / 4.5;
      const u1 = usePhoto ? 1 : Math.max(1, Math.round(len / 4.5)) + u0;
      const v0 = usePhoto ? floorIndex / floors : 0;
      const v1 = usePhoto ? (floorIndex + 1) / floors : 1;
      pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
      for (let k = 0; k < 6; k++) nor.push(nx, 0, nz);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      run += Math.max(1, Math.round(len / 4.5)) * 4.5;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }

  function capGeometry(pts, y) {
    const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const pos = [], nor = [];
    tris.forEach(([i, j, k]) => {
      let a = pts[i], b = pts[j], c = pts[k];
      const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
      if (ny < 0) [b, c] = [c, b];
      pos.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  }

  function removeBuilt(id) {
    const item = built.get(id);
    if (!item) return;
    disposeGroup(item.group);
    buildingsGroup.remove(item.group);
    item.label.remove();
    built.delete(id);
  }

  function buildBuilding(b) {
    removeBuilt(b.id);
    const pts = oriented(b.outline);
    const group = new THREE.Group();
    group.userData.id = b.id;
    const usePhoto = !!(b.photo && b.photoOnWalls);
    const photo = usePhoto ? photoTexture(b.photo) : null;
    const floors = [];
    for (let i = 0; i < b.floors; i++) {
      const y0 = i * b.floorHeight, y1 = (i + 1) * b.floorHeight;
      const mat = new THREE.MeshLambertMaterial({
        map: usePhoto ? (i === 0 ? photo : photo.clone()) : windowTexture,
        color: usePhoto ? '#ffffff' : b.color
      });
      if (usePhoto && i > 0) mat.map.needsUpdate = true;
      const walls = new THREE.Mesh(wallGeometry(pts, y0, y1, i, b.floors, usePhoto), mat);
      walls.castShadow = true;
      const cap = new THREE.Mesh(capGeometry(pts, y1), new THREE.MeshLambertMaterial({ color: '#efece4' }));
      cap.castShadow = true;
      walls.userData.id = cap.userData.id = b.id;
      group.add(walls, cap);
      floors.push({ walls, cap });
    }
    buildingsGroup.add(group);
    const label = el('button', { class: 'pin', type: 'button', onclick: () => selectBuilding(b.id, null, true) }, b.name);
    $('labels').append(label);
    const [cx, cz] = centroid(pts);
    built.set(b.id, { group, floors, label, cx, cz, top: b.floors * b.floorHeight });
  }

  function rebuildAll() {
    [...built.keys()].forEach(removeBuilt);
    state.buildings.forEach(buildBuilding);
    applyFocus();
  }

  function applyFocus() {
    built.forEach((item, id) => {
      const isSel = selected.id === id;
      const f = isSel ? selected.floor : null;
      const top = f === null ? item.floors.length - 1 : f;
      item.floors.forEach((fl, i) => {
        fl.walls.visible = i <= top;
        fl.cap.visible = i === top;
        const glow = isSel && (f === null || f === i) ? 0x1c5a50 : (hoveredId === id ? 0x25302c : 0);
        fl.walls.material.emissive.setHex(glow);
        fl.walls.material.emissiveIntensity = isSel ? 0.42 : 0.5;
        fl.cap.material.color.set(f !== null && i === f ? '#8fd3c3' : '#efece4');
      });
      item.label.classList.toggle('active', isSel);
    });
  }

  /* ---------- 카메라 ---------- */
  let tween = null;
  function flyTo(pos, target) {
    if (reduceMotion) {
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
      return;
    }
    tween = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: pos, q1: target };
  }
  function fitDistance(w, h) {
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const dh = (h / 2) / Math.tan(vf);
    const dw = (w / 2) / (Math.tan(vf) * camera.aspect);
    return Math.max(dh, dw) * 1.12;
  }
  function viewHome() {
    const { width: w, height: h } = state.ground;
    const d = Math.min(fitDistance(w, h) * (camera.aspect < 1 ? 1.05 : 1.3), controls.maxDistance);
    flyTo(new THREE.Vector3(-d * 0.34, d * 0.72, d * 0.68), new THREE.Vector3(0, 0, 0));
  }
  function viewTop() {
    const { width: w, height: h } = state.ground;
    const d = Math.min(fitDistance(w, h), controls.maxDistance);
    flyTo(new THREE.Vector3(0, d, 0.5), new THREE.Vector3(0, 0, 0));
  }
  function viewBuilding(b) {
    const item = built.get(b.id);
    if (!item) return;
    const xs = b.outline.map((p) => p[0]), zs = b.outline.map((p) => p[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), item.top);
    const d = Math.max(size * 2.1, 55);
    const target = new THREE.Vector3(item.cx, item.top * 0.4, item.cz);
    const dir = camera.position.clone().sub(controls.target);
    dir.y = 0;
    if (dir.lengthSq() < 1) dir.set(-0.45, 0, 0.9);
    dir.normalize().multiplyScalar(d * 0.78);
    dir.y = d * 0.62;
    flyTo(target.clone().add(dir), target);
  }

  /* ---------- 패널 ---------- */
  const getB = (id) => state.buildings.find((b) => b.id === id);
  const roomsOf = (b, i) => (b.rooms && b.rooms[i + 1]) || [];

  function renderPanel() {
    const panel = $('panel');
    panel.replaceChildren();
    $('schoolName').textContent = state.name;
    document.title = state.name;
    const b = getB(selected.id);
    if (!b) renderHome(panel);
    else renderBuilding(panel, b);
  }

  function renderHome(panel) {
    panel.append(el('h2', {}, '건물 둘러보기'), el('p', {}, state.intro || ''));
    panel.append(el('div', { class: 'list' }, state.buildings.map((b) => {
      const swatch = el('span', { class: 'swatch' });
      swatch.style.background = b.color;
      return el('button', { class: 'row', type: 'button', onclick: () => selectBuilding(b.id, null, true) },
        swatch, el('strong', {}, b.name), el('span', { class: 'rooms' }, `${b.floors}층`));
    })));
    if (!state.buildings.length) panel.append(el('p', {}, '아직 건물이 없습니다.'));
  }

  function renderBuilding(panel, b) {
    panel.append(el('button', { class: 'back', type: 'button', onclick: clearSelection }, '← 전체 건물'));
    if (b.photo) panel.append(el('img', { class: 'photo', src: b.photo, alt: `${b.name} 사진` }));
    panel.append(el('h2', {}, b.name));
    if (b.desc) panel.append(el('p', {}, b.desc));
    panel.append(el('h3', {}, '층별 안내'));
    const rows = [];
    for (let i = b.floors - 1; i >= 0; i--) {
      const rooms = roomsOf(b, i);
      rows.push(el('button', {
        class: 'row', type: 'button', 'aria-pressed': selected.floor === i,
        onclick: () => selectBuilding(b.id, selected.floor === i ? null : i, false)
      }, el('strong', {}, `${i + 1}층`), el('span', { class: 'rooms' }, rooms.join(', ') || '등록된 교실 없음')));
    }
    panel.append(el('div', { class: 'list' }, rows));
  }

  function selectBuilding(id, floor, moveCamera) {
    selected = { id, floor };
    controls.autoRotate = false;
    $('btnSpin').setAttribute('aria-pressed', 'false');
    applyFocus();
    renderPanel();
    if (moveCamera) viewBuilding(getB(id));
  }
  function clearSelection() {
    selected = { id: null, floor: null };
    applyFocus();
    renderPanel();
    viewHome();
  }

  /* ---------- 검색 ---------- */
  function renderSearch() {
    const box = $('searchResults');
    const q = $('search').value.trim().toLowerCase();
    box.replaceChildren();
    box.hidden = !q;
    if (!q) return;
    const hits = [];
    state.buildings.forEach((b) => {
      if (b.name.toLowerCase().includes(q)) hits.push({ b, floor: null, text: b.name, sub: '건물' });
      for (let i = 0; i < b.floors; i++) {
        roomsOf(b, i).forEach((r) => {
          if (r.toLowerCase().includes(q)) hits.push({ b, floor: i, text: r, sub: `${b.name} ${i + 1}층` });
        });
      }
    });
    if (!hits.length) { box.append(el('p', {}, '찾는 곳이 없습니다.')); return; }
    hits.slice(0, 10).forEach((h) => box.append(el('button', {
      type: 'button',
      onclick: () => {
        $('search').value = '';
        box.hidden = true;
        selectBuilding(h.b.id, h.floor, true);
      }
    }, h.text, el('small', {}, h.sub))));
  }
  $('search').addEventListener('input', renderSearch);
  $('search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = $('searchResults').querySelector('button'); if (first) first.click(); }
    if (e.key === 'Escape') { e.target.value = ''; renderSearch(); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.search')) $('searchResults').hidden = true;
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }

  /* ---------- 포인터 ---------- */
  let down = null;
  function pickBuilding(e) {
    setRay(e);
    const hits = raycaster.intersectObjects(buildingsGroup.children, true).filter((h) => h.object.visible);
    return hits.length ? hits[0].object.userData.id : null;
  }
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; tween = null; });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const id = pickBuilding(e);
    if (id !== hoveredId) {
      hoveredId = id;
      stage.classList.toggle('hovering', !!id);
      applyFocus();
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5 || e.button !== 0) return;
    const id = pickBuilding(e);
    if (id) selectBuilding(id, null, true);
  });

  /* ---------- 버튼 / 렌더 루프 ---------- */
  $('btnHome').onclick = clearSelection;
  $('btnTop').onclick = viewTop;
  $('btnSpin').onclick = (e) => {
    controls.autoRotate = !controls.autoRotate;
    e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
  };

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  const v = new THREE.Vector3();
  function updateLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    built.forEach((item) => {
      v.set(item.cx, item.top + 1.5, item.cz).project(camera);
      const show = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      item.label.style.display = show ? '' : 'none';
      if (show) {
        const x = Math.round((v.x + 1) / 2 * w), y = Math.round((1 - v.y) / 2 * h);
        item.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    });
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / 750);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.q0, tween.q1, e);
      if (k >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
  }

  function init() {
    resize();
    buildGround();
    rebuildAll();
    renderPanel();
    const d = Math.min(fitDistance(state.ground.width, state.ground.height) * (camera.aspect < 1 ? 1.05 : 1.3), controls.maxDistance);
    camera.position.set(-d * 0.34, d * 0.72, d * 0.68);
    controls.target.set(0, 0, 0);
    controls.update();
    requestAnimationFrame(loop);
  }
  init();
})();
