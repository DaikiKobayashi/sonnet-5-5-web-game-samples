// Entry: gallery or game.
const params = new URLSearchParams(location.search);
if (params.get('gallery') === '1') {
  const c = document.getElementById('game');
  if (c) c.remove();
  import('./gallery.js').then((m) => m.runGallery());
} else {
  import('./game.js');
}
