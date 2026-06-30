// core/prediction.glsl — motion extrapolation models.
//
// Given a tracked point's current state (position p, velocity v, acceleration a)
// these functions project where it *will* be `t` seconds from now. The shader
// renders that projection as a leading ghost, so the effect precedes the cause.
//
// Models (selected by `uPredictionModel`):
//   0  linear     — constant velocity        p + v t
//   1  quadratic  — constant acceleration     p + v t + ½ a t²
//   2  damped     — velocity bleeds off       (exponential drag, k≈3)
//
// These are pure functions. State (v, a) is estimated CPU-side by the player
// from the mouse track and handed in via uniforms; see snippets/kalman2d.js for
// a sturdier estimator than finite differences.

#ifndef TD_PREDICTION
#define TD_PREDICTION

vec2 predictLinear(vec2 p, vec2 v, float t) {
    return p + v * t;
}

vec2 predictQuadratic(vec2 p, vec2 v, vec2 a, float t) {
    return p + v * t + 0.5 * a * t * t;
}

// Velocity decays as exp(-k t); integrating gives a finite lead even for large t.
// This keeps fast flicks from launching the ghost off-screen.
vec2 predictDamped(vec2 p, vec2 v, float t) {
    const float k = 3.0;
    float decay = (1.0 - exp(-k * t)) / k;
    return p + v * decay;
}

// Dispatcher. Falls back to linear for unknown models.
vec2 predict(int model, vec2 p, vec2 v, vec2 a, float t) {
    if (model == 1) return predictQuadratic(p, v, a, t);
    if (model == 2) return predictDamped(p, v, t);
    return predictLinear(p, v, t);
}

// Confidence in a prediction falls off the further ahead we look and the faster
// the target is moving (fast motion is noisier). Use it to fade the ghost so the
// guess looks tentative rather than authoritative.
float predictionConfidence(vec2 v, float t) {
    float speed = length(v);
    return exp(-t * (0.5 + speed * 0.8));
}

// A short trail of N samples along the predicted path, for motion-blurred ghosts.
// `i` in [0, n-1]; returns the position at fractional lead time.
vec2 predictSample(int model, vec2 p, vec2 v, vec2 a, float leadTime, int i, int n) {
    float f = float(i) / float(max(n - 1, 1));
    return predict(model, p, v, a, leadTime * f);
}

#endif
