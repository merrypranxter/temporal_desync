// player.js — a minimal WebGL2 player for the temporal_desync shaders.
//
// Responsibilities:
//   * compile a selected .frag (after #include expansion) behind a Shadertoy-ish
//     header that declares all uniforms and a main() that calls mainImage();
//   * run a ping-pong feedback pair so iChannel0 = the previous frame (this is
//     the "temporal ring buffer" the retrocausal shaders read from);
//   * track the mouse and estimate velocity + acceleration (the cause we predict);
//   * expose lead_time / prediction_model / temporal_offset / causal_inversion /
//     desequence_factor as live controls.

import { loadShader } from "./glsl-include.js";
import { SHADERS, findShader } from "./manifest.js";

const SHADER_BASE = new URL("../shaders/", window.location.href).href;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Prepended to every fragment shader. Keeps the .frag files clean: they only
// declare mainImage() and #include what they need.
const FRAG_HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform vec3  iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int   iFrame;
uniform vec4  iMouse;     // xy = cursor px (y up); z = interacted flag; w = unused
uniform vec2  iMouseVel;  // px / second  (the velocity we extrapolate)
uniform vec2  iMouseAcc;  // px / second^2
uniform sampler2D iChannel0; // previous frame == temporal ring buffer
uniform float uLeadTime;
uniform float uTemporalOffset;
uniform float uCausalInversion;
uniform float uDesequence;
uniform int   uPredictionModel;
out vec4 fragColor;
#line 1
`;

const FRAG_FOOTER = `
void main() { mainImage(fragColor, gl_FragCoord.xy); }`;

const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
out vec4 o;
void main(){ o = texture(uTex, gl_FragCoord.xy / uRes); }`;

class Player {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) throw new Error("WebGL2 is required but not available.");
    this.gl = gl;
    gl.getExtension("EXT_color_buffer_float");

    this._fullscreenQuad();
    this.copyProgram = this._program(VERT, COPY_FRAG);

    this.program = null;
    this.uniforms = {};
    this.startTime = performance.now() / 1000;
    this.lastTime = this.startTime;
    this.frame = 0;
    this.paused = false;

    // mouse / motion state (in CSS px, y-up)
    this.mouse = { x: 0, y: 0, interacted: false };
    this.vel = { x: 0, y: 0 };
    this.acc = { x: 0, y: 0 };
    this._lastMouse = null;

    // controls
    this.params = {
      uLeadTime: 0.35,
      uTemporalOffset: 0.25,
      uCausalInversion: 1.0,
      uDesequence: 0.0,
      uPredictionModel: 2,
    };

    this._initPingPong();
    this._bindMouse();
    window.addEventListener("resize", () => this._resize());
    this._resize();
  }

  _fullscreenQuad() {
    const gl = this.gl;
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  _shader(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log + "\n\n" + _numbered(src));
    }
    return sh;
  }

  _program(vsrc, fsrc) {
    const gl = this.gl;
    const p = gl.createProgram();
    const vs = this._shader(gl.VERTEX_SHADER, vsrc);
    const fs = this._shader(gl.FRAGMENT_SHADER, fsrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  _initPingPong() {
    const gl = this.gl;
    this.targets = [0, 1].map(() => {
      const tex = gl.createTexture();
      const fbo = gl.createFramebuffer();
      return { tex, fbo };
    });
    this.read = 0;
    this.write = 1;
  }

  _sizeTargets() {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    for (const t of this.targets) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._clearHistory();
  }

  _clearHistory() {
    const gl = this.gl;
    for (const t of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this._sizeTargets();
    }
  }

  _bindMouse() {
    const c = this.canvas;
    const update = (e) => {
      const rect = c.getBoundingClientRect();
      const dpr = this.canvas.width / rect.width;
      const x = (e.clientX - rect.left) * dpr;
      const y = (rect.height - (e.clientY - rect.top)) * dpr; // flip to y-up
      this.mouse.x = x;
      this.mouse.y = y;
      this.mouse.interacted = true;
    };
    c.addEventListener("pointermove", update);
    c.addEventListener("pointerdown", update);
  }

  async setShader(id) {
    const meta = findShader(id);
    if (!meta) throw new Error("unknown shader: " + id);
    const entry = new URL(meta.path, SHADER_BASE).href;
    const body = await loadShader(entry, SHADER_BASE);
    const full = FRAG_HEADER + body + FRAG_FOOTER;
    const prog = this._program(VERT, full);
    if (this.program) this.gl.deleteProgram(this.program);
    this.program = prog;
    this.meta = meta;
    this._cacheUniforms();
    this._clearHistory();
    this.startTime = performance.now() / 1000;
    this.frame = 0;
  }

  _cacheUniforms() {
    const gl = this.gl, p = this.program;
    const names = ["iResolution","iTime","iTimeDelta","iFrame","iMouse","iMouseVel",
      "iMouseAcc","iChannel0","uLeadTime","uTemporalOffset","uCausalInversion",
      "uDesequence","uPredictionModel"];
    this.uniforms = {};
    for (const n of names) this.uniforms[n] = gl.getUniformLocation(p, n);
  }

  _estimateMotion(dt) {
    if (!this._lastMouse) {
      this._lastMouse = { x: this.mouse.x, y: this.mouse.y };
      return;
    }
    const inst = {
      x: (this.mouse.x - this._lastMouse.x) / Math.max(dt, 1e-3),
      y: (this.mouse.y - this._lastMouse.y) / Math.max(dt, 1e-3),
    };
    // Exponential smoothing — finite differences alone are far too jittery.
    const a = 0.25;
    const prevVel = { ...this.vel };
    this.vel.x += (inst.x - this.vel.x) * a;
    this.vel.y += (inst.y - this.vel.y) * a;
    const instAcc = {
      x: (this.vel.x - prevVel.x) / Math.max(dt, 1e-3),
      y: (this.vel.y - prevVel.y) / Math.max(dt, 1e-3),
    };
    this.acc.x += (instAcc.x - this.acc.x) * a;
    this.acc.y += (instAcc.y - this.acc.y) * a;
    this._lastMouse = { x: this.mouse.x, y: this.mouse.y };
  }

  frameTick() {
    if (!this.program) return;
    const gl = this.gl;
    const now = performance.now() / 1000;
    const dt = Math.min(now - this.lastTime, 1 / 15);
    this.lastTime = now;
    if (this.paused) return;
    this._resize();
    this._estimateMotion(dt);

    const w = this.canvas.width, h = this.canvas.height;
    const t = now - this.startTime;

    // pass 1: render the shader into the write target, reading previous as iChannel0
    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[this.write].fbo);
    gl.viewport(0, 0, w, h);
    gl.bindVertexArray(this.quad);

    const U = this.uniforms;
    gl.uniform3f(U.iResolution, w, h, w / h);
    gl.uniform1f(U.iTime, t);
    gl.uniform1f(U.iTimeDelta, dt);
    gl.uniform1i(U.iFrame, this.frame);
    gl.uniform4f(U.iMouse, this.mouse.x, this.mouse.y, this.mouse.interacted ? 1 : 0, 0);
    gl.uniform2f(U.iMouseVel, this.vel.x, this.vel.y);
    gl.uniform2f(U.iMouseAcc, this.acc.x, this.acc.y);
    gl.uniform1f(U.uLeadTime, this.params.uLeadTime);
    gl.uniform1f(U.uTemporalOffset, this.params.uTemporalOffset);
    gl.uniform1f(U.uCausalInversion, this.params.uCausalInversion);
    gl.uniform1f(U.uDesequence, this.params.uDesequence);
    gl.uniform1i(U.uPredictionModel, this.params.uPredictionModel);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.read].tex);
    gl.uniform1i(U.iChannel0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2: copy write target to screen
    gl.useProgram(this.copyProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.write].tex);
    gl.uniform1i(gl.getUniformLocation(this.copyProgram, "uTex"), 0);
    gl.uniform2f(gl.getUniformLocation(this.copyProgram, "uRes"), w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // swap
    [this.read, this.write] = [this.write, this.read];
    this.frame++;
  }
}

function _numbered(src) {
  return src.split("\n").map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join("\n");
}

// ---- bootstrap UI ---------------------------------------------------------

function buildUI(player) {
  const sel = document.getElementById("shaderSelect");
  for (const g of SHADERS) {
    const og = document.createElement("optgroup");
    og.label = g.group;
    for (const s of g.items) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.title;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }

  const status = document.getElementById("status");
  async function load(id) {
    try {
      status.textContent = "compiling…";
      await player.setShader(id);
      status.textContent = "";
      const desc = player.meta && player.meta.feedback ? " (feedback)" : "";
      status.textContent = id + desc;
    } catch (e) {
      status.innerHTML = `<pre class="err">${String(e.message || e)}</pre>`;
      console.error(e);
    }
  }

  sel.addEventListener("change", () => load(sel.value));

  const bind = (id, key, parse) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + "Val");
    const apply = () => {
      const v = parse(el.value);
      player.params[key] = v;
      if (out) out.textContent = typeof v === "number" ? v.toFixed(2) : v;
    };
    el.addEventListener("input", apply);
    apply();
  };
  bind("lead", "uLeadTime", parseFloat);
  bind("offset", "uTemporalOffset", parseFloat);
  bind("inv", "uCausalInversion", parseFloat);
  bind("deseq", "uDesequence", parseFloat);
  bind("model", "uPredictionModel", (v) => parseInt(v, 10));

  document.getElementById("pause").addEventListener("click", (e) => {
    player.paused = !player.paused;
    e.target.textContent = player.paused ? "▶ play" : "⏸ pause";
  });

  load(SHADERS[0].items[0].id);
}

function main() {
  const canvas = document.getElementById("gl");
  let player;
  try {
    player = new Player(canvas);
  } catch (e) {
    document.getElementById("status").innerHTML =
      `<pre class="err">${String(e.message || e)}</pre>`;
    return;
  }
  buildUI(player);
  const loop = () => { player.frameTick(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

main();
