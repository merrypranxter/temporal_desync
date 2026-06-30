// common.glsl — shared helpers used across temporal_desync shaders.
// No uniforms here; pure functions only so it can be #included anywhere.

#ifndef TD_COMMON
#define TD_COMMON

const float TD_PI  = 3.14159265359;
const float TD_TAU = 6.28318530718;

// --- hashing / noise -------------------------------------------------------

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// value noise in [0,1]
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// --- shapes ----------------------------------------------------------------

// soft, anti-aliased disc. returns coverage in [0,1].
float disc(vec2 p, vec2 center, float radius, float softness) {
    float d = length(p - center);
    return 1.0 - smoothstep(radius - softness, radius + softness, d);
}

// thin ring of given radius and thickness.
float ring(vec2 p, vec2 center, float radius, float thickness, float softness) {
    float d = abs(length(p - center) - radius);
    return 1.0 - smoothstep(thickness - softness, thickness + softness, d);
}

// --- color -----------------------------------------------------------------

// cheap, pleasant cyclic palette (Inigo Quilez style).
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TD_TAU * (c * t + d));
}

// the house palette: cold "present", warm "future".
vec3 timePalette(float t) {
    return palette(t,
        vec3(0.5, 0.5, 0.55),
        vec3(0.5, 0.45, 0.5),
        vec3(1.0, 1.0, 1.0),
        vec3(0.0, 0.15, 0.4));
}

// --- misc ------------------------------------------------------------------

// aspect-corrected, centered coords in roughly [-1,1] on the short axis.
vec2 centered(vec2 fragCoord, vec3 res) {
    return (2.0 * fragCoord - res.xy) / res.y;
}

#endif
