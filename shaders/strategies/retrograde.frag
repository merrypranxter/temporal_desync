// retrograde.frag — backward particles.
//
// A field of particles falls under gravity — but time runs in reverse, so they
// rise, decelerating, gathering back toward the launch points they "came from".
// Trails point the way they're going, which is the way they came. The feedback
// buffer (iChannel0) supplies the trails: each frame decays the last one and
// stamps the new particle positions over it.

#include "common.glsl"
#include "core/temporal_buffer.glsl"
#include "core/causality_swap.glsl"

// Position of particle `id` at retrograde time `t`.
vec2 particleAt(float id, float t) {
    vec2 seed = hash22(vec2(id, id * 1.7));
    vec2 launch = vec2(seed.x, -0.1);          // launched from below
    vec2 vel = vec2((seed.y - 0.5) * 0.4, 1.2); // upward-ish
    float g = -1.4;
    // Reverse time: evaluate at -t within a looping window.
    float lt = causalPhase(t + id, 3.0, uCausalInversion) * 2.4;
    return launch + vel * lt + 0.5 * vec2(0.0, g) * lt * lt;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    float aspect = res.x / res.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    // Decayed history from the buffer = particle trails.
    vec4 prev = texture(iChannel0, uv);
    vec3 col = prev.rgb * 0.90;

    float soft = 2.5 / res.y;
    const int COUNT = 48;
    for (int i = 0; i < COUNT; i++) {
        float id = float(i);
        vec2 pos = particleAt(id, iTime);
        pos.x *= aspect;
        float m = disc(p, pos, 0.006, soft);
        // Color by height: warm low (origin/future), cold high (past).
        vec3 c = mix(vec3(1.0, 0.7, 0.4), vec3(0.4, 0.7, 1.0), clamp(pos.y, 0.0, 1.0));
        col += c * m;
    }

    col = clamp(col, 0.0, 1.0);
    fragColor = vec4(col, 1.0);
}
