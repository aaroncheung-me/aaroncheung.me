// Escape closes whichever overlay reports isOpen() -- one permanent listener
// avoids the bookkeeping bugs of add/remove-per-open (e.g. a second open()
// call orphaning the first listener).
function bindEscapeToClose(isOpen, onClose) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) onClose();
  });
}
