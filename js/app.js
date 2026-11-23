(function () {
  'use strict';

  const ADMIN = new URLSearchParams(location.search).has('edit');
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

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  if (!window.THREE || !THREE.OrbitControls) {
    $('stage').append(el('div', { class: 'fatal' }, '3D 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'));
    return;
  }

  /* ---------- 임시 저장 (관리자 브라우저 전용) ---------- */
  const store = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('school-map-3d', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get() {
      const db = await this.open();
      return new Promise((res, rej) => {
        const r = db.transaction('kv').objectStore('kv').get('draft');
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => rej(r.error);
      });
    },
    async set(v) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        if (v === null) tx.objectStore('kv').delete('draft');
        else tx.objectStore('kv').put(v, 'draft');
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    }
  };

  let state = clone(window.SCHOOL_DATA);
  let saveTimer;
  function touch() {
    if (!ADMIN) return;
    $('saveState').textContent = '저장 중…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await store.set(clone(state));
        $('saveState').textContent = '이 브라우저에 저장됨';
      } catch (e) {
        $('saveState').textContent = '저장 실패';
        toast('자동 저장에 실패했습니다. 공개용 파일로 내보내 보관해 주세요.');
      }
    }, 350);
  }

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
  const drawGroup = new THREE.Group();
  scene.add(groundGroup, buildingsGroup, drawGroup);

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
    if (ADMIN) {
      const name = el('input', { value: state.name, oninput: (e) => { state.name = e.target.value; $('schoolName').textContent = state.name; document.title = state.name; touch(); } });
      const intro = el('textarea', { value: state.intro || '', oninput: (e) => { state.intro = e.target.value; touch(); } });
      panel.append(el('div', { class: 'form' },
        el('label', {}, '안내도 제목', name),
        el('label', {}, '소개 문구', intro)));
    }
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
    if (ADMIN) panel.append(editForm(b));
  }

  function editForm(b) {
    const rebuild = () => { buildBuilding(b); applyFocus(); touch(); };
    const num = (label, value, min, max, step, apply) => el('label', {}, label, el('input', {
      type: 'number', value, min, max, step,
      onchange: (e) => {
        const v = Math.min(max, Math.max(min, Number(e.target.value) || min));
        e.target.value = v;
        apply(v);
      }
    }));
    const photoInput = el('input', {
      type: 'file', accept: 'image/*', hidden: true,
      onchange: async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          b.photo = await readImage(f, 1280);
          b.photoOnWalls = true;
          rebuild();
          renderPanel();
        } catch (err) { toast(err.message); }
      }
    });
    const roomFields = [];
    for (let i = b.floors - 1; i >= 0; i--) {
      roomFields.push(el('label', {}, `${i + 1}층 교실 (한 줄에 하나씩)`, el('textarea', {
        value: roomsOf(b, i).join('\n'),
        onchange: (e) => {
          b.rooms = b.rooms || {};
          b.rooms[i + 1] = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
          touch();
          renderPanel();
        }
      })));
    }
    return el('div', { class: 'form' },
      el('label', {}, '건물 이름', el('input', {
        id: 'fieldName', value: b.name,
        oninput: (e) => { b.name = e.target.value; built.get(b.id).label.textContent = b.name; touch(); },
        onchange: renderPanel
      })),
      el('div', { class: 'cols' },
        num('층수', b.floors, 1, 30, 1, (v) => { b.floors = v; rebuild(); renderPanel(); }),
        num('층 높이(m)', b.floorHeight, 2.5, 20, 0.5, (v) => { b.floorHeight = v; rebuild(); }),
        el('label', {}, '색상', el('input', { type: 'color', value: b.color, onchange: (e) => { b.color = e.target.value; rebuild(); } }))),
      el('label', {}, '설명', el('textarea', { value: b.desc || '', onchange: (e) => { b.desc = e.target.value; touch(); renderPanel(); } })),
      el('div', { class: 'actions' },
        el('button', { type: 'button', onclick: () => photoInput.click() }, b.photo ? '건물 사진 바꾸기' : '건물 사진 올리기'),
        b.photo ? el('button', { type: 'button', onclick: () => { b.photo = null; b.photoOnWalls = false; rebuild(); renderPanel(); } }, '사진 삭제') : null,
        photoInput),
      b.photo ? el('label', { class: 'check' }, el('input', {
        type: 'checkbox', checked: !!b.photoOnWalls,
        onchange: (e) => { b.photoOnWalls = e.target.checked; rebuild(); }
      }), '사진을 건물 벽면에 입히기') : null,
      roomFields,
      el('div', { class: 'actions' },
        el('button', { type: 'button', onclick: () => startDraw(b.id) }, '윤곽 다시 그리기'),
        el('button', {
          type: 'button', class: 'danger',
          onclick: () => {
            if (!confirm(`'${b.name}' 건물을 삭제할까요?`)) return;
            state.buildings = state.buildings.filter((x) => x !== b);
            removeBuilt(b.id);
            clearSelection();
            touch();
          }
        }, '건물 삭제')));
  }

  function selectBuilding(id, floor, moveCamera) {
    if (drawing) return;
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

  /* ---------- 건물 윤곽 그리기 ---------- */
  let drawing = null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function groundPoint(e) {
    setRay(e);
    const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!p) return null;
    const { width: w, height: h } = state.ground;
    if (Math.abs(p.x) > w / 2 || Math.abs(p.z) > h / 2) return null;
    return [Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2];
  }

  function startDraw(targetId) {
    drawing = { targetId: targetId || null, pts: [], cursor: null };
    tween = null;
    controls.autoRotate = false;
    controls.enableRotate = false;
    $('btnSpin').setAttribute('aria-pressed', 'false');
    stage.classList.add('drawing');
    $('drawBar').hidden = false;
    viewTop();
    updateDraw();
  }
  function endDraw() {
    drawing = null;
    disposeGroup(drawGroup);
    controls.enableRotate = true;
    stage.classList.remove('drawing');
    $('drawBar').hidden = true;
  }
  function updateDraw() {
    disposeGroup(drawGroup);
    if (!drawing) return;
    const n = drawing.pts.length;
    $('drawHint').textContent = n < 3
      ? `건물 모서리를 차례로 클릭하세요. (${n}/3점 이상)`
      : `${n}개 점 선택. 첫 점을 누르거나 완료를 누르면 닫힙니다.`;
    $('drawUndo').disabled = !n;
    $('drawDone').disabled = n < 3;
    const line = drawing.pts.map((p) => new THREE.Vector3(p[0], 0.6, p[1]));
    if (drawing.cursor && n) line.push(new THREE.Vector3(drawing.cursor[0], 0.6, drawing.cursor[1]));
    if (line.length > 1) {
      drawGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: '#d4331f' })));
    }
    drawing.pts.forEach((p, i) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(i === 0 ? 1.8 : 1.2, 20), new THREE.MeshBasicMaterial({ color: i === 0 ? '#17695c' : '#d4331f' }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(p[0], 0.7, p[1]);
      drawGroup.add(m);
    });
  }
  function segCross(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  function selfCrosses(pts) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 2; j < pts.length; j++) {
        if (i === 0 && j === pts.length - 1) continue;
        if (segCross(pts[i], pts[(i + 1) % pts.length], pts[j], pts[(j + 1) % pts.length])) return true;
      }
    }
    return false;
  }
  function finishDraw() {
    if (!drawing || drawing.pts.length < 3) return;
    const pts = drawing.pts;
    if (selfCrosses(pts)) { toast('선이 서로 교차합니다. 되돌리기로 점을 고쳐 주세요.'); return; }
    if (Math.abs(signedArea(pts)) < 4) { toast('건물 면적이 너무 작습니다.'); return; }
    let b = getB(drawing.targetId);
    if (b) {
      b.outline = pts;
    } else {
      b = {
        id: `b${Date.now()}`, name: '새 건물', floors: 3, floorHeight: 4, color: '#d9c7a8',
        desc: '', photo: null, photoOnWalls: false, outline: pts, rooms: {}
      };
      state.buildings.push(b);
    }
    endDraw();
    buildBuilding(b);
    touch();
    selectBuilding(b.id, null, true);
    const f = $('fieldName');
    if (f) { f.focus(); f.select(); }
  }
  function drawClick(e) {
    const p = groundPoint(e);
    if (!p) { toast('지도 안쪽을 클릭해 주세요.'); return; }
    const pts = drawing.pts;
    if (pts.length >= 3 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < 3) { finishDraw(); return; }
    const last = pts[pts.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) return;
    pts.push(p);
    updateDraw();
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
    if (drawing) { drawing.cursor = groundPoint(e); updateDraw(); return; }
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
    if (drawing) { drawClick(e); return; }
    const id = pickBuilding(e);
    if (id) selectBuilding(id, null, true);
  });
  canvas.addEventListener('dblclick', () => { if (drawing) finishDraw(); });
  window.addEventListener('keydown', (e) => {
    if (!drawing) return;
    if (e.key === 'Escape') endDraw();
    if (e.key === 'Enter') finishDraw();
    if (e.key === 'Backspace') { e.preventDefault(); drawing.pts.pop(); updateDraw(); }
  });

  /* ---------- 이미지 / 파일 ---------- */
  function readImage(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('사진을 읽을 수 없습니다. JPG나 PNG 파일로 올려 주세요.'));
      };
      img.src = url;
    });
  }
  function imageSize(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res([i.naturalWidth, i.naturalHeight]);
      i.onerror = rej;
      i.src = src;
    });
  }

  function validData(d) {
    return d && typeof d === 'object' && d.ground && Array.isArray(d.buildings) &&
      d.buildings.every((b) => b.id && Array.isArray(b.outline) && b.outline.length >= 3 && b.floors >= 1 && b.floorHeight > 0);
  }

  function setupAdmin() {
    $('adminBadge').hidden = false;
    $('toolbar').hidden = false;
    $('btnGround').onclick = () => $('fileGround').click();
    $('btnAdd').onclick = () => { if (drawing) endDraw(); startDraw(null); };
    $('btnImport').onclick = () => $('fileImport').click();
    $('drawUndo').onclick = () => { drawing.pts.pop(); updateDraw(); };
    $('drawDone').onclick = finishDraw;
    $('drawCancel').onclick = endDraw;

    $('fileGround').onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const image = await readImage(f, 2048);
        const [iw, ih] = await imageSize(image);
        const L = 240;
        state.ground = iw >= ih
          ? { width: L, height: Math.round(L * ih / iw), image, sample: false }
          : { width: Math.round(L * iw / ih), height: L, image, sample: false };
        buildGround();
        touch();
        viewTop();
        toast('배치도를 올렸습니다. 건물 추가를 눌러 윤곽을 따라 그려 보세요.');
      } catch (err) { toast(err.message || '사진을 읽을 수 없습니다.'); }
    };

    $('btnExport').onclick = () => {
      const text = `window.SCHOOL_DATA = ${JSON.stringify(state)};\n`;
      const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/javascript' })), download: 'school-data.js' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('내려받은 school-data.js를 data 폴더의 같은 파일과 바꾸면 방문자 화면에 반영됩니다.');
    };

    $('fileImport').onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const t = await f.text();
        const d = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
        if (!validData(d)) throw new Error('invalid');
        state = d;
        selected = { id: null, floor: null };
        buildGround();
        rebuildAll();
        renderPanel();
        viewHome();
        touch();
      } catch (err) { toast('안내도 데이터 파일이 아닙니다.'); }
    };

    $('btnReset').onclick = async () => {
      if (!confirm('이 브라우저의 편집 내용을 지우고 공개된 데이터로 되돌릴까요?')) return;
      clearTimeout(saveTimer);
      try { await store.set(null); } catch (err) { /* 저장소가 막힌 환경 */ }
      state = clone(window.SCHOOL_DATA);
      selected = { id: null, floor: null };
      buildGround();
      rebuildAll();
      renderPanel();
      viewHome();
      $('saveState').textContent = '';
    };
  }

  /* ---------- 버튼 / 렌더 루프 ---------- */
  $('btnHome').onclick = () => { if (drawing) return; clearSelection(); };
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

  async function init() {
    if (ADMIN) {
      setupAdmin();
      try {
        const draft = await store.get();
        if (validData(draft)) {
          state = draft;
          $('saveState').textContent = '이 브라우저에 저장됨';
        }
      } catch (e) { toast('이 브라우저에서는 자동 저장을 쓸 수 없습니다.'); }
    }
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
