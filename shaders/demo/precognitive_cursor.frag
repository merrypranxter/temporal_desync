// precognitive_cursor.frag — the cursor knows where you're going.
//
// A reticle is drawn not at the mouse, but where the motion model predicts the
// mouse will be. As long as you move smoothly it sits ahead of you, "waiting".
// When you stop or reverse, it overshoots and snaps back — that recovery is the
// tell that it was guessing. The faint dot is the true cursor for comparison.

#include "common.glsl"
#include "core/prediction.glsl"

float reticle(vec2 p, vec2 c, float r) {
    float ringv = ring(p, c, r, 0.004, 0.003);
    // crosshair ticks
    vec2 d = abs(p - c);
    float tick = 0.0;
    tick = max(tick, (d.y < 0.0015 && d.x < r * 1.4 && d.x > r * 0.7) ? 1.0 : 0.0);
    tick = max(tick, (d.x < 0.0015 && d.y < r * 1.4 && d.y > r * 0.7) ? 1.0 : 0.0);
    return max(ringv, tick);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    float aspect = res.x / res.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec2 m = iMouse.xy / res;
    vec2 v = iMouseVel / res;
    vec2 a = iMouseAcc / res;

    if (iMouse.z < 0.5 && length(iMouseVel) < 1.0) {
        float t = iTime;
        m = vec2(0.5) + vec2(0.3 * sin(t * 1.1), 0.22 * sin(t * 1.7));
        v = vec2(0.3 * 1.1 * cos(t * 1.1), 0.22 * 1.7 * cos(t * 1.7));
        a = vec2(-0.3 * 1.21 * sin(t * 1.1), -0.22 * 2.89 * sin(t * 1.7));
    }

    vec2 pred = predict(uPredictionModel, m, v, a, uLeadTime);
    float conf = predictionConfidence(v, uLeadTime);

    vec2 mp = vec2(m.x * aspect, m.y);
    vec2 pp = vec2(pred.x * aspect, pred.y);

    vec3 col = vec3(0.02, 0.03, 0.05);

    // background grid for spatial reference
    vec2 g = abs(fract(p * 12.0) - 0.5);
    float grid = smoothstep(0.48, 0.5, max(g.x, g.y)) * 0.04;
    col += vec3(grid);

    // true cursor: small faint dot
    col += vec3(0.5) * disc(p, mp, 0.008, 2.0 / res.y);

    // precognitive reticle, brightness scaled by confidence
    col += vec3(0.4, 0.8, 1.0) * reticle(p, pp, 0.05) * (0.4 + 0.6 * conf);

    fragColor = vec4(col, 1.0);
}
