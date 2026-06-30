// ring_buffer.js — a CPU temporal ring buffer.
//
// The GPU effects fake the ring buffer with a feedback texture (see
// core/temporal_buffer.glsl). When you need the *real* thing — to read genuine
// past frames, or to feed a true "future" sample from a recording — this is the
// reference implementation: a fixed-capacity circular buffer of timestamped
// snapshots with linear interpolation between them.
//
//   const rb = new RingBuffer(120);          // ~2s at 60fps
//   rb.push(performance.now()/1000, frameData);
//   const past   = rb.sample(now - 0.1);     // 100 ms ago
//   const future = rb.sample(now + offset);  // only "works" while replaying a recording

export class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.times = new Float64Array(capacity);
    this.slots = new Array(capacity).fill(null);
    this.head = 0;   // next write index
    this.count = 0;  // number of valid entries
  }

  // Store a snapshot at time `t`. `value` is whatever you're buffering.
  push(t, value) {
    this.times[this.head] = t;
    this.slots[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }

  // Oldest and newest timestamps currently held.
  span() {
    if (this.count === 0) return null;
    const oldest = this.times[this._idx(0)];
    const newest = this.times[this._idx(this.count - 1)];
    return { oldest, newest };
  }

  // Sample the buffer at time `t`. Returns { a, b, mix } so the caller decides how
  // to interpolate its own value type (numbers, arrays, ImageData…). Clamps to
  // the held range — reading "the future" only returns real data if `t` falls
  // inside a buffer you filled ahead of the playhead (e.g. a recording).
  sample(t) {
    if (this.count === 0) return null;
    // binary search for the first entry with time >= t
    let lo = 0, hi = this.count - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.times[this._idx(mid)] < t) lo = mid + 1; else hi = mid;
    }
    const i = lo;
    if (i === 0) return { a: this.slots[this._idx(0)], b: this.slots[this._idx(0)], mix: 0 };
    const t0 = this.times[this._idx(i - 1)];
    const t1 = this.times[this._idx(i)];
    const mix = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    return {
      a: this.slots[this._idx(i - 1)],
      b: this.slots[this._idx(i)],
      mix: Math.max(0, Math.min(1, mix)),
    };
  }

  // Convenience for scalar/array values you can lerp.
  sampleLerp(t, lerp = (a, b, m) => a + (b - a) * m) {
    const s = this.sample(t);
    return s ? lerp(s.a, s.b, s.mix) : null;
  }

  _idx(logical) {
    // logical 0 == oldest entry
    const start = (this.head - this.count + this.capacity) % this.capacity;
    return (start + logical) % this.capacity;
  }
}
