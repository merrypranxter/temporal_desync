// kalman2d.js — a 2D constant-velocity Kalman filter for cursor prediction.
//
// The player ships EMA-smoothed finite differences for velocity. This is the
// upgrade: it fuses noisy position measurements into a smooth (position,
// velocity) estimate and exposes a covariance trace you can map to ghost opacity
// — high uncertainty -> fainter prediction, which is exactly the "tentative
// guess" look the project wants.
//
// State x = [px, py, vx, vy]^T. Measurement z = [px, py] (the mouse position).
// Standalone and dependency-free; copy it wherever you track a moving point.
//
//   const kf = new Kalman2D({ processNoise: 1e-3, measurementNoise: 4 });
//   kf.update([mouseX, mouseY], dt);
//   const [gx, gy] = kf.predict(leadTimeSeconds); // where it'll be
//   const opacity = 1 / (1 + kf.uncertainty());   // fade with doubt

export class Kalman2D {
  constructor({ processNoise = 1e-3, measurementNoise = 4 } = {}) {
    this.q = processNoise;       // trust in the model
    this.r = measurementNoise;   // trust in the measurement (px²)
    this.x = [0, 0, 0, 0];       // px, py, vx, vy
    // 4x4 covariance, row-major; start uncertain.
    this.P = _eye(4, 1e3);
    this.initialized = false;
  }

  // Advance with elapsed time `dt` (s) and a fresh measurement [mx, my].
  update(measurement, dt) {
    const [mx, my] = measurement;
    if (!this.initialized) {
      this.x = [mx, my, 0, 0];
      this.initialized = true;
      return;
    }
    dt = Math.max(dt, 1e-3);

    // --- predict ---
    // F = [[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]]
    const [px, py, vx, vy] = this.x;
    this.x = [px + vx * dt, py + vy * dt, vx, vy];
    this.P = _addQ(_FPFt(this.P, dt), this.q, dt);

    // --- correct --- (measure position only)
    // Innovation S = H P H^T + R, with H selecting [px, py].
    const Sxx = this.P[0] + this.r;
    const Syy = this.P[5] + this.r;
    // Kalman gain K (4x2). Position/velocity rows over their axis variance.
    const Kpx = this.P[0] / Sxx, Kvx = this.P[8] / Sxx;
    const Kpy = this.P[5] / Syy, Kvy = this.P[13] / Syy;

    const yx = mx - this.x[0];
    const yy = my - this.x[1];
    this.x[0] += Kpx * yx; this.x[2] += Kvx * yx;
    this.x[1] += Kpy * yy; this.x[3] += Kvy * yy;

    // Covariance update (diagonal-ish approximation, axis-decoupled).
    this.P[0]  *= (1 - Kpx);
    this.P[5]  *= (1 - Kpy);
    this.P[8]  *= (1 - Kpx);
    this.P[13] *= (1 - Kpy);
  }

  // Extrapolate the estimate `lead` seconds ahead.
  predict(lead) {
    const [px, py, vx, vy] = this.x;
    return [px + vx * lead, py + vy * lead];
  }

  velocity() { return [this.x[2], this.x[3]]; }

  // Scalar uncertainty: trace of the position covariance.
  uncertainty() { return this.P[0] + this.P[5]; }
}

function _eye(n, v) {
  const m = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) m[i * n + i] = v;
  return m;
}

// P' = F P F^T for the constant-velocity F (closed form, avoids a matmul lib).
function _FPFt(P, dt) {
  const o = P.slice();
  // Only the position/velocity coupling terms change under F.
  // x-axis block (indices 0,2,8,10), y-axis block (5,7,13,15).
  const f = (pp, pv, vp, vv) => {
    const a = P[pp] + dt * (P[vp] + P[pv]) + dt * dt * P[vv];
    const b = P[pv] + dt * P[vv];
    const c = P[vp] + dt * P[vv];
    return [a, b, c, P[vv]];
  };
  [o[0], o[2], o[8], o[10]] = f(0, 2, 8, 10);
  [o[5], o[7], o[13], o[15]] = f(5, 7, 13, 15);
  return o;
}

function _addQ(P, q, dt) {
  // Discrete white-noise acceleration model adds process noise to all four states.
  const o = P.slice();
  o[0]  += q * dt;      o[5]  += q * dt;
  o[10] += q;           o[15] += q;
  return o;
}
