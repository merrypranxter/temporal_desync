// retrograde_dominoes.frag — falling upward.
//
// A row of dominoes. The toppling wave starts at the LAST domino and propagates
// backward to the first — and each domino rises from flat to standing rather than
// falling. The cause (the push at the far end) is never shown; you only ever see
// the effect arriving ahead of it. uCausalInversion flips the wave direction so
// you can compare retrograde vs. ordinary toppling.

#include "common.glsl"
#include "core/causality_swap.glsl"

// Rotate point about pivot.
vec2 rot(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c) * v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    float aspect = res.x / res.y;
    vec2 p = vec2((fragCoord.x / res.y), fragCoord.y / res.y); // y-normalized

    const int N = 10;
    float baseY = 0.35;

    float period = 4.0;
    // Wave front position along the row, reversed by inversion.
    float front = causalPhase(iTime, period, uCausalInversion);

    vec3 col = vec3(0.02, 0.03, 0.05);
    // ground line
    col += vec3(0.15) * (abs(p.y - baseY) < 0.004 ? 1.0 : 0.0);

    for (int i = 0; i < N; i++) {
        float fi = (float(i) + 1.0) / float(N + 1);   // 0..1 along row
        vec2 pivot = vec2(fi * aspect, baseY);

        // Distance of this domino from the (reversed) wave front; topple as the
        // front passes. Retrograde: rises from fallen to standing.
        float trigger = smoothstep(0.04, 0.0, abs(fi - front));
        float fall = trigger;                          // 0 standing .. 1 toppled
        if (uCausalInversion > 0.5) fall = 1.0 - fall; // rise instead

        float angle = fall * (TD_PI * 0.42);

        // domino as a thin upright box, rotated about its base
        vec2 local = rot(p - pivot, angle);
        float w = 0.018, h = 0.14;
        float box = step(abs(local.x), w) * step(0.0, local.y) * step(local.y, h);

        // color: standing = cold, toppled = warm
        vec3 c = mix(vec3(0.4, 0.7, 1.0), vec3(1.0, 0.6, 0.35), fall);
        col = mix(col, c, box);
    }

    fragColor = vec4(col, 1.0);
}
