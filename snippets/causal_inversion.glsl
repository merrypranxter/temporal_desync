// causal_inversion.glsl — polarity-swap kernel (standalone snippet).
//
// "Button press releases; button release presses." The essence of causal
// inversion: a response that runs opposite to its stimulus, dialed in smoothly so
// it reads as uncanny rather than as a flipped boolean.
//
// `cause`     : the stimulus in [0,1] (e.g. 1.0 while a key is held).
// `inversion` : 0 = honest, 1 = fully inverted.
// returns the effect amplitude to drive whatever you're animating.

float invertedResponse(float cause, float inversion) {
    return mix(cause, 1.0 - cause, clamp(inversion, 0.0, 1.0));
}

// Temporal version: make the effect ANTICIPATE the cause by `lead` seconds.
// Sample your stimulus signal at (t + lead) so the response moves first.
// `stimulusAt` is a function you provide that returns the cause at a given time.
//   float e = anticipatedResponse(iTime, 0.2, inversion);
// (here we model the stimulus as a square pulse for illustration)
float squarePulse(float t, float period, float duty) {
    return step(fract(t / period), duty);
}

float anticipatedResponse(float t, float lead, float inversion) {
    float causeNow    = squarePulse(t, 2.0, 0.5);
    float causeFuture = squarePulse(t + lead, 2.0, 0.5); // peek ahead
    // Blend honest "now" response with the early "future" one.
    float effect = mix(causeNow, causeFuture, 0.85);
    return invertedResponse(effect, inversion);
}

// Spatial polarity swap: turn a bright-on-dark mark into dark-on-bright as
// inversion rises — the visual analogue of pressing-by-releasing.
vec3 invertField(vec3 color, float inversion) {
    return mix(color, 1.0 - color, clamp(inversion, 0.0, 1.0));
}
