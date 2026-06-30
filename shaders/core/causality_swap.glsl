// core/causality_swap.glsl — invert the cause→effect mapping.
//
// The point of causal inversion is that the *response* arrives before the
// *stimulus*. These helpers blend smoothly between the honest mapping
// (inversion = 0) and the inverted one (inversion = 1) so the violation can be
// dialed in and feels uncanny rather than simply wrong.

#ifndef TD_CAUSALITY_SWAP
#define TD_CAUSALITY_SWAP

// Swap polarity of an event signal. At inversion=1, a press (cause=1) reads as a
// release (0) and vice versa. At 0 it's the identity.
float invertPolarity(float cause, float inversion) {
    return mix(cause, 1.0 - cause, clamp(inversion, 0.0, 1.0));
}

// Reverse a looping phase in [0,1): time runs backward through the cycle.
float reverseTime(float t, float period) {
    float phase = fract(t / period);
    return 1.0 - phase;
}

// Blend a forward phase and its reverse. inversion=0 -> forward, 1 -> retrograde.
float causalPhase(float t, float period, float inversion) {
    float fwd = fract(t / period);
    float rev = 1.0 - fwd;
    return mix(fwd, rev, clamp(inversion, 0.0, 1.0));
}

// Shift an effect *earlier* than its cause by `lead` seconds. Returns the time at
// which the effect should be evaluated. With lead>0 the effect leads the cause.
float anticipate(float t, float lead) {
    return t + lead;
}

// Desequencing: scramble event ordering by jittering the time coordinate with a
// hash. `amount` is uDesequence; at 0 it's the identity, at 1 events smear across
// roughly ±0.5 of a period.
float desequence(float t, float period, float amount, float seed) {
    float slot = floor(t / period);
    float j = fract(sin(slot * 12.9898 + seed * 78.233) * 43758.5453) - 0.5;
    return t + j * amount * period;
}

#endif
