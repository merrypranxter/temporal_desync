# Predictive Models

How `temporal_desync` guesses the future from the recent past. The models live in
`shaders/core/prediction.glsl` (pure GLSL functions); the *state* they consume —
velocity and acceleration — is estimated CPU-side in `web/player.js`, with a
sturdier reference estimator in `snippets/kalman2d.js`.

## State estimation (where v and a come from)

The shader needs `p` (current position), `v` (velocity), `a` (acceleration). The
player derives these from the mouse track.

- **Finite differences (what the player ships):** `v ≈ Δp/Δt`, smoothed with an
  exponential moving average because raw differences are extremely jittery. Cheap,
  good enough for a leading ghost. `a` is the smoothed derivative of `v`.
- **Kalman filter (the upgrade):** a constant-velocity Kalman filter fuses the
  noisy position measurements into a smooth `(p, v)` estimate *and* gives a
  covariance you can map to ghost opacity. See `snippets/kalman2d.js`.

## The three models

Selected by the `uPredictionModel` uniform / the `prediction_model` dropdown.

### 0 — Linear (constant velocity)

```glsl
vec2 predictLinear(vec2 p, vec2 v, float t) { return p + v * t; }
```

`p(t) = p₀ + v·t`. Assumes the target keeps its current heading and speed. Best
for steady tracking; overshoots through curves and snaps hard at reversals.

### 1 — Quadratic (constant acceleration)

```glsl
vec2 predictQuadratic(vec2 p, vec2 v, vec2 a, float t) {
    return p + v * t + 0.5 * a * t * t;
}
```

`p(t) = p₀ + v·t + ½·a·t²`. Curves with the motion, so it tracks arcs well — but
the `t²` term means a noisy `a` estimate throws the ghost wildly at large lead
times. Keep `lead_time` modest with this one, or filter `a` hard.

### 2 — Damped (decaying velocity) — default

```glsl
vec2 predictDamped(vec2 p, vec2 v, float t) {
    const float k = 3.0;
    float decay = (1.0 - exp(-k * t)) / k;
    return p + v * decay;
}
```

Velocity bleeds off as `e^{-k t}`; the integrated displacement saturates at
`v/k`. This is the most forgiving model for interactive use: a fast flick can't
launch the ghost off-screen, and the lead gracefully tops out instead of diverging.
`k ≈ 3` gives a pleasant ~300 ms time constant.

## Choosing a lead time

The horizon `t` is `uLeadTime` (seconds). Perceptually:

| lead | feels like |
|------|-----------|
| 0.00–0.05 s | nothing; ghost sits on the cursor |
| 0.05–0.15 s | tight precognition — "it's reading me" |
| 0.15–0.35 s | clear lead; ghost visibly waits ahead (sweet spot) |
| 0.35–0.8 s  | spooky but starts to detach on direction changes |
| > 0.8 s     | two separate objects; spell breaks |

## Confidence → opacity

```glsl
float predictionConfidence(vec2 v, float t) {
    float speed = length(v);
    return exp(-t * (0.5 + speed * 0.8));
}
```

Confidence falls with both lead time and speed (fast motion is noisier and harder
to extrapolate). The shaders multiply ghost brightness by this so a long or fast
guess presents itself as tentative — which is exactly what keeps it *uncanny
rather than broken* (see `retrocausality.md`).

## Extending

- **Neural / learned model:** the README lists `neural` as a model. A small
  recurrent predictor (or even a polynomial fit over the last N samples) can be
  evaluated CPU-side and the predicted point fed in as a uniform; the shader
  doesn't care how the point was produced.
- **Per-pixel flow prediction:** for full-frame effects, estimate an optical-flow
  field and advect the buffer along it (`core/temporal_buffer.glsl :: advect`).
