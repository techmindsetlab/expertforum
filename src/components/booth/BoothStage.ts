import gsap from "gsap";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import * as T from "./textures";

/**
 * Pojok Kreasi Astragraphia — island booth 4 × 3.8 m, built in metres.
 * Axes: x = left → right (facing the backdrop), y = up, z = toward the aisle.
 * The backdrop front face sits at z = 0; the 1 m storage is behind it
 * (z −1 → 0) with a one-person door on its right side. Visitors enter from
 * the front and the right.
 *
 * The backdrop front is one print: the designer's final artwork (FA,
 * 4000 × 2400 mm, design/booth-backdrop-FA-4000x2400mm.pdf), rasterised by
 * `npm run booth:backdrop`. Headers, logos, ribbon band and the "g" are all
 * in that print; TVs and the collage sit in its boxes.
 */

export const BOOTH = {
  width: 4,
  depth: 3.8,
  storage: 1,
  wallH: 2.4,
  floor: 0, // no flooring: booth stands on the hall floor
  backdropArt: "/booth/backdrop-fa.webp", // FA at 1 px = 1 mm
  tvZ: 0.012, // TVs built into the backdrop: screens ~flush with the wall
  tabletZ: 2.012, // tablet 2.0 m in front of the centre TV
  // Two 55" TVs (1218 × 685 mm) in the FA's screen boxes, centres 1647 mm up.
  tvMain: { cx: 0, cy: 1.647, w: 1.218, h: 0.685 }, // centre: wall display
  tvSide: { cx: -1.35, cy: 1.647, w: 1.218, h: 0.685 }, // left: product slideshow above the printer
  band: { h: 1.074 }, // FA ribbon band: floor up to the bottom of the panel boxes
  g: { bottom: 0.01, h: 1.067 }, // printed "g" in the FA
  // Pojok Kreasi collage: 14 A3 works (297 × 420 mm) in slim 10 mm frames, rows
  // of 4-3-4-3 from just under the printed caption, spanning the width between
  // the centre TV and the backdrop edge; free to overlap the FA box and ribbons.
  collage: { x0: 0.655, x1: 1.995, top: 2, rows: [4, 3, 4, 3], art: { w: 0.297, h: 0.42 }, rim: 0.01 },
  table: { w: 0.5, d: 0.5, h: 1.0 }, // plain white table (50 × 50 × 100 cm) under the tablet holder
  spotlights: [0.95, 1.75], // two arm spotlights, both on Pojok Kreasi
  // Three 18 mm shelves fixed to the backdrop right of the ApeosPrint, sized for the
  // QuickLabel QL-E100 (251 L × 260 W × 292 H mm): 27 cm deep, 34 cm pitch
  // (32.2 cm clear between boards).
  shelves: { cx: -0.98, w: 0.5, d: 0.27, t: 0.018, tops: [0.92, 0.58, 0.24] },
  ql: { w: 0.26, d: 0.251, h: 0.292 },
};
const FL = BOOTH.floor;

export type ViewName = "perspektif" | "depan" | "kiri" | "kanan" | "pengunjung" | "hambalan" | "denah" | "belakang";
export const VIEWS: Record<ViewName, { label: string; pos: [number, number, number]; target: [number, number, number] }> = {
  perspektif: { label: "Perspektif", pos: [4.6, 2.5, 6.2], target: [0, 1.1, 0.7] },
  depan: { label: "Depan", pos: [0, 1.45, 6.6], target: [0, 1.2, 0.4] },
  kiri: { label: "Sisi kiri", pos: [-7.4, 1.8, 3.1], target: [-0.6, 1.1, 0.2] },
  kanan: { label: "Sisi kanan", pos: [6.4, 1.7, 1.7], target: [0, 1.1, 0.8] },
  pengunjung: { label: "Mata pengunjung", pos: [0.3, 1.7, 3.6], target: [0, 1.1, 0.7] },
  hambalan: { label: "Hambalan", pos: [-0.25, 1.25, 1.55], target: [-1.05, 0.72, 0.1] },
  denah: { label: "Denah", pos: [0, 10.5, 0.951], target: [0, 0, 0.9] },
  belakang: { label: "Belakang", pos: [-4.4, 2.4, -5.4], target: [0, 1.2, -0.4] },
};


type Progress = (msg: string) => void;

/** Frame centres of the Pojok Kreasi collage and its vertical extent (metres above the floor). */
function collageLayout() {
  const { x0, x1, top, rows, art, rim } = BOOTH.collage;
  const fw = art.w + 2 * rim;
  const fh = art.h + 2 * rim;
  const cols = Math.max(...rows);
  const gap = (x1 - x0 - cols * fw) / (cols - 1);
  const mid = (x0 + x1) / 2;
  const frames = rows.flatMap((count, r) =>
    Array.from({ length: count }, (_, i) => ({ x: mid + (i - (count - 1) / 2) * (fw + gap), y: top - fh / 2 - r * (fh + gap) })),
  );
  return { fw, fh, frames, top, bottom: top - rows.length * fh - (rows.length - 1) * gap };
}

const std = (color: string, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function shadows<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.position.set(x, y, z);
  return m;
}

function plane(w: number, h: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function texMat(c: HTMLCanvasElement, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ map: T.toTexture(c), roughness: 0.85, ...opts });
}

function person(color = "#A39CA9") {
  const g = new THREE.Group();
  const mat = std(color, 0.85);
  for (const x of [-0.09, 0.09]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.84, 12), mat);
    leg.position.set(x, 0.42, 0);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 6, 16), mat);
  torso.scale.z = 0.62;
  torso.position.y = 1.16;
  g.add(torso);
  for (const x of [-0.23, 0.23]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 10), mat);
    arm.position.set(x, 1.1, 0);
    arm.rotation.z = x > 0 ? 0.08 : -0.08;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), mat);
  head.position.y = 1.6;
  g.add(head);
  return shadows(g);
}

function label(text: string, sub?: string) {
  const el = document.createElement("div");
  el.style.cssText =
    "padding:5px 10px;border-radius:999px;background:rgba(27,18,32,.88);color:#fff;font:700 12px var(--font-sans);white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none";
  el.innerHTML = sub ? `${text}<span style="font-weight:400;opacity:.7"> · ${sub}</span>` : text;
  return new CSS2DObject(el);
}

function dimension(a: THREE.Vector3, b: THREE.Vector3, text: string, tick: THREE.Vector3) {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: "#C4197F", depthTest: false, transparent: true });
  const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
  const line = (p: THREE.Vector3, q: THREE.Vector3) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, q]), mat);
    l.renderOrder = 10;
    g.add(l);
  };
  line(pts[0], pts[1]);
  line(pts[2], pts[3]);
  line(pts[4], pts[5]);
  const el = document.createElement("div");
  el.style.cssText = "padding:3px 8px;border-radius:6px;background:#C4197F;color:#fff;font:700 12px var(--font-sans);white-space:nowrap;pointer-events:none";
  el.textContent = text;
  const lab = new CSS2DObject(el);
  lab.position.copy(a.clone().add(b).multiplyScalar(0.5));
  g.add(lab);
  return g;
}

export class BoothStage {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raf = 0;
  private ro: ResizeObserver;
  private labels = new THREE.Group();
  private dims = new THREE.Group();
  private people = new THREE.Group();
  private disposed = false;
  private slides: HTMLCanvasElement[] = [];
  private slideCanvas?: HTMLCanvasElement;
  private slideTex?: THREE.CanvasTexture;
  private clock = new THREE.Clock();
  private lastSlide = -1;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    host.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
    host.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 120);
    this.camera.position.set(...VIEWS.perspektif.pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...VIEWS.perspektif.target);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.autoRotateSpeed = 0.6;

    this.scene.background = new THREE.Color("#ECE7E2");
    this.scene.fog = new THREE.Fog("#ECE7E2", 16, 42);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.scene.add(this.labels, this.dims, this.people);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  // ─── Build ──────────────────────────────────────────────────────
  async build(progress: Progress = () => {}) {
    const fonts = T.fontFamilies();
    progress("Memuat font & logo");
    await T.ensureFonts(fonts);
    const [wordmark, wordmarkWhite, markWhite, markBlack, backdropArt] = await Promise.all([
      T.loadImage("/brand/astragraphia-wordmark.svg"),
      T.loadImage("/brand/astragraphia-wordmark-white.svg"),
      T.loadImage("/brand/wcce-mark-white.png"),
      T.loadImage("/brand/wcce-mark-black.png"),
      new THREE.TextureLoader().loadAsync(BOOTH.backdropArt),
    ]);
    if (this.disposed) return;

    progress("Mengambil karya dari wall");
    const live: string[] = await fetch("/api/wall?limit=14")
      .then((r) => r.json())
      .then((d: { items?: { id: string }[] }) => (d.items ?? []).slice(-14).map((i) => `/api/art/${i.id}/image`))
      .catch(() => []);

    progress("Lantai & backdrop");
    this.buildFloor();
    this.buildLights();
    this.buildShell();

    // The FA as one matte print across the backdrop face ("g" included).
    backdropArt.colorSpace = THREE.SRGBColorSpace;
    backdropArt.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const print = plane(BOOTH.width, BOOTH.wallH, new THREE.MeshStandardMaterial({ map: backdropArt, roughness: 0.85 }));
    print.position.set(0, FL + BOOTH.wallH / 2, 0.002);
    print.receiveShadow = true;
    this.scene.add(print);

    progress("Pojok Kreasi · 14 art");
    this.buildCollage(fonts);

    progress("TV, tablet & printer");
    const arts = await Promise.all(Array.from({ length: 14 }, (_, i) => T.artCanvas(i, live[i], 240, 240, fonts)));
    this.buildTv(T.tvScreen(fonts, arts, wordmarkWhite, markWhite), BOOTH.tvMain, true);
    this.slides = await T.productSlides(fonts);
    this.slideCanvas = document.createElement("canvas");
    this.slideCanvas.width = 1920;
    this.slideCanvas.height = 1080;
    this.slideCanvas.getContext("2d")!.drawImage(this.slides[0], 0, 0);
    this.slideTex = this.buildTv(this.slideCanvas, BOOTH.tvSide, false);
    this.buildTable(T.tabletScreen(fonts, wordmarkWhite));
    this.buildPrinter(fonts);
    this.buildShelves(fonts);
    this.buildRack(T.rackPoster(fonts, wordmark, markBlack));
    this.buildPeople();
    this.buildLabels();
    this.buildDims();
    progress("");
  }

  private buildFloor() {
    const hall = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), std("#D6D0CA", 0.95));
    hall.rotation.x = -Math.PI / 2;
    hall.receiveShadow = true;
    this.scene.add(hall);
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#b9b0a8", 0.55));
    const sun = new THREE.DirectionalLight("#fff6ee", 1.05);
    sun.position.set(3.5, 8, 6.5);
    sun.target.position.set(0, 0.8, 0.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);

    // Two arm spotlights on top of the backdrop, both lighting the Pojok Kreasi
    // collage. Long arms + a cone fitted to the collage keep the printed header
    // out of the beam.
    const black = std("#151515", 0.35, 0.6);
    const reachZ = 0.9;
    const lampY = FL + 2.38;
    const { top, bottom } = collageLayout();
    const up = Math.atan2(lampY - (FL + top), reachZ);
    const down = Math.atan2(lampY - (FL + bottom), reachZ);
    const aimY = lampY - reachZ * Math.tan((up + down) / 2);
    const cone = (down - up) / 2 + 0.04;
    for (const x of BOOTH.spotlights) {
      const arm = new THREE.Group();
      arm.add(box(0.03, 0.12, 0.03, black, 0, FL + 2.43, 0.0));
      const reach = box(0.025, 0.025, reachZ + 0.02, black, 0, FL + 2.48, reachZ / 2);
      arm.add(reach);
      const head = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 20), black);
      head.add(can);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 1.1), toneMapped: false }));
      lens.position.y = -0.081;
      lens.rotation.x = Math.PI / 2;
      head.add(lens);
      head.position.set(0, FL + 2.43, reachZ);
      arm.add(head);
      // Aim while the arm is still at the origin, then move the whole arm.
      head.lookAt(new THREE.Vector3(0, aimY, 0));
      head.rotateX(-Math.PI / 2); // cylinder axis is y; lens sits at −y
      arm.position.x = x;
      this.scene.add(shadows(arm, true, false));

      const spot = new THREE.SpotLight("#fff1dd", 2.6, 7, cone, 0.45, 2);
      spot.position.set(x, lampY, reachZ);
      spot.target.position.set(x, aimY, 0);
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0006;
      this.scene.add(spot, spot.target);
    }
  }

  private buildShell() {
    const wall = std("#F7F5F2", 0.9);
    const W = BOOTH.width;
    const H = BOOTH.wallH;
    const S = BOOTH.storage;
    const t = 0.05;
    const shell = new THREE.Group();
    shell.add(
      box(W, H, t, wall, 0, FL + H / 2, -t / 2), // backdrop (storage front)
      box(t, H, S, wall, -W / 2 + t / 2, FL + H / 2, -S / 2), // left
      box(t, H, S, wall, W / 2 - t / 2, FL + H / 2, -S / 2), // right (door)
    );
    // Storage is open at the back and on top; its outer faces stay plain white.
    // One-person door on the right face of the storage.
    const door = new THREE.Group();
    door.add(box(0.02, 2.02, 0.82, std("#2B2629", 0.5, 0.2), 0, 1.01, 0));
    door.add(box(0.02, 1.98, 0.76, std("#E7E2DC", 0.7), 0.006, 1.0, 0));
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12), std("#9a9a9a", 0.3, 0.9));
    handle.position.set(0.03, 1.02, -0.28);
    door.add(handle);
    door.position.set(W / 2 + 0.002, FL, -S / 2);
    this.scene.add(shadows(shell, true, true), shadows(door));
  }

  /**
   * 14 framed A3 student works (see BOOTH.collage): slim black frames hung
   * over the printed backdrop, overlapping its box line and ribbon band.
   */
  private buildCollage(fonts: T.Fonts) {
    const { art } = BOOTH.collage;
    const { fw, fh, frames } = collageLayout();
    const frameMat = std("#161616", 0.45, 0.2);
    const group = new THREE.Group();
    frames.forEach(({ x, y }, i) => {
      group.add(box(fw, fh, 0.02, frameMat, x, FL + y, 0.013));
      const a = plane(art.w, art.h, texMat(T.artPoster(i + 1, 420, Math.round(420 * (art.h / art.w)), fonts), { roughness: 0.7 }));
      a.position.set(x, FL + y, 0.0235);
      group.add(a);
    });
    this.scene.add(shadows(group, true, true));
  }

  /** TV built into the backdrop; returns the screen texture (for the slideshow). */
  private buildTv(screen: HTMLCanvasElement, spec: { cx: number; cy: number; w: number; h: number }, floorStand: boolean) {
    const tv = new THREE.Group();
    const dark = std("#141416", 0.35, 0.5);
    const z = BOOTH.tvZ;
    const { cx, cy, w, h } = spec;
    // Only the bezel and a dark shadow-gap reveal show on the front.
    tv.add(box(w + 0.08, h + 0.087, 0.006, std("#0b0b0c", 0.9), cx, FL + cy, 0.003)); // reveal / cut-out
    tv.add(rbox(w + 0.026, h + 0.032, 0.03, 0.006, dark, cx, FL + cy, z - 0.015)); // bezel
    // Behind the backdrop (visible through the open storage).
    tv.add(rbox(w - 0.03, h - 0.01, 0.05, 0.01, dark, cx, FL + cy, -0.075)); // rear housing
    tv.add(box(0.4, 0.3, 0.04, dark, cx, FL + cy, -0.12)); // VESA mount
    if (floorStand) {
      tv.add(box(0.08, cy, 0.06, dark, cx, FL + cy / 2, -0.17)); // column
      tv.add(box(0.8, 0.025, 0.5, dark, cx, FL + 0.0125, -0.35)); // base
    } else {
      tv.add(box(0.5, 0.06, 0.08, dark, cx, FL + cy + h / 4, -0.16)); // wall bracket rail
    }
    const tex = T.toTexture(screen);
    const glass = plane(w, h, new THREE.MeshBasicMaterial({ map: tex }));
    (glass.material as THREE.MeshBasicMaterial).color.setScalar(0.92);
    glass.position.set(cx, FL + cy, z + 0.0005);
    tv.add(glass);
    this.scene.add(shadows(tv));
    return tex;
  }

  /** Plain white table (50 × 50 × 100 cm) with a black acrylic tablet holder. */
  private buildTable(screen: HTMLCanvasElement) {
    const { w, d, h } = BOOTH.table;
    const t = new THREE.Group();
    t.add(rbox(w, h, d, 0.008, std("#F4F2EF", 0.55), 0, h / 2, 0));

    // Holder: base plate, upright with an oval cut-out, sloped rest with two lips.
    const acrylic = new THREE.MeshPhysicalMaterial({ color: "#0b0b0d", roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
    const holder = new THREE.Group();
    const th = 0.006;
    holder.add(box(0.22, th, 0.2, acrylic, 0, th / 2, 0)); // base
    const upright = new THREE.Shape();
    upright.moveTo(-0.11, 0);
    upright.lineTo(0.11, 0);
    upright.lineTo(0.11, 0.17);
    upright.lineTo(-0.11, 0.17);
    upright.closePath();
    const hole = new THREE.Path();
    hole.absellipse(0, 0.09, 0.018, 0.032, 0, Math.PI * 2, false, 0);
    upright.holes.push(hole);
    const up = new THREE.Mesh(new THREE.ExtrudeGeometry(upright, { depth: th, bevelEnabled: false, curveSegments: 24 }), acrylic);
    up.position.set(0, th, -0.1);
    holder.add(up);
    // Sloped rest from the top of the upright down toward the visitor (~30°).
    const rest = new THREE.Group();
    const top = new THREE.Vector3(0, th + 0.17, -0.097);
    const low = new THREE.Vector3(0, 0.065, 0.1);
    const len = top.distanceTo(low);
    rest.position.copy(top.clone().add(low).multiplyScalar(0.5));
    rest.rotation.x = Math.atan2(top.y - low.y, low.z - top.z);
    rest.add(box(0.2, th, len, acrylic));
    for (const x of [-0.07, 0.07]) rest.add(box(0.045, 0.016, th, acrylic, x, 0.01, len / 2 - th / 2)); // lips
    // Galaxy Tab (portrait) lying on the rest.
    rest.add(rbox(0.165, 0.008, 0.26, 0.004, std("#1a1a1d", 0.4, 0.3), 0, th / 2 + 0.004, -0.012));
    const glass = plane(0.152, 0.243, new THREE.MeshBasicMaterial({ map: T.toTexture(screen) }));
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(0, th / 2 + 0.0085, -0.012);
    rest.add(glass);
    holder.add(rest);
    holder.position.set(0, h, 0.1);
    t.add(holder);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 8), std("#55555b", 0.4, 0.6));
    pen.rotation.z = Math.PI / 2;
    pen.position.set(0.17, h + 0.004, 0.17);
    t.add(pen);
    t.position.set(0, FL, BOOTH.tabletZ - 0.1);
    this.scene.add(shadows(t));
  }

  /**
   * FUJIFILM ApeosPrint C5570 approximated: 620 W × 723 D mm, ±1141 mm tall
   * with the 2-tray module on casters (809 mm without it). Dark output bay on
   * top, touch panel on a dark pillar at the top-left.
   */
  private buildPrinter(fonts: T.Fonts) {
    const p = new THREE.Group();
    const W = 0.62;
    const D = 0.723;
    const body = std("#F1F1EF", 0.45);
    const dark = std("#2c2d31", 0.5, 0.2);
    const seam = std("#9c9c9a", 0.6);
    const front = D / 2;
    for (const [x, z] of [
      [-0.26, -0.3],
      [0.26, -0.3],
      [-0.26, 0.3],
      [0.26, 0.3],
    ]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.022, z);
      p.add(wheel);
    }
    p.add(rbox(W, 0.255, D - 0.02, 0.012, body, 0, 0.045 + 0.255 / 2, 0)); // 2-tray module
    p.add(rbox(W, 0.24, D, 0.012, body, 0, 0.3 + 0.12, 0)); // standard 2 trays
    // four paper trays: seam + recessed grip
    [0.11, 0.235, 0.36, 0.48].forEach((y) => {
      p.add(box(W - 0.03, 0.004, 0.004, seam, 0, y - 0.05, front + 0.002));
      p.add(box(0.2, 0.03, 0.01, std("#d9d9d7", 0.5), 0.02, y, front));
    });
    p.add(rbox(W, 0.28, D, 0.012, body, 0, 0.54 + 0.14, 0)); // engine
    const logo = plane(0.17, 0.032, new THREE.MeshBasicMaterial({ map: T.toTexture(T.fujifilmLabel(fonts)) }));
    logo.position.set(0.02, 0.72, front + 0.002);
    p.add(logo);
    // top: white shell, dark output bay opening on the front
    p.add(rbox(W, 0.27, D, 0.012, body, 0, 0.82 + 0.135, 0));
    p.add(rbox(W, 0.05, D, 0.01, body, 0, 1.141 - 0.025, 0)); // lid
    p.add(box(0.44, 0.21, 0.012, dark, 0.07, 0.95, front + 0.002)); // output bay
    p.add(box(0.38, 0.01, 0.07, std("#3a3b40", 0.45), 0.07, 0.855, front + 0.03)); // output tray lip
    // dark pillar + touch panel, top-left
    p.add(box(0.15, 0.3, 0.03, dark, -W / 2 + 0.075, 0.97, front + 0.004));
    const panel = new THREE.Group();
    panel.add(rbox(0.15, 0.1, 0.018, 0.008, std("#17181b", 0.3, 0.3)));
    const ui = plane(0.13, 0.08, new THREE.MeshBasicMaterial({ map: T.toTexture(T.printerPanel()) }));
    ui.position.z = 0.0095;
    panel.add(ui);
    panel.position.set(-W / 2 + 0.075, 1.12, front - 0.02);
    panel.rotation.x = -0.75;
    p.add(panel);
    p.position.set(-1.6, FL, 0.43);
    p.rotation.y = 0.18;
    this.scene.add(shadows(p));
  }

  /** Shelves: QuickLabel QL-E100 on top, batik packaging display on 2 & 3. */
  private buildShelves(fonts: T.Fonts) {
    const { cx, w, d, t, tops } = BOOTH.shelves;
    const g = new THREE.Group();
    const board = std("#F4F2EE", 0.5);
    const bracket = std("#2a2a2c", 0.5, 0.5);
    for (const top of tops) {
      g.add(box(w, t, d, board, cx, FL + top - t / 2, d / 2));
      for (const dx of [-0.18, 0.18]) g.add(box(0.012, 0.06, 0.12, bracket, cx + dx, FL + top - t - 0.03, 0.06));
    }

    // ── QuickLabel QL-E100 label printer (top shelf), real dimensions ──
    const Q = BOOTH.ql;
    const ql = new THREE.Group();
    const white = std("#F5F5F7", 0.35);
    ql.add(rbox(Q.w, Q.h, Q.d, 0.025, white, 0, Q.h / 2, 0));
    ql.add(box(Q.w + 0.004, 0.022, Q.d * 0.6, std("#5B1F86", 0.45), 0, Q.h * 0.72, -Q.d * 0.18)); // purple band
    const bezel = new THREE.Group();
    bezel.add(rbox(Q.w + 0.004, 0.15, 0.06, 0.01, std("#0d0d10", 0.25, 0.3)));
    const screen = plane(0.17, 0.106, new THREE.MeshBasicMaterial({ map: T.toTexture(T.qlScreen(fonts)) }));
    screen.position.set(-0.018, 0, 0.0305);
    bezel.add(screen);
    const power = new THREE.Mesh(new THREE.CircleGeometry(0.007, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.4, 0.4), toneMapped: false }));
    power.position.set(0.1, -0.04, 0.0306);
    bezel.add(power);
    bezel.position.set(0, Q.h - 0.075, Q.d / 2 - 0.03);
    bezel.rotation.x = -0.28;
    ql.add(bezel);
    const front = Q.d / 2;
    ql.add(box(Q.w - 0.04, 0.12, 0.008, std("#FBFBFC", 0.4), 0, 0.075, front + 0.002)); // lower front panel
    ql.add(box(0.14, 0.01, 0.01, std("#1a1a1d", 0.6), 0, 0.04, front + 0.005)); // label slot
    const logo = plane(0.11, 0.022, new THREE.MeshBasicMaterial({ map: T.toTexture(T.qlLogo(fonts)) }));
    logo.position.set(0, 0.1, front + 0.0065);
    ql.add(logo);
    const strip = plane(0.085, 0.11, new THREE.MeshStandardMaterial({ map: T.toTexture(T.labelStrip(fonts)), roughness: 0.6, side: THREE.DoubleSide }));
    strip.position.set(0, 0.028, front + 0.05);
    strip.rotation.x = -1.15;
    ql.add(strip);
    // Back against the backdrop, fully supported by the 27 cm shelf.
    ql.position.set(cx, FL + tops[0], 0.004 + Q.d / 2);
    g.add(ql);

    // ── Packaging display (shelves 2 & 3) ──
    const bat = (seed: number, scheme: T.BatikScheme = "green") => new THREE.MeshStandardMaterial({ map: T.toTexture(T.batik(seed, 512, 512, scheme)), roughness: 0.55 });
    const y2 = FL + tops[1];
    const y3 = FL + tops[2];
    // open gift box
    g.add(box(0.27, 0.05, 0.15, std("#3a3a3c", 0.6), cx - 0.08, y2 + 0.025, 0.095));
    const tray = plane(0.25, 0.13, bat(5));
    tray.rotation.x = -Math.PI / 2;
    tray.position.set(cx - 0.08, y2 + 0.051, 0.095);
    g.add(tray);
    const lid = new THREE.Group();
    lid.add(box(0.27, 0.16, 0.012, std("#2f2f31", 0.6), 0, 0.08, 0));
    const inside = plane(0.258, 0.15, new THREE.MeshStandardMaterial({ map: T.toTexture(T.lidPrint(fonts)), roughness: 0.5 }));
    inside.position.set(0, 0.08, 0.0065);
    lid.add(inside);
    lid.position.set(cx - 0.08, y2 + 0.05, 0.022);
    lid.rotation.x = -0.14;
    g.add(lid);
    // card box
    g.add(box(0.07, 0.1, 0.028, bat(9), cx + 0.15, y2 + 0.05, 0.1));
    // sleeve box leaning on the wall, folded scarf, pouch
    const sleeve = box(0.22, 0.14, 0.02, bat(11), cx - 0.07, y3 + 0.07, 0.035);
    sleeve.rotation.x = -0.16;
    g.add(sleeve);
    g.add(box(0.13, 0.022, 0.08, bat(13, "violet"), cx - 0.09, y3 + 0.011, 0.14));
    g.add(rbox(0.1, 0.07, 0.035, 0.015, bat(17, "brown"), cx + 0.14, y3 + 0.035, 0.11));

    this.scene.add(shadows(g));
  }

  private buildRack(poster: HTMLCanvasElement) {
    const r = new THREE.Group();
    const black = std("#151515", 0.35, 0.5);
    r.add(box(0.36, 0.02, 0.36, black, 0, 0.01, 0));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.95, 12), black);
    pole.position.y = 0.475;
    r.add(pole);
    const frame = new THREE.Group();
    frame.add(box(0.46, 0.634, 0.02, black));
    const art = plane(0.42, 0.594, texMat(poster, { roughness: 0.5 }));
    art.position.z = 0.0105;
    frame.add(art);
    frame.position.set(0, 1.25, 0.03);
    frame.rotation.x = -0.18;
    r.add(frame);
    r.position.set(0.82, FL, BOOTH.tabletZ + 0.05);
    r.rotation.y = 0.32;
    this.scene.add(shadows(r));
  }

  private buildPeople() {
    const a = person();
    a.position.set(0, FL, BOOTH.tabletZ + 0.55);
    a.rotation.y = Math.PI;
    const b = person("#B4ADBA");
    b.position.set(1.35, FL, 0.95);
    b.rotation.y = Math.PI;
    const c = person("#9C93A3");
    c.position.set(-0.85, FL, 1.05);
    c.rotation.y = -0.6;
    this.people.add(a, b, c);
  }

  private buildLabels() {
    const add = (text: string, sub: string | undefined, x: number, y: number, z: number) => {
      const l = label(text, sub);
      l.position.set(x, y, z);
      this.labels.add(l);
    };
    add("Print backdrop", "FA 4 × 2,4 m", 0, FL + 2.38, 0.1);
    add('TV 55" landscape', "built-in backdrop", 0.95, FL + 1.95, 0.1);
    add('TV 55"', "slideshow produk", -1.35, FL + 2.12, 0.1);
    add("Meja 50 × 50 × 100", "tablet holder", 0, FL + 1.35, BOOTH.tabletZ);
    add("Display rack A2", "cara ikut", 0.95, FL + 1.75, BOOTH.tabletZ + 0.05);
    add("ApeosPrint C5570", undefined, -1.6, FL + 1.42, 0.8);
    add("QuickLabel QL-E100", "hambalan 1", -0.6, FL + 1.12, 0.45);
    add("Display kemasan", "hambalan 2 & 3", -0.6, FL + 0.45, 0.4);
    add("Logo g", "print", -0.5, FL + 0.6, 0.12);
    add("Pojok Kreasi", "14 frame A3 · karya siswa SMK", 1.32, FL + 2.22, 0.1);
    add("Storage 1 m", "pintu 1 orang", 2.15, FL + 1.6, -0.5);
    for (const x of BOOTH.spotlights) add("Spotlight", undefined, x, FL + 2.62, 0.9);
  }

  private buildDims() {
    const y = FL + 0.02;
    const tickX = new THREE.Vector3(0.06, 0, 0);
    const tickZ = new THREE.Vector3(0, 0, 0.06);
    const tickY = new THREE.Vector3(0.06, 0, 0);
    const W = BOOTH.width / 2;
    const zF = BOOTH.depth - BOOTH.storage;
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-W, 0.004, -BOOTH.storage),
        new THREE.Vector3(W, 0.004, -BOOTH.storage),
        new THREE.Vector3(W, 0.004, zF),
        new THREE.Vector3(-W, 0.004, zF),
      ]),
      new THREE.LineDashedMaterial({ color: "#C4197F", dashSize: 0.12, gapSize: 0.08 }),
    );
    outline.computeLineDistances();
    this.dims.add(outline);
    this.dims.add(
      dimension(new THREE.Vector3(-2, y, 3.0), new THREE.Vector3(2, y, 3.0), "4,0 m", tickZ),
      dimension(new THREE.Vector3(2.25, y, -1), new THREE.Vector3(2.25, y, 2.8), "3,8 m", tickX),
      dimension(new THREE.Vector3(2.55, y, -1), new THREE.Vector3(2.55, y, 0), "storage 1,0 m", tickX),
      dimension(new THREE.Vector3(2.55, y, 0), new THREE.Vector3(2.55, y, 2.8), "area 2,8 m", tickX),
      dimension(new THREE.Vector3(-2.15, FL, 0.03), new THREE.Vector3(-2.15, FL + 2.4, 0.03), "2,4 m", tickY),
      dimension(new THREE.Vector3(2.12, FL, 0.03), new THREE.Vector3(2.12, FL + BOOTH.band.h, 0.03), "band 1,07 m", tickY),
      dimension(new THREE.Vector3(-0.4, y, BOOTH.tvZ), new THREE.Vector3(-0.4, y, BOOTH.tabletZ), "TV → tablet 2,0 m", tickX),
      dimension(new THREE.Vector3(0.42, FL + BOOTH.g.bottom, 0.12), new THREE.Vector3(0.42, FL + BOOTH.g.bottom + BOOTH.g.h, 0.12), "g 1,07 m", tickY),
      dimension(
        new THREE.Vector3(BOOTH.shelves.cx + BOOTH.shelves.w / 2 + 0.02, FL + BOOTH.shelves.tops[2], 0),
        new THREE.Vector3(BOOTH.shelves.cx + BOOTH.shelves.w / 2 + 0.02, FL + BOOTH.shelves.tops[2], BOOTH.shelves.d),
        `hambalan ${Math.round(BOOTH.shelves.d * 100)} cm`,
        tickX,
      ),
    );
  }

  // ─── Controls ───────────────────────────────────────────────────
  setView(name: ViewName, instant = false) {
    const v = VIEWS[name];
    gsap.killTweensOf([this.camera.position, this.controls.target]);
    if (instant) {
      this.camera.position.set(...v.pos);
      this.controls.target.set(...v.target);
      this.controls.update();
      return;
    }
    const d = 1.4;
    gsap.to(this.camera.position, { x: v.pos[0], y: v.pos[1], z: v.pos[2], duration: d, ease: "power3.inOut" });
    gsap.to(this.controls.target, { x: v.target[0], y: v.target[1], z: v.target[2], duration: d, ease: "power3.inOut", onUpdate: () => this.controls.update() });
  }

  setLabels(on: boolean) {
    this.toggleCss(this.labels, on);
  }

  setDims(on: boolean) {
    this.dims.visible = on;
    this.toggleCss(this.dims, on);
  }

  setPeople(on: boolean) {
    this.people.visible = on;
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }


  private toggleCss(group: THREE.Object3D, on: boolean) {
    group.traverse((o) => {
      if (o instanceof CSS2DObject) o.element.style.visibility = on ? "visible" : "hidden";
    });
  }

  screenshot() {
    this.composer.render();
    return this.renderer.domElement.toDataURL("image/png");
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.labelRenderer.setSize(w, h);
  }

  /** 55" product slideshow: 4.5 s per slide with a 0.8 s cross-fade. */
  private tickSlides() {
    if (!this.slides.length || !this.slideCanvas || !this.slideTex) return;
    const hold = 4.5;
    const fade = 0.8;
    const t = this.clock.getElapsedTime();
    const i = Math.floor(t / hold) % this.slides.length;
    const p = (t % hold) / fade;
    if (p >= 1 && i === this.lastSlide) return;
    const ctx = this.slideCanvas.getContext("2d")!;
    const prev = this.slides[(i + this.slides.length - 1) % this.slides.length];
    ctx.globalAlpha = 1;
    ctx.drawImage(prev, 0, 0);
    ctx.globalAlpha = Math.min(1, p);
    ctx.drawImage(this.slides[i], 0, 0);
    ctx.globalAlpha = 1;
    this.slideTex.needsUpdate = true;
    if (p >= 1) this.lastSlide = i;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.tickSlides();
    this.controls.update();
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
