(function () {
  // No leading space (transparent pixels handled separately); ordered lightest → densest.
  const PALETTES = [
    { label: 'classic', chars: '.,:-=+*#%@'  },
    { label: 'block',   chars: '░▒▓█'         },
    { label: 'thin',    chars: '·:;!|1'        },
    { label: 'circles', chars: '.oO0@'         },
    { label: 'binary',  chars: '01'            },
  ];

  const CHAR_ASPECT = MONO_CHAR_ASPECT;
  const ALPHA_THRESHOLD = 0.05;

  let currentPalette    = 0;
  let currentCols       = 200;
  let currentInvert     = false;
  let currentBrightness = 0; // -1 (darkest) to +1 (lightest), offset applied to luma
  let loadedImage       = null;

  function buildAscii(img, cols, palette, invert, brightnessOffset) {
    const rows = Math.round(cols * (img.naturalHeight / img.naturalWidth) * CHAR_ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width  = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cols, rows);
    const { data } = ctx.getImageData(0, 0, cols, rows);
    const chars = palette.chars;

    let out = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const alpha = data[i + 3] / 255;

        if (alpha < ALPHA_THRESHOLD) {
          out += ' ';
          continue;
        }

        // Perceived brightness (Rec. 601 luma) + offset clamp
        const raw = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        const brightness = Math.max(0, Math.min(1, raw + brightnessOffset));
        // Default: dark → dense, white → lightest char
        const density = invert ? brightness : 1 - brightness;
        const idx = Math.min(Math.floor(density * chars.length), chars.length - 1);
        out += chars[idx];
      }
      out += '\n';
    }
    return out;
  }

  function fitOutputWidth(pre) {
    const width = pre.parentElement?.clientWidth || pre.clientWidth;
    fitMonospaceFontSize(pre, width, currentCols, CHAR_ASPECT);
  }

  function render() {
    if (!loadedImage) return;
    const pre = document.getElementById('ascii-art-output');
    if (!pre) return;
    pre.textContent = buildAscii(loadedImage, currentCols, PALETTES[currentPalette], currentInvert, currentBrightness);
    fitOutputWidth(pre);
  }

  function syncButtons() {
    PALETTES.forEach((_, i) => {
      document.getElementById('ascii-pal-' + i)?.classList.toggle('active', i === currentPalette);
    });
    document.getElementById('ascii-invert-btn')?.classList.toggle('active', currentInvert);
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        loadedImage = img;
        const label = document.getElementById('ascii-art-drop-label');
        if (label) label.textContent = '[ ' + file.name + ' ]';
        render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.asciiTriggerUpload = () => document.getElementById('ascii-art-file')?.click();
  window.asciiHandleFile    = (e) => loadFile(e.target.files[0]);

  window.asciiHandleDrop = (e) => {
    e.preventDefault();
    document.getElementById('ascii-art-drop')?.classList.remove('ascii-drag-over');
    loadFile(e.dataTransfer.files[0]);
  };

  window.asciiSetPalette = (idx) => {
    currentPalette = idx;
    syncButtons();
    render();
  };

  window.asciiToggleInvert = () => {
    currentInvert = !currentInvert;
    syncButtons();
    render();
  };

  window.asciiUpdateBrightness = (val) => {
    currentBrightness = parseInt(val, 10) / 100;
    const display = document.getElementById('ascii-brightness-val');
    if (display) display.textContent = (val > 0 ? '+' : '') + val;
    render();
  };

  window.asciiUpdateCols = (val) => {
    currentCols = parseInt(val, 10);
    const display = document.getElementById('ascii-art-cols-val');
    if (display) display.textContent = currentCols;
    render();
  };

  window.asciiCopyOutput = () => {
    const text = document.getElementById('ascii-art-output')?.textContent;
    if (text) navigator.clipboard.writeText(text);
  };

  window.asciiDownloadOutput = () => {
    const text = document.getElementById('ascii-art-output')?.textContent;
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'ascii-art.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Exposed globally so other pages can reuse this renderer/palettes.
  window.ASCII_ART_PALETTES = PALETTES;
  window.buildAsciiArt = buildAscii;

  window.initAsciiArtDemo = () => {
    currentPalette    = 0;
    currentCols       = 200;
    currentInvert     = false;
    currentBrightness = 0;
    loadedImage       = null;

    const brightnessInput = document.getElementById('ascii-brightness');
    if (brightnessInput) brightnessInput.value = 0;
    const brightnessVal = document.getElementById('ascii-brightness-val');
    if (brightnessVal) brightnessVal.textContent = '0';

    const colsInput = document.getElementById('ascii-art-cols');
    if (colsInput) colsInput.value = 200;
    const colsVal = document.getElementById('ascii-art-cols-val');
    if (colsVal) colsVal.textContent = '200';
    const pre = document.getElementById('ascii-art-output');
    if (pre) {
      pre.textContent = '';
      new ResizeObserver(() => { if (loadedImage) fitOutputWidth(pre); }).observe(pre.parentElement || pre);
    }
    const label = document.getElementById('ascii-art-drop-label');
    if (label) label.textContent = '[ drop image or click to upload ]';

    syncButtons();

    const drop = document.getElementById('ascii-art-drop');
    if (drop) {
      drop.addEventListener('dragover',  (e) => { e.preventDefault(); drop.classList.add('ascii-drag-over'); });
      drop.addEventListener('dragleave', ()  => drop.classList.remove('ascii-drag-over'));
    }
  };
})();
