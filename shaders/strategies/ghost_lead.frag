// ghost_lead.frag — predictive ghost.
//
// The white disc is "now": it sits exactly under the cursor. The translucent
// blue disc is the prediction — where the motion model says the cursor will be
// `uLeadTime` seconds from now. Move the mouse in a smooth arc and the ghost
// leads you into the turn before you arrive. Confidence fades the ghost when the
// guess is a long way ahead or the motion is fast, so it reads as a guess.

#include "common.glsl"
#include "core/prediction.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;

    // Mouse -> UV, with y flipped to match gl_FragCoord origin.
    vec2 m = iMouse.xy / res;
    // Velocity / acceleration delivered in px/sec; convert to UV/sec.
    vec2 v = iMouseVel / res;
    vec2 a = iMouseAcc / res;

    // Idle fallback so there's something to watch before the mouse moves.
    if (iMouse.z < 0.5 && length(iMouseVel) < 1.0) {
        float t = iTime * 0.7;
        m = vec2(0.5) + 0.32 * vec2(cos(t), sin(t * 1.3));
        v = vec2(-sin(t), cos(t * 1.3) * 1.3) * 0.32 * 0.7;
        a = vec2(-cos(t), -sin(t * 1.3) * 1.69) * 0.32 * 0.49;
    }

    vec2 ghostPos = predict(uPredictionModel, m, v, a, uLeadTime);
    float conf = predictionConfidence(v, uLeadTime);

    float aspect = res.x / res.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 mp = vec2(m.x * aspect, m.y);
    vec2 gp = vec2(ghostPos.x * aspect, ghostPos.y);

    float r = 0.035;
    float soft = 2.0 / res.y;

    // Motion-blurred ghost trail along the predicted path.
    float ghost = 0.0;
    const int N = 8;
    for (int i = 0; i < N; i++) {
        vec2 sp = predictSample(uPredictionModel, m, v, a, uLeadTime, i, N);
        sp.x *= aspect;
        ghost = max(ghost, disc(p, sp, r * 0.8, soft) * (float(i) / float(N)));
    }
    ghost = max(ghost, disc(p, gp, r, soft));

    float now = disc(p, mp, r, soft);

    // Faint link line from cause to predicted effect.
    vec2 ab = gp - mp;
    float tline = clamp(dot(p - mp, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
    float lineDist = length(p - (mp + ab * tline));
    float link = (1.0 - smoothstep(0.0, 4.0 / res.y, lineDist)) * 0.25;

    vec3 col = vec3(0.03, 0.04, 0.06);
    col += vec3(0.35, 0.55, 1.0) * (ghost * 0.45 + link) * conf; // future = cold blue
    col = mix(col, vec3(1.0), now);                              // present = white

    fragColor = vec4(col, 1.0);
}
