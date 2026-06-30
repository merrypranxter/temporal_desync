# Retrocausality

> Time is just a coordinate. This document is about pointing the arrow the wrong way — and, more honestly, about *making it look like* we did.

## The honest disclaimer

Nothing here violates physics. We cannot read the future. What we *can* do is
exploit two facts:

1. **Smooth motion is predictable.** Over short horizons, a trajectory's next
   position is well-approximated by its current position, velocity, and
   acceleration. So we can render where something is *going* before it gets
   there. To a viewer, an accurate-enough prediction is indistinguishable from
   foresight — until it's wrong, which is when it gets interesting.
2. **Perception is reconstructed, not recorded.** The brain stitches a coherent
   "now" out of signals that arrive at different latencies, and it routinely
   back-dates and forward-projects events to make the story consistent
   (postdiction). We lean on that: present the effect early and the visual system
   often *accepts* it as causal.

So "retrocausality" here means **the felt experience of effect-before-cause**,
built from prediction, anticipation, and time-reversed simulation.

## Four levers

### 1. Predictive lead
Maintain a motion model and draw the predicted future state as a translucent
ghost that leads the real one. See [`predictive_models.md`](predictive_models.md)
and `shaders/strategies/ghost_lead.frag`.

The ghost must read as a *guess*: fade it with confidence (drops with lead time
and speed), and let it overshoot on direction changes. A ghost that's never wrong
looks like a second cursor; a ghost that's wrong in a recoverable way looks like
precognition.

### 2. Anticipation (effect before cause)
Shift the effect's evaluation time *ahead* of the cause's. `anticipate(t, lead)`
in `core/causality_swap.glsl` is the whole trick: evaluate the response at
`t + lead`. `echo_first.frag` times an expanding ring to peak *before* the strike
that "makes" it.

### 3. Retrocausal cascade (time-reversed simulation)
Run a forward simulation, then play it backward, or evaluate the dynamics at a
reversed phase. Dominoes rise instead of fall; ripples converge instead of
spread; particles climb their own arcs. `reverseTime` / `causalPhase` provide the
reversed time coordinate; `retrograde.frag` and `retrograde_dominoes.frag` use it.

The signature of a *good* reversal is that it's locally plausible (each frame
looks like real physics) but globally impossible (the energy comes from nowhere).

### 4. Buffered causality
Keep a ring buffer of frames and read from an offset. In a fragment shader the
buffer is the feedback texture `iChannel0`; "reading the future" is reading
*ahead along the optical flow*, because where a feature is heading is, locally,
where it will be. See `core/temporal_buffer.glsl` and `docs/architecture.md`.

## The uncanny line

The agent's standing instruction: **the violation should feel uncanny, not
broken.** A few rules of thumb that keep effects on the right side of that line:

- **Keep the truth on screen.** Always show the real state somewhere (the white
  mark, the true bar) so the brain has something to be wrong *against*.
- **Make the lead small and physical.** 50–300 ms reads as precognition;
  multi-second leads read as two unrelated objects.
- **Fade with confidence.** Uncertainty that's visible is uncanny; certainty
  that's wrong is just a bug.
- **Loop seamlessly.** A reversed sequence that pops at the loop boundary breaks
  the spell instantly.

## Further reading

- Libet et al. (1983), *Time of conscious intention to act* — readiness potential
  precedes reported intention; the "cause" (decision) lags its own effect.
- Eagleman & Sejnowski (2000), *Motion integration and postdiction* — the
  flash-lag illusion as forward extrapolation; the basis for `flash_lag.frag`.
- Choi (2013), *Retrocausality in quantum mechanics* — the physics framing we are
  deliberately only *simulating*.
