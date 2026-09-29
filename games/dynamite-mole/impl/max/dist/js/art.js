/* art.js - shared helpers for the procedural pixel-art modules + the build entry point.
 * Every asset is drawn from scratch at build time with the Pix toolkit (1 art dot = 1 logical px),
 * so the game ships no image files besides the favicon. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var Pix = DM.Pix, hex = Pix.hex;

  var U = DM.ArtUtil = {};
  U.hex = hex;
  U.ramp = Pix.ramp;
  U.OL = hex('#241629');                         // universal dark outline (plum black)
  U.SHADOW = hex('#0b0612', 0.34);
  U.WHITE = hex('#ffffff');

  /* draw one part on its own layer, outline it, composite it onto target */
  U.part = function (target, drawFn, olColor, diag) {
    var l = new Pix(target.w, target.h);
    drawFn(l);
    l.outline(olColor == null ? U.OL : olColor, diag);
    target.blit(l, 0, 0);
    return target;
  };

  /* mix a whole sprite towards a colour (used for hit flashes) */
  U.flash = function (p, colorHex, t) { return p.tint(hex(colorHex), t); };

  /* tiny ASCII sprites: rows + palette object of hex strings */
  U.art = function (rows, palHex) {
    var pal = {};
    Object.keys(palHex).forEach(function (k) { pal[k] = hex(palHex[k]); });
    return Pix.fromArt(rows, pal);
  };

  /* tiny deterministic value noise for texture (integer lattice hash) */
  U.noise = function (x, y, seed) { return DM.hash2(x, y, seed); };

  /* 5-point star (5x5 cross-shaped) used by the dizzy stars and sparkles */
  U.star = function (p, cx, cy, c1, c2) {
    p.set(cx, cy - 2, c1); p.set(cx, cy + 2, c1); p.set(cx - 2, cy, c1); p.set(cx + 2, cy, c1);
    p.set(cx - 1, cy, c2); p.set(cx + 1, cy, c2); p.set(cx, cy - 1, c2); p.set(cx, cy + 1, c2); p.set(cx, cy, U.WHITE);
    p.set(cx - 1, cy - 1, c1); p.set(cx + 1, cy - 1, c1); p.set(cx - 1, cy + 1, c1); p.set(cx + 1, cy + 1, c1);
  };

  DM.Art = {
    build: function () {
      var S = DM.Spr = {};
      DM.ArtChars.build(S);
      DM.ArtTiles.build(S);
      DM.ArtUi.build(S);
      return S;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
