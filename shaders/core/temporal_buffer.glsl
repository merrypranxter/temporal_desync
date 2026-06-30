// core/temporal_buffer.glsl — the ring buffer, expressed as a feedback texture.
//
// A real ring buffer of frames would need N textures. Instead the player gives
// us iChannel0 = the previous output frame, and we treat the accumulated history
// inside it as the buffer. Reading "the future" is then a matter of sampling the
// buffer *ahead along the optical flow*: where a feature is heading is, locally,
// where it will be — so reading there shows the present a few frames early.
//
// Helpers here are pure given iChannel0; they don't declare the sampler, the
// caller passes it in.

#ifndef TD_TEMPORAL_BUFFER
#define TD_TEMPORAL_BUFFER

// Sample the buffer offset along a flow field — the "read from the future" op.
// `flow` is in UV/sec, `offset` in seconds (uTemporalOffset).
vec4 readFuture(sampler2D buf, vec2 uv, vec2 flow, float offset) {
    vec2 futureUv = uv + flow * offset;
    return texture(buf, clamp(futureUv, 0.0, 1.0));
}

// Symmetric "read from the past" for comparison / echo effects.
vec4 readPast(sampler2D buf, vec2 uv, vec2 flow, float offset) {
    vec2 pastUv = uv - flow * offset;
    return texture(buf, clamp(pastUv, 0.0, 1.0));
}

// Persistence: blend new content over a decayed copy of the buffer so motion
// leaves trails (the "tail" of the ring buffer). `decay` in [0,1], higher = longer.
vec4 persist(vec4 prev, vec4 next, float decay) {
    return max(next, prev * decay);
}

// Advect (push) the buffer contents along a flow field by one step. Cheap
// semi-Lagrangian advection: look back along the flow and copy.
vec4 advect(sampler2D buf, vec2 uv, vec2 flow, float dt) {
    return texture(buf, clamp(uv - flow * dt, 0.0, 1.0));
}

// Map a ring-buffer slot index to a normalized phase, so callers can fake "N
// frames of history/future" (uniform temporal_buffer_size) without N textures.
float ringPhase(int frame, int size) {
    return float(frame % max(size, 1)) / float(max(size, 1));
}

#endif
