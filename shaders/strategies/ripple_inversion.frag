// ripple_inversion.frag — converging waves.
//
// Normally you drop a stone and rings expand outward. Here the rings *converge*:
// they appear at the rim and rush inward, collapsing onto the impact point at the
// moment of "impact". The effect (waves) precedes the cause (the strike).
// uCausalInversion crossfades between outward (0) and inward (1) propagation.

#include "common.glsl"
#include "core/causality_swap.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 p = centered(fragCoord, iResolution);

    // Impact point follows the mouse, or drifts if idle.
    vec2 impact = (iMouse.z > 0.5)
        ? centered(iMouse.xy, iResolution)
        : 0.5 * vec2(cos(iTime * 0.6), sin(iTime * 0.9));

    float d = length(p - impact);
    float period = 2.4;

    // Phase of the strike cycle, optionally reversed.
    float phase = causalPhase(iTime, period, uCausalInversion);

    // Wave argument: outward uses (d - phase·R), inward uses (d + phase·R).
    // We blend the sign of the radial term with the inversion amount.
    float R = 1.6;
    float dir = mix(-1.0, 1.0, clamp(uCausalInversion, 0.0, 1.0)); // -out / +in
    float wave = sin(d * 14.0 + dir * phase * R * 14.0);

    // Rings sharpen and brighten as the cycle approaches the strike (phase->1
    // when inverting, so brightness peaks right as the waves reach the center).
    float collapse = smoothstep(0.0, 1.0, phase);
    float amp = exp(-d * 1.6) * mix(0.4, 1.0, collapse);
    float rings = smoothstep(0.55, 1.0, wave) * amp;

    // The strike flash: a bright pop at the center, timed to the convergence.
    float strike = disc(p, impact, 0.02 + 0.06 * collapse, 0.01) *
                   pow(collapse, 6.0);

    vec3 cold = vec3(0.25, 0.55, 1.0);  // anticipation
    vec3 warm = vec3(1.0, 0.85, 0.5);   // the moment of impact
    vec3 col = vec3(0.02, 0.03, 0.05);
    col += cold * rings;
    col += warm * strike * 2.0;

    fragColor = vec4(col, 1.0);
}
