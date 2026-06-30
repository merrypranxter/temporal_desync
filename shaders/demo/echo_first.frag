// echo_first.frag — the ring before the strike.
//
// Audio plays before its visual cause; we can't emit sound from a fragment
// shader, so this is the *visual score* of that idea. A bell is struck on a
// regular beat. The expanding "sound" ring is rendered to ARRIVE at full size
// slightly BEFORE the visible strike pulse — the echo leads its source. The
// player can read iTime to drive a WebAudio click at the true strike time, so
// what you hear lands after what the ring already told you was coming.

#include "common.glsl"
#include "core/temporal_buffer.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = centered(fragCoord, iResolution);

    float beat = 1.5;                       // seconds per strike
    float phase = fract(iTime / beat);      // 0..1 within a beat
    float lead = clamp(uLeadTime, 0.0, 0.6) / beat + 0.18; // echo leads by this

    vec2 bell = vec2(0.0, 0.0);

    // The "sound" ring: expands and is timed to peak BEFORE the strike (phase
    // wraps, so we look at the *next* strike using phase + lead).
    float ringPhase = fract(phase + lead);
    float rr = ringPhase * 1.4;
    float soundRing = ring(p, bell, rr, 0.02 + 0.05 * ringPhase, 0.01);
    soundRing *= (1.0 - ringPhase);         // fade as it grows

    // The visible strike: a sharp flash of the bell at the actual beat (phase~0).
    float strikePulse = exp(-phase * 12.0);
    float bellGlow = disc(p, bell, 0.06 + 0.04 * strikePulse, 0.01);

    vec3 col = vec3(0.02, 0.03, 0.05);
    col += vec3(0.35, 0.7, 1.0) * soundRing;          // the early echo (cold)
    col += vec3(1.0, 0.9, 0.6) * bellGlow * (0.3 + strikePulse); // the strike (warm)

    // a faint persistence trail so successive echoes overlap
    col = max(col, texture(iChannel0, uv).rgb * 0.82);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
