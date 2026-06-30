# temporal_desync

> Output leads input. Effect before cause. A shader that breaks time's arrow.

## What This Is

Causality is the assumption that causes precede effects. This repo violates that
assumption — deliberately, visibly, and beautifully. The output responds to input
*before* the input arrives, creating a temporally desynchronized experience.

This is achieved through:

1. **Prediction** — Extrapolate likely future input from trajectories
2. **Anticipation** — Show the effect *before* the cause, creating a sense of precognition
3. **Retrocausality Simulation** — Visualize what a time-reversed causal chain looks like
4. **Buffer Manipulation** — Read from the "future" end of a ring buffer

The guiding rule for everything here: **make the prediction visible as a
translucent ghost, and make the violation feel uncanny — not broken.**

## Run It

The shaders are real WebGL2 fragment shaders. A tiny dependency-free player
(`web/`) compiles them, drives a feedback buffer that acts as the temporal ring
buffer, and exposes the parameters below as live sliders.

```bash
# any static file server works — the player fetches shaders over HTTP
python3 -m http.server 8080
# then open http://localhost:8080/
```

Pick a shader from the dropdown, move the mouse, and watch the output arrive
early. See [`docs/architecture.md`](docs/architecture.md) for how the player,
the `#include` resolver, and the feedback buffer fit together.

## Core Mechanisms

### 1. Predictive Lead
The shader maintains a motion model (velocity, acceleration) for tracked objects.
It renders the *predicted* future state alongside the current state, creating a
"ghost" that leads the actual input.

```glsl
// Predictive lead
vec2 predicted_pos = current_pos + velocity * lead_time + 0.5 * acceleration * lead_time * lead_time;
render_ghost(predicted_pos, 0.3); // 30% opacity ghost
render_actual(current_pos, 1.0);
```

### 2. Retrocausal Cascade
A chain of dominoes that falls *up*. The last domino triggers first, and the wave
propagates backward. Implemented via reverse-time simulation in a buffer.

### 3. Echo-First Audio
Sound plays before the visual event that "causes" it. The brain struggles to bind
them causally.

### 4. Buffered Causality
A circular buffer stores the last N frames. The shader reads from `current + offset`,
displaying a future frame in the present. The user sees their own actions before
they perform them.

## Visual Strategies

| Strategy | Description | Implementation |
|----------|-------------|----------------|
| **Ghost Lead** | Transparent preview of predicted future | Kalman/particle prediction |
| **Ripple Inversion** | Waves converge on impact point before the impact | Reverse-time wave equation |
| **Retrograde Particles** | Particles flow backward along their trajectories | Time-reversed physics |
| **Deja Vu Loop** | The same 3-second sequence plays, but each iteration starts 1 second "earlier" | Overlapping phase-shifted loops |
| **Causal Inversion** | Button press *releases*; button release *presses* | Input polarity swap |
| **Flash-Lag** | A flash next to a moving object appears to lag behind it | Perceptual postdiction (Eagleman) |

## Technical Implementation

```glsl
// Temporal buffer for retrocausal display
uniform sampler2D temporal_buffer; // Ring buffer of past frames
uniform float temporal_offset;     // How far "into the future" to read

void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;

    // Read from "future" (actually just offset in ring buffer)
    vec2 future_uv = uv + velocity_field(uv) * temporal_offset;
    vec3 future_color = texture(temporal_buffer, future_uv).rgb;

    vec3 present_color = render_present(uv);

    // Blend: show future bleeding into present
    float lead_strength = smoothstep(0.0, 1.0, temporal_offset);
    vec3 color = mix(present_color, future_color, lead_strength);

    gl_FragColor = vec4(color, 1.0);
}
```

## Parameters

| Uniform | Slider | Meaning |
|---------|--------|---------|
| `uLeadTime` | `lead_time` | how far ahead to predict (seconds) |
| `uPredictionModel` | `prediction_model` | `0` linear / `1` quadratic / `2` damped |
| `uTemporalOffset` | `temporal_offset` | how far "into the future" to read the buffer |
| `uCausalInversion` | `causal_inversion` | swap cause and effect mapping (`0`..`1`) |
| `uDesequence` | `desequence_factor` | how much to scramble event order |

All shaders also receive Shadertoy-style `iResolution`, `iTime`, `iTimeDelta`,
`iFrame`, `iMouse`, and `iChannel0` (the feedback / temporal buffer).

## Layout

```
temporal_desync/
├── index.html                      # entry point for the WebGL2 player
├── web/
│   ├── player.js                   # compiles shaders, drives the feedback buffer
│   ├── glsl-include.js             # resolves #include "core/..." over HTTP
│   └── manifest.js                 # the catalog of runnable shaders
├── shaders/
│   ├── common.glsl                 # shared sdf/noise/hash helpers
│   ├── core/
│   │   ├── prediction.glsl         # motion extrapolation models
│   │   ├── temporal_buffer.glsl    # ring buffer / feedback management
│   │   └── causality_swap.glsl     # invert cause/effect
│   ├── strategies/
│   │   ├── ghost_lead.frag         # predictive ghost
│   │   ├── ripple_inversion.frag   # converging waves
│   │   ├── retrograde.frag         # backward particles
│   │   ├── deja_vu.frag            # phase-shifted loops
│   │   └── flash_lag.frag          # perceptual postdiction
│   └── demo/
│       ├── precognitive_cursor.frag # cursor knows where you're going
│       ├── retrograde_dominoes.frag # falling upward
│       └── echo_first.frag          # the ring before the strike
├── snippets/                       # standalone, copy-pasteable references
│   ├── kalman2d.js                 # 2D constant-velocity Kalman filter
│   ├── ring_buffer.js              # CPU temporal ring buffer
│   ├── reverse_wave.glsl           # converging-ripple kernel
│   └── causal_inversion.glsl       # polarity-swap kernel
└── docs/
    ├── retrocausality.md
    ├── predictive_models.md
    └── architecture.md
```

## References

- Libet et al. (1983). *Time of conscious intention to act.*
- Eagleman & Sejnowski (2000). *Motion integration and postdiction in visual awareness.*
- Choi (2013). *Retrocausality in quantum mechanics.*

## Related

- `saccadic_masking_exploits` — shared manipulation of perception timing
- `simulation_hypothesis_vis` — shared "reality is a simulation" themes

---

*Time is just a coordinate. This shader uses a different coordinate system.*
