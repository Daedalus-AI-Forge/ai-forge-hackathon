// WebGL2 / GLES 3.0 wishing-pool renderer, ported from Katie-Lan's web prototype (waterworks).
// A ping-pong height-field ripple sim, rendered as refraction of the pool-floor photo with coins and stars.
// It only needs a WebGL2-shaped context, so the same class runs on a DOM <canvas> (web) and on an
// expo-gl GLView context (iOS/Android): the caller owns the surface and passes `present` (endFrameEXP).
import { RENDER, SIM_DROP, SIM_UPDATE, VERT } from "./shaders";

export const MAX_COINS = 16;
export const MAX_STARS = 8;
const SIM_SIZE = 256;

export interface RenderCoin {
  x: number;
  y: number;
  depth: number;
  size: number;
  tilt: number;
  angle: number;
  /** Which copper coin in the sprite sheet (0 or 1). */
  variant: number;
  alpha: number;
}

export interface RenderRise {
  x: number;
  y: number;
  depth: number;
  size: number;
  rot: number;
  glow: number;
  alpha: number;
  open: number;
}

export interface RenderStar {
  x: number;
  y: number;
  rot: number;
  size: number;
}

/** Where the pool sits on the surface, in layout pixels. Pool space radius 1 = R pixels. */
export interface PoolGeometry {
  cx: number;
  cy: number;
  R: number;
}

/** Anything gl.texImage2D accepts: a DOM image on web, an `{ localUri }` asset object on expo-gl. */
export type TexSource = TexImageSource | { localUri: string };

type Prog = { program: WebGLProgram; u: (name: string) => WebGLUniformLocation | null };

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("createShader failed");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return s;
}

function makeProgram(gl: WebGL2RenderingContext, frag: string, uniforms: string[]): Prog {
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  const locs = new Map<string, WebGLUniformLocation | null>();
  for (const name of uniforms) locs.set(name, gl.getUniformLocation(program, name));
  return { program, u: (name) => locs.get(name) ?? null };
}

/** Two ping-pong render targets for the height field. Returns null when this format can't be rendered to. */
function makeTargets(gl: WebGL2RenderingContext, packed: boolean) {
  const tex: WebGLTexture[] = [];
  const fbo: WebGLFramebuffer[] = [];
  const filter = packed ? gl.NEAREST : gl.LINEAR; // packed bytes must not be interpolated
  for (let i = 0; i < 2; i++) {
    const t = gl.createTexture();
    const f = gl.createFramebuffer();
    if (!t || !f) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (packed) {
      // (127, 128) in each byte pair decodes to ~0 height / 0 velocity (see enc16/dec16 in shaders.ts).
      const zero = new Uint8Array(SIM_SIZE * SIM_SIZE * 4);
      for (let k = 0; k < zero.length; k += 2) {
        zero[k] = 127;
        zero[k + 1] = 128;
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SIM_SIZE, SIM_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, zero);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SIM_SIZE, SIM_SIZE, 0, gl.RGBA, gl.HALF_FLOAT, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!ok) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      [...tex, t].forEach((x) => gl.deleteTexture(x));
      [...fbo, f].forEach((x) => gl.deleteFramebuffer(x));
      return null;
    }
    if (!packed) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    tex.push(t);
    fbo.push(f);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo };
}

export interface WaterRendererOptions {
  /** Called after each frame is drawn. expo-gl needs `gl.endFrameEXP()` here; a DOM canvas needs nothing. */
  present?: () => void;
}

export class WaterRenderer {
  geometry: PoolGeometry = { cx: 0, cy: 0, R: 1 };
  /** True when the height field fell back to RGBA8 packing (no float render targets). */
  readonly packed: boolean;
  private gl: WebGL2RenderingContext;
  private present: () => void;
  private bufW = 1;
  private bufH = 1;
  private dpr = 1;
  private sim: Prog;
  private drop: Prog;
  private render: Prog;
  private tex: WebGLTexture[];
  private fbo: WebGLFramebuffer[];
  private cur = 0;
  private floor: WebGLTexture;
  private coinTex: WebGLTexture;
  private vao: WebGLVertexArrayObject | null;
  private drops: { x: number; y: number; r: number; s: number }[] = [];
  private coinA = new Float32Array(MAX_COINS * 4);
  private coinB = new Float32Array(MAX_COINS * 4);
  private starBuf = new Float32Array(MAX_STARS * 4);

  constructor(gl: WebGL2RenderingContext, opts: WaterRendererOptions = {}) {
    this.gl = gl;
    this.present = opts.present ?? (() => {});
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("EXT_color_buffer_half_float");

    let targets = makeTargets(gl, false);
    this.packed = !targets;
    if (!targets) targets = makeTargets(gl, true);
    if (!targets) throw new Error("No renderable texture format for the water sim");
    this.tex = targets.tex;
    this.fbo = targets.fbo;

    this.sim = makeProgram(gl, SIM_UPDATE(this.packed), ["uTex", "uDelta"]);
    this.drop = makeProgram(gl, SIM_DROP(this.packed), ["uTex", "uCenter", "uRadius", "uStrength"]);
    this.render = makeProgram(gl, RENDER(this.packed), [
      "uHeight", "uFloor", "uRes", "uCenter", "uR", "uTime",
      "uCoinA", "uCoinB", "uCoinCount", "uStar", "uStarCount", "uCoinTex", "uRise", "uRiseB",
    ]);
    this.vao = typeof gl.createVertexArray === "function" ? gl.createVertexArray() : null;

    this.floor = this.solidTexture([150, 205, 210, 255]);
    this.coinTex = this.solidTexture([184, 108, 70, 255]);
  }

  private solidTexture(rgba: number[]) {
    const gl = this.gl;
    const t = gl.createTexture();
    if (!t) throw new Error("createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    return t;
  }

  private upload(t: WebGLTexture, img: TexSource, wrap: number) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img as TexImageSource);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  }

  /** Copper coin sprite sheet: two coins side by side, cut from the pool floor photo. */
  setCoinImage(img: TexSource) {
    this.upload(this.coinTex, img, this.gl.CLAMP_TO_EDGE);
  }

  setFloorImage(img: TexSource) {
    this.upload(this.floor, img, this.gl.MIRRORED_REPEAT);
  }

  /** Layout size in points/CSS px, drawing-buffer size in device pixels, and where the pool sits. */
  resize(width: number, bufferWidth: number, bufferHeight: number, geometry: PoolGeometry) {
    this.bufW = Math.max(1, bufferWidth);
    this.bufH = Math.max(1, bufferHeight);
    this.dpr = this.bufW / Math.max(1, width);
    this.geometry = geometry;
  }

  /** Queue a ripple. x/y in pool space, radius in pool units, strength ~0.01 (drip) .. 0.12 (splash). */
  addDrop(x: number, y: number, radius: number, strength: number) {
    if (this.drops.length < 32) this.drops.push({ x, y, r: radius, s: strength });
  }

  private pass(prog: Prog, setup: () => void) {
    const gl = this.gl;
    const next = 1 - this.cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[next]!);
    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
    gl.useProgram(prog.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]!);
    gl.uniform1i(prog.u("uTex"), 0);
    setup();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cur = next;
  }

  frame(time: number, coins: RenderCoin[], stars: RenderStar[], rise: RenderRise | null, steps = 2) {
    const gl = this.gl;
    if (this.vao) gl.bindVertexArray(this.vao);

    for (const d of this.drops.splice(0)) {
      this.pass(this.drop, () => {
        gl.uniform2f(this.drop.u("uCenter"), d.x * 0.5 + 0.5, d.y * 0.5 + 0.5);
        gl.uniform1f(this.drop.u("uRadius"), d.r * 0.5);
        gl.uniform1f(this.drop.u("uStrength"), d.s);
      });
    }
    for (let i = 0; i < steps; i++) {
      this.pass(this.sim, () => gl.uniform2f(this.sim.u("uDelta"), 1 / SIM_SIZE, 1 / SIM_SIZE));
    }

    const nc = Math.min(coins.length, MAX_COINS);
    for (let i = 0; i < nc; i++) {
      const c = coins[i]!;
      this.coinA.set([c.x, c.y, c.depth, c.size], i * 4);
      this.coinB.set([c.tilt, c.angle, c.variant, c.alpha], i * 4);
    }
    const ns = Math.min(stars.length, MAX_STARS);
    for (let i = 0; i < ns; i++) {
      const s = stars[i]!;
      this.starBuf.set([s.x, s.y, s.rot, s.size], i * 4);
    }

    const u = this.render.u;
    const g = this.geometry;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.bufW, this.bufH);
    gl.useProgram(this.render.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]!);
    gl.uniform1i(u("uHeight"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.floor);
    gl.uniform1i(u("uFloor"), 1);
    gl.uniform2f(u("uRes"), this.bufW, this.bufH);
    gl.uniform2f(u("uCenter"), g.cx * this.dpr, g.cy * this.dpr);
    gl.uniform1f(u("uR"), g.R * this.dpr);
    gl.uniform1f(u("uTime"), time);
    gl.uniform4fv(u("uCoinA"), this.coinA);
    gl.uniform4fv(u("uCoinB"), this.coinB);
    gl.uniform1i(u("uCoinCount"), nc);
    gl.uniform4fv(u("uStar"), this.starBuf);
    gl.uniform1i(u("uStarCount"), ns);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.coinTex);
    gl.uniform1i(u("uCoinTex"), 2);
    if (rise) {
      gl.uniform4f(u("uRise"), rise.x, rise.y, rise.depth, rise.size);
      gl.uniform4f(u("uRiseB"), rise.rot, rise.glow, rise.alpha, rise.open);
    } else {
      gl.uniform4f(u("uRiseB"), 0, 0, 0, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.present();
  }

  dispose() {
    const gl = this.gl;
    this.tex.forEach((t) => gl.deleteTexture(t));
    this.fbo.forEach((f) => gl.deleteFramebuffer(f));
    gl.deleteTexture(this.floor);
    gl.deleteTexture(this.coinTex);
    if (this.vao) gl.deleteVertexArray(this.vao);
  }
}
