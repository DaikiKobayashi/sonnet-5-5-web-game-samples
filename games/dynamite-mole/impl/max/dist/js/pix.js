/* pix.js - tiny pixel-art toolkit. Every sprite in the game is drawn with these primitives at
 * exactly 1 logical px per art dot (no scaled-up art, no smoothing) and turned into offscreen canvases. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};

  /* colours are packed little-endian ABGR uint32 (matches ImageData on all mainstream platforms) */
  function pack(r, g, b, a) {
    if (a == null) a = 255;
    return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  }
  function hex(s, alpha) {
    var r, g, b;
    if (s.charAt(0) === '#') s = s.slice(1);
    if (s.length === 3) { r = parseInt(s.charAt(0) + s.charAt(0), 16); g = parseInt(s.charAt(1) + s.charAt(1), 16); b = parseInt(s.charAt(2) + s.charAt(2), 16); }
    else { r = parseInt(s.slice(0, 2), 16); g = parseInt(s.slice(2, 4), 16); b = parseInt(s.slice(4, 6), 16); }
    return pack(r, g, b, alpha == null ? 255 : Math.round(alpha * 255));
  }
  function unpack(c) { return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255]; }
  function alphaOf(c) { return c >>> 24; }
  function mix(c1, c2, t) {
    var a = unpack(c1), b = unpack(c2);
    return pack(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t), Math.round(a[3] + (b[3] - a[3]) * t));
  }
  function withAlpha(c, alpha) { var u = unpack(c); return pack(u[0], u[1], u[2], Math.round(alpha * 255)); }
  function css(c) { var u = unpack(c); return 'rgba(' + u[0] + ',' + u[1] + ',' + u[2] + ',' + (u[3] / 255) + ')'; }
  function overColor(dst, src) {
    var sa = src >>> 24;
    if (sa === 255) return src;
    if (sa === 0) return dst;
    var da = dst >>> 24;
    if (da === 0) return src;
    var s = unpack(src), d = unpack(dst);
    var a = sa / 255, ia = (da / 255) * (1 - a);
    var oa = a + ia;
    return pack(Math.round((s[0] * a + d[0] * ia) / oa), Math.round((s[1] * a + d[1] * ia) / oa),
      Math.round((s[2] * a + d[2] * ia) / oa), Math.round(oa * 255));
  }

  function Pix(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }
  var P = Pix.prototype;

  P.get = function (x, y) {
    return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x];
  };
  P.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    return this;
  };
  P.over = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    var i = y * this.w + x;
    this.d[i] = overColor(this.d[i], c);
    return this;
  };
  P.clone = function () {
    var p = new Pix(this.w, this.h);
    p.d.set(this.d);
    return p;
  };
  P.clear = function () { this.d.fill(0); return this; };
  P.fill = function (c) { this.d.fill(c); return this; };
  P.rect = function (x, y, w, h, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  };
  P.rectOver = function (x, y, w, h, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.over(x + i, y + j, c);
    return this;
  };
  P.hline = function (x, y, w, c) { return this.rect(x, y, w, 1, c); };
  P.vline = function (x, y, h, c) { return this.rect(x, y, 1, h, c); };

  /* rectangle with corner radius (pixel centre test) */
  P.rrect = function (x, y, w, h, r, c) {
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var px = i + 0.5, py = j + 0.5, dx = 0, dy = 0;
        if (px < r) dx = r - px; else if (px > w - r) dx = px - (w - r);
        if (py < r) dy = r - py; else if (py > h - r) dy = py - (h - r);
        if (dx * dx + dy * dy <= r * r) this.set(x + i, y + j, c);
      }
    }
    return this;
  };

  /* filled ellipse; (cx,cy) may be fractional; uses pixel centres */
  P.ell = function (cx, cy, rx, ry, c) {
    var x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  };
  P.ellOver = function (cx, cy, rx, ry, c) {
    var x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.over(x, y, c);
      }
    }
    return this;
  };

  /* ellipse shaded like a lit sphere (light from upper-left). ramp = dark..light colours */
  P.ellShade = function (cx, cy, rx, ry, ramp, o) {
    o = o || {};
    var lx = o.lx != null ? o.lx : -0.55, ly = o.ly != null ? o.ly : -0.75, lz = o.lz != null ? o.lz : 0.5;
    var ln = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ln; ly /= ln; lz /= ln;
    var lo = o.lo != null ? o.lo : -0.55, hi = o.hi != null ? o.hi : 0.95;
    var n = ramp.length;
    var x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    var clipTop = o.clipTop, clipBottom = o.clipBottom;
    for (var y = y0; y <= y1; y++) {
      if (clipTop != null && y + 0.5 < clipTop) continue;
      if (clipBottom != null && y + 0.5 > clipBottom) continue;
      for (var x = x0; x <= x1; x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        var nz = Math.sqrt(1 - d2);
        var l = dx * lx + dy * ly + nz * lz;
        var t = (l - lo) / (hi - lo);
        t = t < 0 ? 0 : (t > 0.999 ? 0.999 : t);
        var f = t * n, b = Math.floor(f);
        if (o.dither && f - b > 0.68 && ((x + y) & 1) === 0 && b < n - 1) b++;
        this.set(x, y, ramp[b]);
      }
    }
    return this;
  };

  P.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var guard = 0; guard < 4096; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  };
  P.lineOver = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var guard = 0; guard < 4096; guard++) {
      this.over(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  };

  /* even-odd polygon fill; pts = [[x,y],...] */
  P.poly = function (pts, c) {
    var minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        for (var x = Math.ceil(xs[i] - 0.5); x < xs[i + 1] - 0.5 + 1e-9; x++) this.set(x, y, c);
      }
    }
    return this;
  };

  /* composite another Pix (alpha-over). opts: {alpha} */
  P.blit = function (src, dx, dy, opts) {
    var al = opts && opts.alpha != null ? opts.alpha : 1;
    for (var y = 0; y < src.h; y++) {
      for (var x = 0; x < src.w; x++) {
        var c = src.d[y * src.w + x];
        if ((c >>> 24) === 0) continue;
        if (al < 1) c = withAlpha(c, (c >>> 24) / 255 * al);
        this.over(dx + x, dy + y, c);
      }
    }
    return this;
  };

  P.flipH = function () {
    var p = new Pix(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) p.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return p;
  };
  P.flipV = function () {
    var p = new Pix(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) p.d[(this.h - 1 - y) * this.w + x] = this.d[y * this.w + x];
    return p;
  };
  P.rotCW = function () {
    var p = new Pix(this.h, this.w);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) p.d[x * p.w + (this.h - 1 - y)] = this.d[y * this.w + x];
    return p;
  };
  P.rotCCW = function () {
    var p = new Pix(this.h, this.w);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) p.d[(this.w - 1 - x) * p.w + y] = this.d[y * this.w + x];
    return p;
  };
  P.shift = function (dx, dy) {
    var p = new Pix(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var c = this.d[y * this.w + x];
      if (c) p.set(x + dx, y + dy, c);
    }
    return p;
  };

  /* 1px outline around every opaque pixel (4-neighbourhood, or 8 with diag). Draws only into transparent pixels. */
  P.outline = function (c, diag) {
    var src = this.d.slice();
    var w = this.w, h = this.h;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if ((src[y * w + x] >>> 24) !== 0) continue;
        var hit = false;
        if (x > 0 && (src[y * w + x - 1] >>> 24) > 0) hit = true;
        else if (x < w - 1 && (src[y * w + x + 1] >>> 24) > 0) hit = true;
        else if (y > 0 && (src[(y - 1) * w + x] >>> 24) > 0) hit = true;
        else if (y < h - 1 && (src[(y + 1) * w + x] >>> 24) > 0) hit = true;
        else if (diag) {
          if (x > 0 && y > 0 && (src[(y - 1) * w + x - 1] >>> 24) > 0) hit = true;
          else if (x < w - 1 && y > 0 && (src[(y - 1) * w + x + 1] >>> 24) > 0) hit = true;
          else if (x > 0 && y < h - 1 && (src[(y + 1) * w + x - 1] >>> 24) > 0) hit = true;
          else if (x < w - 1 && y < h - 1 && (src[(y + 1) * w + x + 1] >>> 24) > 0) hit = true;
        }
        if (hit) this.d[y * w + x] = c;
      }
    }
    return this;
  };

  P.map = function (fn) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var i = y * this.w + x, c = this.d[i];
      if ((c >>> 24) !== 0) this.d[i] = fn(c, x, y);
    }
    return this;
  };
  /* all opaque pixels -> colour c (keeps alpha) */
  P.silhouette = function (c) {
    var u = unpack(c);
    return this.clone().map(function (old) { return pack(u[0], u[1], u[2], old >>> 24); });
  };
  /* replace colours by a {packedFrom: packedTo} table */
  P.recolor = function (table) {
    return this.clone().map(function (c) { return table[c] != null ? table[c] : c; });
  };
  /* mix every pixel towards colour c by t */
  P.tint = function (c, t) {
    return this.clone().map(function (old) { var m = mix(old, c, t); return pack(m & 255, (m >>> 8) & 255, (m >>> 16) & 255, old >>> 24); });
  };

  P.toCanvas = function () {
    var cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    var x = cv.getContext('2d');
    var id = x.createImageData(this.w, this.h);
    new Uint32Array(id.data.buffer).set(this.d);
    x.putImageData(id, 0, 0);
    return cv;
  };

  /* build from ASCII art. pal maps a char to a packed colour; '.' and ' ' are transparent */
  Pix.fromArt = function (rows, pal) {
    var h = rows.length, w = 0, i;
    for (i = 0; i < h; i++) w = Math.max(w, rows[i].length);
    var p = new Pix(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var ch = rows[y].charAt(x);
        if (ch === '.' || ch === ' ') continue;
        if (pal[ch] == null) throw new Error('fromArt: missing palette char "' + ch + '"');
        p.d[y * w + x] = pal[ch];
      }
    }
    return p;
  };

  Pix.pack = pack;
  Pix.hex = hex;
  Pix.unpack = unpack;
  Pix.mix = mix;
  Pix.alphaOf = alphaOf;
  Pix.withAlpha = withAlpha;
  Pix.css = css;
  Pix.overColor = overColor;
  Pix.ramp = function (list) { return list.map(function (s) { return hex(s); }); };
  Pix.canvas = function (w, h) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  };

  DM.Pix = Pix;
})(typeof window !== 'undefined' ? window : globalThis);
