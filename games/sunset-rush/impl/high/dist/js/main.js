import { runGallery } from './gallery.js';

const params = new URLSearchParams(location.search);
if (params.get('gallery') === '1') {
  runGallery();
} else {
  import('./boot.js').then((m) => m.boot(params));
}
