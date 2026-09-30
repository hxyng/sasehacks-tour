/* SASEHacks hill tour: a camera over the painted backdrop, with three depth layers, painted cloud cut-outs and
   doodles. Event facts come only from window.SH_EVENT. The page works as a plain scrolling page without this file. */
(function () {
  'use strict';
  var E = window.SH_EVENT || {}, D = window.TOUR_DATA, root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var sstep = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /* ================= facts from SH_EVENT (both modes) ================= */
  var start = new Date(E.start), end = new Date(E.end), hasTime = !isNaN(start) && !isNaN(end) && end > start;
  function offMin(iso) { var m = /([+-])(\d\d):?(\d\d)$/.exec(iso || ''); return m ? (m[1] == '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : -new Date().getTimezoneOffset(); }
  var OFF = offMin(E.start);
  function fmt(d, o) { o.timeZone = 'UTC'; return new Intl.DateTimeFormat('en-US', o).format(new Date(d.getTime() + OFF * 60000)); }
  var tOpt = { hour: 'numeric', minute: '2-digit' };
  function setF(k, v) { $$('[data-f="' + k + '"]').forEach(function (el) { el.textContent = v; }); }
  setF('name', E.name || 'SASEHacks'); setF('host', E.host || 'OU SASE'); setF('theme', E.theme || 'Community'); if (E.partner) setF('partner', E.partner);
  if (E.venue) setF('venue', E.venue);
  if (E.timezone) setF('tz', E.timezone);
  if (hasTime) {
    setF('date', fmt(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    setF('range', fmt(start, tOpt) + ' to ' + fmt(end, tOpt));
    setF('startTime', fmt(start, tOpt)); setF('endTime', fmt(end, tOpt));
    var hrs = Math.ceil((end - start) / 36e5), words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    if (hrs <= 12) setF('hoursWord', words[hrs]);
  }
  $$('a[data-f="register"]').forEach(function (a) { if (E.register) a.href = E.register; });
  $$('a[data-f="email"]').forEach(function (a) { if (E.email) { a.href = 'mailto:' + E.email; a.textContent = E.email; } });
  $$('a[data-f="ig"]').forEach(function (a) { if (E.instagram) a.href = E.instagram; if (E.handle) a.textContent = E.handle; });
  var g = $('a[data-f="gcal"]');
  if (g && hasTime) {
    var gs = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent((E.name || 'SASEHacks') + ' by ' + (E.host || 'OU SASE')) +
      '&dates=' + gs(start) + '/' + gs(end) + '&location=' + encodeURIComponent(E.venue || '');
  }

  // review hook, as in the design system: ?shnow=<ISO> previews another moment
  var skew = 0, qn = /[?&]shnow=([^&]+)/.exec(location.search);
  if (qn) { var tq = new Date(decodeURIComponent(qn[1])); if (!isNaN(tq)) skew = tq - Date.now(); }

  // schedule times: draft offsets assume a 12-hour day; stretch to the real start/end, rounded to 15 min (as section 11)
  var schedItems = $$('.sched li');
  if (hasTime) {
    var kS = 1;   // data-at are real minutes after start (the proposal's schedule), not a stretched draft
    schedItems.forEach(function (li) {
      li._t = new Date(+start + Math.round(+li.getAttribute('data-at') * kS / 15) * 15 * 60000);
      $('[data-t]', li).textContent = fmt(li._t, { hour: 'numeric', minute: '2-digit' });
    });
    (function mark() {
      var now = Date.now() + skew, cur = -1;
      if (now >= start && now < end) schedItems.forEach(function (li, i) { if (li._t <= now) cur = i; });
      schedItems.forEach(function (li, i) { li.classList.toggle('is-now', i === cur); if (i === cur) li.setAttribute('aria-current', 'time'); else li.removeAttribute('aria-current'); });
      if (now < end) setTimeout(mark, 60000 - (now % 60000) + 50);   // on the minute: milestones and start/end are whole minutes
    })();
  }

  // countdown (panel digits + the doodle cloud on the painted cumulus)
  (function () {
    if (!hasTime) return;
    var dg = { d: $('[data-u="d"]'), h: $('[data-u="h"]'), m: $('[data-u="m"]'), s: $('[data-u="s"]') };
    var live = $('[data-f="live"]'), cdShort = $('[data-cd="short"]'), cdLbl = $('[data-cd="label"]');
    var lastState = null, lastMin = null, pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    function tick() {
      var now = Date.now() + skew, state, left;
      if (now < start) { state = 'before'; left = start - now; } else if (now < end) { state = 'during'; left = end - now; } else { state = 'after'; left = 0; }
      if (state !== lastState) {
        lastState = state;
        $$('[data-state]').forEach(function (el) { var st = el.getAttribute('data-state'); if (st === state || (st === 'clock' && state !== 'after')) el.setAttribute('data-show', ''); else el.removeAttribute('data-show'); });
        if (cdLbl) cdLbl.textContent = state === 'before' ? 'gates open in' : state === 'during' ? 'wrap-up in' : "that's a wrap!";
      }
      var s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sc = s % 60;
      if (dg.d) { dg.d.textContent = pad(d); dg.h.textContent = pad(h); dg.m.textContent = pad(m); dg.s.textContent = pad(sc); }
      if (cdShort) cdShort.textContent = state === 'after' ? 'thank you!' : d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(sc);
      var mk = state + Math.floor(s / 60);
      if (mk !== lastMin && live) {
        lastMin = mk;
        live.textContent = state === 'before' ? d + ' days, ' + h + ' hours and ' + m + ' minutes until SASEHacks starts.'
          : state === 'during' ? 'SASEHacks is happening now. ' + h + ' hours and ' + m + ' minutes left.' : 'SASEHacks has ended. Thank you for coming.';
      }
      if (state !== 'after') setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    }
    tick();
  })();

  /* ================= motion mode ================= */
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { location.reload(); });
  if (!D || !root.classList.contains('js-motion')) { root.classList.remove('js-motion'); return; }

  // smooth scrolling: Lenis eases wheel/trackpad scrolling into one continuous glide (touch keeps native momentum).
  // It is stepped from the tour's own frame loop (autoRaf off), so the camera always reads this frame's scroll, not last frame's.
  var lenis = null;
  try {
    if (window.Lenis) {
      lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1, syncTouch: false });
      $$('.panel').forEach(function (p) { p.setAttribute('data-lenis-prevent', ''); });   // inner panel scroll stays native
    }
  } catch (e) { lenis = null; }
  function scrollToY(y, smooth) {
    if (lenis) lenis.scrollTo(y, smooth ? { duration: 1.6, easing: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } } : { immediate: true, force: true });
    else if (smooth) window.scrollTo({ top: y, behavior: 'smooth' }); else window.scrollTo(0, y);
  }

  var W = D.W, H = D.H, OS = D.overscan, F = D.files;
  var stage = $('.stage'), tour = $('#tour');
  var sections = $$('.stop'), N = sections.length;
  var STOPS = D.stops;
  var ids = STOPS.map(function (s) { return s.id; });
  var panels = sections.map(function (s) { return $('.panel', s); });
  var navLinks = $$('.progress a');

  // scroll lengths (svh units). Long hops get more room for the zoom-out arc behind the cloud bank.
  var HOLD = { hero: 45, about: 55, when: 60, community: 55, schedule: 170 };
  var MOVE = { when: 90, schedule: 200 };   // after the schedule: the gate opens, clouds roll in, then the FAQ
  var LONG = { when: 1 };
  sections.forEach(function (s, i) { s.style.setProperty('--hold', HOLD[ids[i]] || 90); s.style.setProperty('--move', MOVE[ids[i]] || 60); });

  var LK = { far: .85, mid: 1, near: 1 };           // depth per layer: near is locked to mid (they move as one); only the far sky/sea parallaxes
  var CLOUD_K = 1.45, DRIFT = .05, AMP = 60;         // cloud depth, slow push-in during holds, pointer parallax px

  var svhProbe = document.createElement('div');
  svhProbe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(svhProbe);

  var vp = {}, tops = [], holdPx = [], movePx = [], frames = [];
  // phone framings were composed for ~9:19.5 and are height-led (bands above/below): on wider portrait screens keep the
  // same vertical coverage instead of the same width, otherwise a 3:4 tablet lands 1.6x tighter than a phone
  var PHONE_A = 9 / 19.5;
  function mixF(d, m) { var mw = Math.min(1, m.w * Math.max(1, vp.a / PHONE_A)); return { cx: lerp(m.cx, d.cx, vp.mix), cy: lerp(m.cy, d.cy, vp.mix), lw: lerp(Math.log(mw), Math.log(d.w), vp.mix) }; }
  function measure() {
    vp.w = stage.clientWidth || innerWidth; vp.h = stage.clientHeight || innerHeight;
    vp.hs = Math.min(svhProbe.offsetHeight || innerHeight, vp.h);
    vp.cx = vp.w / 2; vp.cy = vp.hs / 2;
    vp.a = vp.w / vp.hs;
    var rig = vp.a >= 1 ? 'd' : 'm';
    // art set: phone plates/1600 bases only on phone-sized screens; portrait tablets need the 2688 textures
    var art = rig === 'm' && vp.w < 600 ? 'm' : 'd';
    if (vp.art && art !== vp.art) { resetPlates(); resetBases(); }
    vp.rig = rig; vp.art = art;
    if (typeof loadGate === 'function') loadGate();
    vp.mix = clamp((vp.a - .75) / (1.2 - .75), 0, 1);
    vp.coarse = matchMedia('(pointer: coarse)').matches;
    vp.lim = (vp.coarse ? .025 : .035) * vp.w;
    vp.sMin = Math.max(vp.w / W, vp.h / H);
    vp.lwMax = Math.log(vp.w / (vp.sMin * W));
    vp.still = !!(mq && mq.matches);
    // sizes the frame loop needs, read once here: reading layout inside the loop, right after writing transforms,
    // forces a synchronous reflow every frame
    vp.clL = cl.left.offsetWidth; vp.clR = cl.right.offsetWidth; vp.clB = [cl.b1.offsetHeight, cl.b2.offsetHeight];
    vp.puffH = gate.puffs.map(function (el) { return el.offsetHeight; });
    if (GL) GL.size(vp.w, vp.h);
    var sy = scrollY;
    tops = sections.map(function (s) { return s.getBoundingClientRect().top + sy; });
    holdPx = ids.map(function (id) { return (HOLD[id] || 55) * vp.hs / 100; });
    movePx = ids.map(function (id) { return (MOVE[id] || 60) * vp.hs / 100; });
    frames = STOPS.map(function (s) { return { a: mixF(s.d[0], s.m[0]), b: mixF(s.d[1], s.m[1]), travel: ['cx', 'cy', 'w'].some(function (k) { return s.d[0][k] !== s.d[1][k] || s.m[0][k] !== s.m[1][k]; }) }; });
    dirty = true;
  }

  // warp: nearer layers lead the move, farther ones lag; aligned at both ends
  function warp(t, k) { return clamp(t + (k - 1) * .6 * Math.sin(Math.PI * t), 0, 1); }
  function framing(i, u, k) {
    var fr = frames[i], f;
    if (fr.travel) {
      var tt = sstep(warp(u, k));
      f = { cx: lerp(fr.a.cx, fr.b.cx, tt), cy: lerp(fr.a.cy, fr.b.cy, tt), lw: lerp(fr.a.lw, fr.b.lw, tt) };
    } else f = { cx: fr.a.cx, cy: fr.a.cy, lw: fr.a.lw - k * Math.log(1 + DRIFT * u) };
    return f;
  }
  function between(i, t, k) {
    var a = framing(i, 1, k), b = framing(i + 1, 0, k), tt = ease(warp(t, k));
    var f = { cx: lerp(a.cx, b.cx, tt), cy: lerp(a.cy, b.cy, tt), lw: lerp(a.lw, b.lw, tt) };
    if (LONG[ids[i]]) {
      var peak = Math.min(Math.log(2 * Math.max(Math.exp(a.lw), Math.exp(b.lw))), vp.lwMax);
      var dip = Math.max(0, peak - (a.lw + b.lw) / 2);
      f.lw += dip * Math.sin(Math.PI * tt);
    }
    return f;
  }
  function toCam(f) {
    var s = Math.max(vp.w / (Math.exp(f.lw) * W), vp.sMin);
    var x = clamp(f.cx * W, vp.cx / s, W - (vp.w - vp.cx) / s);
    var y = clamp(f.cy * H, vp.cy / s, H - (vp.h - vp.cy) / s);
    return { s: s, x: x, y: y };
  }
  function locate(y) {
    var i = 0; while (i < N - 1 && y >= tops[i + 1]) i++;
    var local = y - tops[i];
    if (local < holdPx[i]) return { i: i, m: false, u: clamp(local / holdPx[i], 0, 1) };
    return { i: i, m: true, u: clamp((local - holdPx[i]) / movePx[i], 0, 1) };
  }
  function camFor(loc, k) { return toCam(loc.m && loc.i < N - 1 ? between(loc.i, loc.u, k) : framing(loc.i, loc.m ? 1 : loc.u, k)); }
  // keep a layer within vp.lim screen px of the painting plane (the inpainted fills only hold up to ~4%)
  function limitTo(mid, L) {
    var r = L.s / mid.s;
    var dx = Math.abs(L.s * (mid.x - L.x)) + Math.abs(r - 1) * vp.w / 2, dy = Math.abs(L.s * (mid.y - L.y)) + Math.abs(r - 1) * vp.h / 2;
    var m = Math.max(dx, dy); if (m <= vp.lim) return L;
    var f = vp.lim / m;
    return { s: mid.s * Math.pow(r, f), x: mid.x + (L.x - mid.x) * f, y: mid.y + (L.y - mid.y) * f };
  }
  function stopWeight(j, pos) { return sstep(1 - Math.abs(pos - j) / .34); }

  /* ---------- stage images ---------- */
  var layerEls = { far: $('.ly-far'), mid: $('.ly-mid'), near: $('.ly-near') };
  function pic(stem, w, h, cls) {
    var p = document.createElement('picture'), s = document.createElement('source'), im = new Image();
    s.type = 'image/avif'; s.srcset = 'art/' + stem + '.avif';
    im.alt = ''; im.width = w; im.height = h; im.decoding = 'async'; im.className = cls; im.draggable = false;
    im.style.width = w + 'px'; im.style.height = h + 'px';
    im.src = 'art/' + stem + '.webp';
    p.appendChild(s); p.appendChild(im);
    return { p: p, img: im };
  }
  // stop an image loading and let its bitmap go (detach it from its <picture> first, or the <source> is picked again)
  function releaseImg(o) {
    var im = o.img; if (!im) return;
    if (im.parentNode) im.parentNode.removeChild(im);
    im.removeAttribute('src'); o.img = null;
    if (o.p && o.p.parentNode) o.p.parentNode.removeChild(o.p);
  }

  /* ---------- WebGL painter ----------
     The painting layers (bases + detail plates) are drawn as textured quads into one canvas instead of as several
     huge scaled <img> layers that the compositor re-rasters and blends on every camera move. The canvas is handed to
     a worker (tour-gl.js) that fetches, decodes, uploads and draws, so none of that can stall the main thread. Here
     the tour only works out where each quad goes and posts that once per rendered frame.
     The <img> stack stays as the fallback: no OffscreenCanvas/WebGL, file:// pages, a worker that fails or loses its
     context, or a Midjourney asset that has to sit between two painting layers. ?nogl forces it. */
  var FADE = 280;           // ms: plate cross-fade, as the old CSS transition
  var upMs = [];            // worker upload ms per slice (test hook)
  var glObjs = {}, glSeq = 0;
  function initGL() {
    if (/[?&]nogl\b/.test(location.search) || location.protocol === 'file:') return null;
    if ((window.TOUR_ASSETS || []).some(function (a) { return !a.layer || a.layer === 'far' || a.layer === 'mid'; })) return null;
    var cv = document.createElement('canvas');
    if (!cv.transferControlToOffscreen || !window.Worker || !window.createImageBitmap) return null;
    var wk, off;
    try { wk = new Worker('tour-gl.js'); off = cv.transferControlToOffscreen(); } catch (e) { if (wk) wk.terminate(); return null; }
    var big = 0;
    Object.keys(F).forEach(function (k) { big = Math.max(big, F[k].px[0], F[k].px[1]); });
    Object.keys(D.plates).forEach(function (s) { Object.keys(D.plates[s]).forEach(function (r) { Object.keys(D.plates[s][r]).forEach(function (L) { var px = D.plates[s][r][L].px; big = Math.max(big, px[0], px[1]); }); }); });
    wk.postMessage({ t: 'init', canvas: off, base: new URL('art/', location.href).href, big: big }, [off]);
    cv.className = 'gl';
    stage.insertBefore(cv, $('.dd-near'));
    var g = { cv: cv, wk: wk, ok: false, sz: '' };
    g.timer = setTimeout(function () { if (!g.ok) glFail(); }, 5000);   // a worker that never answers
    wk.onmessage = function (e) {
      var m = e.data, o;
      if (m.t === 'ok') { g.ok = true; clearTimeout(g.timer); }
      else if (m.t === 'fail' || m.t === 'lost') glFail();
      else if (m.t === 'ready' || m.t === 'bad') { o = glObjs[m.id]; if (o && !o.dead) { if (m.t === 'ready') { o.ready = true; dirty = true; } o.settle(m.t === 'ready'); } }
      else if (m.t === 'up') upMs.push(m.ms);
    };
    wk.onerror = function () { glFail(); };
    g.size = function (w, h) {
      var r = Math.min(window.devicePixelRatio || 1, 2), k = w + 'x' + h + '@' + r;
      if (k !== g.sz) { g.sz = k; wk.postMessage({ t: 'size', w: w, h: h, r: r }); }
    };
    g.load = function (o, stem, hi) { wk.postMessage({ t: 'load', id: o.id, stem: stem, w: o.pw, h: o.ph, hi: !!hi }); };
    g.drop = function (o) { wk.postMessage({ t: 'drop', id: o.id }); };
    g.draw = function (list) {
      var q = [];
      list.forEach(function (o) { q.push(o.id, o.X, o.Y, o.pw * o.S, o.ph * o.S, o.a); });
      wk.postMessage({ t: 'draw', q: q });
    };
    return g;
  }
  var GL = initGL();
  // a painting image for the GL path; o.onready / o.onfail fire exactly once
  function glImg(stem, w, h, hi) {
    var o = { gl: true, id: ++glSeq, pw: w, ph: h, a: 0, a0: 0 };
    o.settle = function (ok) { if (o.settled) return; o.settled = true; if (ok) { if (o.onready) o.onready(); } else if (o.onfail) o.onfail(); };
    glObjs[o.id] = o;
    GL.load(o, stem, hi);
    return o;
  }
  function dropObj(o) {
    o.dead = true;
    if (o.gl) { if (GL) GL.drop(o); delete glObjs[o.id]; if (!o.settled) o.settle(false); }   // still loading: count it as done
    releaseImg(o);
  }
  // the worker failed or lost its context: rebuild the current layers as the <img> stack and carry on
  function glFail() {
    if (!GL) return;
    var g = GL, hadBases = !!bases.far;
    clearTimeout(g.timer);
    resetPlates(); resetBases();
    GL = null;
    g.wk.terminate();
    if (g.cv.parentNode) g.cv.parentNode.removeChild(g.cv);
    if (lqip) lqip.img.style.display = '';
    if (hadBases) makeBases();
    dirty = true;
  }

  var bases = {}, lqip = null;
  function resetBases() { Object.keys(bases).forEach(function (L) { dropObj(bases[L]); }); bases = {}; lastPlateI = -1; }
  function makeBases() {
    if (bases.far) return;
    ['far', 'mid', 'near'].forEach(function (L) {
      var stem = L + (vp.art === 'm' ? '-1600' : '-2688'), f = F[stem];   // phones: holds use plates, bases only carry the moves
      var o = GL ? glImg(stem, f.px[0], f.px[1]) : pic(stem, f.px[0], f.px[1], 'base');
      o.ox = -OS; o.oy = -OS; o.k = f.k; o.ready = false;
      var ok = function () { o.ready = true; if (L === 'far' && lqip) lqip.img.style.display = 'none'; dirty = true; };
      if (o.gl) o.onready = ok;
      else { o.img.addEventListener('load', ok); layerEls[L].insertBefore(o.p, layerEls[L].firstChild); }
      bases[L] = o;
    });
  }
  // blurry 48px preview under everything until the far layer arrives
  (function () {
    var im = new Image(); im.alt = ''; im.src = D.lqip; im.className = 'lqip';
    im.style.width = '48px'; im.style.height = '32px';
    var p = document.createElement('span'); p.appendChild(im); layerEls.far.appendChild(p);
    lqip = { p: p, img: im, ox: 0, oy: 0, k: W / 48 };
  })();

  var plates = {};  // key "stop|layer" -> {img, r:[x0,y0,x1,y1] painting px, k, ox, oy, ready, stop}
  var pendingDecodes = 0;
  function resetPlates() { Object.keys(plates).forEach(dropPlate); }
  function dropPlate(key) { var p = plates[key]; if (!p) return; dropObj(p); delete plates[key]; }
  function wantPlates(i) {
    var keep = {};
    [i, i + 1].forEach(function (j) {   // current + next only: keeps decoded memory down
      if (j < 0 || j >= N) return;
      var set = D.plates[ids[j]] && D.plates[ids[j]][vp.art]; if (!set) return;
      Object.keys(set).forEach(function (L) {
        var key = ids[j] + '|' + L; keep[key] = 1;
        if (plates[key]) return;
        var d = set[L], o = GL ? glImg(d.f, d.px[0], d.px[1], j === i) : pic(d.f, d.px[0], d.px[1], 'plate');
        o.ox = d.r[0] * W; o.oy = d.r[1] * H; o.k = d.r[2] * W / d.px[0];
        o.r = [o.ox, o.oy, o.ox + d.r[2] * W, o.oy + d.r[3] * H]; o.ready = false; o.L = L; o.j = j;
        if (j === i && o.img) o.img.setAttribute('fetchpriority', 'high');
        pendingDecodes++;
        var done = function () { pendingDecodes--; o.ready = true; dirty = true; }, fail = function () { pendingDecodes--; };
        if (o.gl) { o.onready = done; o.onfail = fail; }
        else {
          o.img.addEventListener('load', function () { (o.img && o.img.decode ? o.img.decode() : Promise.resolve()).then(done, done); }, { once: true });
          o.img.addEventListener('error', fail, { once: true });
          layerEls[L].appendChild(o.p);
        }
        plates[key] = o;
      });
    });
    Object.keys(plates).forEach(function (k) { if (!keep[k] && !plates[k].shown && !(plates[k].a > 0)) dropPlate(k); });
  }

  /* ---------- Midjourney assets (assets.js) ----------
     Each slot is an image the user makes in Midjourney, keyed out by prep.py and saved as art/fg/<file>.webp/.avif.
     A missing file simply leaves the slot empty. ?slots shows every slot as a labelled box, to see where art goes. */
  var SLOTS = /[?&]slots(?![a-z])/.test(location.search);
  var assets = (window.TOUR_ASSETS || []).map(function (a) {
    var el = document.createElement('div');
    el.className = 'as' + (a.flip ? ' as-flip' : '') + (a.bob ? ' as-bob' : '');
    el.style.width = a.w + 'px';                               // painting px: the camera scale does the rest
    var p = document.createElement('picture'), s = document.createElement('source'), im = new Image();
    s.type = 'image/avif'; s.srcset = 'art/fg/' + a.file + '.avif';
    im.alt = ''; im.decoding = 'async'; im.src = 'art/fg/' + a.file + '.webp';
    im.addEventListener('error', function () { if (p.parentNode) p.parentNode.removeChild(p); el.classList.add('as-missing'); });
    p.appendChild(s); p.appendChild(im); el.appendChild(p);
    if (SLOTS) { var t = document.createElement('span'); t.className = 'as-tag'; t.textContent = a.file; el.appendChild(t); el.classList.add('as-debug'); el.style.height = (a.h || a.w * .7) + 'px'; }
    $('.dd-' + (a.layer || 'mid')).appendChild(el);
    var st = function (list) { return (list || []).map(function (x) { return ids.indexOf(x); }).filter(function (j) { return j >= 0; }); };
    return { el: el, a: a, L: a.layer === 'front' ? 'near' : (a.layer || 'mid'), stops: st(a.stops), mstops: a.mstops ? st(a.mstops) : null, vis: false };
  });
  // panel backdrops: art/fg/panel-<stop>.webp behind the card text, if the user has made one
  panels.forEach(function (pn) {
    var name = pn.getAttribute('data-art'); if (!name) return;
    var probe = new Image();
    probe.onload = function () { pn.style.setProperty('--panel-art', 'url("art/fg/' + name + '.webp")'); pn.classList.add('has-art'); };
    probe.src = 'art/fg/' + name + '.webp';
  });

  /* ---------- the town gate between Schedule and Prizes ---------- */
  var gateCover = 0;   // 0..1: how much of the screen the gate covers right now (fades the schedule card under it)
  var gate = { el: $('.gate'), yard: $('.gate-yard img'), l: $('.gate-l'), r: $('.gate-r'),
    li: $('.gate-l img'), ri: $('.gate-r img'), ls: $('.gate-l i'), rs: $('.gate-r i'), set: null, ok: false, vis: false,
    fog: $('.gate-fog'), puffs: [].slice.call(document.querySelectorAll('.gate-fog img')),
    cards: $$('.yard-card'), dust: $('.gate-dust'), t0: 0, bits: [], dustRaf: 0 };
  function loadGate() {
    var set = vp.rig === 'm' ? 'm' : 'd';
    if (gate.set === set) return;
    gate.set = set; gate.ok = false;
    var yard = set === 'd' ? 'courtyard-d3' : 'courtyard-m';
    var n = 0, done = function () { if (++n === 2) { gate.ok = true; dirty = true; } }, fail = function () { gate.ok = false; };
    var g = new Image(), y = new Image();
    g.onload = done; y.onload = done; g.onerror = fail; y.onerror = fail;
    g.src = 'art/fg/' + (set === 'm' ? 'gate-m2' : 'gate-d') + '.webp'; y.src = 'art/fg/' + yard + '.webp';
    gate.li.src = gate.ri.src = g.src; gate.yard.src = y.src;
  }
  // dust: grit flung sideways and up from the seam and the sill, and soft clouds that billow out and settle
  function burst() {
    var cv = gate.dust, r = Math.min(devicePixelRatio || 1, 1.5), w = vp.w, hh = vp.h;
    cv.width = Math.round(w * r); cv.height = Math.round(hh * r);
    var bits = gate.bits = [], k = Math.max(.6, Math.min(1.4, w / 1200)), rnd = Math.random, i, s;
    for (i = 0; i < 380; i++) {              // grit from the seam, thrown out to both sides
      s = rnd() < .5 ? -1 : 1;
      bits.push({ x: w / 2 + s * rnd() * 10, y: hh * (.05 + .95 * Math.pow(rnd(), .7)), vx: s * (150 + rnd() * 1100) * k,
        vy: -(rnd() * 420) * k, g: 900 * k, d: 2.2, r: .8 + rnd() * 2.6, life: .7 + rnd() * .9, grit: 1 });
    }
    for (i = 0; i < 90; i++) {               // grit kicked up off the sill
      s = rnd() < .5 ? -1 : 1;
      bits.push({ x: w / 2 + s * rnd() * w * .35, y: hh - rnd() * 12, vx: s * (60 + rnd() * 500) * k, vy: -(250 + rnd() * 700) * k,
        g: 1100 * k, d: 1.6, r: .8 + rnd() * 2.2, life: .8 + rnd() * .8, grit: 1 });
    }
    for (i = 0; i < 70; i++) {               // soft clouds of dust
      s = rnd() < .5 ? -1 : 1;
      var low = rnd() < .45;
      bits.push({ x: w / 2 + s * rnd() * 30, y: low ? hh - rnd() * hh * .12 : hh * rnd(), vx: s * (80 + rnd() * 420) * k,
        vy: (low ? -(30 + rnd() * 120) : -(rnd() * 60)) * k, g: -12, d: 1.4, r: (50 + rnd() * 110) * k, grow: (140 + rnd() * 220) * k,
        life: 1.1 + rnd() * 1.1, a: .3 + rnd() * .25 });
    }
    var prev = performance.now(), ctx = cv.getContext('2d');
    cancelAnimationFrame(gate.dustRaf);
    (function tick(now) {
      var dt = Math.min(.05, (now - prev) / 1000); prev = now;
      ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, w, hh);
      var alive = 0;
      bits.forEach(function (p) {
        p.age = (p.age || 0) + dt; if (p.age >= p.life) return; alive++;
        var f = Math.exp(-p.d * dt); p.vx *= f; p.vy = p.vy * f + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        var q = p.age / p.life;
        if (p.grit) {
          ctx.globalAlpha = .95 * (1 - q); ctx.fillStyle = p.r > 2.4 ? '#8a7258' : '#efe4cf';
          ctx.fillRect(p.x, p.y, p.r, p.r);
        } else {
          var rad = p.r + p.grow * Math.sqrt(q), gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          gr.addColorStop(0, 'rgba(238,228,208,' + (p.a * (1 - q)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(238,228,208,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.2832); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (alive) gate.dustRaf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, w, hh);
    })(prev);
  }
  // while the gate slams and opens, scrolling is held at the gate so the whole effect plays
  var LOCK_MS = 2600;
  function holdScroll(on) {
    if (gate.locked === on) return;
    gate.locked = on;
    document.documentElement.style.overflow = on ? 'hidden' : '';
    if (lenis) { if (on) lenis.stop(); else lenis.start(); }
    if (on) { var iS = ids.indexOf('schedule'); gate.lockY = tops[iS] + holdPx[iS] + movePx[iS] * .02; scrollToY(gate.lockY); }
  }
  function renderGate(loc) {
    var iS = ids.indexOf('schedule');
    var on = gate.ok && loc.m && loc.i === iS;
    if (!on) {
      gateCover = 0;
      if (loc.i < iS || (loc.i === iS && !loc.m)) gate.t0 = 0;
      holdScroll(false);   // scroll back above the gate and it slams again
      if (gate.vis) { gate.vis = false; gate.el.style.visibility = gate.fog.style.visibility = 'hidden'; }
      gate.cards.forEach(function (el) { css(el, '--w', '0'); css(el, 'pointerEvents', 'none'); });
      return;
    }
    if (!gate.vis) { gate.vis = true; gate.el.style.visibility = gate.fog.style.visibility = 'visible'; }
    var t = loc.u, now = performance.now();
    var still = vp.still;
    // the slam plays on the clock (so it always hits hard), the moment you scroll past the schedule
    if (!gate.t0) {
      gate.t0 = t > .1 || still ? now - 5000 : now;
      gate.hit = false;
      if (now - gate.t0 < LOCK_MS) holdScroll(true);
    }
    var el = now - gate.t0;
    if (gate.locked && el >= LOCK_MS) holdScroll(false);
    else if (gate.locked && Math.abs(scrollY - gate.lockY) > 2) scrollToY(gate.lockY);   // momentum or a script can't carry you past it
    var st = (now - gate.t0) / 640;              // 0..1 slam timeline; impact at .5
    if (el < LOCK_MS + 100) dirty = true;
    var slamAng;
    if (st < .5) slamAng = 94 * (1 - Math.pow(st / .5, 2.4));             // swinging in, faster and faster
    else { var b2 = (st - .5) / .5; slamAng = b2 < 1 ? 6 * Math.sin(Math.PI * b2) * (1 - b2) : 0; }   // a small rebound
    if (st >= .5 && !gate.hit) { gate.hit = true; if (!still && now - gate.t0 < 1500) burst(); }
    // on the clock: slam 0-.32s, dust, a beat, doors swing open 1.0-2.5s. Then scroll: .06-.84 the cards, .84-1 clouds
    var open = ease(clamp((el - 1000) / 1500, 0, 1)), c = clamp((t - .84) / .16, 0, 1);
    var gone = sstep((c - .62) / .2);
    css(gate.el, 'opacity', (1 - gone).toFixed(3));
    gateCover = sstep(st / .5);
    css(gate.yard, 'opacity', st >= .5 ? '1' : '0');   // the courtyard is only there once the doors have closed over the view
    var ang = open > 0 ? open * 100 : slamAng;
    gate.l.style.transform = 'rotateY(' + (-ang).toFixed(2) + 'deg)';
    gate.r.style.transform = 'rotateY(' + ang.toFixed(2) + 'deg)';
    gate.ls.style.opacity = gate.rs.style.opacity = Math.min(1, (open > 0 ? open : slamAng / 94) * 1.6).toFixed(3);
    var df = (1 - sstep((open - .72) / .26)).toFixed(3);   // no brown door edges left at the sides once they are open
    gate.l.style.setProperty('--df', df); gate.r.style.setProperty('--df', df);
    var push = 1.04 - .04 * open + .06 * sstep((t - .06) / .9);    // the courtyard settles as the doors open, then you walk in
    gate.yard.style.transform = 'scale(' + push.toFixed(4) + ')';
    // the impact shakes the view
    var sh = st >= .5 && st < 1.1 && !still ? (1 - (st - .5) / .6) : 0;
    gate.el.style.transform = sh ? 'translate3d(' + (Math.sin(now * .09) * 9 * sh).toFixed(1) + 'px,' + (Math.cos(now * .13) * 6 * sh).toFixed(1) + 'px,0)' : '';
    // cards: one at a time over the courtyard
    var nC = gate.cards.length, span = .76 / nC;
    gate.cards.forEach(function (el, n) {
      var a0 = .07 + n * span, w = sstep((t - a0) / (span * .22)) * (1 - sstep((t - a0 - span * .78) / (span * .22)));
      css(el, '--w', w.toFixed(3));
      css(el, 'pointerEvents', w > .6 ? 'auto' : 'none');
    });
    // clouds: three banks billow up from below and settle into the page colour; the FAQ then scrolls in beneath
    // (their flat lower edge never rises above the bottom of the screen)
    var rise = ease(clamp(c / .6, 0, 1));
    css(gate.fog, 'backgroundColor', 'rgba(251,246,233,' + sstep((c - .15) / .6).toFixed(3) + ')');
    gate.puffs.forEach(function (el, n) {
      var hgt = vp.puffH[n], sc = 1.35 + n * .22 + .25 * sstep((c - .4) / .6);
      var ty = -rise * (1 + sc) / 2 * hgt * (1 - n * .16);
      css(el, 'visibility', c > 0 ? 'visible' : 'hidden');
      if (c <= 0) return;
      css(el, 'opacity', (1 - sstep((c - .55) / .45)).toFixed(3));
      el.style.transform = 'translate3d(-50%,' + ty.toFixed(1) + 'px,0) scale(' + (n % 2 ? -sc : sc).toFixed(3) + ',' + sc.toFixed(3) + ')';
    });
  }

  /* ---------- foreground clouds ---------- */
  var cl = { left: $('.fgc-left'), right: $('.fgc-right'), b1: $('.fgc-b1'), b2: $('.fgc-b2') };

  /* ---------- the frame loop ---------- */
  var ys = scrollY, dirty = true, raf = 0, last = 0, onScreen = true, curI = -1;
  var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  var lastPlateI = -1, lastNav = -1, lastShown = -1, settleAt = 0, lastYs = NaN;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (lenis) lenis.raf(now);        // step the smooth scroll first, so this frame's camera uses this frame's scroll
    if (!onScreen) return;            // (the loop keeps running off the tour only to drive Lenis for the FAQ)
    var dt = Math.min(now - (last || now - 16), 64); last = now;
    // Lenis (wheel) and native touch momentum are already smooth: follow them 1:1, since easing again on top only adds lag.
    // Without Lenis, mouse-wheel steps are eased here.
    var y = lenis && !vp.coarse ? lenis.animatedScroll : scrollY;
    if (lenis || vp.coarse) ys = y;
    else {
      if (Math.abs(y - ys) > vp.hs * 1.2) ys = y;                 // long jumps cut instead of flying through every stop
      else ys += (y - ys) * (1 - Math.exp(-dt / 70));
      if (Math.abs(y - ys) < .3) ys = y;
    }
    ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt / 120)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt / 120));
    var moving = ys !== lastYs || Math.abs(ptr.tx - ptr.x) > .002 || Math.abs(ptr.ty - ptr.y) > .002;
    if (!moving && !dirty) return;
    settleAt = now;
    dirty = false; lastYs = ys;
    render(ys, now);
  }

  // the GL frame, back to front: per layer its base (unless a sharp plate has covered it for a while), then its plates cross-fading
  function drawGL(now) {
    var list = [];
    ['far', 'mid', 'near'].forEach(function (L) {
      var b = bases[L];
      if (b && b.ready && !b.off) { b.a = 1; list.push(b); }
      Object.keys(plates).forEach(function (k) {
        var o = plates[k]; if (o.L !== L || !o.ready) return;
        var t = o.since ? (now - o.since) / FADE : 1;
        o.a = o.shown ? Math.min(1, o.a0 + t) : Math.max(0, o.a0 - t);
        if (o.a > 0) list.push(o);
        if (o.a > 0 && o.a < 1) dirty = true;   // keep drawing until the fade settles
      });
    });
    GL.draw(list);
  }
  // write a style only when it changes: an unchanged write still invalidates style, and the loop runs every frame
  function css(el, k, v) { var c = el._css || (el._css = {}); if (c[k] === v) return; c[k] = v; if (k.charAt(0) === '-') el.style.setProperty(k, v); else el.style[k] = v; }

  function render(y, now) {
    var loc = locate(y), pos = loc.m ? loc.i + loc.u : loc.i;
    if (loc.i !== lastPlateI) { lastPlateI = loc.i; wantPlates(loc.i); if (loc.i > 0 || vp.art === 'd') makeBases(); }
    var mid = camFor(loc, 1), cams = { mid: mid };
    var cc0 = limitTo(mid, camFor(loc, CLOUD_K)), pc0 = vp.coarse ? { x: 0, y: 0 } : { x: (CLOUD_K - 1) * ptr.x * AMP, y: (CLOUD_K - 1) * ptr.y * AMP * .6 };
    var par = { x: clamp(cc0.s * (mid.x - cc0.x), -90, 90) + pc0.x, y: clamp(cc0.s * (mid.y - cc0.y), -60, 60) + pc0.y };
    cams.far = limitTo(mid, camFor(loc, LK.far));
    cams.near = limitTo(mid, camFor(loc, LK.near));
    var po = function (k) { return vp.coarse ? { x: 0, y: 0 } : { x: (k - 1) * ptr.x * AMP, y: (k - 1) * ptr.y * AMP * .6 }; };
    var P = { far: po(LK.far), mid: po(1), near: po(LK.near) };

    // layer images
    ['far', 'mid', 'near'].forEach(function (L) {
      var c = cams[L], p = P[L];
      var place = function (o) {
        var X = vp.cx + p.x - c.s * (c.x - o.ox), Y = vp.cy + p.y - c.s * (c.y - o.oy);
        if (o.gl) { o.X = X; o.Y = Y; o.S = c.s * o.k; return; }   // drawn by the GL painter below
        if (o.img) o.img.style.transform = 'translate3d(' + X.toFixed(2) + 'px,' + Y.toFixed(2) + 'px,0) scale(' + (c.s * o.k).toFixed(5) + ')';
      };
      if (L === 'far' && lqip && lqip.img.style.display !== 'none') place(lqip);
      if (bases[L]) place(bases[L]);
      // choose the sharpest loaded plate that fully covers this layer's view
      var x0 = c.x - (vp.cx + p.x) / c.s, y0 = c.y - (vp.cy + p.y) / c.s, x1 = x0 + vp.w / c.s, y1 = y0 + vp.h / c.s, mg = 6 / c.s;
      var best = null;
      Object.keys(plates).forEach(function (key) {
        var o = plates[key]; if (o.L !== L) return;
        place(o);
        if (o.ready && o.r[0] <= x0 - mg && o.r[1] <= y0 - mg && o.r[2] >= x1 + mg && o.r[3] >= y1 + mg && (!best || o.k < best.k)) best = o;
      });
      Object.keys(plates).forEach(function (key) {
        var o = plates[key]; if (o.L !== L) return;
        var want = o === best;
        if (want && !o.shown) { o.shown = true; o.since = now; o.a0 = o.a || 0; if (!o.gl) o.img.classList.add('on'); }
        if (!want && o.shown) { o.shown = false; o.since = now; o.a0 = o.a || 0; if (!o.gl) o.img.classList.remove('on'); }
      });
      if (bases[L]) {
        var hide = best && now - best.since > 320;
        if (bases[L].gl) bases[L].off = !!hide; else if (bases[L].img) bases[L].img.classList.toggle('off', !!hide);
        if (best && !hide) dirty = true;   // keep ticking until the base can be hidden
      }
    });
    if (GL) drawGL(now);

    // Midjourney assets: placed in painting coordinates on their depth layer, fading in around their stops
    var iS = ids.indexOf('schedule'), iF = ids.indexOf('finale');
    var NS = schedItems.length;
    var shown = loc.i === iS && !loc.m ? Math.min(NS, Math.floor(loc.u * (NS + .4)) + 1) : loc.i === iS ? NS : 1;
    assets.forEach(function (o) {
      var st = vp.rig === 'm' && o.mstops ? o.mstops : o.stops, w = st.length ? 0 : 1;
      st.forEach(function (j) { w = Math.max(w, stopWeight(j, pos)); });
      if (SLOTS) w = Math.max(w, .9);
      if (w < .01) { if (o.vis) { o.vis = false; o.el.style.visibility = 'hidden'; } return; }
      if (!o.vis) { o.vis = true; o.el.style.visibility = 'visible'; }
      var a = o.a, m = vp.rig === 'm', ax = m && a.axm != null ? a.axm : a.ax, ay = m && a.aym != null ? a.aym : a.ay;
      if (a.layer === 'front') {   // framing pieces: pinned to the screen corners at a fixed size, drifting with the clouds
        var fw = (m && a.vwm ? a.vwm : a.vw) * vp.w;
        css(o.el, 'opacity', w.toFixed(3));
        css(o.el, 'transform', 'translate3d(' + (a.sx * vp.w + par.x * .6).toFixed(1) + 'px,' + (vp.h + 6 + Math.max(0, par.y) * .4 + (1 - w) * 40).toFixed(1) + 'px,0) scale(' + (fw / a.w).toFixed(4) + ')');
        return;
      }
      var c = a.layer === 'front' ? cc0 : cams[o.L], p = a.layer === 'front' ? pc0 : P[o.L];
      var X = vp.cx + p.x + c.s * (ax * W - c.x), Y = vp.cy + p.y + c.s * (ay * H - c.y);
      css(o.el, 'opacity', w.toFixed(3));
      css(o.el, 'transform', 'translate3d(' + X.toFixed(1) + 'px,' + Y.toFixed(1) + 'px,0) scale(' + (c.s * (m && a.wm ? a.wm / a.w : 1)).toFixed(4) + ')');
    });

    // schedule panel: reveal milestones one by one, window follows the newest
    var shownItems = loc.i === iS ? shown : loc.i > iS ? NS : 1;
    if (shownItems !== lastShown) {
      lastShown = shownItems;
      schedItems.forEach(function (li, i) { li.classList.toggle('shown', i < shownItems); li.classList.toggle('cur', i === shownItems - 1); });
      var win = $('.sched-win'), ol = $('.sched'), cur = schedItems[shownItems - 1];
      if (win && cur) {
        var bottom = cur.offsetTop + cur.offsetHeight, ty = Math.max(0, bottom - win.clientHeight + 4);
        ol.style.transform = 'translateY(' + (-ty) + 'px)';
      }
    }

    // foreground clouds: side curtains at the wide shots, a low bank that sweeps past the lens on the two long hops
    var cc = cc0, pc = pc0;
    var wl = Math.max(stopWeight(0, pos), stopWeight(ids.indexOf('when'), pos), stopWeight(iF, pos));
    var wr = Math.max(stopWeight(0, pos), stopWeight(ids.indexOf('tracks'), pos), stopWeight(iF, pos));
    if (vp.rig === 'd') css(cl.left, 'transform', 'translate3d(' + (par.x - (1 - wl) * vp.clL * .9).toFixed(1) + 'px,' + par.y.toFixed(1) + 'px,0) scale(' + (1 + .3 * (1 - wl)).toFixed(3) + ')');
    css(cl.right, 'transform', 'translate3d(' + (par.x + (1 - wr) * vp.clR * .95).toFixed(1) + 'px,' + par.y.toFixed(1) + 'px,0) scale(' + (1 + .3 * (1 - wr)).toFixed(3) + ')');
    var sweep = loc.m && LONG[ids[loc.i]] ? loc.u : -1;
    [cl.b1, cl.b2].forEach(function (el, n) {
      var tt = sweep < 0 ? -1 : clamp((sweep - .06 - n * .1) / .78, 0, 1);
      if (tt <= 0 || tt >= 1) { css(el, 'visibility', 'hidden'); return; }
      css(el, 'visibility', 'visible');
      var hgt = vp.clB[n], ty = -tt * (vp.h + hgt * 1.1), sc = 1.02 + .22 * Math.sin(Math.PI * tt) + n * .12;
      css(el, 'transform', 'translate3d(-50%,' + ty.toFixed(1) + 'px,0) scale(' + (n ? -sc : sc).toFixed(3) + ',' + sc.toFixed(3) + ')');
    });

    renderGate(loc);

    // panels
    panels.forEach(function (pn, j) {
      var w = stopWeight(j, pos);
      if (j === ids.indexOf('schedule')) w *= 1 - gateCover;
      css(pn, '--w', w.toFixed(3));
      var on = w > .01;
      if (on !== !!pn._on) { pn._on = on; pn.classList.toggle('is-on', on); }
      css(pn, 'pointerEvents', w > .6 ? 'auto' : 'none');
    });
    var nav = Math.round(pos);
    if (nav !== lastNav) {
      lastNav = nav;
      navLinks.forEach(function (a, j) { if (j === nav) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    }
    curI = loc.i;
  }

  /* ---------- navigation: progress links, skip link, in-page anchors, focus ---------- */
  function yFor(j) { return tops[j] + (j === 0 ? 0 : holdPx[j] * .12); }
  function go(j, smooth) {
    var y = yFor(j);
    scrollToY(y, smooth); if (!smooth) { ys = y; dirty = true; }
    sections[j].focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href').slice(1), j = sections.findIndex(function (s) { return s.id === id; });
    if (j < 0) return;
    e.preventDefault();
    var pos = curI < 0 ? 0 : curI;
    go(j, Math.abs(j - pos) <= 3);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });
  // keyboard: focusing something inside a panel that is not on screen brings its stop into view
  document.addEventListener('focusin', function (e) {
    var sec = e.target.closest && e.target.closest('.stop'); if (!sec) return;
    var j = sections.indexOf(sec), loc = locate(scrollY), pos = loc.m ? loc.i + loc.u : loc.i;
    if (Math.abs(pos - j) > .2 && e.target !== sec) { var y = yFor(j); scrollToY(y, false); ys = y; dirty = true; }
  });

  addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; ptr.tx = clamp(e.clientX / vp.w * 2 - 1, -1, 1); ptr.ty = clamp(e.clientY / vp.hs * 2 - 1, -1, 1); }, { passive: true });
  var rzT = 0;
  function onResize() { clearTimeout(rzT); rzT = setTimeout(function () { measure(); render(ys, performance.now()); }, 60); }
  addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); dirty = true; });
  addEventListener('load', function () { measure(); dirty = true; });
  if (window.IntersectionObserver) new IntersectionObserver(function (en) {
    onScreen = en[0].isIntersecting;
    if (onScreen) { last = 0; dirty = true; }
    if (onScreen && !raf) raf = requestAnimationFrame(frame);
    if (!onScreen && raf && !lenis) { cancelAnimationFrame(raf); raf = 0; }   // with Lenis the loop keeps driving the scroll
  }).observe(tour);
  document.addEventListener('visibilitychange', function () { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } else if (!document.hidden && !raf && (onScreen || lenis)) { last = 0; raf = requestAnimationFrame(frame); } });

  measure();
  setTimeout(makeBases, 1200);
  if (location.hash) { var hj = sections.findIndex(function (s) { return '#' + s.id === location.hash; }); if (hj >= 0) { scrollToY(yFor(hj), false); } }
  ys = scrollY;
  render(ys, performance.now());
  raf = requestAnimationFrame(frame);

  // test hook
  window.__tour = {
    state: function () { var l = locate(ys); return { stop: ids[l.i], moving: l.m, u: l.u, ys: ys, y: scrollY, pending: pendingDecodes, rig: vp.rig, plates: Object.keys(plates).filter(function (k) { return plates[k].shown; }), gl: !!GL, uploads: upMs.slice() }; },
    yAt: function (stop, u, moving) { var j = ids.indexOf(stop); return tops[j] + (moving ? holdPx[j] + movePx[j] * u : holdPx[j] * u); },
    idle: function () { return new Promise(function (res) { (function chk() { if (pendingDecodes <= 0 && Math.abs(ys - scrollY) < .5 && performance.now() - settleAt > 450) res(); else setTimeout(chk, 50); })(); }); }
  };
})();
