// reverse_wave.glsl — converging-ripple kernel (standalone snippet).
//
// The minimal core of ripple_inversion.frag, isolated for reuse. A normal ripple
// uses phase (kr - ωt): crests move OUTWARD as t grows. Flip the sign of the time
// term and crests move INWARD, collapsing onto the source — the wave arrives
// before the thing that "caused" it.
//
// Drop this function into any shader and call it with centered coords.

float convergingRipple(vec2 p, vec2 source, float t,
                        float wavelength, float speed) {
    float r = length(p - source);
    float k = 6.28318530718 / wavelength; // spatial frequency
    float w = k * speed;                  // temporal frequency

    // OUTWARD (normal):  phase = k*r - w*t
    // INWARD  (reversed): phase = k*r + w*t   <-- the only change
    float phase = k * r + w * t;

    float wave = sin(phase);
    // emphasize crests and fade with distance so it reads as collapsing rings
    float crest = smoothstep(0.4, 1.0, wave);
    float falloff = exp(-r * 1.5);
    return crest * falloff;
}

// Bonus: a one-liner that crossfades outward<->inward by `inv` in [0,1], the same
// way uCausalInversion does in the full shader.
float ripple(vec2 p, vec2 src, float t, float wl, float spd, float inv) {
    float r = length(p - src);
    float k = 6.28318530718 / wl;
    float w = k * spd;
    float phase = k * r + mix(-1.0, 1.0, clamp(inv, 0.0, 1.0)) * w * t;
    return smoothstep(0.4, 1.0, sin(phase)) * exp(-r * 1.5);
}
