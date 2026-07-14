// Fira Mono (and the other selectable fonts) advance width is ~0.6em.
const MONO_CHAR_ASPECT = 0.6;

// Scales a monospace element's font-size so `cols` characters exactly fill `width`.
function fitMonospaceFontSize(el, width, cols, charAspect = MONO_CHAR_ASPECT) {
  if (!width) return;
  const fontSize = width / (cols * charAspect);
  el.style.fontSize = fontSize + 'px';
  el.style.lineHeight = fontSize + 'px';
}
