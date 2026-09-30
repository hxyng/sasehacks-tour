/* SASEHacks hill tour: the WebGL painter, run as a worker. It owns the OffscreenCanvas that tour.js hands it: it fetches
   and decodes the painting layers, uploads them in stripes between frames, and draws the quads tour.js sends for each
   frame. All of it is off the main thread, so loading a layer can never stall scrolling.
   Messages in:  init {canvas, base, big} · size {w, h, r} · load {id, stem, w, h, hi} · drop {id} · draw {q}
                 (q is flat: id, x, y, width, height, alpha per quad, in CSS px, back to front)
   Messages out: ok · fail · lost · ready {id} · bad {id} · up {ms} */
'use strict';
var gl = null, v2 = false, cv = null, base = '', uR = null, uV = null, uA = null;
var tex = {}, queue = [], avifOK = null, cssW = 1, cssH = 1, lastQ = null, pumping = false;
var STRIPE = 1 << 19, BUDGET = 6;   // px per upload stripe (2 MB); ms of uploading before yielding to a draw

onmessage = function (e) {
  var m = e.data;
  if (m.t === 'init') { init(m); return; }
  if (!gl) return;
  if (m.t === 'size') {
    cssW = m.w; cssH = m.h;
    var W = Math.round(m.w * m.r), H = Math.round(m.h * m.r);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; if (lastQ) draw(lastQ); }   // resizing clears it
  }
  else if (m.t === 'load') load(m);
  else if (m.t === 'drop') drop(m.id);
  else if (m.t === 'draw') { lastQ = m.q; draw(m.q); }
};

function init(m) {
  cv = m.canvas; base = m.base;
  var opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
  try {
    gl = cv.getContext('webgl2', opt); v2 = !!gl;
    if (!gl) gl = cv.getContext('webgl', opt);
  } catch (err) { gl = null; }
  if (!gl || gl.getParameter(gl.MAX_TEXTURE_SIZE) < m.big) { gl = null; postMessage({ t: 'fail' }); return; }
  function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var pr = gl.createProgram();
  gl.attachShader(pr, shader(gl.VERTEX_SHADER,
    'attribute vec2 q;uniform vec4 r;uniform vec2 v;varying vec2 t;' +
    'void main(){t=q;vec2 p=(r.xy+q*r.zw)/v;gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0);}'));
  gl.attachShader(pr, shader(gl.FRAGMENT_SHADER,
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'uniform sampler2D s;uniform float a;varying vec2 t;void main(){gl_FragColor=texture2D(s,t)*a;}'));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { gl = null; postMessage({ t: 'fail' }); return; }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(pr);
  var aQ = gl.getAttribLocation(pr, 'q');
  gl.enableVertexAttribArray(aQ); gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
  uR = gl.getUniformLocation(pr, 'r'); uV = gl.getUniformLocation(pr, 'v'); uA = gl.getUniformLocation(pr, 'a');
  gl.uniform1i(gl.getUniformLocation(pr, 's'), 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // the bitmaps are premultiplied
  cv.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); gl = null; postMessage({ t: 'lost' }); });
  postMessage({ t: 'ok' });
}

// fetch + decode (AVIF if this browser can, else WebP), then cut into stripes for the upload queue
function load(m) {
  var T = tex[m.id] = { id: m.id, w: m.w, h: m.h, parts: null, next: 0, tx: null, dead: false, ready: false };
  var get = function (ext) {
    return fetch(base + m.stem + '.' + ext, m.hi ? { priority: 'high' } : {})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) { return createImageBitmap(b, { premultiplyAlpha: 'premultiply' }); });
  };
  var p = avifOK === false ? get('webp')
    : get('avif').then(function (bm) { avifOK = true; return bm; }, function (err) { if (avifOK) throw err; avifOK = false; return get('webp'); });
  p.then(function (full) {
    if (T.dead) { full.close(); return; }
    var R = Math.max(32, Math.floor(STRIPE / m.w)), cuts = [];
    for (var y = 0; y < m.h; y += R) {
      cuts.push(createImageBitmap(full, 0, y, m.w, Math.min(R, m.h - y)).then(function (y0) { return function (b) { return { src: b, y: y0 }; }; }(y)));
    }
    return Promise.all(cuts).then(function (parts) {
      full.close();
      T.parts = parts;
      if (T.dead) { closeParts(T); return; }
      queue.push(T); pump();
    }, function (err) { full.close(); throw err; });
  }).catch(function () { if (!T.dead) { delete tex[m.id]; postMessage({ t: 'bad', id: m.id }); } });
}
function closeParts(T) { (T.parts || []).forEach(function (p) { if (p) p.src.close(); }); T.parts = null; }
function drop(id) {
  var T = tex[id]; if (!T) return;
  T.dead = true; delete tex[id];
  if (T.tx && gl) gl.deleteTexture(T.tx);
  T.tx = null;   // its stripes are closed by load() or by the queue
}

function pump() { if (!pumping) { pumping = true; setTimeout(tick, 0); } }
function tick() {
  pumping = false;
  if (!gl) return;
  var t0 = performance.now(), did = false;
  while (queue.length && (!did || performance.now() - t0 < BUDGET)) {
    var T = queue[0];
    if (T.dead) { queue.shift(); closeParts(T); continue; }
    var part = T.parts[T.next];
    if (!T.tx) T.tx = alloc(T.w, T.h);
    gl.bindTexture(gl.TEXTURE_2D, T.tx);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, part.y, gl.RGBA, gl.UNSIGNED_BYTE, part.src);
    did = true;
    part.src.close(); T.parts[T.next++] = null;
    if (T.next >= T.parts.length) {
      queue.shift(); T.parts = null;
      if (v2) {   // mipmaps keep the wide (zoomed-out) shots from shimmering; WebGL1 can't mipmap these non-power-of-two sizes
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
      T.ready = true;
      postMessage({ t: 'ready', id: T.id });
      if (lastQ) draw(lastQ);   // it may already be in the frame
    }
  }
  if (did) postMessage({ t: 'up', ms: +(performance.now() - t0).toFixed(1) });
  if (queue.length) pump();
}
function alloc(w, h) {
  var tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  if (v2) gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log(Math.max(w, h)) / Math.LN2) + 1, gl.RGBA8, w, h);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tx;
}

function draw(q) {
  if (!gl) return;
  gl.viewport(0, 0, cv.width, cv.height);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uV, cssW, cssH);
  for (var i = 0; i < q.length; i += 6) {
    var T = tex[q[i]]; if (!T || !T.ready) continue;
    gl.bindTexture(gl.TEXTURE_2D, T.tx);
    gl.uniform4f(uR, q[i + 1], q[i + 2], q[i + 3], q[i + 4]);
    gl.uniform1f(uA, q[i + 5]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
