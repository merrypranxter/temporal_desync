// flash_lag.frag — perceptual postdiction (the flash-lag illusion).
//
// A bar moves steadily across the screen. At the moment a stationary dot flashes
// exactly beside the bar, you perceive the bar as already *ahead* of the flash —
// even though they were aligned. The visual system extrapolates the moving object
// forward (Eagleman & Sejnowski, 2000). Here we make that extrapolation literal:
// we draw the bar at its true position AND a ghost where perception places it,
// and flash the dot at the true alignment so you can compare.

#include "common.glsl"
#include "core/prediction.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float speed = 0.35;                 // UV/sec
    float period = 2.0 * aspect / speed;
    float t = mod(iTime, period);
    float x = -0.1 + speed * t;         // true bar position (sweeps L->R)

    // Perceived position: extrapolated forward by ~80 ms of latency.
    float latency = 0.08 + uLeadTime;   // slider extends the illusion
    float xPerceived = x + speed * latency;

    float barTrue = abs(p.x - x * aspect) < 0.012 ? 1.0 : 0.0;
    float yband = smoothstep(0.0, 0.02, p.y - 0.35) * smoothstep(0.0, 0.02, 0.65 - p.y);
    barTrue *= yband;

    // ghost where you *think* it is
    float barGhost = (abs(p.x - xPerceived * aspect) < 0.012 ? 1.0 : 0.0) * yband;

    // The flash: fires briefly each time the bar crosses center.
    float flashWindow = smoothstep(0.06, 0.0, abs(x - 0.5));
    vec2 flashPos = vec2(0.5 * aspect, 0.5);
    float flash = disc(p, flashPos, 0.02, 0.004) * flashWindow;

    vec3 col = vec3(0.02, 0.03, 0.05);
    col += vec3(1.0) * barTrue;                       // truth = white
    col += vec3(0.35, 0.6, 1.0) * barGhost * 0.6;     // perception = ghost
    col += vec3(1.0, 0.85, 0.4) * flash * 2.0;        // the flash
    fragColor = vec4(col, 1.0);
}
