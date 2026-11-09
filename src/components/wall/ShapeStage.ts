import * as THREE from "three";

/**
 * WebGL backdrop for the wall: the two WCCE shape families rebuilt as motion.
 *  - "fan"   : purple ribbons → four fans of instanced paper sheets that ripple
 *              like paper feeding through a printer (WCCE shape, Astragraphia meaning)
 *  - "green" : soft glowing ellipses that breathe and drift (WCCE green)
 *  - "plum"  : the same ellipses in Astragraphia plum
 * Written as plain classes (Locomotive-style), mounted by WallApp.
 */

export type SceneName = "fan" | "green" | "plum";

interface Layer {
  scene: THREE.Scene;
  camera: THREE.Camera;
  update(t: number): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

const BLOB_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uRim;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdEllipse(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = mix(uBase * 0.62, uBase * 1.05, smoothstep(-0.2, 1.2, uv.y * 0.7 + uv.x * 0.5));

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(-0.75 + fi * 0.52, 0.18 - fi * 0.16);
    c += 0.05 * vec2(sin(uTime * 0.11 + fi * 1.7), cos(uTime * 0.09 + fi * 2.3));
    vec2 q = rot(-0.62 + 0.06 * sin(uTime * 0.07 + fi)) * (p - c);
    vec2 r = vec2(0.62 - fi * 0.06, 0.27 - fi * 0.02) * (1.0 + 0.035 * sin(uTime * 0.23 + fi * 1.1));
    float d = sdEllipse(q, r);
    float inside = smoothstep(0.012, -0.012, d);
    float edge = exp(-abs(d) * 55.0);
    float halo = exp(-max(d, 0.0) * 9.0) * (1.0 - inside);
    vec3 fill = mix(uMid, uBase * 1.12, smoothstep(-0.28, 0.02, d));
    col = mix(col, fill, inside * 0.82);
    col += uRim * (edge * 0.75 + halo * 0.12);
  }

  float vig = smoothstep(1.25, 0.25, length((uv - 0.5) * vec2(1.4, 1.0)));
  col *= mix(0.72, 1.0, vig);
  col += (hash(uv * uRes + floor(uTime * 14.0)) - 0.5) * 0.07;
  gl_FragColor = vec4(col, 1.0);
}`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class BlobLayer implements Layer {
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(palette: { base: string; mid: string; rim: string }) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BLOB_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uBase: { value: new THREE.Color(palette.base) },
        uMid: { value: new THREE.Color(palette.mid) },
        uRim: { value: new THREE.Color(palette.rim) },
      },
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.scene.add(this.mesh);
  }
  update(t: number) {
    this.mat.uniforms.uTime.value = t;
  }
  resize(w: number, h: number) {
    this.mat.uniforms.uRes.value.set(w, h);
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

const SHEETS = 18;

class FanLayer implements Layer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private fans: { mesh: THREE.InstancedMesh; sx: number; sy: number }[] = [];
  private bg: THREE.Mesh;
  private dummy = new THREE.Object3D();
  private geo: THREE.BoxGeometry;
  private mat: THREE.MeshStandardMaterial;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 0, 18);

    // Gradient backdrop (indigo with violet core), reuses the blob shader plumbing.
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec2 p = vUv - 0.5; p.x *= 1.6;
          vec3 core = vec3(0.30, 0.18, 0.62); vec3 edge = vec3(0.10, 0.05, 0.24);
          vec3 col = mix(core, edge, smoothstep(0.0, 0.95, length(p)));
          col += (hash(vUv * 1400.0 + floor(uTime * 14.0)) - 0.5) * 0.07;
          gl_FragColor = vec4(col, 1.0);
        }`,
      uniforms: { uTime: { value: 0 } },
      depthWrite: false,
    });
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -1;
    this.scene.add(this.bg);

    // Each sheet: violet at the base fading to hot magenta at the leading edge.
    this.geo = new THREE.BoxGeometry(4.6, 1.15, 0.06, 1, 1, 1);
    const pos = this.geo.attributes.position;
    const colors: number[] = [];
    const a = new THREE.Color("#3b1f8f");
    const b = new THREE.Color("#e04bb8");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getX(i) / 4.6 + 0.5) * 0.7 + (pos.getY(i) / 1.15 + 0.5) * 0.3;
      c.copy(a).lerp(b, Math.pow(k, 1.6));
      colors.push(c.r, c.g, c.b);
    }
    this.geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });

    for (const [sx, sy] of [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ] as const) {
      const mesh = new THREE.InstancedMesh(this.geo, this.mat, SHEETS);
      const tint = new THREE.Color();
      for (let i = 0; i < SHEETS; i++) {
        tint.setScalar(0.55 + 0.45 * (i / (SHEETS - 1)));
        mesh.setColorAt(i, tint);
      }
      this.fans.push({ mesh, sx, sy });
      this.scene.add(mesh);
    }

    this.scene.add(new THREE.AmbientLight("#6a4bd6", 1.1));
    const key = new THREE.DirectionalLight("#ffd6f3", 2.2);
    key.position.set(-4, 6, 10);
    this.scene.add(key);
    const rim = new THREE.PointLight("#ff4fc0", 60, 30);
    rim.position.set(0, 0, 6);
    this.scene.add(rim);
  }

  update(t: number) {
    (this.bg.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    const d = this.dummy;
    for (const { mesh, sx, sy } of this.fans) {
      for (let i = 0; i < SHEETS; i++) {
        const k = i / (SHEETS - 1);
        const wave = Math.sin(t * 0.7 + i * 0.42 + (sx + sy) * 0.8);
        // Sheets stack from the outer corner toward the centre along an arc.
        const ang = 0.25 + k * 0.95 + wave * 0.035;
        const r = 9.2 - k * 1.9;
        d.position.set(sx * (Math.cos(ang) * r * 0.62 + 2.2), sy * (Math.sin(ang) * r * 0.36 + 0.9), -k * 0.9 + wave * 0.12);
        d.rotation.set(sy * (0.95 - k * 0.25), sx * (0.25 + wave * 0.05), sx * sy * (-0.55 + k * 0.85 + wave * 0.06));
        d.scale.setScalar(1 - k * 0.18);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.camera.position.x = Math.sin(t * 0.05) * 0.6;
    this.camera.position.y = Math.cos(t * 0.04) * 0.35;
    this.camera.lookAt(0, 0, 0);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    (this.bg.material as THREE.Material).dispose();
    this.bg.geometry.dispose();
    for (const f of this.fans) f.mesh.dispose();
  }
}

export class ShapeStage {
  private renderer: THREE.WebGLRenderer;
  private layers: Record<SceneName, Layer>;
  private current: SceneName = "fan";
  private raf = 0;
  private clock = new THREE.Clock();
  private ro: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.layers = {
      fan: new FanLayer(),
      green: new BlobLayer({ base: "#2c8f73", mid: "#47c49e", rim: "#e6fff4" }),
      plum: new BlobLayer({ base: "#5b1047", mid: "#a3286f", rim: "#ffd0ea" }),
    };
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.loop();
  }

  set(name: SceneName) {
    this.current = name;
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    for (const l of Object.values(this.layers)) l.resize(w * pr, h * pr);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    const layer = this.layers[this.current];
    layer.update(t);
    this.renderer.render(layer.scene, layer.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const l of Object.values(this.layers)) l.dispose();
    this.renderer.dispose();
  }
}
