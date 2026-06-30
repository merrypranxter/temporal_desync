# Architecture

How the pieces fit together. This is the audit-added glue that turns the README's
file tree into something that actually runs in a browser.

```
index.html ──loads──> web/player.js
                          │
                          ├── web/manifest.js      (which shaders exist)
                          ├── web/glsl-include.js  (#include resolver)
                          └── shaders/**           (fetched over HTTP, compiled)
```

## The player (`web/player.js`)

A ~300-line vanilla WebGL2 renderer. Each frame it:

1. Estimates mouse **velocity** and **acceleration** from the pointer track
   (EMA-smoothed finite differences). This is the "cause" the shaders extrapolate.
2. Renders the selected fragment shader into a float framebuffer, binding the
   **previous frame** as `iChannel0` (the temporal ring buffer).
3. Copies that framebuffer to the screen.
4. Swaps the ping-pong pair.

### Uniforms every shader receives

| uniform | type | meaning |
|---------|------|---------|
| `iResolution` | `vec3` | viewport px, plus aspect in `.z` |
| `iTime` | `float` | seconds since shader load |
| `iTimeDelta` | `float` | seconds since last frame |
| `iFrame` | `int` | frame counter |
| `iMouse` | `vec4` | `.xy` cursor px (y-up); `.z` = 1 once the user interacts |
| `iMouseVel` | `vec2` | cursor velocity, px/sec (smoothed) |
| `iMouseAcc` | `vec2` | cursor acceleration, px/sec² (smoothed) |
| `iChannel0` | `sampler2D` | previous frame = the temporal ring buffer |
| `uLeadTime` | `float` | prediction horizon, seconds |
| `uTemporalOffset` | `float` | how far "into the future" to read the buffer |
| `uCausalInversion` | `float` | 0 = honest, 1 = inverted cause/effect |
| `uDesequence` | `float` | event-order scramble amount |
| `uPredictionModel` | `int` | 0 linear / 1 quadratic / 2 damped |

The player prepends a header declaring all of these plus a `main()` that calls
your `mainImage(out vec4 fragColor, in vec2 fragCoord)`. So a shader file only
ever declares `mainImage` and whatever it `#include`s — no boilerplate, no
version pragma.

## The `#include` resolver (`web/glsl-include.js`)

GLSL has no `#include`. The resolver fetches each `#include "path"` target
(relative to `shaders/`), recursively expands *its* includes, guards against
cycles, and splices the text in. That's why `shaders/core/*.glsl` use
`#ifndef TD_FOO / #define TD_FOO / #endif` include guards — a file pulled in by
two different paths is only emitted once.

Include paths are always written relative to the `shaders/` root, so the same
line works whether it appears in `strategies/` or `demo/`:

```glsl
#include "common.glsl"
#include "core/prediction.glsl"
```

## The temporal ring buffer (feedback)

The README describes a ring buffer of N frames. Rather than allocate N textures,
the player keeps a **ping-pong pair of float framebuffers** and exposes the
previous frame as `iChannel0`. Two consequences:

- **Trails / persistence** (`persist`, `advect` in `core/temporal_buffer.glsl`)
  come for free: decay the old frame, stamp new content over it.
- **"Reading the future"** (`readFuture`) is reading the buffer *offset along the
  optical flow* — locally, where a feature is heading is where it will be, so the
  sample shows the present a few frames early.

Shaders that rely on this set `feedback: true` in `web/manifest.js`
(`retrograde`, `echo_first`). Others ignore `iChannel0` entirely.

## Adding a shader

1. Drop a `.frag` in `shaders/strategies/` or `shaders/demo/` defining
   `mainImage`.
2. `#include` any core helpers you need.
3. Register it in `web/manifest.js` (set `feedback: true` if it samples
   `iChannel0`).

It appears in the dropdown on reload. Compile errors are printed — with line
numbers, against the fully-expanded source — into the status box and the console.

## Why not Shadertoy directly?

These shaders are deliberately Shadertoy-*compatible* in spirit (`mainImage`,
`iResolution`, `iTime`, `iMouse`, `iChannel0`) so they're easy to port. The local
player exists so the `#include` modularity, the custom `u*` parameters, and the
mouse velocity/acceleration uniforms work without manual setup.
