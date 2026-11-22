/* The water: a full-screen WebGL pass over the pond bed (where the name lies).
   Every active ripple bends the bed underneath it, and a soft caustic shimmer keeps it alive.
   Ripples are analytic rings passed in as uniforms, so they match the rings drawn on the surface exactly. */
export const MAX_RIPPLES = 16;

const VS = `attribute vec2 a; varying vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
const FS = `
precision highp float;
varying vec2 v;
uniform sampler2D uBed;
uniform sampler2D uName;
uniform vec2 uRes;
uniform float uTime;
uniform float uReveal;
uniform vec4 uR[${MAX_RIPPLES}]; // x, y (css px, y down), ring radius (px), strength
void main(){
  vec2 p = vec2(v.x, 1.0 - v.y) * uRes;
  vec2 disp = vec2(0.0);
  float hi = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uR[i];
    if (r.w <= 0.001) continue;
    vec2 d = p - r.xy;
    float dist = length(d) + 0.0001;
    float x = dist - r.z;
    float w = 20.0 + r.z * 0.1;
    float env = exp(-x * x / (w * w)) * r.w;
    disp += d / dist * sin(x * 0.11) * env * 7.0;
    hi += cos(x * 0.11) * env;
  }
  // the surface is never perfectly still
  disp += vec2(sin(p.y * 0.018 + uTime * 0.7) + 0.5 * sin(p.y * 0.043 - uTime * 0.5),
               cos(p.x * 0.016 + uTime * 0.6) + 0.5 * cos(p.x * 0.037 + uTime * 0.45)) * 0.9;
  vec2 uv = (p + disp) / uRes;
  uv.y = 1.0 - uv.y;
  vec3 col = texture2D(uBed, uv).rgb;
  vec4 nm = texture2D(uName, uv);
  float name = nm.a * uReveal;
  col = mix(col, nm.rgb, name);
  // caustic light on the bed, a little stronger on the raised letters
  vec2 q = p * 0.006;
  float c = sin(q.x * 2.1 + sin(q.y * 1.7 + uTime * 0.35) * 1.6) + sin(q.y * 2.3 + sin(q.x * 1.9 - uTime * 0.3) * 1.6);
  c = pow(max(0.0, c * 0.5), 3.0);
  col += vec3(0.05, 0.11, 0.095) * c * (0.35 + name * 0.9);
  // light catching the ripple crests
  col += vec3(0.75, 0.95, 0.88) * max(hi, 0.0) * 0.06;
  col -= vec3(0.025) * max(-hi, 0.0);
  vec2 e = v - 0.5;
  col *= 1.0 - dot(e, e) * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createWater(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const u = { bed: U('uBed'), name: U('uName'), res: U('uRes'), time: U('uTime'), reveal: U('uReveal'), r: U('uR[0]') };
  const makeTex = unit => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const bedTex = makeTex(0), nameTex = makeTex(1);
  gl.uniform1i(u.bed, 0); gl.uniform1i(u.name, 1);
  const rip = new Float32Array(MAX_RIPPLES * 4);
  let W = 1, H = 1;

  return {
    resize(w, h, dpr) {
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    setTextures(bed, name) {
      if (!bed.width || !bed.height) return; // nothing to upload yet
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bedTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bed);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, nameTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, name);
    },
    render(time, ripples, reveal) {
      rip.fill(0);
      ripples.slice(-MAX_RIPPLES).forEach((r, i) => rip.set([r.x, r.y, r.radius, r.amp], i * 4));
      gl.uniform2f(u.res, W, H);
      gl.uniform1f(u.time, time);
      gl.uniform1f(u.reveal, reveal);
      gl.uniform4fv(u.r, rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
}
