// glsl-include.js — a tiny #include resolver for GLSL fetched over HTTP.
//
// GLSL has no #include. Our .frag files use `#include "core/foo.glsl"` and this
// resolver expands them, recursively, with cycle protection. Paths are resolved
// relative to the shaders/ root (the `baseUrl` passed in), which keeps the
// include lines identical no matter which subdirectory the shader lives in.

const _cache = new Map();

async function _fetchText(url) {
  if (_cache.has(url)) return _cache.get(url);
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  _cache.set(url, text);
  return text;
}

const INCLUDE_RE = /^[ \t]*#include[ \t]+"([^"]+)"[ \t]*$/gm;

// Expand includes in `source`. `baseUrl` is the shaders/ root (with trailing /).
// `seen` guards against include cycles.
export async function resolveIncludes(source, baseUrl, seen = new Set()) {
  const matches = [...source.matchAll(INCLUDE_RE)];
  if (matches.length === 0) return source;

  // Fetch + recursively resolve every included file first.
  const expansions = await Promise.all(
    matches.map(async (m) => {
      const rel = m[1];
      const url = new URL(rel, baseUrl).href;
      if (seen.has(url)) return ""; // already included — include guards do the rest
      const next = new Set(seen);
      next.add(url);
      const text = await _fetchText(url);
      const expanded = await resolveIncludes(text, baseUrl, next);
      return `\n// ---- begin ${rel} ----\n${expanded}\n// ---- end ${rel} ----\n`;
    })
  );

  let i = 0;
  return source.replace(INCLUDE_RE, () => expansions[i++]);
}

// Fetch a shader entry file and fully expand its includes.
export async function loadShader(entryUrl, baseUrl) {
  const src = await _fetchText(entryUrl);
  return resolveIncludes(src, baseUrl);
}

export function clearShaderCache() {
  _cache.clear();
}
