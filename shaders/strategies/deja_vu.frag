// deja_vu.frag — phase-shifted overlapping loops.
//
// The same short motion plays in several copies, each started a little "earlier"
// than the last. You see the event, then see it again having begun before you
// saw it the first time. The overlap is what makes it uncanny: at any instant the
// screen holds the same gesture at three different ages.

#include "common.glsl"
#include "core/causality_swap.glsl"

// The "event": a token tracing a figure path over one loop period.
vec2 eventPath(float phase) {
    float a = phase * TD_TAU;
    return vec2(0.5 + 0.3 * sin(a * 1.0),
                0.5 + 0.25 * sin(a * 2.0)); // lissajous
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    float aspect = res.x / res.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float period = 3.0;
    float lead = 1.0; // each ghost starts 1s earlier (the "deja vu" lead)

    vec3 col = vec3(0.02, 0.03, 0.05);
    float soft = 2.5 / res.y;

    const int COPIES = 3;
    for (int i = 0; i < COPIES; i++) {
        // Copy i is shifted earlier in time; with desequence it also jitters.
        float ti = iTime + float(i) * lead;
        ti = desequence(ti, period, uDesequence, float(i) * 3.1);
        float phase = fract(ti / period);

        vec2 pos = eventPath(phase);
        pos.x *= aspect;

        // Older copies (later i) are fainter and warmer — they are "the future
        // memory" bleeding back. The freshest copy is white.
        float age = float(i) / float(COPIES);
        float bright = mix(1.0, 0.25, age);
        vec3 tint = mix(vec3(1.0), vec3(1.0, 0.6, 0.3), age);

        col += tint * disc(p, pos, 0.03, soft) * bright;
        // a faint trail behind each token
        for (int k = 1; k <= 6; k++) {
            float tp = fract((ti - float(k) * 0.04) / period);
            vec2 tpos = eventPath(tp); tpos.x *= aspect;
            col += tint * disc(p, tpos, 0.012, soft) * bright * (0.12 / float(k));
        }
    }

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
