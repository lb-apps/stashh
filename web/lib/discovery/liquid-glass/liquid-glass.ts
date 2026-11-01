'use client';

import { colorToken, lengthToken, motionToken, numberToken } from '../token-values';
import type { GlassRegistry, GlassTier } from '../glass';
import { FRAGMENT, MAX_PANES, VERTEX } from './shader';

/**
 * Discovery's refractive glass, drawn inside the map's own WebGL frame.
 *
 * WebKit (Safari, and the WKWebView of Instagram's in-app browser) cannot
 * refract live DOM — `backdrop-filter: url()` is unimplemented — so the glass
 * is painted by the map: a custom layer, last in the stack, copies the
 * finished frame under the panes (GPU to GPU, no readback) and draws every
 * pane in one pass. DOM elements register themselves and stay on top as a
 * transparent layer of glyphs and hit targets.
 *
 * Idle cost is nothing: the map only redraws when something moves, and this
 * class asks for a redraw only while a pane moves or a press glow animates.
 */

/** Structural twin of Mapbox/MapLibre `CustomLayerInterface`. */
export interface GlassCustomLayer {
  id: string;
  type: 'custom';
  renderingMode: '2d';
  onAdd: (map: unknown, gl: WebGLRenderingContext) => void;
  render: (gl: WebGLRenderingContext) => void;
  onRemove: (map: unknown, gl: WebGLRenderingContext) => void;
}

interface Pane {
  radiusCss: (width: number, height: number) => number;
  /** Where the finger last touched — kept while the glow fades out. */
  press: { x: number; y: number } | null;
  /** Glow, eased toward `target` (1 while pressed). */
  strength: number;
  target: number;
}

interface Params {
  bezel: number;
  refraction: number;
  blur: number;
  merge: number;
  specular: number;
  glow: number;
  tint: [number, number, number, number];
  shadow: [number, number, number, number];
  shadowSpread: number;
  shadowOffset: number;
  pressSeconds: number;
}

function readParams(): Params {
  return {
    bezel: lengthToken('--glass-bezel'),
    refraction: numberToken('--glass-refraction'),
    blur: lengthToken('--glass-blur'),
    merge: Math.max(0.001, lengthToken('--glass-merge')),
    specular: numberToken('--glass-specular'),
    glow: numberToken('--glass-press-glow'),
    tint: colorToken('--glass-tint'),
    shadow: colorToken('--glass-shadow'),
    shadowSpread: lengthToken('--glass-shadow-spread'),
    shadowOffset: lengthToken('--glass-shadow-offset'),
    pressSeconds: motionToken('--dur-fast', '--ease-out').duration,
  };
}

/** Border radius of an element as a function of its size (handles `%` and pills). */
function radiusOf(element: HTMLElement): (width: number, height: number) => number {
  const raw = getComputedStyle(element).borderTopLeftRadius;
  const value = Number.parseFloat(raw);
  const percent = raw.trim().endsWith('%');
  return (width, height) => {
    const max = Math.min(width, height) / 2;
    return Math.min(percent ? (value / 100) * Math.min(width, height) : value, max);
  };
}

type Uniforms = Record<
  | 'resolution' | 'bounds' | 'count' | 'rects' | 'radii' | 'press' | 'bezel' | 'refraction' | 'blur' | 'merge'
  | 'specular' | 'glow' | 'glowRadius' | 'tint' | 'shadow' | 'shadowSpread' | 'shadowOffset' | 'scene',
  WebGLUniformLocation | null
>;

interface GpuState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  quad: WebGLBuffer;
  texture: WebGLTexture;
  textureSize: [number, number];
  uniforms: Uniforms;
  corner: number;
}

/** Frames slower than this, many in a row while glass is moving, mean the device can't afford it. */
const SLOW_FRAME_MS = 24;
const SLOW_FRAMES_TO_FALL_BACK = 30;

export class LiquidGlass {
  private panes = new Map<HTMLElement, Pane>();
  private gpu: GpuState | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private repaint: () => void = () => {};
  private params: Params | null = null;
  private frame = 0;
  private lastSignature = '';
  private lastTick = 0;
  private slowFrames = 0;

  constructor(private readonly onBudgetMissed: () => void) {}

  /** The registry handed to `GlassProvider` for the given tier. */
  registry(tier: GlassTier): GlassRegistry {
    return { tier, register: this.register, press: this.press };
  }

  readonly layer: GlassCustomLayer = {
    id: 'discovery-liquid-glass',
    type: 'custom',
    renderingMode: '2d',
    onAdd: (_map, gl) => this.setup(gl),
    render: (gl) => this.draw(gl),
    onRemove: () => this.teardown(),
  };

  /** Binds to the map's canvas; `repaint` asks the map for one more frame. */
  attach(canvas: HTMLCanvasElement, repaint: () => void) {
    this.canvas = canvas;
    this.repaint = repaint;
    this.params = readParams();
    this.watch();
  }

  detach() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.canvas = null;
    this.repaint = () => {};
  }

  private register = (element: HTMLElement) => {
    this.panes.set(element, { radiusCss: radiusOf(element), press: null, strength: 0, target: 0 });
    this.watch();
    return () => {
      this.panes.delete(element);
      this.lastSignature = '';
      this.repaint();
    };
  };

  private press = (element: HTMLElement, point: { x: number; y: number } | null) => {
    const pane = this.panes.get(element);
    if (!pane) return;
    if (point) pane.press = point;
    pane.target = point ? 1 : 0;
    this.watch();
  };

  /** One rAF loop: redraw when a pane moved or a glow is animating; sleep otherwise. */
  private watch() {
    if (this.frame || !this.canvas) return;
    this.lastTick = performance.now();
    const tick = (now: number) => {
      this.frame = 0;
      if (!this.canvas || this.panes.size === 0) return;
      const dt = Math.min(0.1, (now - this.lastTick) / 1000);
      this.lastTick = now;

      let animating = false;
      const tau = Math.max(0.001, (this.params?.pressSeconds ?? 0.14) / 3);
      for (const pane of this.panes.values()) {
        if (Math.abs(pane.target - pane.strength) > 0.002) {
          pane.strength += (pane.target - pane.strength) * (1 - Math.exp(-dt / tau));
          animating = true;
        } else {
          pane.strength = pane.target;
        }
      }

      const signature = this.signature();
      const moved = signature !== this.lastSignature;
      if (moved || animating) {
        this.lastSignature = signature;
        this.repaint();
        this.slowFrames = dt * 1000 > SLOW_FRAME_MS ? this.slowFrames + 1 : 0;
        if (this.slowFrames >= SLOW_FRAMES_TO_FALL_BACK) {
          this.slowFrames = 0;
          this.onBudgetMissed();
        }
      } else {
        this.slowFrames = 0;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private signature(): string {
    let s = '';
    for (const element of this.panes.keys()) {
      const r = element.getBoundingClientRect();
      s += `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)};`;
    }
    return s;
  }

  private setup(gl: WebGLRenderingContext) {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'glass shader');
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'glass program');

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const u = (name: string) => gl.getUniformLocation(program, name);
    this.gpu = {
      gl,
      program,
      quad,
      texture,
      textureSize: [0, 0],
      corner: gl.getAttribLocation(program, 'a_corner'),
      uniforms: {
        resolution: u('u_resolution'), bounds: u('u_bounds'), count: u('u_count'), rects: u('u_rects'),
        radii: u('u_radii'), press: u('u_press'), bezel: u('u_bezel'), refraction: u('u_refraction'),
        blur: u('u_blur'), merge: u('u_merge'), specular: u('u_specular'), glow: u('u_glow'),
        glowRadius: u('u_glowRadius'), tint: u('u_tint'), shadow: u('u_shadow'),
        shadowSpread: u('u_shadowSpread'), shadowOffset: u('u_shadowOffset'), scene: u('u_scene'),
      },
    };
  }

  private teardown() {
    const gpu = this.gpu;
    this.gpu = null;
    if (!gpu || gpu.gl.isContextLost()) return;
    gpu.gl.deleteProgram(gpu.program);
    gpu.gl.deleteBuffer(gpu.quad);
    gpu.gl.deleteTexture(gpu.texture);
  }

  private draw(gl: WebGLRenderingContext) {
    const gpu = this.gpu;
    const canvas = this.canvas;
    const params = this.params;
    if (!gpu || !canvas || !params || this.panes.size === 0) return;

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = width / box.width;

    const rects = new Float32Array(MAX_PANES * 4);
    const radii = new Float32Array(MAX_PANES);
    const press = new Float32Array(MAX_PANES * 3);
    let count = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const [element, pane] of this.panes) {
      if (count === MAX_PANES) break;
      const r = element.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cx = (r.left - box.left + r.width / 2) * dpr;
      const cy = height - (r.top - box.top + r.height / 2) * dpr;
      const hw = (r.width / 2) * dpr;
      const hh = (r.height / 2) * dpr;
      if (cx + hw < 0 || cx - hw > width || cy + hh < 0 || cy - hh > height) continue;
      rects.set([cx, cy, hw, hh], count * 4);
      radii[count] = pane.radiusCss(r.width, r.height) * dpr;
      if (pane.press && pane.strength > 0) {
        press.set([(pane.press.x - box.left) * dpr, height - (pane.press.y - box.top) * dpr, pane.strength], count * 3);
      }
      minX = Math.min(minX, cx - hw); maxX = Math.max(maxX, cx + hw);
      minY = Math.min(minY, cy - hh); maxY = Math.max(maxY, cy + hh);
      count += 1;
    }
    if (count === 0) return;

    const margin = (params.shadowSpread + params.shadowOffset + params.merge) * dpr;
    const reach = (params.bezel * params.refraction + params.blur) * dpr + 2;
    const x0 = Math.max(0, Math.floor(minX - margin));
    const y0 = Math.max(0, Math.floor(minY - margin));
    const x1 = Math.min(width, Math.ceil(maxX + margin));
    const y1 = Math.min(height, Math.ceil(maxY + margin));

    // The finished map under the panes (plus how far refraction can reach) → texture.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    if (gpu.textureSize[0] !== width || gpu.textureSize[1] !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gpu.textureSize = [width, height];
    }
    const cx0 = Math.max(0, Math.floor(minX - reach));
    const cy0 = Math.max(0, Math.floor(minY - reach));
    const cx1 = Math.min(width, Math.ceil(maxX + reach));
    const cy1 = Math.min(height, Math.ceil(maxY + reach));
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, cx0, cy0, cx0, cy0, cx1 - cx0, cy1 - cy0);

    // Our own vertex state: never write into a VAO the map left bound.
    if ('bindVertexArray' in gl) (gl as WebGL2RenderingContext).bindVertexArray(null);
    else gl.getExtension('OES_vertex_array_object')?.bindVertexArrayOES(null);

    gl.useProgram(gpu.program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, width, height);

    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.quad);
    gl.enableVertexAttribArray(gpu.corner);
    gl.vertexAttribPointer(gpu.corner, 2, gl.FLOAT, false, 0, 0);

    const u = gpu.uniforms;
    gl.uniform1i(u.scene, 0);
    gl.uniform2f(u.resolution, width, height);
    gl.uniform4f(u.bounds, x0, y0, x1, y1);
    gl.uniform1i(u.count, count);
    gl.uniform4fv(u.rects, rects);
    gl.uniform1fv(u.radii, radii);
    gl.uniform3fv(u.press, press);
    gl.uniform1f(u.bezel, params.bezel * dpr);
    gl.uniform1f(u.refraction, params.refraction);
    gl.uniform1f(u.blur, params.blur * dpr);
    gl.uniform1f(u.merge, params.merge * dpr);
    gl.uniform1f(u.specular, params.specular);
    gl.uniform1f(u.glow, params.glow);
    gl.uniform1f(u.glowRadius, params.bezel * 2 * dpr);
    gl.uniform4fv(u.tint, params.tint);
    gl.uniform4fv(u.shadow, params.shadow);
    gl.uniform1f(u.shadowSpread, params.shadowSpread * dpr);
    gl.uniform1f(u.shadowOffset, params.shadowOffset * dpr);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(gpu.corner);
  }
}
