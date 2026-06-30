// manifest.js — the catalog of runnable shaders shown in the player dropdown.
// `feedback: true` means the shader reads its previous frame from iChannel0
// (the temporal ring buffer) and needs the ping-pong path.

export const SHADERS = [
  {
    group: "strategies",
    items: [
      { id: "ghost_lead",       title: "Ghost Lead — predictive ghost",        path: "strategies/ghost_lead.frag" },
      { id: "ripple_inversion", title: "Ripple Inversion — converging waves",   path: "strategies/ripple_inversion.frag" },
      { id: "retrograde",       title: "Retrograde — backward particles",       path: "strategies/retrograde.frag", feedback: true },
      { id: "deja_vu",          title: "Deja Vu — phase-shifted loops",         path: "strategies/deja_vu.frag" },
      { id: "flash_lag",        title: "Flash-Lag — perceptual postdiction",    path: "strategies/flash_lag.frag" },
    ],
  },
  {
    group: "demo",
    items: [
      { id: "precognitive_cursor", title: "Precognitive Cursor — it knows where you go", path: "demo/precognitive_cursor.frag" },
      { id: "retrograde_dominoes", title: "Retrograde Dominoes — falling upward",        path: "demo/retrograde_dominoes.frag" },
      { id: "echo_first",          title: "Echo First — the ring before the strike",     path: "demo/echo_first.frag", feedback: true },
    ],
  },
];

export function findShader(id) {
  for (const g of SHADERS) {
    const found = g.items.find((s) => s.id === id);
    if (found) return found;
  }
  return null;
}
