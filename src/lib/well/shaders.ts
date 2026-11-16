// GLSL for the bird's-eye wishing pool, ported from Katie-Lan's web prototype (waterworks).
// All positions use "pool space": (0,0) is the pool centre, radius 1 is the water's edge, +y points down.
//
// The height field (height, velocity) lives in a float texture when the GPU can render to one.
// Otherwise it is packed into RGBA8: height in .rg and velocity in .ba as 16-bit fixed point.
// Every program reads and writes the field through readHV()/writeHV(), defined by fieldChunk().

export function fieldChunk(packed: boolean) {
  return packed
    ? `
vec2 enc16(float v) {
  float x = clamp(v * 0.125 + 0.5, 0.0, 0.99999);
  float hi = floor(x * 255.0) / 255.0;
  return vec2(hi, fract(x * 255.0));
}
float dec16(vec2 c) { return (c.x + c.y / 255.0) * 8.0 - 4.0; }
vec2 readHV(sampler2D t, vec2 uv) { vec4 c = texture(t, uv); return vec2(dec16(c.rg), dec16(c.ba)); }
vec4 writeHV(vec2 hv) { return vec4(enc16(hv.x), enc16(hv.y)); }
`
    : `
vec2 readHV(sampler2D t, vec2 uv) { return texture(t, uv).rg; }
vec4 writeHV(vec2 hv) { return vec4(hv, 0.0, 0.0); }
`;
}

export const VERT = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const SIM_DROP = (packed: boolean) => /* glsl */ `#version 300 es
precision highp float;
${fieldChunk(packed)}
uniform sampler2D uTex;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 info = readHV(uTex, vUv);
  float d = max(0.0, 1.0 - length(uCenter - vUv) / uRadius);
  d = 0.5 - cos(d * 3.14159265) * 0.5;
  info.x += d * uStrength;
  o = writeHV(info);
}`;

export const SIM_UPDATE = (packed: boolean) => /* glsl */ `#version 300 es
precision highp float;
${fieldChunk(packed)}
uniform sampler2D uTex;
uniform vec2 uDelta;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 info = readHV(uTex, vUv);
  vec2 dx = vec2(uDelta.x, 0.0);
  vec2 dy = vec2(0.0, uDelta.y);
  float avg = (
    readHV(uTex, vUv - dx).x + readHV(uTex, vUv + dx).x +
    readHV(uTex, vUv - dy).x + readHV(uTex, vUv + dy).x) * 0.25;
  info.y += (avg - info.x) * 2.0;
  info.y *= 0.993;
  info.x += info.y;
  info.x *= 0.9992;
  if (length(vUv * 2.0 - 1.0) > 1.0) info = vec2(0.0);
  o = writeHV(info);
}`;

export const RENDER = (packed: boolean) => /* glsl */ `#version 300 es
precision highp float;
${fieldChunk(packed)}

uniform sampler2D uHeight;
uniform sampler2D uFloor;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uR;
uniform float uTime;
uniform vec4 uCoinA[16]; // x, y, depth (0 surface .. 1 floor), size
uniform vec4 uCoinB[16]; // tilt, angle, variant (0/1 in the copper sprite sheet), alpha
uniform sampler2D uCoinTex;
uniform vec4 uRise;      // challenge star: x, y, depth, size
uniform vec4 uRiseB;     // rotation, glow, alpha, open (0..1)
uniform int uCoinCount;
uniform vec4 uStar[8];   // x, y, rotation, size
uniform int uStarCount;

out vec4 o;

const float PI = 3.14159265;
const float RIM = 0.15;
const vec3 MOON = normalize(vec3(0.15, -0.19, 1.0));
const vec3 LAMP = normalize(vec3(-0.21, 0.13, 1.0));

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

// Inigo Quilez five-point star SDF.
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Tileable procedural caustics.
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.2831, 6.2831) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

float H(vec2 uv) { return readHV(uHeight, uv).x; }

const vec3 TINT = vec3(0.42, 0.86, 0.9);
const vec3 DEEP = vec3(0.03, 0.27, 0.36);

// The same colour pipeline for everything lying under the water (floor and coins).
vec3 waterize(vec3 c, float shade, float caus, float edge) {
  vec3 w = c * TINT * 1.18 * shade;
  w += caus * vec3(0.8, 1.0, 0.95) * shade * (0.35 + c * 0.9);
  return mix(w, DEEP, 0.14 + edge * 0.3);
}

vec3 starColor(vec2 lq, float rot, float d) {
  float ang = atan(lq.x, lq.y);
  float seg = mod(ang + PI / 5.0, 2.0 * PI / 5.0) - PI / 5.0;
  float side = ang - seg + sign(seg) * PI * 0.5;
  vec3 fn = normalize(vec3(sin(side) * 0.55, cos(side) * 0.55, 1.0));
  vec3 L = normalize(vec3(rot2(rot) * vec2(0.5, -0.6), 0.65));
  float diff = max(dot(fn, L), 0.0);
  vec3 sc = vec3(1.0, 0.86, 0.48) * (0.55 + 0.6 * diff) + vec3(0.12, 0.08, 0.0);
  return sc + smoothstep(0.0, -0.04, d) * 0.08;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (frag - uCenter) / uR;
  float r = length(p);
  float px = 1.25 / uR;

  // ---- surface shape: simulated ripples + gentle ambient chop ----
  vec2 uv = p * 0.5 + 0.5;
  float e = 1.0 / 256.0;
  float hC = H(uv);
  float hR = H(uv + vec2(e, 0)), hL = H(uv - vec2(e, 0));
  float hD = H(uv + vec2(0, e)), hU = H(uv - vec2(0, e));
  vec2 amb = vec2(
    sin(p.x * 9.0 + uTime * 1.3) * 0.6 + sin((p.x + p.y) * 14.0 - uTime * 1.9) * 0.4,
    cos(p.y * 10.0 - uTime * 1.1) * 0.6 + sin((p.x - p.y) * 12.0 + uTime * 1.6) * 0.4) * 0.018;
  amb += (vec2(noise(p * 22.0 + uTime * 0.6), noise(p * 22.0 - uTime * 0.5 + 7.0)) - 0.5) * 0.05;
  vec2 grad = vec2(hR - hL, hD - hU) * 22.0 + amb;
  float lap = hR + hL + hD + hU - 4.0 * hC;
  vec3 n = normalize(vec3(-grad, 1.0));
  vec3 viewDir = normalize(vec3(p * 0.38, -1.0));
  vec3 R = reflect(viewDir, n);

  // ---- pool floor seen through the water ----
  vec2 refr = -grad * 0.11;
  vec2 fp = p + refr;
  vec3 floorCol = texture(uFloor, fp * 0.48 + 0.5).rgb;
  floorCol = pow(floorCol, vec3(1.15));

  float shade = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uStarCount) break;
    vec4 s = uStar[i];
    vec2 lq = rot2(s.z) * (fp - s.xy - vec2(-0.03, 0.04));
    float d = sdStar5(lq, s.w, 0.5);
    shade *= mix(0.55, 1.0, smoothstep(-0.01, 0.035, d));
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uCoinCount) break;
    vec4 A = uCoinA[i];
    float k = smoothstep(0.35, 1.0, A.z) * uCoinB[i].w;
    float d = length(fp - A.xy - vec2(-0.012, 0.016) * (1.0 + (1.0 - A.z) * 3.0)) / (A.w * 1.1);
    shade *= 1.0 - k * 0.45 * (1.0 - smoothstep(0.6, 1.25, d));
  }
  // the moonlit rim casts a crescent of shade onto the floor
  float rimSh = smoothstep(0.9, 1.03, length(fp + vec2(0.06, -0.08)));
  shade *= 1.0 - rimSh * 0.55;

  float c = caustic(fp * 1.5 + 0.3, uTime * 0.42);
  float c2 = clamp(-lap * 90.0, 0.0, 1.2);
  float caus = c * 0.5 + c2 * 0.6;
  float edge = smoothstep(0.55, 1.0, r);
  vec3 wc = waterize(floorCol, shade, caus, edge);

  // ---- tossed copper coins: same sprite & water colouring as the coins on the floor ----
  for (int i = 0; i < 16; i++) {
    if (i >= uCoinCount) break;
    vec4 A = uCoinA[i];
    vec4 B = uCoinB[i];
    float depth = A.z;
    vec2 q = rot2(B.y) * (p + refr * (0.25 + depth * 0.75) - A.xy);
    float ct = max(abs(cos(B.x)), 0.12);
    float rad = A.w * (1.0 + (1.0 - depth) * 0.5);
    vec2 lq = vec2(q.x, q.y / ct) / rad;
    float dist = length(lq);
    if (dist < 1.0) {
      float a = (1.0 - smoothstep(0.93 - 2.0 * px / rad, 0.95, dist)) * B.w;
      vec2 suv = vec2((clamp(lq.x, -0.97, 0.97) * 0.5 + 0.5 + B.z) * 0.5, lq.y * 0.5 + 0.5);
      vec3 coin = texture(uCoinTex, suv).rgb;
      coin = pow(coin, vec3(1.15));
      // flipping coin: the face darkens as it turns edge-on, with a copper glint
      coin *= 0.7 + 0.3 * ct;
      coin += vec3(1.0, 0.7, 0.45) * pow(max(dot(reflect(viewDir, normalize(vec3(0.0, sin(B.x), cos(B.x)))), MOON), 0.0), 40.0) * 0.35;
      vec3 under = waterize(coin, shade, caus, edge);
      wc = mix(wc, mix(coin * 0.95, under, smoothstep(0.0, 0.5, depth)), a);
    }
  }

  // ---- the daily challenge star, rising from below ----
  float riseA = uRiseB.z * (1.0 - uRiseB.w);
  if (uRiseB.z > 0.0) {
    float depth = uRise.z;
    vec2 q = rot2(uRiseB.x) * (p + refr * (0.25 + depth * 0.75) - uRise.xy);
    float sz = uRise.w * (1.0 + (1.0 - depth) * 0.45) * (1.0 + uRiseB.w * 0.9);
    float d = sdStar5(q, sz, 0.5);
    wc += vec3(1.0, 0.78, 0.36) * uRiseB.y * exp(-max(d, 0.0) * 9.0) * 0.55 * uRiseB.z;
    float m = (1.0 - smoothstep(-px, px, d)) * riseA;
    vec3 sc = starColor(q, uRiseB.x, d) * (1.0 + uRiseB.y * 0.25);
    sc = mix(sc, waterize(sc, 1.0, caus, edge) * 1.3, depth * 0.55);
    wc = mix(wc, sc, m);
  }

  // ---- surface: night sky, moon and lamp glints ----
  float fres = 0.04 + 0.6 * pow(1.0 - max(dot(n, -viewDir), 0.0), 5.0);
  vec3 sky = mix(vec3(0.02, 0.05, 0.1), vec3(0.1, 0.16, 0.26), clamp(R.z, 0.0, 1.0));
  wc = mix(wc, sky, fres * 1.6);
  float mdot = dot(R, MOON);
  wc += vec3(1.0, 0.96, 0.86) * (smoothstep(0.9993, 0.99975, mdot) * 0.42 + pow(max(mdot, 0.0), 1400.0) * 0.2);
  wc += vec3(1.0, 0.84, 0.52) * pow(max(dot(R, LAMP), 0.0), 600.0) * 0.55;
  wc += vec3(1.0) * pow(max(dot(R, MOON), 0.0), 60.0) * smoothstep(0.02, 0.09, length(grad)) * 0.35;
  wc += smoothstep(0.972, 0.996, r) * 0.1;

  // ---- golden stars floating on the surface ----
  for (int i = 0; i < 8; i++) {
    if (i >= uStarCount) break;
    vec4 s = uStar[i];
    vec2 lq = rot2(s.z) * (p - s.xy - grad * 0.012);
    float d = sdStar5(lq, s.w, 0.5);
    wc += vec3(1.0, 0.82, 0.42) * exp(-max(d, 0.0) * 30.0) * 0.22;
    float m = 1.0 - smoothstep(-px, px, d);
    if (m > 0.0) wc = mix(wc, starColor(lq, s.z, d), m);
  }

  // ---- the challenge star opening: a burst of light rays and a ring ----
  if (uRiseB.w > 0.0 && uRiseB.w < 1.0) {
    float o = uRiseB.w;
    vec2 q = rot2(uRiseB.x) * (p - uRise.xy);
    float lr = length(q);
    float burst = o * (1.0 - o) * 4.0;
    float rays = pow(max(cos(atan(q.x, q.y) * 5.0), 0.0), 18.0) * exp(-lr / (0.06 + o * 0.35));
    float ring = smoothstep(0.018, 0.0, abs(lr - (0.05 + o * 0.4)));
    wc += vec3(1.0, 0.86, 0.5) * (rays * 1.4 + ring * 0.9 + exp(-lr * 14.0) * 0.8) * burst;
  }

  // ---- marble rim and night garden beyond it ----
  vec3 outside = vec3(0.0);
  if (r > 1.0 - 3.0 * px) {
    float t = clamp((r - 1.0) / RIM, 0.0, 1.0);
    vec2 dir = p / max(r, 1e-4);
    float sgn = 2.0 * t - 1.0;
    float z = sqrt(max(1.0 - sgn * sgn, 0.0));
    vec3 rn = normalize(vec3(dir * sgn / max(z, 0.22) * 0.75, 1.0));
    float diff = max(dot(rn, normalize(vec3(0.5, -0.65, 0.75))), 0.0);
    float v = fbm(p * 6.0 + fbm(p * 3.0) * 2.5);
    vec3 marble = vec3(0.94, 0.91, 0.85) * (0.9 + 0.1 * fbm(p * 26.0));
    marble = mix(marble, vec3(0.72, 0.68, 0.62), smoothstep(0.025, 0.0, abs(v - 0.52)) * 0.5);
    float segA = abs(fract(atan(p.y, p.x) / (2.0 * PI) * 18.0) - 0.5);
    float seamD = (0.5 - segA) / 18.0 * 2.0 * PI * r;
    marble *= 1.0 - (1.0 - smoothstep(0.0, 0.004 + px, seamD)) * 0.3;
    vec3 rimCol = marble * (0.42 + 0.62 * diff) * vec3(0.9, 0.92, 1.0);
    rimCol += vec3(0.3, 0.78, 0.82) * 0.2 * pow(1.0 - t, 2.0);
    rimCol += pow(max(dot(reflect(viewDir, rn), MOON), 0.0), 30.0) * 0.18;
    float rimMask = 1.0 - smoothstep(1.0 + RIM - px, 1.0 + RIM + px, r);

    float g = fbm(p * 5.0);
    vec3 ground = mix(vec3(0.025, 0.05, 0.045), vec3(0.07, 0.12, 0.085), g);
    ground = mix(ground, vec3(0.09, 0.1, 0.12), smoothstep(0.55, 0.75, fbm(p * 2.2 + 4.0)) * 0.6);
    float gsh = 1.0 - smoothstep(1.0 + RIM, 1.0 + RIM + 0.16, length(p - vec2(-0.04, 0.05)));
    ground *= 1.0 - gsh * 0.65;
    vec2 cell = floor(p * 16.0);
    vec2 fc = fract(p * 16.0) - 0.5;
    float hs = hash(cell);
    if (hs > 0.9) {
      float tw = 0.5 + 0.5 * sin(uTime * 2.2 + hs * 60.0);
      vec2 off = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
      ground += vec3(1.0, 0.8, 0.4) * smoothstep(0.09, 0.0, length(fc - off)) * tw * 0.85;
    }
    outside = mix(ground, rimCol, rimMask);
  }

  float waterMask = 1.0 - smoothstep(1.0 - px, 1.0 + px, r);
  vec3 col = mix(outside, wc, waterMask);
  vec2 sv = (frag / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= 1.0 - 0.45 * smoothstep(0.35, 0.85, length(sv));
  o = vec4(col, 1.0);
}`;
