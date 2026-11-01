/**
 * The Liquid Glass pass. One quad over the union of all panes; per pixel it
 * evaluates a signed distance field of every pane (rounded boxes, smooth-min
 * union so close panes melt together), then:
 *
 *  - inside, it refracts: a convex bezel bends the sample outward along the
 *    surface normal, strongest at the rim, so what lies past the edge is drawn
 *    in (lensing); a light blur, the material tint, a top-left specular rim
 *    with a dimmer counter-rim, and the press glow under the finger;
 *  - outside, it lays the warm drop shadow;
 *  - across the edge, one device pixel of anti-aliasing.
 *
 * GLSL ES 1.00 so it runs in either a WebGL1 or WebGL2 context. All lengths
 * arrive in device pixels, in GL coordinates (origin bottom-left).
 */
export const MAX_PANES = 8;

export const VERTEX = /* glsl */ `
attribute vec2 a_corner;
uniform vec4 u_bounds; // min.xy, max.xy in device px
uniform vec2 u_resolution;
varying vec2 v_px;
void main() {
  v_px = mix(u_bounds.xy, u_bounds.zw, a_corner);
  gl_Position = vec4(v_px / u_resolution * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAGMENT = /* glsl */ `
precision highp float;
#define MAX_PANES ${MAX_PANES}

uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform int u_count;
uniform vec4 u_rects[MAX_PANES];  // center.xy, half-size.xy
uniform float u_radii[MAX_PANES];
uniform vec3 u_press[MAX_PANES];  // point.xy, strength 0-1
uniform float u_bezel;
uniform float u_refraction;
uniform float u_blur;
uniform float u_merge;
uniform float u_specular;
uniform float u_glow;
uniform float u_glowRadius;
uniform vec4 u_tint;
uniform vec4 u_shadow;
uniform float u_shadowSpread;
uniform float u_shadowOffset;
varying vec2 v_px;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float field(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < MAX_PANES; i++) {
    if (i >= u_count) break;
    float di = sdRoundBox(p - u_rects[i].xy, u_rects[i].zw, u_radii[i]);
    d = i == 0 ? di : smin(d, di, u_merge);
  }
  return d;
}

vec3 scene(vec2 px) {
  return texture2D(u_scene, clamp(px / u_resolution, 0.0, 1.0)).rgb;
}

// Two rings of eight taps (at r and r/2) around the centre: a soft disc blur
// that stays smooth at the larger radius regular glass needs over busy maps.
vec3 frosted(vec2 px) {
  vec3 c = scene(px) * 0.12;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.3927;
    vec2 d = vec2(cos(a), sin(a)) * u_blur;
    c += scene(px + d) * 0.055;
    c += scene(px + d * 0.5) * 0.055;
  }
  return c;
}

void main() {
  vec2 p = v_px;
  float d = field(p);

  // Drop shadow, shifted down (GL y is up).
  float ds = field(p + vec2(0.0, u_shadowOffset));
  float shadow = u_shadow.a * (1.0 - smoothstep(-u_shadowSpread * 0.25, u_shadowSpread, ds));
  vec4 under = vec4(u_shadow.rgb * shadow, shadow);

  float coverage = clamp(0.5 - d, 0.0, 1.0);
  if (coverage <= 0.0) {
    if (shadow <= 0.001) discard;
    gl_FragColor = under;
    return;
  }

  vec2 e = vec2(1.0, 0.0);
  vec2 n = normalize(vec2(field(p + e.xy) - field(p - e.xy), field(p + e.yx) - field(p - e.yx)) + 1e-6);
  float rim = 1.0 - clamp(-d / u_bezel, 0.0, 1.0); // 1 at the edge, 0 past the bezel

  // Convex bezel: sample further out the closer we are to the edge.
  vec2 bent = p + n * u_refraction * u_bezel * rim * rim;
  vec3 color = frosted(bent);
  color = mix(color, u_tint.rgb, u_tint.a);

  vec2 light = normalize(vec2(-0.55, 0.85));
  float lit = max(dot(n, light), 0.0);
  float counter = max(dot(n, -light), 0.0);
  color += u_specular * pow(rim, 3.0) * (lit + 0.45 * counter);

  for (int i = 0; i < MAX_PANES; i++) {
    if (i >= u_count) break;
    float strength = u_press[i].z;
    if (strength <= 0.0) continue;
    vec2 dp = p - u_press[i].xy;
    color += u_glow * strength * exp(-dot(dp, dp) / (2.0 * u_glowRadius * u_glowRadius));
  }

  vec4 glass = vec4(min(color, 1.0), 1.0);
  gl_FragColor = glass * coverage + under * (1.0 - coverage);
}
`;
