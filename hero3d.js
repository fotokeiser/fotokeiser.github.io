// Startseite: Ich als 3D-Relief (steht still), Porträts kreisen als Abzüge um mich.
// Beim Scrollen fährt die Kamera heran, der Ring öffnet sich und fliegt an ihr vorbei.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const hero = document.querySelector(".hero");
const canvas = hero.querySelector(".hero__canvas");
const content = hero.querySelector(".hero__content");
const bottom = hero.querySelector(".hero__bottom");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  renderer = null;
}
if (renderer) {
  document.documentElement.classList.add("webgl");
  init();
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
}

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d0d0c, 8, 16);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
  const loader = new THREE.TextureLoader();
  const world = new THREE.Group();
  scene.add(world);

  // Ich: Foto + Tiefenkarte, im Vertex-Shader nach vorn gewölbt
  const meH = 3.4;
  const meW = (meH * 960) / 920;
  const meMap = loader.load("img/torben-3d.png");
  meMap.colorSpace = THREE.SRGBColorSpace;
  const meMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uMap: { value: meMap },
      uDepth: { value: loader.load("img/torben-depth.png") },
      uAmp: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uDepth;
      uniform float uAmp;
      varying vec2 vUv;
      varying float vD;
      void main() {
        vUv = uv;
        vD = texture2D(uDepth, uv).r;
        vec3 p = position + normal * vD * uAmp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vD;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        if (c.a < 0.03) discard;
        // Ränder leicht abdunkeln, damit die Wölbung plastischer wirkt
        c.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.6, vD));
        gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
  });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(meW, meH, 240, 240), meMat);
  world.add(me);

  // Ring aus Abzügen
  const photos = ["lachen", "jana", "leder", "till-park", "thorn", "blitz", "rot", "plenum", "colin", "schatten", "duo", "profil", "gruen", "sitzen", "blumen"];
  const ring = new THREE.Group();
  world.add(ring);
  const R = 2.9;
  const cw = 0.88;
  const ch = 1.1;
  const paperGeo = new THREE.PlaneGeometry(cw + 0.07, ch + 0.17);
  const photoGeo = new THREE.PlaneGeometry(cw, ch);
  const paperMat = new THREE.MeshBasicMaterial({ color: 0xeeede6 });
  const backMat = new THREE.MeshBasicMaterial({ color: 0x23231f, side: THREE.BackSide });
  let plenumSlot = null;
  let plenumAngle = 0;
  photos.forEach((name, i) => {
    const a = (i / photos.length) * Math.PI * 2;
    if (name === "plenum") {
      // Platzhalter im Ring, das eigentliche Bild fliegt später frei (siehe unten)
      plenumAngle = a;
      plenumSlot = new THREE.Object3D();
      plenumSlot.position.set(Math.sin(a) * R, Math.sin(a * 3) * 0.22, Math.cos(a) * R);
      plenumSlot.rotation.set(0, a, Math.sin(a * 2) * 0.08);
      ring.add(plenumSlot);
      return;
    }
    const t = loader.load(`img/${name}-s.webp`, (tx) => {
      const ia = tx.image.width / tx.image.height;
      const ca = cw / ch;
      if (ia > ca) {
        tx.repeat.set(ca / ia, 1);
        tx.offset.set((1 - ca / ia) / 2, 0);
      } else {
        tx.repeat.set(1, ia / ca);
        tx.offset.set(0, (1 - ia / ca) * 0.75);
      }
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const card = new THREE.Group();
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.set(0, -0.05, -0.004);
    const back = new THREE.Mesh(paperGeo, backMat);
    back.position.copy(paper.position);
    const photoMat = new THREE.MeshBasicMaterial({ map: t });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    card.add(paper, back, photo);
    card.position.set(Math.sin(a) * R, Math.sin(a * 3) * 0.22, Math.cos(a) * R);
    card.rotation.set(0, a, Math.sin(a * 2) * 0.08);
    ring.add(card);
  });

  // Plenarsaal: kreist erst als Abzug mit, löst sich dann und füllt den Bildschirm.
  // Am Ende übernimmt nahtlos der nächste Abschnitt mit demselben Bild.
  const plTex = loader.load("img/plenum.webp", () => cover(cw / ch));
  plTex.colorSpace = THREE.SRGBColorSpace;
  plTex.anisotropy = 8;
  const cover = (planeAspect) => {
    const img = plTex.image;
    if (!img) return;
    const ia = img.width / img.height;
    if (ia > planeAspect) {
      plTex.repeat.set(planeAspect / ia, 1);
      plTex.offset.set((1 - planeAspect / ia) / 2, 0);
    } else {
      // vertikal wie im nächsten Abschnitt (object-position 50% 62%)
      plTex.repeat.set(1, ia / planeAspect);
      plTex.offset.set(0, (1 - ia / planeAspect) * 0.38);
    }
  };
  const plenum = new THREE.Group();
  // transparent, damit es nach mir (ebenfalls transparent) gezeichnet wird
  const plPaperMat = paperMat.clone();
  plPaperMat.transparent = true;
  const plBackMat = backMat.clone();
  plBackMat.transparent = true;
  const plPhotoMat = new THREE.MeshBasicMaterial({ map: plTex, transparent: true });
  const plPaper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plPaperMat);
  plPaper.position.z = -0.002;
  const plBack = new THREE.Mesh(plPaper.geometry, plBackMat);
  plBack.position.z = -0.002;
  const plPhoto = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plPhotoMat);
  // kurzer Lichtreflex, wenn das Bild landet
  const plGlintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const plGlint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plGlintMat);
  plGlint.position.z = 0.001;
  // gleiche Abdunklung nach unten wie im nächsten Abschnitt (transparent 40 % → 70 % Schwarz)
  const shadeCanvas = document.createElement("canvas");
  shadeCanvas.width = 4;
  shadeCanvas.height = 256;
  const sctx = shadeCanvas.getContext("2d");
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.4, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.7)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 4, 256);
  const plShadeMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadeCanvas), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const plShade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plShadeMat);
  plShade.position.z = 0.002;
  plShade.renderOrder = 13;
  plenum.add(plPaper, plBack, plPhoto, plGlint, plShade);
  const pin = hero.querySelector(".hero__pin");
  const next = hero.querySelector(".hero__next");
  // Reihenfolge: Rückseite/Rand, dann Foto, dann Reflex
  plPaper.renderOrder = plBack.renderOrder = 10;
  plPhoto.renderOrder = 11;
  plGlint.renderOrder = 12;
  const flipQuat = new THREE.Quaternion();
  const flipEuler = new THREE.Euler();
  scene.add(plenum);
  const zoomSection = document.querySelector(".zoom");
  const slotPos = new THREE.Vector3();
  const slotQuat = new THREE.Quaternion();
  const slotScale = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  // Layout je nach Bildschirm
  const layout = { x: 0, y: 0, camZ: 9 };
  let ringBaseY = 0;
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = camera.aspect > 1.1;
    // auf breiten Bildschirmen näher ran, damit oben nicht so viel leerer Raum bleibt
    layout.camZ = wide ? 7.3 : 13.5;
    const viewH = 2 * layout.camZ * Math.tan(THREE.MathUtils.degToRad(17.5));
    layout.x = wide ? viewH * camera.aspect * 0.27 : 0;
    // ich stehe unten im Bild, auf dem Handy etwas höher (Text sitzt unten)
    layout.y = -viewH / 2 + meH / 2 - 0.05 + (wide ? 0 : viewH * 0.3);
    me.position.y = layout.y;
    ringBaseY = layout.y + meH * 0.14;
    ring.position.y = ringBaseY;
  };
  resize();
  addEventListener("resize", resize);

  ring.rotation.set(0.3, 0, -0.08);

  const clamp = THREE.MathUtils.clamp;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const look = new THREE.Vector3();
  const clock = new THREE.Clock();
  let spin = 0;
  let lock = null;

  const tick = () => {
    requestAnimationFrame(tick);
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const p = clamp(-rect.top / (hero.offsetHeight - innerHeight), 0, 1);
    // sobald der Plenarsaal drüberfährt, Szene langsam abdunkeln
    canvas.style.opacity = clamp((rect.bottom / innerHeight) * 1.6 - 0.6, 0, 1);
    // nur der erste Teil des Ablaufs: Schluss, sobald die Fotos an der Kamera vorbeiziehen
    // Zeitachse in Bildschirmhöhen gescrollt, damit Anfang und Flug unabhängig voneinander getaktet sind
    const sv = -rect.top / innerHeight;
    const a = Math.min(0.5, sv * 0.59);
    // Flug des Plenarsaal-Bildes (0 = im Ring, 1 = füllt den Bildschirm)
    const k = reduce ? 0 : ease(clamp((sv - 0.38) / 1.4, 0, 1));

    world.position.x = layout.x * (1 - ease(clamp(a * 1.6, 0, 1)));

    // vor dem Abflug dreht der Ring das Plenarsaal-Bild nach hinten,
    // damit es immer hinter mir hervorkommt
    const lockS = reduce ? 0 : clamp((sv - 0.21) / 0.17, 0, 1);
    if (lockS <= 0) {
      lock = null;
      spin += dt * (reduce ? 0 : 0.14 + a * 1.8);
      ring.rotation.y = spin;
    } else {
      if (!lock) {
        let need = (((Math.PI - plenumAngle - spin) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (need < Math.PI) need += Math.PI * 2;
        lock = { from: spin, need };
      }
      ring.rotation.y = lock.from + lock.need * ease(lockS);
    }
    const open = reduce ? 0 : ease(a);
    // die übrigen Abzüge machen Platz, sobald das Plenarsaal-Bild losfliegt
    ring.scale.setScalar(1 + open * 2.8);
    ring.rotation.x = 0.3 - open * 0.9;
    ring.position.y = ringBaseY + open * 3.2;
    me.position.z = -k * 1.2;

    // Kamera: leichte Parallaxe, dann ran an mich (nicht zu nah, das Foto ist klein)
    const f = reduce ? 0 : ease(clamp(a / 0.9, 0, 1));
    const faceY = me.position.y + meH * 0.3;
    camera.position.set(0, THREE.MathUtils.lerp(0.1, faceY, f), THREE.MathUtils.lerp(layout.camZ, 5.6, f));
    look.set(THREE.MathUtils.lerp(world.position.x * 0.5, 0, f), THREE.MathUtils.lerp(0, faceY, f), 0);
    camera.lookAt(look);

    // Text weg
    const fade = clamp(1 - a * 3.2, 0, 1);
    content.style.opacity = fade;
    content.style.transform = `translateY(${-a * 120}px)`;
    bottom.style.opacity = fade;
    pin.style.setProperty("--veil", fade);

    // Plenarsaal aus dem Ring lösen und vor die Kamera zoomen
    camera.updateMatrixWorld();
    ring.updateMatrixWorld();
    plenumSlot.matrixWorld.decompose(slotPos, slotQuat, slotScale);
    // erst nach dem Ablesen der Startposition fliegt der Rest des Rings nach oben weg
    ring.scale.multiplyScalar(1 + k * 0.15);
    ring.position.y += ease(clamp(k / 0.6, 0, 1)) * 7;
    const d = 0.6;
    const fullH = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.01;
    const fullW = fullH * camera.aspect;
    camera.getWorldDirection(camDir);
    // Phase 1: von hinten heranfliegen, umdrehen, als Abzug mit Rand den Bildschirm füllen
    // Phase 2: kurz halten, dann so weit ran, dass der Rand aus dem Bild rutscht
    const k1 = clamp(k / 0.68, 0, 1);
    // erst hinter mir (verdeckt), sobald es hervorkommt, liegt es über allem anderen
    const onTop = k1 > 0.3;
    plPaperMat.depthTest = plBackMat.depthTest = plPhotoMat.depthTest = !onTop;
    const k2 = THREE.MathUtils.smoothstep(k, 0.84, 1);
    plenum.position.copy(slotPos).lerp(camDir.multiplyScalar(d).add(camera.position), k1);
    plenum.quaternion.copy(slotQuat).slerp(camera.quaternion, k1);
    flipEuler.set(0, 0, Math.sin(k1 * Math.PI) * 0.4);
    plenum.quaternion.multiply(flipQuat.setFromEuler(flipEuler));
    const framedW = fullW / 1.08;
    const framedH = fullH / 1.155;
    const w = THREE.MathUtils.lerp(THREE.MathUtils.lerp(cw * slotScale.x, framedW, k1), fullW, k2);
    const h = THREE.MathUtils.lerp(THREE.MathUtils.lerp(ch * slotScale.y, framedH, k1), fullH, k2);
    plPaper.scale.set(w * 1.08, h * 1.155, 1);
    plBack.scale.copy(plPaper.scale);
    plPhoto.scale.set(w, h, 1);
    plPhoto.position.y = h * 0.045 * (1 - k2);
    plGlint.scale.set(w, h, 1);
    plGlint.position.y = plPhoto.position.y;
    plGlintMat.opacity = clamp(1 - Math.abs(k - 0.74) / 0.07, 0, 1) * 0.35;
    // zum Ende hin schon so aussehen wie der nächste Abschnitt: Abdunklung + Überschrift
    const settle = THREE.MathUtils.smoothstep(k, 0.86, 1);
    plShade.scale.set(w, h, 1);
    plShade.position.y = plPhoto.position.y;
    plShadeMat.opacity = settle;
    next.style.opacity = settle;
    next.style.transform = `translateY(${(1 - settle) * 40}px)`;
    cover(w / h);
    // nächster Abschnitt übernimmt im letzten Moment
    zoomSection.style.opacity = clamp((p - 0.985) / 0.015, 0, 1);

    renderer.render(scene, camera);
  };
  tick();
}
