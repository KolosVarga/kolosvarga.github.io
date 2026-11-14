/* Painterly post-processing.
   - Kuwahara filter: flattens surfaces into brush-like patches (hand-painted look)
   - colour grade: warm lamplight highlights, soft blue-violet shadows, paper grain, vignette
   - uInk (0..1): wipes the image into a manga page — cream paper, black ink edges,
     cross-hatching in the shadows, red kept as a spot colour. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const shader = radius => ({
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uInk: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    #define R ${radius}
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uInk;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    vec3 quad(vec2 uv, vec2 px, float qx, float qy, out float v){
      vec3 m = vec3(0.0), s = vec3(0.0);
      for (int j = 0; j <= R; j++) for (int i = 0; i <= R; i++) {
        vec3 c = texture2D(tDiffuse, uv + vec2(float(i) * qx, float(j) * qy) * px).rgb;
        m += c; s += c * c;
      }
      float n = float((R + 1) * (R + 1));
      m /= n; s = abs(s / n - m * m); v = s.r + s.g + s.b;
      return m;
    }
    void main(){
      vec2 px = 1.0 / uRes;
      float v0, v1, v2, v3;
      vec3 m0 = quad(vUv, px, -1.0, -1.0, v0), m1 = quad(vUv, px, 1.0, -1.0, v1);
      vec3 m2 = quad(vUv, px, -1.0, 1.0, v2), m3 = quad(vUv, px, 1.0, 1.0, v3);
      vec3 c = m0; float mv = v0;
      if (v1 < mv) { mv = v1; c = m1; } if (v2 < mv) { mv = v2; c = m2; } if (v3 < mv) { mv = v3; c = m3; }

      // edges from the raw render (Sobel on perceptual luminance)
      vec2 e = px * 1.5;
      float tl = lum(pow(texture2D(tDiffuse, vUv + vec2(-e.x, e.y)).rgb, vec3(0.4545)));
      float tc = lum(pow(texture2D(tDiffuse, vUv + vec2(0.0, e.y)).rgb, vec3(0.4545)));
      float tr = lum(pow(texture2D(tDiffuse, vUv + vec2(e.x, e.y)).rgb, vec3(0.4545)));
      float ml = lum(pow(texture2D(tDiffuse, vUv + vec2(-e.x, 0.0)).rgb, vec3(0.4545)));
      float mr = lum(pow(texture2D(tDiffuse, vUv + vec2(e.x, 0.0)).rgb, vec3(0.4545)));
      float bl = lum(pow(texture2D(tDiffuse, vUv + vec2(-e.x, -e.y)).rgb, vec3(0.4545)));
      float bc = lum(pow(texture2D(tDiffuse, vUv + vec2(0.0, -e.y)).rgb, vec3(0.4545)));
      float br = lum(pow(texture2D(tDiffuse, vUv + vec2(e.x, -e.y)).rgb, vec3(0.4545)));
      float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
      float edge = clamp(length(vec2(gx, gy)) * 1.4, 0.0, 1.0);

      vec3 sc = pow(max(c, 0.0), vec3(0.4545));
      float l = lum(sc);
      vec2 fc = gl_FragCoord.xy;
      float paper = noise(fc * 0.35) * 0.5 + noise(fc * 0.06) * 0.5;

      // ---- painted look ----
      vec3 paint = mix(vec3(l), sc, 1.04);
      paint = mix(paint, paint * vec3(0.7, 0.78, 1.18) + vec3(0.02, 0.025, 0.07), (1.0 - smoothstep(0.04, 0.42, l)) * 0.55);
      paint += vec3(0.04, 0.025, 0.0) * smoothstep(0.6, 1.0, l);
      // painted contour: darken toward a deeper, warmer shade of the same colour
      paint = mix(paint, paint * paint * vec3(0.9, 0.75, 0.8), smoothstep(0.12, 0.6, edge) * 0.65);
      paint *= 0.93 + paper * 0.1;
      paint *= 1.0 - 0.42 * pow(length(vUv - 0.5) * 1.3, 2.4);

      // ---- manga ink ----
      vec3 P = vec3(0.95, 0.9, 0.81), INK = vec3(0.07, 0.05, 0.05), RED = vec3(0.76, 0.15, 0.12);
      float d = 1.0 - l;
      float a1 = abs(fract((fc.x + fc.y) / 7.0) - 0.5);
      float a2 = abs(fract((fc.x - fc.y) / 7.0) - 0.5);
      float hatch = step(a1, smoothstep(0.42, 0.85, d) * 0.3);
      hatch = max(hatch, step(a2, smoothstep(0.66, 1.0, d) * 0.3));
      hatch = max(hatch, step(0.9, d));
      float redness = smoothstep(0.06, 0.2, sc.r - max(sc.g, sc.b));
      vec3 base = mix(P, RED, redness * 0.95);
      float inkEdge = smoothstep(0.22, 0.5, edge);
      vec3 manga = mix(base, INK, max(hatch * (1.0 - redness * 0.5), inkEdge));
      manga *= 0.96 + paper * 0.06;

      float wn = noise(vUv * vec2(6.0, 26.0)) * 0.2;
      float wipe = smoothstep(-0.015, 0.015, uInk * 1.4 - (vUv.x * 0.85 + (1.0 - vUv.y) * 0.15) - wn);
      vec3 outc = mix(paint, manga, wipe);
      gl_FragColor = vec4(pow(max(outc, 0.0), vec3(2.2)), 1.0);
      #include <colorspace_fragment>
    }`
});

export function painterly(view, { radius = 3, bloom = true } = {}) {
  const composer = new EffectComposer(view.renderer);
  composer.addPass(new RenderPass(view.scene, view.camera));
  if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(view.w, view.h), 0.32, 0.6, 0.78));
  const pass = new ShaderPass(shader(radius));
  composer.addPass(pass);
  const size = () => {
    const pr = view.renderer.getPixelRatio();
    composer.setPixelRatio(pr);
    composer.setSize(view.w, view.h);
    pass.uniforms.uRes.value.set(view.w * pr, view.h * pr);
  };
  const prev = view.onResize;
  view.onResize = (w, h) => { prev?.(w, h); size(); };
  size();
  view.render = () => composer.render();
  return pass;
}
