/* raster.js - tiny software pixel-art rasteriser.
 *
 * All game art is drawn with this at 1 px dots (no anti-aliasing anywhere).
 * Sprites are designed in a 32 x 32 "unit" space and rasterised at any
 * resolution R (32 for normal cells, 64 for the big title illustration,
 * 16 for HUD icons) by sampling shape predicates at pixel centres.
 */
(function () {
  'use strict';
  var DM = window.DM;

  var cache = {};
  function pack(r, g, b, a) {
    return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  }
  function col(c) {
    if (typeof c === 'number') return c;
    var v = cache[c];
    if (v !== undefined) return v;
    var s = c.charAt(0) === '#' ? c.slice(1) : c;
    if (s.length === 3 || s.length === 4) {
      s = s
        .split('')
        .map(function (ch) {
          return ch + ch;
        })
        .join('');
    }
    var r = parseInt(s.substr(0, 2), 16);
    var g = parseInt(s.substr(2, 2), 16);
    var b = parseInt(s.substr(4, 2), 16);
    var a = s.length >= 8 ? parseInt(s.substr(6, 2), 16) : 255;
    v = pack(r, g, b, a);
    cache[c] = v;
    return v;
  }
  function over(dst, src) {
    var sa = src >>> 24;
    if (sa === 255) return src;
    if (sa === 0) return dst;
    var da = dst >>> 24;
    if (da === 0) return src;
    var a = sa / 255;
    var ia = (da / 255) * (1 - a);
    var oa = a + ia;
    var r = ((src & 255) * a + (dst & 255) * ia) / oa;
    var g = (((src >>> 8) & 255) * a + ((dst >>> 8) & 255) * ia) / oa;
    var b = (((src >>> 16) & 255) * a + ((dst >>> 16) & 255) * ia) / oa;
    return pack(Math.round(r), Math.round(g), Math.round(b), Math.round(oa * 255));
  }
  function mix(c1, c2, t) {
    c1 = col(c1);
    c2 = col(c2);
    var r = (c1 & 255) + ((c2 & 255) - (c1 & 255)) * t;
    var g = ((c1 >>> 8) & 255) + (((c2 >>> 8) & 255) - ((c1 >>> 8) & 255)) * t;
    var b = ((c1 >>> 16) & 255) + (((c2 >>> 16) & 255) - ((c1 >>> 16) & 255)) * t;
    var a = (c1 >>> 24) + ((c2 >>> 24) - (c1 >>> 24)) * t;
    return pack(Math.round(r), Math.round(g), Math.round(b), Math.round(a));
  }
  function withAlpha(c, a) {
    c = col(c);
    return pack(c & 255, (c >>> 8) & 255, (c >>> 16) & 255, Math.round(a * 255));
  }

  /* shapes carry an optional bounding box (unit space) so fills only visit nearby pixels */
  function bb(fn, x0, y0, x1, y1) {
    fn.bb = [x0, y0, x1, y1];
    return fn;
  }

  /* ---- shape predicates in unit space ---- */
  var sh = {
    ell: function (cx, cy, rx, ry) {
      if (ry === undefined) ry = rx;
      var ix = 1 / rx, iy = 1 / ry;
      return bb(
        function (x, y) {
          var dx = (x - cx) * ix, dy = (y - cy) * iy;
          return dx * dx + dy * dy <= 1;
        },
        cx - rx, cy - ry, cx + rx, cy + ry
      );
    },
    rect: function (x0, y0, x1, y1) {
      return bb(
        function (x, y) {
          return x >= x0 && x < x1 && y >= y0 && y < y1;
        },
        x0, y0, x1, y1
      );
    },
    rrect: function (x0, y0, x1, y1, r) {
      return bb(
        function (x, y) {
          if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
          var cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
          var cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
          var dx = x - cx, dy = y - cy;
          return dx * dx + dy * dy <= r * r;
        },
        x0, y0, x1, y1
      );
    },
    poly: function (pts) {
      var n = pts.length / 2;
      var mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (var q = 0; q < n; q++) {
        mnx = Math.min(mnx, pts[q * 2]);
        mxx = Math.max(mxx, pts[q * 2]);
        mny = Math.min(mny, pts[q * 2 + 1]);
        mxy = Math.max(mxy, pts[q * 2 + 1]);
      }
      return bb(
        function (x, y) {
          var inside = false;
          for (var i = 0, j = n - 1; i < n; j = i++) {
            var xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        },
        mnx, mny, mxx, mxy
      );
    },
    seg: function (x0, y0, x1, y1, w) {
      var dx = x1 - x0, dy = y1 - y0;
      var l2 = dx * dx + dy * dy || 1e-6;
      var r2 = (w / 2) * (w / 2);
      return bb(
        function (x, y) {
          var t = ((x - x0) * dx + (y - y0) * dy) / l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          var px = x0 + dx * t - x, py = y0 + dy * t - y;
          return px * px + py * py <= r2;
        },
        Math.min(x0, x1) - w / 2, Math.min(y0, y1) - w / 2, Math.max(x0, x1) + w / 2, Math.max(y0, y1) + w / 2
      );
    },
    /* lumpy blob: radius modulated by a few sines with seeded phases */
    blob: function (cx, cy, r, seed, amp) {
      var p1 = DM.hash(seed, 1, 7) * 6.28, p2 = DM.hash(seed, 2, 7) * 6.28, p3 = DM.hash(seed, 3, 7) * 6.28;
      amp = amp === undefined ? 0.12 : amp;
      var rm = r * (1 + amp * 1.45);
      return bb(
        function (x, y) {
          var dx = x - cx, dy = y - cy;
          var a = Math.atan2(dy, dx);
          var rr = r * (1 + amp * (Math.sin(2 * a + p1) * 0.6 + Math.sin(3 * a + p2) * 0.5 + Math.sin(5 * a + p3) * 0.35));
          return dx * dx + dy * dy <= rr * rr;
        },
        cx - rm, cy - rm, cx + rm, cy + rm
      );
    },
    and: function () {
      var f = arguments;
      var fn = function (x, y) {
        for (var i = 0; i < f.length; i++) if (!f[i](x, y)) return false;
        return true;
      };
      var b = null;
      for (var i = 0; i < f.length; i++) {
        if (!f[i].bb) continue;
        var q = f[i].bb;
        b = b ? [Math.max(b[0], q[0]), Math.max(b[1], q[1]), Math.min(b[2], q[2]), Math.min(b[3], q[3])] : q.slice();
      }
      if (b) fn.bb = b;
      return fn;
    },
    or: function () {
      var f = arguments;
      var fn = function (x, y) {
        for (var i = 0; i < f.length; i++) if (f[i](x, y)) return true;
        return false;
      };
      var b = null, ok = true;
      for (var i = 0; i < f.length; i++) {
        if (!f[i].bb) {
          ok = false;
          break;
        }
        var q = f[i].bb;
        b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])] : q.slice();
      }
      if (ok && b) fn.bb = b;
      return fn;
    },
    sub: function (a, b) {
      var fn = function (x, y) {
        return a(x, y) && !b(x, y);
      };
      if (a.bb) fn.bb = a.bb;
      return fn;
    },
    mv: function (a, dx, dy) {
      var fn = function (x, y) {
        return a(x - dx, y - dy);
      };
      if (a.bb) fn.bb = [a.bb[0] + dx, a.bb[1] + dy, a.bb[2] + dx, a.bb[3] + dy];
      return fn;
    },
    /* rotate predicate about (cx,cy) by angle (radians) */
    rot: function (a, cx, cy, ang) {
      var c = Math.cos(-ang), s = Math.sin(-ang);
      return function (x, y) {
        var dx = x - cx, dy = y - cy;
        return a(cx + dx * c - dy * s, cy + dx * s + dy * c);
      };
    },
    below: function (a, yy) {
      return function (x, y) {
        return y >= yy && a(x, y);
      };
    },
    above: function (a, yy) {
      return function (x, y) {
        return y < yy && a(x, y);
      };
    }
  };

  /* ---- sprite buffer ---- */
  function Spr(w, h, unitW) {
    this.w = w;
    this.h = h === undefined ? w : h;
    this.k = (unitW || 32) / w; /* units per pixel */
    this.d = new Uint32Array(this.w * this.h);
  }
  Spr.prototype = {
    /* pixel range [x0,x1) x [y0,y1) covered by a predicate's bounding box */
    range: function (pred) {
      var w = this.w, h = this.h, k = this.k;
      var b = pred && pred.bb;
      if (!b) return [0, 0, w, h];
      return [
        Math.max(0, Math.floor(b[0] / k - 0.5) - 1),
        Math.max(0, Math.floor(b[1] / k - 0.5) - 1),
        Math.min(w, Math.ceil(b[2] / k - 0.5) + 2),
        Math.min(h, Math.ceil(b[3] / k - 0.5) + 2)
      ];
    },
    fill: function (pred, c) {
      c = col(c);
      var w = this.w, k = this.k, d = this.d;
      var rg = this.range(pred);
      var opaque = c >>> 24 === 255;
      for (var y = rg[1]; y < rg[3]; y++) {
        var uy = (y + 0.5) * k;
        for (var x = rg[0]; x < rg[2]; x++) {
          if (pred((x + 0.5) * k, uy)) {
            var i = y * w + x;
            d[i] = opaque ? c : over(d[i], c);
          }
        }
      }
      return this;
    },
    /* fn(ux, uy, px, py) -> colour or 0/undefined to skip */
    fillFn: function (pred, fn) {
      var w = this.w, k = this.k, d = this.d;
      var rg = this.range(pred);
      for (var y = rg[1]; y < rg[3]; y++) {
        var uy = (y + 0.5) * k;
        for (var x = rg[0]; x < rg[2]; x++) {
          var ux = (x + 0.5) * k;
          if (!pred || pred(ux, uy)) {
            var c = fn(ux, uy, x, y);
            if (c) {
              c = col(c);
              var i = y * w + x;
              d[i] = c >>> 24 === 255 ? c : over(d[i], c);
            }
          }
        }
      }
      return this;
    },
    set: function (x, y, c) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
      c = col(c);
      var i = y * this.w + x;
      this.d[i] = c >>> 24 === 255 ? c : over(this.d[i], c);
      return this;
    },
    get: function (x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
      return this.d[y * this.w + x];
    },
    /* 1 px outline in the transparent pixels touching opaque ones */
    outline: function (c, eight) {
      c = col(c);
      var w = this.w, h = this.h, d = this.d;
      var src = new Uint32Array(d);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = y * w + x;
          if (src[i] >>> 24 >= 40) continue;
          var hit =
            (x > 0 && src[i - 1] >>> 24 >= 128) ||
            (x < w - 1 && src[i + 1] >>> 24 >= 128) ||
            (y > 0 && src[i - w] >>> 24 >= 128) ||
            (y < h - 1 && src[i + w] >>> 24 >= 128);
          if (!hit && eight) {
            hit =
              (x > 0 && y > 0 && src[i - w - 1] >>> 24 >= 128) ||
              (x < w - 1 && y > 0 && src[i - w + 1] >>> 24 >= 128) ||
              (x > 0 && y < h - 1 && src[i + w - 1] >>> 24 >= 128) ||
              (x < w - 1 && y < h - 1 && src[i + w + 1] >>> 24 >= 128);
          }
          if (hit) d[i] = c;
        }
      }
      return this;
    },
    clone: function () {
      var s = new Spr(this.w, this.h, this.k * this.w);
      s.d.set(this.d);
      return s;
    },
    mirror: function () {
      var s = new Spr(this.w, this.h, this.k * this.w);
      for (var y = 0; y < this.h; y++)
        for (var x = 0; x < this.w; x++) s.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
      return s;
    },
    /* all visible pixels -> one colour (hit flash) */
    silhouette: function (c, keepAlpha) {
      c = col(c);
      var s = this.clone();
      for (var i = 0; i < s.d.length; i++) {
        var a = s.d[i] >>> 24;
        if (a) s.d[i] = keepAlpha ? withAlpha(c, a / 255) : c;
      }
      return s;
    },
    /* blend all visible pixels toward colour c by t */
    tint: function (c, t) {
      var s = this.clone();
      c = col(c);
      for (var i = 0; i < s.d.length; i++) {
        var p = s.d[i];
        if (p >>> 24) {
          var m = mix(p, c, t);
          s.d[i] = (m & 0x00ffffff) | (p & 0xff000000);
        }
      }
      return s;
    },
    /* draw another sprite (same pixel scale) at pixel offset */
    blit: function (src, ox, oy) {
      for (var y = 0; y < src.h; y++) {
        for (var x = 0; x < src.w; x++) {
          var p = src.d[y * src.w + x];
          if (p >>> 24) {
            var tx = x + ox, ty = y + oy;
            if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
            var i = ty * this.w + tx;
            this.d[i] = p >>> 24 === 255 ? p : over(this.d[i], p);
          }
        }
      }
      return this;
    },
    shifted: function (dx, dy) {
      var s = new Spr(this.w, this.h, this.k * this.w);
      s.blit(this, dx, dy);
      return s;
    },
    toCanvas: function () {
      var c = DM.mkCanvas(this.w, this.h);
      var ctx = c.getContext('2d');
      var img = new ImageData(new Uint8ClampedArray(this.d.buffer.slice(0)), this.w, this.h);
      ctx.putImageData(img, 0, 0);
      return c;
    }
  };

  DM.col = col;
  DM.mix = mix;
  DM.withAlpha = withAlpha;
  DM.over = over;
  DM.sh = sh;
  DM.Spr = Spr;
})();
