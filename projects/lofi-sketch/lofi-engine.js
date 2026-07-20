
(function () {
  'use strict';

  var NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  var CHORD_TYPES = {
    maj7: { intervals: [0, 4, 7, 11], label: 'maj7' },
    min7: { intervals: [0, 3, 7, 10], label: 'm7' },
    dom7: { intervals: [0, 4, 7, 10], label: '7' },
    m7b5: { intervals: [0, 3, 6, 10], label: 'm7b5' }
  };

  // This whole engine is now a direct port of meel-hd/lofi-engine's
  // structure (Chords/ChordProgression/Chord.ts and the melody/drum logic
  // in PlayButton.svelte), not a bespoke system anymore. Same 7 diatonic
  // chords, same allowed-next lists (uniform random, no weighting, no
  // wildcard -- a chord can never repeat), same melody scale and interval
  // weights, same sparse drum pattern.
  var CHORD_POOL = [
    { degree: 'I',   r: 0,  t: 'maj7' },
    { degree: 'ii',  r: 2,  t: 'min7' },
    { degree: 'iii', r: 4,  t: 'min7' },
    { degree: 'IV',  r: 5,  t: 'maj7' },
    { degree: 'V',   r: 7,  t: 'dom7' },
    { degree: 'vi',  r: 9,  t: 'min7' },
    { degree: 'vii', r: 11, t: 'm7b5' }
  ];

  // Exact allowed-next lists from their Chords.ts (uniform random pick
  // among these; no weighting, no fallback to an arbitrary chord).
  var NEXT_CHORD_OPTIONS = [
    [1, 2, 3, 4, 5, 6],
    [2, 4, 6],
    [3, 5],
    [1, 4],
    [0, 2, 5],
    [1, 3],
    [0, 2]
  ];

  var REGEN_BAR_OPTIONS = [16, 20, 24, 28, 32, 48]; // how often the key/transpose can reroll

  // Piano samples: their exact sparse set (A, C, D#, F# across 6 octaves --
  // 24 real recordings), the same interval their Tone.Sampler uses. Every
  // playable note is at most a minor third from an actual recording, filled
  // in by pitch-shifting via playbackRate, same technique Tone.Sampler uses
  // internally.
  var PIANO_LETTER_SEMITONE = { A: 9, C: 0, Dsharp: 3, Fsharp: 6 };
  var PIANO_SAMPLE_KEYS = [];
  var PIANO_SAMPLE_FREQS = {};
  ['A', 'C', 'Dsharp', 'Fsharp'].forEach(function (letter) {
    [1, 2, 3, 4, 5, 6].forEach(function (octave) {
      var key = letter + octave;
      PIANO_SAMPLE_KEYS.push(key);
      // scientific pitch notation: C_n = 16.3516 * 2^n Hz
      PIANO_SAMPLE_FREQS[key] = 16.3516 * Math.pow(2, octave + PIANO_LETTER_SEMITONE[letter] / 12);
    });
  });

  // Melody scale: their "fiveToFive" -- semitone offsets spanning roughly a
  // fifth below the tonic up to a fifth two octaves above it.
  var WALK_SCALE = [-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];

  // Probability of moving 0,1,2,3... scale steps away from the current
  // note. Heavily favors a single step; big leaps are rare. (Their exact
  // intervalWeights values.)
  var MELODY_INTERVAL_WEIGHTS = [0.10, 0.30, 0.20, 0.15, 0.15, 0.025, 0.025, 0.05];

  // Melody rhythm: each entry is a candidate note value. `steps` is its
  // length in 16th-note steps, `repeats` is how many times that value plays
  // in a row (a NEW pitch each time) before a fresh value+pitch decision is
  // made. repeats*steps is the same (8 = 2 beats) for every entry, so every
  // phrase occupies the same span regardless of which value gets picked --
  // 1 half note, 2 quarters, 4 eighths, or 8 sixteenths all fill 2 beats.
  var MELODY_SUBDIVISIONS = [
    { steps: 8, repeats: 1 }, // half
    { steps: 4, repeats: 2 }, // quarter
    { steps: 2, repeats: 4 }, // eighth
    { steps: 1, repeats: 8 }  // sixteenth
  ];
  var MELODY_SUBDIVISION_WEIGHTS = [0.20, 0.35, 0.35, 0.10]; // half/quarter/eighth/16th

  var TRANSPOSES = [-3, -1, 0, 2, 4];

  var CHORD_ROOT_HZ = 130.813; // fixed register, same as their key+"3" -- no voice leading
  var LEAD_ROOT_HZ = CHORD_ROOT_HZ * 4; // two octaves up, same gap as their key+"3" vs key+"5"
  var ARP_ROOT_HZ = CHORD_ROOT_HZ * 2; // one octave above the chord bed, one below the lead
  var STEPS_PER_BAR = 16;
  var LOOKAHEAD_MS = 25;
  var SCHEDULE_AHEAD_S = 0.12;

  // Ambience themes -- one button cycles through these. Each maps to the
  // target gain for whichever of the persistent beds it uses; anything not
  // listed for a theme fades to 0. "rain" and "thunder" both use the rain
  // wash/drop beds (thunder just runs them louder/denser, see scheduler())
  // plus thunder gets rare thunderclap events on top.
  // Precipitation and Atmosphere are two independent toggles now, not one
  // combined selector -- you can have Rain + Forest together, Thunderstorm
  // + Cityscape, either alone, or neither. Each has its own state, its own
  // bed-key list, and its own apply function, so switching one never
  // touches the other's gains.
  var PRECIP_STATES = ['off', 'rain', 'thunder'];
  var PRECIP_LABELS = { off: 'Rain', rain: 'Rain', thunder: 'Thunderstorm' };
  var PRECIP_BEDS = {
    // Cut hard (was 0.065/0.09, roughly *0.15) -- at the 100% slider
    // position it needed to be manually pulled down to ~15% to sound
    // right, so that's what "100%" itself should actually produce. Same
    // wash-forward ratio, just much quieter overall. rainMistGain is a
    // second, softer/broader downpour layer (see initEngine) added
    // alongside the wash so the overall bed reads as more of a continuous
    // rainfall and less like individual drops -- kept well under the
    // wash's own level (first attempt at 0.05 overshot badly and made rain
    // itself too loud).
    rain: { rainWashGain: 0.0098, rainDropGain: 0.0105, rainMistGain: 0.006 },
    // Rain pulled back a bit (0.14/0.15 -> 0.10/0.10) and the thunderclap
    // itself boosted separately (see playThunderClap) -- the rain was
    // crowding out the thunder entirely, which is the actual point of a
    // thunderstorm versus plain rain. Cut hard again, all three values to
    // roughly 20% of the prior pass (0.10/0.045/0.035 -> 0.02/0.009/0.007)
    // -- still too loud, covering the thunderclaps rather than sitting
    // underneath them. The clap itself (playThunderClap) is untouched --
    // only the continuous ambient rain layer needed to come down.
    thunder: { rainWashGain: 0.02, rainDropGain: 0.009, rainMistGain: 0.007 }
  };
  var PRECIP_BED_KEYS = ['rainWashGain', 'rainDropGain', 'rainMistGain'];

  var ATMOSPHERE_STATES = ['off', 'cityscape', 'forest', 'ocean', 'fireplace'];
  var ATMOSPHERE_LABELS = {
    off: 'Atmosphere', cityscape: 'Cityscape', forest: 'Forest',
    ocean: 'Ocean', fireplace: 'Fireplace'
  };
  var ATMOSPHERE_BEDS = {
    // AC hum and building hum both cut further (0.03/0.09 -> 0.018/0.05) --
    // together they were reading as one generic continuous "hum/static"
    // that buried the actual traffic one-shots (playTrafficPass, boosted
    // separately) and the point of Cityscape got lost. trafficRumbleGain
    // and mumbleGain (continuous distant-highway and indistinct-voices
    // layers, see initEngine) trimmed too so the discrete car passes read
    // as the foreground event instead of one more layer of drone.
    cityscape: { acHumGain: 0.018, buildingHumGain: 0.05, trafficRumbleGain: 0.05, mumbleGain: 0.04 },
    // Birds and one-shot leaf rustles removed entirely -- replaced by a
    // single continuous wind+leaves wash (forestWindGain, redesigned in
    // initEngine to be broadband and rustly like the rain wash rather than
    // a narrow bandpass sweep) plus occasional twig-snap texture on top
    // (playTwigSnap, scheduled in scheduler()). Cut again to ~40% of the
    // v70 level (0.055 -> 0.022) -- still too loud, and its Q was widened
    // in initEngine too so its energy stops bleeding as far outside its
    // nominal band, which was also swallowing the twig snaps.
    forest: { forestWindGain: 0.022 },
    // Halved (0.22/0.08 -> 0.11/0.04) -- was too loud relative to
    // everything else. oceanWindGain cut hard again (0.04 -> 0.014) -- as
    // a flat, non-pulsing bandpass hiss sitting under the wave swell it
    // read as an unrelated background noise rather than part of the ocean.
    ocean: { oceanWaveGain: 0.11, oceanWindGain: 0.014 },
    fireplace: { fireplaceGain: 0.09 }
  };
  var ATMOSPHERE_BED_KEYS = [
    'acHumGain', 'buildingHumGain', 'trafficRumbleGain', 'mumbleGain',
    'forestWindGain', 'oceanWaveGain', 'oceanWindGain', 'fireplaceGain'
  ];

  // Vinyl crackle (the continuous crackleGain hiss bed plus playCrackleTick's
  // pops) used to run unconditionally regardless of any toggle -- now it's
  // its own on/off, defaulting on to match the old always-there behavior.
  var CRACKLE_BASE_GAIN = 0.011;

  // Recalibrates what each mix slider's 100% actually means -- the slider
  // itself still shows/stores 0-150% same as always, this just scales the
  // real gain applied at the bus so "100%" lands at a balance that's
  // already been tuned by ear, instead of every bus defaulting to unity.
  var BUS_VOLUME_BASELINE = {
    chordBus: 0.75,
    melodyBus: 1.05,
    drumBus: 0.60,
    rainBus: 0.75,
    staticBus: 0.50,
    vinylBus: 0.50
  };

  // Live read of the site's own toggle (data-reduced-motion), not a
  // one-time OS-preference snapshot -- that attribute already folds in the
  // OS setting at load (see index.html's inline script) and stays current
  // if the visitor flips the site's own motion toggle afterward, which a
  // captured-once matchMedia() value never would.
  function reducedMotionOn() {
    return document.documentElement.getAttribute('data-reduced-motion') === 'true';
  }

  // This engine can run with no visible UI at all (the site-wide footer
  // toggle just wants audio, no buttons/sliders) or with a full control
  // panel mounted via LofiSketch.mount(container) (the Projects page demo).
  // `els` defaults to a set of real but detached DOM elements -- every
  // .textContent/.classList/.value write the engine already does elsewhere
  // stays exactly as it was written (no null-checks scattered through 2000
  // lines of tuned scheduler code), it just lands on nothing anyone sees
  // until mount() swaps in the real, visible elements.
  function makeDetachedEls() {
    return {
      play: document.createElement('button'),
      regen: document.createElement('button'),
      precip: document.createElement('button'),
      atmosphere: document.createElement('button'),
      vinyl: document.createElement('button'),
      chordLabel: document.createElement('span'),
      stateLabel: document.createElement('span'),
      canvas: document.createElement('canvas'),
      overallVol: document.createElement('input'),
      chordVol: document.createElement('input'),
      melodyVol: document.createElement('input'),
      drumVol: document.createElement('input'),
      rainVol: document.createElement('input'),
      staticVol: document.createElement('input'),
      vinylVol: document.createElement('input'),
      overallVolOut: document.createElement('output'),
      chordVolOut: document.createElement('output'),
      melodyVolOut: document.createElement('output'),
      drumVolOut: document.createElement('output'),
      rainVolOut: document.createElement('output'),
      staticVolOut: document.createElement('output'),
      vinylVolOut: document.createElement('output')
    };
  }

  // Real, visible elements for the full control panel -- ids are `lofi-`
  // prefixed in the markup to avoid colliding with the rest of whatever
  // page this mounts into.
  function buildEls(container) {
    return {
      play: container.querySelector('#lofi-playBtn'),
      regen: container.querySelector('#lofi-regenBtn'),
      precip: container.querySelector('#lofi-precipBtn'),
      atmosphere: container.querySelector('#lofi-atmosphereBtn'),
      vinyl: container.querySelector('#lofi-vinylBtn'),
      chordLabel: container.querySelector('#lofi-chordLabel'),
      stateLabel: container.querySelector('#lofi-stateLabel'),
      canvas: container.querySelector('#lofi-scope'),
      overallVol: container.querySelector('#lofi-overallVol'),
      chordVol: container.querySelector('#lofi-chordVol'),
      melodyVol: container.querySelector('#lofi-melodyVol'),
      drumVol: container.querySelector('#lofi-drumVol'),
      rainVol: container.querySelector('#lofi-rainVol'),
      staticVol: container.querySelector('#lofi-staticVol'),
      vinylVol: container.querySelector('#lofi-vinylVol'),
      overallVolOut: container.querySelector('#lofi-overallVolOut'),
      chordVolOut: container.querySelector('#lofi-chordVolOut'),
      melodyVolOut: container.querySelector('#lofi-melodyVolOut'),
      drumVolOut: container.querySelector('#lofi-drumVolOut'),
      rainVolOut: container.querySelector('#lofi-rainVolOut'),
      staticVolOut: container.querySelector('#lofi-staticVolOut'),
      vinylVolOut: container.querySelector('#lofi-vinylVolOut')
    };
  }

  var uiMounted = false;
  var els = makeDetachedEls();
  var ctx2d = els.canvas.getContext('2d');

  var engine = {
    ctx: null,
    master: null,
    masterFilter: null,
    analyser: null,
    crackleGain: null,
    macroLfo: null,
    macroLfoGain: null,
    breathLfo: null,
    breathLfoGain: null,
    breathGain: null,
    glueSaturation: null,
    glueCompressor: null,
    glueDamping: null,
    roomReverb: null,
    rainWashGain: null,
    rainDropGain: null,
    rainMistGain: null,
    acHumGain: null,
    buildingHumGain: null,
    trafficRumbleGain: null,
    mumbleGain: null,
    forestWindGain: null,
    oceanWaveGain: null,
    oceanWindGain: null,
    fireplaceGain: null,
    // Both default off now -- with Precipitation and Atmosphere independent
    // toggles, defaulting rain on meant it silently bled into every
    // Atmosphere listening test (reported as "static" muddying Cityscape/
    // Forest/Ocean, and as background noise with nothing selected at all).
    // Starting silent lets whatever the user picks be heard cleanly.
    precipitation: 'off',
    atmosphere: 'off',
    vinylEnabled: true,
    nextRainTime: null,
    nextCrackleTime: null,
    nextTrafficTime: null,
    nextThunderTime: null,
    nextFireTime: null,
    nextTwigTime: null,
    // per-category mix buses: created once ctx exists, but the volume
    // values themselves are readable/settable before that so a slider
    // moved before the first Play still takes effect once it starts
    chordBus: null,
    melodyBus: null,
    drumBus: null,
    rainBus: null,
    staticBus: null,
    vinylBus: null,
    arpBus: null,
    overallGain: null,
    chordVolume: 1,
    melodyVolume: 1,
    drumVolume: 1,
    rainVolume: 1,
    staticVolume: 1,
    vinylVolume: 1,
    overallVolume: 1,
    isPlaying: false,
    currentChord: null,
    currentChordIndex: null,
    startingChordIndex: 0,
    chordLastUsedAt: [-1, -1, -1, -1, -1, -1, -1],
    chordChangeCount: 0,
    nextRegenBar: 24,
    drumBuffers: { kick: null, snare: null, hat: null },
    pianoBuffers: {},
    scalePos: 7,
    harmonyDensity: 0.6,
    lastArpTime: null,
    lastMelodyTime: null,
    melodyBusyUntil: 0,
    transpose: 0,
    tempo: 78,
    swing: 0.58,
    timer: null,
    nextNoteTime: 0,
    currentStep: 0,
    currentBar: -1,
    activeVoices: [],
    animId: null
  };

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function jitter(t, ms) { return t + (Math.random() * 2 - 1) * (ms / 1000); }

  // Picks among the chord's allowed-next list (same functional-harmony
  // restriction as before -- e.g. a I chord can go to ii/iii/IV/V/vi/vii
  // but the table still restricts which chords are reachable from where),
  // but no longer uniform: weighted toward whichever of the allowed options
  // has gone longest without being played. A chord never used yet gets a
  // strong boost over one used recently. Every NEXT_CHORD_OPTIONS entry
  // already excludes its own index, so "never repeat the same chord twice
  // in a row" falls out of the table for free -- no extra check needed.
  function pickNextChordIndex(fromIndex) {
    var options = NEXT_CHORD_OPTIONS[fromIndex];
    var weights = options.map(function (opt) {
      var lastUsed = engine.chordLastUsedAt[opt];
      return lastUsed === -1 ? engine.chordChangeCount + 8 : (engine.chordChangeCount - lastUsed);
    });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = Math.random() * sum;
    for (var i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return options[i];
    }
    return options[options.length - 1];
  }

  function rollParams() {
    engine.transpose = rand(TRANSPOSES);
    engine.tempo = Math.round(randRange(74, 82));
    engine.harmonyDensity = randRange(0.4, 0.8);
    engine.scalePos = 3 + Math.floor(Math.random() * 9);
    engine.lastMelodyTime = null;
    engine.currentChordIndex = null;
    engine.startingChordIndex = Math.floor(Math.random() * CHORD_POOL.length);
    engine.chordLastUsedAt = [-1, -1, -1, -1, -1, -1, -1];
    engine.chordChangeCount = 0;
    engine.nextRegenBar = rand(REGEN_BAR_OPTIONS);
  }

  function chordFromIndex(poolIndex) {
    var chordDef = CHORD_POOL[poolIndex];
    var rootSemitone = ((chordDef.r + engine.transpose) % 12 + 12) % 12;
    return {
      def: chordDef,
      rootSemitone: rootSemitone,
      name: NOTE_NAMES[rootSemitone] + CHORD_TYPES[chordDef.t].label,
      degree: chordDef.degree
    };
  }

  // Chord selection is now a live, ongoing decision each time a chord is
  // needed -- not a fixed-length progression generated once and cycled.
  // engine.currentChordIndex carries the running state between calls (both
  // chord-change trigger points in scheduleStep, top of the bar and the
  // halfway point, call this directly).
  function triggerChordChange(time) {
    var nextIndex = engine.currentChordIndex == null
      ? engine.startingChordIndex
      : pickNextChordIndex(engine.currentChordIndex);
    engine.currentChordIndex = nextIndex;
    engine.chordLastUsedAt[nextIndex] = engine.chordChangeCount;
    engine.chordChangeCount++;

    var chord = chordFromIndex(nextIndex);
    engine.currentChord = chord;
    // A few ms of jitter on the actual audio onset -- chords used to land
    // exactly on the grid instant every time (same as drums used to), so
    // they always coincided with the kick down to the sample. Letting them
    // land a touch before or after is what makes the two read as two
    // separate players landing on the same beat instead of one triggered
    // event driving both.
    var chordTime = jitter(time, 5);
    playChord(chord, chordTime);
    playArpBurst(chord, chordTime);
    var label = chord.name;
    var degreeLabel = chord.degree;
    scheduleUiUpdate(time, function () {
      els.chordLabel.textContent = degreeLabel + '  ·  ' + label + '  ·  ' + engine.tempo + ' BPM';
    });
  }

  function makeNoiseBuffer(ctx, seconds) {
    var buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Gentle tanh soft-clip curve for the glue bus -- normalized so unity
  // input still maps to (roughly) unity output, `amount` just controls how
  // hard the curve bends near the top. Low amounts (this uses 1.6) read as
  // a touch of warmth on transients, not audible distortion.
  function makeSaturationCurve(amount) {
    var samples = 1024;
    var curve = new Float32Array(samples);
    var denom = Math.tanh(amount) || 1;
    for (var i = 0; i < samples; i++) {
      var x = (i / (samples - 1)) * 2 - 1;
      curve[i] = Math.tanh(amount * x) / denom;
    }
    return curve;
  }

  // Synthesized reverb impulse response -- exponentially-decaying stereo
  // noise, since there's no audio file to load a real one from. This is a
  // standard lightweight technique for a ConvolverNode reverb and reads as
  // a small, natural room/plate at low wet mix.
  function makeReverbImpulse(ctx, seconds, decay) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var impulse = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // Pink noise (Paul Kellet's "economy" filter) -- rolls off high frequency
  // energy the way real pink noise does, which is what their background
  // noise bed actually uses (Tone.Noise("pink")). White noise run through
  // the same gain reads as bright hiss/static; pink noise reads as a much
  // softer, warmer rumble at the same volume.
  function makePinkNoiseBuffer(ctx, seconds) {
    var buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      var pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }
    return buffer;
  }

  function initEngine() {
    var AC = window.AudioContext || window.webkitAudioContext;
    engine.ctx = new AC();
    var ctx = engine.ctx;

    engine.master = ctx.createGain();
    engine.master.gain.value = 0.0001;

    engine.masterFilter = ctx.createBiquadFilter();
    engine.masterFilter.type = 'lowpass';
    engine.masterFilter.frequency.value = 4200;

    engine.analyser = ctx.createAnalyser();
    engine.analyser.fftSize = 1024;

    // overallGain sits AFTER master, as a separate node purely for the
    // user's overall-volume preference -- master's own gain is already
    // busy handling the play/stop fade automation, so layering another
    // control onto that same param would fight it.
    engine.overallGain = ctx.createGain();
    engine.overallGain.gain.value = engine.overallVolume;

    // "Glue" stage -- ties the separately-synthesized tracks into
    // something that reads as one recording instead of parallel layers.
    // breathGain is a slow, barely-perceptible volume LFO (~1dB, started
    // in startMacroAutomation) instead of a perfectly static level.
    // glueSaturation is a gentle tanh soft-clip for a touch of warmth on
    // transients, not audible distortion. glueCompressor is a light bus
    // compressor (~1-2dB of gain reduction on typical peaks, tuned to not
    // pump) that reacts to the whole mix at once -- that shared reaction
    // is what actually makes separately-synthesized instruments feel like
    // they're occupying the same space, more than any single effect does.
    engine.breathGain = ctx.createGain();
    engine.breathGain.gain.value = 1;

    engine.glueSaturation = ctx.createWaveShaper();
    engine.glueSaturation.curve = makeSaturationCurve(1.6);
    engine.glueSaturation.oversample = '2x';

    engine.glueCompressor = ctx.createDynamicsCompressor();
    engine.glueCompressor.threshold.value = -22;
    engine.glueCompressor.knee.value = 18;
    engine.glueCompressor.ratio.value = 2.2;
    engine.glueCompressor.attack.value = 0.012;
    engine.glueCompressor.release.value = 0.18;

    // A fixed, always-on damping filter -- distinct from masterFilter below
    // it, which sweeps brightness up and down via the macro LFO. This one
    // never moves; it just takes the sharpest top end off everything
    // uniformly, the same way recording (or even just playing back) onto
    // a shared physical medium naturally would. That constant, shared
    // ceiling is part of what reads as "one recording" instead of cleanly
    // synthesized layers stacked on top of each other.
    engine.glueDamping = ctx.createBiquadFilter();
    engine.glueDamping.type = 'lowpass';
    engine.glueDamping.frequency.value = 8000;
    engine.glueDamping.Q.value = 0.5;

    engine.master.connect(engine.overallGain);
    engine.overallGain.connect(engine.breathGain);
    engine.breathGain.connect(engine.glueSaturation);
    engine.glueSaturation.connect(engine.glueCompressor);
    engine.glueCompressor.connect(engine.glueDamping);
    engine.glueDamping.connect(engine.masterFilter);
    engine.masterFilter.connect(engine.analyser);
    engine.analyser.connect(ctx.destination);

    // Shared "room" reverb -- a synthesized (not sampled) impulse
    // response, since there's no audio file to load one from. Chords
    // (and the arp, which is already mixed into chordBus) and melody/
    // harmony all send into it; drums and the ambience beds stay dry, so
    // the beat keeps its punch and the textures don't get muddier. Having
    // the harmonic instruments sit in the same small, consistent space is
    // what makes them read as recorded together instead of synthesized
    // separately -- this is the "everyone in the same room" idea.
    engine.roomReverb = ctx.createConvolver();
    engine.roomReverb.buffer = makeReverbImpulse(ctx, 1.3, 2.2);
    var roomSend = ctx.createGain();
    roomSend.gain.value = 0.14;
    engine.roomReverb.connect(roomSend);
    roomSend.connect(engine.master);

    // per-category mix buses -- one gain node each for chords, melody,
    // drums, rain, and static/crackle, sitting between those sounds and
    // the master so the sliders control each independently. Initialized
    // from whatever the sliders were already set to (in case they were
    // moved before the first Play), scaled by BUS_VOLUME_BASELINE so
    // "100%" lands at an already-tuned balance instead of unity.
    engine.chordBus = ctx.createGain();
    engine.chordBus.gain.value = engine.chordVolume * BUS_VOLUME_BASELINE.chordBus;
    engine.chordBus.connect(engine.master);
    engine.chordBus.connect(engine.roomReverb);

    // arpeggio is chord-derived (it plays the current chord's own tones),
    // so it rides the Chords slider rather than needing a slider of its own.
    // Well below unity now -- after several rounds of pushing it louder to
    // compete as its own voice, the actual fix was the opposite direction:
    // pull it back so it's a faint texture under the mix, not a voice
    // fighting the melody/harmony for attention.
    engine.arpBus = ctx.createGain();
    engine.arpBus.gain.value = 0.55;
    engine.arpBus.connect(engine.chordBus);

    engine.melodyBus = ctx.createGain();
    engine.melodyBus.gain.value = engine.melodyVolume * BUS_VOLUME_BASELINE.melodyBus;
    engine.melodyBus.connect(engine.master);
    engine.melodyBus.connect(engine.roomReverb);

    engine.drumBus = ctx.createGain();
    engine.drumBus.gain.value = engine.drumVolume * BUS_VOLUME_BASELINE.drumBus;
    engine.drumBus.connect(engine.master);

    engine.rainBus = ctx.createGain();
    engine.rainBus.gain.value = engine.rainVolume * BUS_VOLUME_BASELINE.rainBus;
    engine.rainBus.connect(engine.master);

    engine.staticBus = ctx.createGain();
    engine.staticBus.gain.value = engine.staticVolume * BUS_VOLUME_BASELINE.staticBus;
    engine.staticBus.connect(engine.master);

    // Its own bus (was routed through staticBus) so the Vinyl mix slider
    // controls it independently of the Atmosphere slider.
    engine.vinylBus = ctx.createGain();
    engine.vinylBus.gain.value = engine.vinylVolume * BUS_VOLUME_BASELINE.vinylBus;
    engine.vinylBus.connect(engine.master);

    // background noise bed -- pink noise through a 2000Hz lowshelf, softer
    // and darker than white noise at the same volume. Pulled down further
    // (0.025 -> 0.016 -> 0.011) -- character was fine, overall vinyl
    // crackle (this bed plus playCrackleTick's pops) was just too loud.
    var noiseBuf = makeNoiseBuffer(ctx, 2);
    var pinkBuf = makePinkNoiseBuffer(ctx, 2);
    var crackleSrc = ctx.createBufferSource();
    crackleSrc.buffer = pinkBuf;
    crackleSrc.loop = true;
    var crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'lowshelf';
    crackleFilter.frequency.value = 2000;
    engine.crackleGain = ctx.createGain();
    engine.crackleGain.gain.value = engine.vinylEnabled ? CRACKLE_BASE_GAIN : 0;
    crackleSrc.connect(crackleFilter);
    crackleFilter.connect(engine.crackleGain);
    engine.crackleGain.connect(engine.vinylBus);
    crackleSrc.start();
    engine.crackleNoiseBuffer = noiseBuf;

    // ambient rain: the wash is the dominant "overall downpour" sound (see
    // PRECIP_BEDS), with playRainDrop's individually-filtered transients
    // layered on top as texture. It used to be completely static -- a
    // fixed-level noise source through a fixed filter has zero movement at
    // all, which is exactly what read as "a block of sound" instead of
    // rain. Two slow, independent LFOs now modulate it: one swells the
    // overall level (gusts of heavier/lighter rain passing through, ~11s
    // period), the other wanders the filter cutoff (a shifting timbre,
    // ~17s period, deliberately not a clean multiple of the swell so they
    // drift in and out of phase with each other instead of locking into a
    // repeating pattern).
    var rainWashSrc = ctx.createBufferSource();
    rainWashSrc.buffer = noiseBuf;
    rainWashSrc.loop = true;
    var rainWashFilter = ctx.createBiquadFilter();
    rainWashFilter.type = 'lowpass';
    rainWashFilter.frequency.value = 1500;

    var rainWashTiltLfo = ctx.createOscillator();
    rainWashTiltLfo.frequency.value = 1 / 17;
    var rainWashTiltLfoGain = ctx.createGain();
    rainWashTiltLfoGain.gain.value = 500;
    rainWashTiltLfo.connect(rainWashTiltLfoGain);
    rainWashTiltLfoGain.connect(rainWashFilter.frequency);
    rainWashTiltLfo.start();

    var rainSwell = ctx.createGain();
    rainSwell.gain.value = 1;
    var rainSwellLfo = ctx.createOscillator();
    rainSwellLfo.frequency.value = 1 / 11;
    var rainSwellLfoGain = ctx.createGain();
    rainSwellLfoGain.gain.value = 0.35;
    rainSwellLfo.connect(rainSwellLfoGain);
    rainSwellLfoGain.connect(rainSwell.gain);
    rainSwellLfo.start();

    engine.rainWashGain = ctx.createGain();
    engine.rainWashGain.gain.value = 0;
    rainWashSrc.connect(rainWashFilter);
    rainWashFilter.connect(rainSwell);
    rainSwell.connect(engine.rainWashGain);
    engine.rainWashGain.connect(engine.rainBus);
    rainWashSrc.start();

    engine.rainDropGain = ctx.createGain();
    engine.rainDropGain.gain.value = 0;
    engine.rainDropGain.connect(engine.rainBus);

    // Rain -- mist: a second, gentler downpour layer underneath the wash --
    // lower-passed (900Hz vs the wash's 1500Hz) and no filter-tilt LFO, just
    // a slow soft swell, so it reads as a steadier, quieter continuous hush
    // rather than another textured layer. Added because the drop transients
    // alone were reading as individual "taps" rather than rainfall -- this
    // gives the ear more continuous rain to land on between drops.
    var mistSrc = ctx.createBufferSource();
    mistSrc.buffer = noiseBuf;
    mistSrc.loop = true;
    var mistFilter = ctx.createBiquadFilter();
    mistFilter.type = 'lowpass';
    mistFilter.frequency.value = 900;
    var mistSwell = ctx.createGain();
    mistSwell.gain.value = 1;
    var mistSwellLfo = ctx.createOscillator();
    mistSwellLfo.frequency.value = 1 / 13;
    var mistSwellLfoGain = ctx.createGain();
    mistSwellLfoGain.gain.value = 0.2;
    mistSwellLfo.connect(mistSwellLfoGain);
    mistSwellLfoGain.connect(mistSwell.gain);
    mistSwellLfo.start();
    engine.rainMistGain = ctx.createGain();
    engine.rainMistGain.gain.value = 0;
    mistSrc.connect(mistFilter);
    mistFilter.connect(mistSwell);
    mistSwell.connect(engine.rainMistGain);
    engine.rainMistGain.connect(engine.rainBus);
    mistSrc.start();

    // Precipitation/atmosphere beds -- all created once, at gain 0, and
    // simply faded up/down by applyPrecip()/applyAtmosphere() when either
    // state changes. Far simpler and more robust than tearing down and
    // rebuilding audio graphs on every switch. Continuous beds live here;
    // one-shot events (birds, traffic, thunder, fire, crickets) are
    // scheduled from scheduler() and just check engine.precipitation /
    // engine.atmosphere.

    // Cityscape -- AC hum: a low, steady electrical drone.
    var acHumOsc = ctx.createOscillator();
    acHumOsc.type = 'sawtooth';
    acHumOsc.frequency.value = 59.5;
    var acHumFilter = ctx.createBiquadFilter();
    acHumFilter.type = 'lowpass';
    acHumFilter.frequency.value = 220;
    engine.acHumGain = ctx.createGain();
    engine.acHumGain.gain.value = 0;
    acHumOsc.connect(acHumFilter);
    acHumFilter.connect(engine.acHumGain);
    engine.acHumGain.connect(engine.staticBus);
    acHumOsc.start();

    // Cityscape -- building hum: broader, softer filtered noise bed
    // underneath the AC hum (distant HVAC/traffic rumble, not any single
    // source).
    var buildingSrc = ctx.createBufferSource();
    buildingSrc.buffer = pinkBuf;
    buildingSrc.loop = true;
    var buildingFilter = ctx.createBiquadFilter();
    buildingFilter.type = 'lowpass';
    buildingFilter.frequency.value = 650;
    engine.buildingHumGain = ctx.createGain();
    engine.buildingHumGain.gain.value = 0;
    buildingSrc.connect(buildingFilter);
    buildingFilter.connect(engine.buildingHumGain);
    engine.buildingHumGain.connect(engine.staticBus);
    buildingSrc.start();

    // Cityscape -- traffic rumble: a continuous distant-highway drone
    // underneath the occasional playTrafficPass car, low and broad with a
    // slow level wander so it's not perfectly flat.
    var trafficRumbleSrc = ctx.createBufferSource();
    trafficRumbleSrc.buffer = pinkBuf;
    trafficRumbleSrc.loop = true;
    var trafficRumbleFilter = ctx.createBiquadFilter();
    trafficRumbleFilter.type = 'lowpass';
    trafficRumbleFilter.frequency.value = 300;
    var trafficRumbleSwell = ctx.createGain();
    trafficRumbleSwell.gain.value = 1;
    var trafficRumbleLfo = ctx.createOscillator();
    trafficRumbleLfo.frequency.value = 1 / 9;
    var trafficRumbleLfoGain = ctx.createGain();
    trafficRumbleLfoGain.gain.value = 0.25;
    trafficRumbleLfo.connect(trafficRumbleLfoGain);
    trafficRumbleLfoGain.connect(trafficRumbleSwell.gain);
    trafficRumbleLfo.start();
    engine.trafficRumbleGain = ctx.createGain();
    engine.trafficRumbleGain.gain.value = 0;
    trafficRumbleSrc.connect(trafficRumbleFilter);
    trafficRumbleFilter.connect(trafficRumbleSwell);
    trafficRumbleSwell.connect(engine.trafficRumbleGain);
    engine.trafficRumbleGain.connect(engine.staticBus);
    trafficRumbleSrc.start();

    // Cityscape -- mumble: soft, indistinct voices. A vocal-range bandpass
    // with its own slow-wandering center frequency plus a slower amplitude
    // waver stands in for murmuring conversation without any single
    // recognizable word or pitch.
    var mumbleSrc = ctx.createBufferSource();
    mumbleSrc.buffer = noiseBuf;
    mumbleSrc.loop = true;
    var mumbleFilter = ctx.createBiquadFilter();
    mumbleFilter.type = 'bandpass';
    mumbleFilter.frequency.value = 550;
    mumbleFilter.Q.value = 1.4;
    var mumbleFilterLfo = ctx.createOscillator();
    mumbleFilterLfo.frequency.value = 1 / 3.3;
    var mumbleFilterLfoGain = ctx.createGain();
    mumbleFilterLfoGain.gain.value = 220;
    mumbleFilterLfo.connect(mumbleFilterLfoGain);
    mumbleFilterLfoGain.connect(mumbleFilter.frequency);
    mumbleFilterLfo.start();
    var mumbleWaver = ctx.createGain();
    mumbleWaver.gain.value = 1;
    var mumbleWaverLfo = ctx.createOscillator();
    mumbleWaverLfo.frequency.value = 1 / 1.7;
    var mumbleWaverLfoGain = ctx.createGain();
    mumbleWaverLfoGain.gain.value = 0.4;
    mumbleWaverLfo.connect(mumbleWaverLfoGain);
    mumbleWaverLfoGain.connect(mumbleWaver.gain);
    mumbleWaverLfo.start();
    engine.mumbleGain = ctx.createGain();
    engine.mumbleGain.gain.value = 0;
    mumbleSrc.connect(mumbleFilter);
    mumbleFilter.connect(mumbleWaver);
    mumbleWaver.connect(engine.mumbleGain);
    engine.mumbleGain.connect(engine.staticBus);
    mumbleSrc.start();

    // Forest -- wind + leaves: redesigned as a continuous broadband rustle
    // (same architecture as the rain wash -- a filter-tilt LFO plus an
    // independent swell LFO on non-aligned periods) instead of a narrow
    // bandpass sweep, so it reads as steady wind through leaves rather than
    // a "sudden" gust. Tuned brighter/broader than rain's wash (rustling
    // leaves sit higher in the spectrum than a downpour).
    var forestWindSrc = ctx.createBufferSource();
    forestWindSrc.buffer = noiseBuf;
    forestWindSrc.loop = true;
    var forestWindFilter = ctx.createBiquadFilter();
    forestWindFilter.type = 'bandpass';
    forestWindFilter.frequency.value = 2600;
    // Narrowed (was 0.6) -- a low Q here spreads real energy well outside
    // the ~1900-3300Hz sweep range, which was part of what buried the twig
    // snaps even after moving their own band lower.
    forestWindFilter.Q.value = 1.1;
    var forestWindTiltLfo = ctx.createOscillator();
    forestWindTiltLfo.frequency.value = 1 / 9;
    var forestWindTiltLfoGain = ctx.createGain();
    forestWindTiltLfoGain.gain.value = 700;
    forestWindTiltLfo.connect(forestWindTiltLfoGain);
    forestWindTiltLfoGain.connect(forestWindFilter.frequency);
    forestWindTiltLfo.start();
    var forestWindSwell = ctx.createGain();
    forestWindSwell.gain.value = 1;
    var forestWindSwellLfo = ctx.createOscillator();
    forestWindSwellLfo.frequency.value = 1 / 13;
    var forestWindSwellLfoGain = ctx.createGain();
    forestWindSwellLfoGain.gain.value = 0.3;
    forestWindSwellLfo.connect(forestWindSwellLfoGain);
    forestWindSwellLfoGain.connect(forestWindSwell.gain);
    forestWindSwellLfo.start();
    engine.forestWindGain = ctx.createGain();
    engine.forestWindGain.gain.value = 0;
    forestWindSrc.connect(forestWindFilter);
    forestWindFilter.connect(forestWindSwell);
    forestWindSwell.connect(engine.forestWindGain);
    engine.forestWindGain.connect(engine.staticBus);
    forestWindSrc.start();

    // Ocean -- waves: filtered noise with a slow rhythmic amplitude swell
    // (~7s period) instead of a flat level, so it actually pulses like surf.
    var oceanSrc = ctx.createBufferSource();
    oceanSrc.buffer = noiseBuf;
    oceanSrc.loop = true;
    var oceanFilter = ctx.createBiquadFilter();
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 700;
    var oceanSwell = ctx.createGain();
    oceanSwell.gain.value = 1;
    var oceanSwellLfo = ctx.createOscillator();
    oceanSwellLfo.frequency.value = 1 / 7;
    var oceanSwellLfoGain = ctx.createGain();
    oceanSwellLfoGain.gain.value = 0.55;
    oceanSwellLfo.connect(oceanSwellLfoGain);
    oceanSwellLfoGain.connect(oceanSwell.gain);
    engine.oceanWaveGain = ctx.createGain();
    engine.oceanWaveGain.gain.value = 0;
    oceanSrc.connect(oceanFilter);
    oceanFilter.connect(oceanSwell);
    oceanSwell.connect(engine.oceanWaveGain);
    engine.oceanWaveGain.connect(engine.staticBus);
    oceanSrc.start();
    oceanSwellLfo.start();

    // Ocean -- wind: same idea as the forest wind bed, tuned brighter/more
    // open (ocean wind reads less "rustly" than wind through trees).
    var oceanWindSrc = ctx.createBufferSource();
    oceanWindSrc.buffer = noiseBuf;
    oceanWindSrc.loop = true;
    var oceanWindFilter = ctx.createBiquadFilter();
    oceanWindFilter.type = 'bandpass';
    oceanWindFilter.frequency.value = 900;
    oceanWindFilter.Q.value = 0.5;
    engine.oceanWindGain = ctx.createGain();
    engine.oceanWindGain.gain.value = 0;
    oceanWindSrc.connect(oceanWindFilter);
    oceanWindFilter.connect(engine.oceanWindGain);
    engine.oceanWindGain.connect(engine.staticBus);
    oceanWindSrc.start();

    // Fireplace -- a warm low rumble bed with a slow irregular flicker on
    // its amplitude (two detuned LFOs summed, so the flutter doesn't lock
    // into an obviously repeating pattern) standing in for a flame's
    // constant small movement. Crackle/pop one-shots (playFireCrackle) sit
    // on top, scheduled from scheduler().
    var fireSrc = ctx.createBufferSource();
    fireSrc.buffer = noiseBuf;
    fireSrc.loop = true;
    var fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 320;
    var fireFlicker = ctx.createGain();
    fireFlicker.gain.value = 1;
    var fireFlickerLfo1 = ctx.createOscillator();
    fireFlickerLfo1.frequency.value = 0.6;
    var fireFlickerLfo1Gain = ctx.createGain();
    fireFlickerLfo1Gain.gain.value = 0.18;
    var fireFlickerLfo2 = ctx.createOscillator();
    fireFlickerLfo2.frequency.value = 1.7;
    var fireFlickerLfo2Gain = ctx.createGain();
    fireFlickerLfo2Gain.gain.value = 0.12;
    fireFlickerLfo1.connect(fireFlickerLfo1Gain);
    fireFlickerLfo1Gain.connect(fireFlicker.gain);
    fireFlickerLfo2.connect(fireFlickerLfo2Gain);
    fireFlickerLfo2Gain.connect(fireFlicker.gain);
    engine.fireplaceGain = ctx.createGain();
    engine.fireplaceGain.gain.value = 0;
    fireSrc.connect(fireFilter);
    fireFilter.connect(fireFlicker);
    fireFlicker.connect(engine.fireplaceGain);
    engine.fireplaceGain.connect(engine.staticBus);
    fireSrc.start();
    fireFlickerLfo1.start();
    fireFlickerLfo2.start();

    loadDrumSamples(ctx);
    loadPianoSamples(ctx);
  }

  function base64ToArrayBuffer(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  // Decoding is async; if a hit fires before its buffer is ready, it's just
  // silently skipped that one time (the samples are small enough this is
  // only a possible issue for the very first hit or two).
  function loadDrumSamples(ctx) {
    ['kick', 'snare', 'hat'].forEach(function (name) {
      var bytes = base64ToArrayBuffer(window.DRUM_SAMPLES_B64[name]);
      ctx.decodeAudioData(bytes, function (buffer) {
        engine.drumBuffers[name] = buffer;
      }, function () {});
    });
  }

  function loadPianoSamples(ctx) {
    PIANO_SAMPLE_KEYS.forEach(function (key) {
      var bytes = base64ToArrayBuffer(window.PIANO_SAMPLES_B64[key]);
      ctx.decodeAudioData(bytes, function (buffer) {
        engine.pianoBuffers[key] = buffer;
      }, function () {});
    });
  }

  // Finds whichever of the 24 loaded samples is closest in pitch to the
  // target frequency (log-distance, so "closest" means musically closest,
  // not numerically closest in Hz). The caller pitch-shifts from there via
  // playbackRate.
  function findNearestPianoSample(targetFreq) {
    var best = null, bestDist = Infinity;
    for (var i = 0; i < PIANO_SAMPLE_KEYS.length; i++) {
      var key = PIANO_SAMPLE_KEYS[i];
      if (!engine.pianoBuffers[key]) continue;
      var dist = Math.abs(Math.log2(PIANO_SAMPLE_FREQS[key] / targetFreq));
      if (dist < bestDist) { bestDist = dist; best = key; }
    }
    return best;
  }

  function releaseVoices(now) {
    engine.activeVoices.forEach(function (v) {
      try {
        // `now` here is a lookahead-scheduled time slightly in the future,
        // not the actual current instant -- so `.value` (which reads the
        // real-time-interpolated level right now) is the WRONG anchor for
        // it. That mismatch was the once-per-bar hiccup: the ramp-down
        // snapped to a stale captured value instead of wherever the decay
        // curve would actually be at that future instant.
        // cancelAndHoldAtTime anchors correctly at the scheduled time
        // itself, computed from the curve, not read live.
        if (v.gain.gain.cancelAndHoldAtTime) {
          v.gain.gain.cancelAndHoldAtTime(now);
        } else {
          v.gain.gain.cancelScheduledValues(now);
        }
        // Lengthened (was 0.7s, then 1.3s) so the outgoing chord lingers
        // well into the new one's sustain instead of the two just brushing
        // past each other -- that's what was reading as a gap between
        // chords. The extra 20% here (1.3 -> 1.56) is part of a broader
        // softer/flowier pass across every note-playing voice: lower peak,
        // slower fall-off.
        v.gain.gain.linearRampToValueAtTime(0, now + 1.56);
        v.osc.stop(now + 1.61);
      } catch (e) {}
    });
    engine.activeVoices = [];
  }

  // Plays one voice from the sampled piano: finds the nearest real
  // recording to the target pitch and pitch-shifts it via playbackRate,
  // same technique their Tone.Sampler uses internally. No auto-release --
  // for chord voices, releaseVoices() (called at the next chord) handles
  // fading it out, same as their whole-bar sustain.
  function playPianoVoice(targetFreq, time, peakGain, detuneCents) {
    var key = findNearestPianoSample(targetFreq);
    if (!key) return null; // sample still decoding; skip this one voice
    var ctx = engine.ctx;
    var buf = engine.pianoBuffers[key];
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = targetFreq / PIANO_SAMPLE_FREQS[key];
    if (detuneCents) src.detune.value = detuneCents;
    // Slower and gentler than the melody's vibrato -- a "wobble" rather
    // than a vocal-style vibrato, since a whole chord doing the melody's
    // rate/depth would read as seasick rather than warm. Adds to the
    // static detuneCents spread above rather than replacing it.
    addVibrato(ctx, src, time, stepDuration() * 8, 4, 6);

    // Pulled back in from 90ms -- combined with the old chord's much
    // longer fade-out now (see releaseVoices), a slow attack on TOP of a
    // slow release meant neither chord was at real strength right at the
    // transition, which is what read as a gap. Still softer than the
    // original 20ms pluck, just not as slow as 90ms.
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.04);
    // Small decay-compensation ramp (was 1.25x -- pulled way back). At 1.25x
    // the chord swelling louder across its own lifetime was making it
    // increasingly dominate/clash with whatever the melody and harmony were
    // doing on top of it, and made melody gaps read as more noticeable
    // "pauses" by contrast with the growing chord underneath. This is a much
    // gentler nudge -- still offsets a little of the sample's natural decay
    // without the chord swelling enough to compete with the other voices.
    gain.gain.linearRampToValueAtTime(peakGain * 1.08, time + stepDuration() * 8);

    src.connect(gain);
    gain.connect(engine.chordBus);
    src.start(time);
    src.stop(time + 10); // safety net; normally cut earlier by releaseVoices

    return { osc: src, gain: gain };
  }

  // Root always at the same fixed register (no voice leading), upper
  // 3rd/5th/7th always stacked in that exact ascending order above it --
  // every voice starts at the same instant, no arpeggiation. There's no
  // separate bass instrument: the chord's own root, voiced low, IS the bass.
  //
  // The upper voices used to be shuffled into a random order before being
  // force-stacked ascending (each CHORD_TYPES entry is already sorted, e.g.
  // maj7 = [0, 4, 7, 11], so a shuffle like [7, 4, 11] needed +12 correction
  // on the out-of-order entries to restore ascending order -- pushing that
  // voice up an extra octave). That meant the chord's voicing SPAN varied
  // wildly and randomly from one chord to the next -- tight and compact one
  // time, spread across nearly 2 octaves the next, with zero relationship
  // between successive chords. That register unpredictability, not an
  // actual volume gap, is almost certainly the real "tension" -- lengthening
  // the amplitude crossfade twice already didn't fix it because the
  // amplitude was never the problem. Always using the natural (already
  // ascending) order gives every chord the same compact, consistent shape,
  // so successive chords differ only by their root, not their spread.
  function playChord(chord, time) {
    releaseVoices(time);
    var intervals = CHORD_TYPES[chord.def.t].intervals; // [0, 3rd, 5th, 7th], already ascending
    var rootFreq = CHORD_ROOT_HZ * Math.pow(2, chord.rootSemitone / 12);

    intervals.forEach(function (interval, idx) {
      var freq = rootFreq * Math.pow(2, interval / 12);
      var detuneCents = (idx - intervals.length / 2) * 4;
      // Small per-voice velocity variation (+/-8%) -- four notes hit at
      // exactly identical relative levels every single chord reads as
      // programmed; a real player's hand never lands perfectly even. The
      // *0.75 is the softer/flowier pass -- 25% quieter peak across every
      // note-playing voice, paired with a slower fall-off (see
      // releaseVoices/playLeadNote/playHarmonyNote/playArpNote).
      var peak = Math.max(0.86 - idx * 0.08, 0.4) * 0.75 * randRange(0.92, 1.0);
      var voice = playPianoVoice(freq, time, peak, detuneCents);
      if (voice) engine.activeVoices.push(voice);
    });
  }

  // Root/3rd/5th of the current chord (the plain triad, dropping the 7th),
  // stacked ascending, one octave above the chord bed -- the note pool the
  // arpeggio voice picks from. Always exactly 3 tones now.
  function arpTones(chord) {
    var baseIntervals = CHORD_TYPES[chord.def.t].intervals.slice(0, 3);
    var rootFreq = ARP_ROOT_HZ * Math.pow(2, chord.rootSemitone / 12);
    return baseIntervals.map(function (interval) {
      return rootFreq * Math.pow(2, interval / 12);
    });
  }

  // Short, plucked envelope -- deliberately NOT matching the melody's long
  // hold anymore. That earlier change made arp notes ring long enough to
  // overlap each other, which is what made it stop sounding like an
  // arpeggio at all (a cascade of distinct plucked notes) and start
  // sounding like a slow pad. Decay ends right at the note's own nominal
  // length, no stretch multiplier.
  function playArpNote(freq, time, dur) {
    var key = findNearestPianoSample(freq);
    if (!key) return;
    var ctx = engine.ctx;
    var buf = engine.pianoBuffers[key];
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = freq / PIANO_SAMPLE_FREQS[key];

    // Pulled way back and softened -- this used to be a distinct, plucky
    // lead voice (peak 0.85, near-instant 8ms attack); now it's meant to be
    // a faint texture sitting under everything else, not a voice competing
    // with the melody/harmony/chords for attention. Slower attack (20ms)
    // reads as a soft shimmer rather than a pluck. Peak down another 25%
    // (0.28 -> 0.21) and the decay window stretched 20% (dur -> dur*1.2),
    // same softer/flowier pass as the other note-playing voices.
    var decayEnd = dur * 1.2;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.21, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decayEnd);

    src.connect(gain);
    gain.connect(engine.arpBus);
    src.start(time);
    src.stop(time + decayEnd + 0.05);
  }

  // Plays the chord's own root/3rd/5th as a 3-note run immediately
  // following the chord itself. Chords change every 2 beats (8 steps), so
  // there are exactly 3 off-beat 8th-note slots between one chord and the
  // next (steps 2, 4, 6 relative to the chord); one arp note lands on each
  // of those before the next chord arrives. Deterministic now -- it's
  // meant to be a fixed part of every chord ("connected to the chords"),
  // not a coin flip; the quiet/soft envelope above is what keeps it from
  // competing with the melody and harmony.
  function playArpBurst(chord, time) {
    var tones = arpTones(chord);
    var noteGap = stepDuration() * 2; // 8th note
    var dur = noteGap * 0.8;
    for (var i = 0; i < tones.length; i++) {
      playArpNote(tones[i], jitter(time + (i + 1) * noteGap, 3), dur);
    }
    engine.lastArpTime = time + tones.length * noteGap;
  }

  // A held note's own detune AudioParam is a-rate, so a slow oscillator
  // connected through a small gain (depth, in cents) is the standard way
  // to modulate pitch over time -- adds to whatever static detune the
  // voice already has (they sum, they don't fight). Depth eases in over
  // the first third of the note instead of being present from the attack,
  // since real vibrato onsets after a note has already spoken, not on it.
  function addVibrato(ctx, src, time, dur, rateHz, depthCents) {
    var lfo = ctx.createOscillator();
    lfo.frequency.value = rateHz;
    var lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, time);
    lfoGain.gain.linearRampToValueAtTime(depthCents, time + dur * 0.3);
    lfo.connect(lfoGain);
    lfoGain.connect(src.detune);
    lfo.start(time);
    lfo.stop(time + dur + 0.3);
  }

  function playLeadNote(freq, time, dur) {
    var key = findNearestPianoSample(freq);
    if (!key) return;
    var ctx = engine.ctx;
    var buf = engine.pianoBuffers[key];
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = freq / PIANO_SAMPLE_FREQS[key];
    addVibrato(ctx, src, time, dur, 5.5, 10);

    // Real sustain now, not just a long release: the envelope used to
    // start decaying immediately after the attack, with only the release
    // TIME scaled by the note's length (release = dur*3.4). That's a
    // mistake with an exponential curve -- most of its perceived loudness
    // drops off within the first 20-30% of its own span regardless of how
    // long the span is, so even a half note was audibly fading well
    // before its own nominal length was up, reading as "held the same as
    // an 8th note, then silence." The gain now holds flat at peak (nothing
    // scheduled = no change) until the note's own nominal duration is over,
    // THEN decays -- so a long note is actually loud for its whole length,
    // not just its first fraction.
    //
    // Softer/flowier pass: peak down 25% (0.78 -> 0.585) and the fall-off
    // stretched 20% (3.4 -> 4.08) -- same idea across every note-playing
    // voice (chords, harmony, arp).
    var release = dur * 4.08;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    // +/-8% velocity variation, same idea as the chord voices.
    var peak = 0.585 * randRange(0.92, 1.0);
    gain.gain.linearRampToValueAtTime(peak, time + 0.05);
    gain.gain.setValueAtTime(peak, time + dur);
    gain.gain.exponentialRampToValueAtTime(0.001, time + release);

    src.connect(gain);
    gain.connect(engine.melodyBus);
    src.start(time);
    src.stop(time + release + 0.15);
  }

  // Quieter harmony voice, now treated the same way as the lead: no echo
  // send, just a long natural hold. Deliberately NOT an independent process:
  // its pitch is always computed FROM whatever the lead just played, not
  // generated on its own.
  function playHarmonyNote(freq, time, dur) {
    var key = findNearestPianoSample(freq);
    if (!key) return;
    var ctx = engine.ctx;
    var buf = engine.pianoBuffers[key];
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = freq / PIANO_SAMPLE_FREQS[key];
    addVibrato(ctx, src, time, dur, 5.2, 8);

    // Same sustain fix as the lead, plus the same small velocity variation
    // and the same softer/flowier peak/fall-off adjustment (0.42 -> 0.315,
    // 3.4 -> 4.08).
    var release = dur * 4.08;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    var peak = 0.315 * randRange(0.92, 1.0);
    gain.gain.linearRampToValueAtTime(peak, time + 0.06);
    gain.gain.setValueAtTime(peak, time + dur);
    gain.gain.exponentialRampToValueAtTime(0.001, time + release);

    src.connect(gain);
    gain.connect(engine.melodyBus);
    src.start(time);
    src.stop(time + release + 0.15);
  }

  // Weighted pick of how many scale steps to move, using MELODY_INTERVAL_WEIGHTS
  // sliced/renormalized to whatever room is actually available in that direction.
  function pickMelodyDistance(room) {
    var weights = MELODY_INTERVAL_WEIGHTS.slice(0, Math.max(1, room + 1));
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = Math.random() * sum;
    for (var i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  // Advance the persistent scale-position walk by a small (mostly single-step)
  // amount, same model as meel-hd/lofi-engine's melody: each note is defined
  // relative to the previous one, which is what keeps a random walk sounding
  // like a phrase instead of a string of unrelated pitches.
  function advanceMelodyWalk() {
    var maxIdx = WALK_SCALE.length - 1;
    var pos = engine.scalePos;
    var descendRoom = Math.min(pos, 7);
    var ascendRoom = Math.min(maxIdx - pos, 7);
    var descend = (descendRoom > 0 && ascendRoom > 0) ? Math.random() < 0.5 : descendRoom > 0;
    var dist = pickMelodyDistance(descend ? descendRoom : ascendRoom);
    // MELODY_INTERVAL_WEIGHTS[0] gives a ~10% chance of landing on distance
    // 0 -- the same scale degree repeating back to back. With melody firing
    // as often as it does now, that reads as "the same note plays twice in
    // a row" often enough to sound like a glitch rather than a deliberate
    // repeated note. Always forced to move at least 1 step instead.
    if (dist === 0) dist = 1;
    var newPos = pos + (descend ? -dist : dist);
    engine.scalePos = Math.max(0, Math.min(maxIdx, newPos));
    return engine.scalePos;
  }

  // Whether a WALK_SCALE position's pitch is one of the given chord's own
  // tones. Every CHORD_POOL chord is built from diatonic scale-degree
  // roots using the diatonic 7th-chord type for that degree, so its tones
  // are always themselves scale degrees -- every chord tone is guaranteed
  // to exist somewhere in WALK_SCALE, never an out-of-scale pitch.
  function isChordTone(walkIdx, chord) {
    var pitchClass = ((WALK_SCALE[walkIdx] + engine.transpose) % 12 + 12) % 12;
    var intervals = CHORD_TYPES[chord.def.t].intervals;
    for (var i = 0; i < intervals.length; i++) {
      if ((chord.rootSemitone + intervals[i]) % 12 === pitchClass) return true;
    }
    return false;
  }

  // The plain stepwise walk in advanceMelodyWalk has zero awareness of the
  // chord underneath -- it can land anywhere in the scale regardless of
  // what's harmonically happening, which is what read as "can't be
  // completely random, sounds pretty bad." Used for the first note of each
  // phrase (see playMelodyPhrase): instead of a random step, jump to
  // whichever chord tone is nearest the current position -- a melody
  // landing on a new gesture should usually agree with the harmony
  // underneath. Later notes within the same phrase still use the plain
  // walk as passing tones connecting one chord-tone landing to the next.
  function advanceMelodyWalkToChordTone() {
    var chord = engine.currentChord;
    if (!chord) return advanceMelodyWalk();

    var maxIdx = WALK_SCALE.length - 1;
    var pos = engine.scalePos;
    // Starts the search at d=1, not d=0 -- searching from 0 meant that if
    // the CURRENT position already happened to be a tone of the new chord,
    // it returned immediately with no movement at all, letting the first
    // note of a phrase land on the exact same pitch as wherever the
    // previous phrase left off.
    // Capped at 4 scale steps -- searching all the way to maxIdx meant that
    // in the worst case (the nearest matching chord tone happens to be far
    // from wherever the melody currently sits) it could leap most of the
    // scale's range in one jump. If nothing turns up within 4 steps, fall
    // back to the ordinary small-step walk instead of reaching further --
    // staying close to the previous note takes priority over exactly
    // matching the chord tone every time.
    var maxJump = 4;
    for (var d = 1; d <= maxJump; d++) {
      var up = pos + d;
      if (up <= maxIdx && isChordTone(up, chord)) { engine.scalePos = up; return up; }
      var down = pos - d;
      if (down >= 0 && isChordTone(down, chord)) { engine.scalePos = down; return down; }
    }
    return advanceMelodyWalk();
  }

  function pickMelodySubdivision() {
    var roll = Math.random();
    var cumulative = 0;
    for (var i = 0; i < MELODY_SUBDIVISIONS.length; i++) {
      cumulative += MELODY_SUBDIVISION_WEIGHTS[i];
      if (roll < cumulative) return MELODY_SUBDIVISIONS[i];
    }
    return MELODY_SUBDIVISIONS[MELODY_SUBDIVISIONS.length - 1];
  }

  // Picks a rhythm value, then plays it `repeats` times -- a NEW pitch
  // each repeat, spaced `steps` 16th-note steps apart. Since repeats*steps
  // is 8 (2 beats) for every entry in MELODY_SUBDIVISIONS, every phrase
  // occupies the same span whether it ends up as 1 half note, 2 quarters,
  // 4 eighths, or 8 sixteenths -- so phrases always land back on a clean
  // beat by construction, no separate alignment logic needed.
  //
  // The phrase's first note lands on the current chord's nearest tone
  // (advanceMelodyWalkToChordTone) instead of a plain random step -- every
  // note after that within the phrase is the ordinary stepwise walk,
  // acting as passing tones between one chord-tone landing and the next.
  //
  // Every slot in a phrase is otherwise perfectly even (fixed length,
  // fixed spacing), which is exactly what reads as mechanical/quantized.
  // An 8th-note slot has a 25% chance of splitting into 2 fast 16th notes
  // instead of playing as one -- introduces real rhythmic unpredictability
  // without touching the phrase's overall length or beat alignment, since
  // the slot still takes exactly one 8th note's worth of time either way.
  function playMelodyPhrase(time) {
    var maxIdx = WALK_SCALE.length - 1;
    var subdiv = pickMelodySubdivision();
    var noteGap = stepDuration() * subdiv.steps;
    var noteLen = noteGap * 0.95;
    var cursor = time;
    var firstNote = true;

    function playOneNote(t, dur, allowHarmony) {
      var pos = firstNote ? advanceMelodyWalkToChordTone() : advanceMelodyWalk();
      firstNote = false;
      var freq = LEAD_ROOT_HZ * Math.pow(2, (WALK_SCALE[pos] + engine.transpose) / 12);
      playLeadNote(freq, t, dur);

      // Parallel-thirds harmony: two scale steps below the note just
      // picked (or above, if there's no room below) -- always derived FROM
      // the lead note, not its own independent walk. Also skipped if an
      // arp note fired very recently, since harmony notes ring for a
      // while and a fresh one could land right on an arp note.
      var arpRecentlyFired = engine.lastArpTime != null && (time - engine.lastArpTime) < stepDuration() * 2;
      if (allowHarmony && !arpRecentlyFired && Math.random() < engine.harmonyDensity) {
        var hPos = pos - 2 >= 0 ? pos - 2 : pos + 2;
        hPos = Math.max(0, Math.min(maxIdx, hPos));
        var hFreq = LEAD_ROOT_HZ * Math.pow(2, (WALK_SCALE[hPos] + engine.transpose) / 12);
        playHarmonyNote(hFreq, t, dur);
      }
    }

    for (var i = 0; i < subdiv.repeats; i++) {
      if (subdiv.steps === 2 && Math.random() < 0.25) {
        var halfGap = noteGap / 2;
        playOneNote(jitter(cursor, 3), halfGap * 0.95, false);
        playOneNote(jitter(cursor + halfGap, 3), halfGap * 0.95, false);
      } else {
        // Harmony only for the two slower values (half/quarter, repeats <=
        // 2) -- harmonizing every note of an eighth or 16th-note phrase
        // would be way too busy.
        playOneNote(jitter(cursor, subdiv.steps === 1 ? 2 : 4), noteLen, subdiv.repeats <= 2);
      }
      cursor += noteGap;
    }

    engine.lastMelodyTime = time;
    engine.melodyBusyUntil = time + subdiv.repeats * noteGap;
  }

  // Called once per 8th-note step, but only if the melody isn't still
  // finishing a previous phrase -- since every phrase spans exactly 2
  // beats (see playMelodyPhrase) and decisions are only made on 8th-note-
  // aligned steps, melodyBusyUntil always lands back on an 8th-note-aligned
  // step too, so this never misses a cycle once it's eligible again.
  //
  // Continuous now -- no density roll. The described process is "pick a
  // note+pitch, play it out, then immediately pick the next," with no
  // "maybe skip this turn" step in it. A density gate here meant a phrase
  // could fail to start on its first eligible check and then keep failing
  // for several more 8th-note checks in a row before finally landing one,
  // which is exactly what read as "sometimes a pretty big gap."
  function maybeMelodyNote(time) {
    if (time < engine.melodyBusyUntil) return;
    playMelodyPhrase(time);
  }

  // Plays a decoded drum sample through the same filter/gain chain their
  // Tone.Sampler uses (Kick/Snare/Hat.ts), truncated to a short one-shot
  // window regardless of the source file's actual length.
  function playSampledDrum(name, time, gain0to1, filterHz, dur) {
    var buf = engine.drumBuffers[name];
    if (!buf) return; // sample still decoding; skip this one hit
    var ctx = engine.ctx;
    var src = ctx.createBufferSource();
    src.buffer = buf;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(gain0to1, time);
    gain.gain.linearRampToValueAtTime(0, time + dur);

    if (filterHz) {
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterHz;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(engine.drumBus);
    src.start(time);
    src.stop(time + dur + 0.05);
  }

  // "Soft" of the beat's soft/loud pair -- plays on every on-beat position.
  // Base gain unchanged (0.85); the muting is purely tonal -- a 900Hz
  // lowpass strips the clicky attack down to a dampened thump, and the
  // tail is shortened so it doesn't ring on. Velocity varies slightly hit
  // to hit (+/-12%) instead of every single kick landing at the exact same
  // level -- a real player never hits with perfectly identical force.
  function playKick(time) {
    playSampledDrum('kick', time, 0.85 * randRange(0.88, 1.0), 900, 0.24);
  }

  // Pulled down further (0.4 -> 0.28 gain, 2000 -> 1400Hz lowpass, 0.28 ->
  // 0.24s tail to match the kick) -- now that beats can split into 2-3
  // quick hits, a stack of snares at the old brighter/louder setting
  // compounded into something noticeably sharper and louder than the
  // kick's fills, instead of the two feeling like the same kind of drum.
  // Same small velocity variation as the kick.
  function playSnare(time) {
    playSampledDrum('snare', time, 0.28 * randRange(0.88, 1.0), 1400, 0.24);
  }

  // Every drum beat is otherwise a single quarter-note hit -- occasionally
  // splits it into a faster subdivision instead: 75% plays normally, 15%
  // splits into 2 eighth notes, 10% splits into an eighth note followed by
  // 2 sixteenth notes. Reuses the same instrument (playFn) for every hit in
  // the split, so it reads as a fill within that beat rather than an
  // unrelated extra hit landing somewhere the pattern doesn't otherwise
  // touch (the standalone off-beat ghost hit this replaced had no
  // supporting context, which is what made it sound wrong on its own).
  //
  // allowSplit lets a caller force the plain single hit regardless of the
  // roll -- used for the beat right before the pattern's always-silent
  // beat 8 (see scheduleStep), since a busy split filling right up to the
  // edge of an already-silent beat reads as an abrupt empty gap rather
  // than the intended quiet breath.
  // Every hit also gets a few ms of micro-timing jitter -- drums used to
  // land exactly on the scheduled grid instant with zero variation at all,
  // which is part of what read as too perfectly aligned/mechanical.
  function playDrumBeat(playFn, time, allowSplit) {
    var roll = Math.random();
    var eighthGap = stepDuration() * 2;
    if (!allowSplit || roll < 0.75) {
      playFn(jitter(time, 4));
    } else if (roll < 0.9) {
      playFn(jitter(time, 4));
      playFn(jitter(time + eighthGap, 4));
    } else {
      var sixteenthGap = stepDuration();
      playFn(jitter(time, 4));
      playFn(jitter(time + eighthGap, 4));
      playFn(jitter(time + eighthGap + sixteenthGap, 4));
    }
  }

  // Real vinyl crackle reads as a dense, irregular stream of mostly-tiny
  // ticks with the occasional bigger pop standing out among them -- not a
  // uniform hiss. ~15% of ticks are a "big" pop (louder, slightly longer);
  // the rest are much smaller. Scheduled on its own irregular clock in
  // scheduler(), not tied to the musical grid at all -- vinyl noise has no
  // relationship to the tempo.
  function playCrackleTick(time) {
    var ctx = engine.ctx;
    var noise = ctx.createBufferSource();
    noise.buffer = engine.crackleNoiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = randRange(1000, 5000);
    filter.Q.value = randRange(1, 3);
    var big = Math.random() < 0.15;
    // Turned down (was 0.09-0.14 / 0.02-0.05) -- character was fine, just
    // too loud overall.
    var peak = big ? randRange(0.06, 0.09) : randRange(0.012, 0.03);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (big ? randRange(0.02, 0.04) : randRange(0.01, 0.025)));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(engine.vinylBus);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  function playRainDrop(time) {
    var ctx = engine.ctx;
    var noise = ctx.createBufferSource();
    noise.buffer = engine.crackleNoiseBuffer;
    // Switched from a resonant bandpass to a highpass -- lowering Q wasn't
    // enough. ANY bandpass mode has some peak/ring character around its
    // center frequency, and that ring-down interacting with the amplitude
    // decay is very likely what read as an elastic, "sticky"/suction
    // quality rather than a clean transient tick. A highpass has no
    // resonant peak at all (Q here is a neutral ~0.7, no bump) -- it just
    // thins out the low end and leaves genuine broadband noise on top,
    // closer to what an actual droplet impact sounds like.
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = randRange(2200, 5000);
    filter.Q.value = 0.7;
    var gain = ctx.createGain();
    var peak = randRange(0.35, 0.7);
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + randRange(0.02, 0.05));
    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    noise.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = randRange(-0.85, 0.85);
      gain.connect(panner);
      panner.connect(engine.rainDropGain);
    } else {
      gain.connect(engine.rainDropGain);
    }
    noise.start(time);
    noise.stop(time + 0.08);
  }

  // Forest -- a twig snap: a sharp, dry, higher-pitched crack than the
  // fireplace's wood pop (playFireCrackle) -- occasional texture on top of
  // the continuous wind+leaves wash, standing in for something shifting
  // underfoot or a branch settling.
  function playTwigSnap(time) {
    var ctx = engine.ctx;
    var noise = ctx.createBufferSource();
    noise.buffer = engine.crackleNoiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Moved down (was 1200-3200Hz, same range as the wind bed's ~1900-
    // 3300Hz sweep) -- it was landing right inside the wind's own band and
    // getting absorbed into it instead of standing out. Q tightened (was
    // 1-2) for a narrower, crisper crack that contrasts with the wind's
    // broad whoosh rather than blending into more of the same texture.
    filter.frequency.value = randRange(600, 1500);
    filter.Q.value = randRange(3, 5);
    // Boosted again (was 0.14-0.22) and held a touch longer for audibility.
    var peak = randRange(0.2, 0.3);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + randRange(0.03, 0.06));
    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    noise.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = randRange(-0.8, 0.8);
      gain.connect(panner);
      panner.connect(engine.staticBus);
    } else {
      gain.connect(engine.staticBus);
    }
    noise.start(time);
    noise.stop(time + 0.08);
  }

  // Cityscape -- a car passing: a bandpass sweeping up then back down over
  // a few seconds, panned across the stereo field, is what actually reads
  // as something moving past rather than a static engine drone.
  function playTrafficPass(time) {
    var ctx = engine.ctx;
    var noise = ctx.createBufferSource();
    noise.buffer = engine.crackleNoiseBuffer;
    noise.loop = true;
    var dur = randRange(2.2, 4.5);
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(220, time);
    filter.frequency.linearRampToValueAtTime(650, time + dur * 0.45);
    filter.frequency.linearRampToValueAtTime(180, time + dur);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    // Boosted (was 0.09) -- wanted the actual cars to read as the
    // foreground event over the hum/rumble beds, not another texture layer.
    gain.gain.linearRampToValueAtTime(0.16, time + dur * 0.3);
    gain.gain.linearRampToValueAtTime(0, time + dur);
    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    noise.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = randRange(-1, 1);
      gain.connect(panner);
      panner.connect(engine.staticBus);
    } else {
      gain.connect(engine.staticBus);
    }
    noise.start(time);
    noise.stop(time + dur + 0.05);
  }

  // Fireplace -- a single wood pop: like playCrackleTick but pitched lower
  // and given a touch more body, since a fire's pops read heavier and less
  // brittle than vinyl surface noise. Peaks and "big pop" odds both bumped
  // up from the original tuning -- wanted more crackling presence overall.
  function playFireCrackle(time) {
    var ctx = engine.ctx;
    var noise = ctx.createBufferSource();
    noise.buffer = engine.crackleNoiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = randRange(400, 1600);
    filter.Q.value = randRange(1, 2.5);
    var big = Math.random() < 0.32;
    var peak = big ? randRange(0.14, 0.22) : randRange(0.03, 0.07);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (big ? randRange(0.05, 0.09) : randRange(0.02, 0.045)));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(engine.staticBus);
    noise.start(time);
    noise.stop(time + 0.12);
  }

  // Thunderstorm -- a rare, heavy low-frequency rumble: a lowpass cutoff
  // that starts relatively open and sinks toward sub-bass over a few
  // seconds, giving it a rolling "distant boom trailing off" quality.
  function playThunderClap(time) {
    var ctx = engine.ctx;
    var noise = ctx.createBufferSource();
    noise.buffer = engine.crackleNoiseBuffer;
    noise.loop = true;
    var dur = randRange(2.5, 4.5);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Opened up (was 180-320Hz) for a sharper initial crack before it
    // rolls down into the low rumble -- 180-320Hz alone stayed muffled the
    // whole time, contributing to it barely being heard.
    filter.frequency.setValueAtTime(randRange(280, 450), time);
    filter.frequency.exponentialRampToValueAtTime(70, time + 2.5);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    // Peak more than doubled (0.5 -> 1.1) and the attack sharpened (0.15s
    // -> 0.08s) -- it needs to read as a real event competing with
    // everything else, not a background rumble you might not notice.
    gain.gain.linearRampToValueAtTime(1.1, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(engine.rainBus);
    noise.start(time);
    noise.stop(time + dur + 0.1);
  }

  function stepDuration() {
    return 60 / engine.tempo / 4;
  }

  function scheduleStep(step, time) {
    // 8th-note swing (their Transport.swing = 1): the "off" 8th note in
    // each beat -- step 2 of every 4 -- lands late instead of dead on the
    // grid. This is what actually gives lofi hip-hop its loose, structured
    // feel instead of sounding quantized; dropping it in the rewrite was
    // part of why the beat felt off.
    var swung = step % 4 === 2;
    var t = swung ? time + engine.swing * stepDuration() : time;

    if (step === 0) {
      engine.currentBar++;

      if (engine.currentBar >= engine.nextRegenBar) {
        engine.transpose = rand(TRANSPOSES);
        engine.nextRegenBar = engine.currentBar + rand(REGEN_BAR_OPTIONS);
      }

      triggerChordChange(time);
    }

    // Chord changes every 2 beats -- this is the second change within the
    // bar, at the halfway point (step 8 of 16). Chord choice itself is a
    // live, ongoing decision (see triggerChordChange/pickNextChordIndex),
    // not indexed into a pre-generated sequence, so there's no progression
    // bookkeeping here anymore -- just call it.
    if (step === 8) {
      triggerChordChange(time);
    }

    // An 8-BEAT measure, not 8 eighth-notes in one bar -- it spans two of
    // this engine's 4-beat/16-step bars. Soft (kick) lands on beats
    // 1/3/5/7 of that measure: steps 0 and 8 of BOTH bars, which is exactly
    // where the chord already changes (every 2 beats), so kick and chord
    // genuinely coincide every time. Louder (snare) lands on beats 2/4/6:
    // step 4 of both bars, plus step 12 of only the first bar. Beat 8 --
    // step 12 of the second bar -- is silent, a deliberate breath before
    // the 2-bar measure repeats. Tempo/subdivision speed is unchanged;
    // only the measure length and where the accents fall within it.
    var evenBar = engine.currentBar % 2 === 0;
    // The kick at step 8 of the odd bar is beat 7 -- the beat immediately
    // before the always-silent beat 8 (step 12, odd bar) -- so it never
    // splits, keeping a clean lead-in into that intentional breath.
    if (step === 0 || step === 8) playDrumBeat(playKick, time, !(step === 8 && !evenBar));
    if (step === 4 || (step === 12 && evenBar)) playDrumBeat(playSnare, time, true);

    // The arpeggio is no longer scheduled here -- it fires as a deterministic
    // burst right after each chord change instead (see playArpBurst, called
    // from triggerChordChange), so it doesn't need a per-step check anymore.
    //
    // Anchored to the unswung `time`, not `t` -- swing is meant as a small
    // single-note nudge on the off-8th-note, but a melody phrase now spans
    // a full 2 beats (see playMelodyPhrase), and every note inside that
    // phrase is computed as an offset from its start time. Starting a
    // phrase from the swung `t` meant the swing offset (~0.1s at this
    // tempo) got baked into every note for the whole phrase, not just one,
    // permanently detaching it from the drums' true beat grid until the
    // phrase ended -- that's what read as "misstimed from the drums."
    if (step % 2 === 0) maybeMelodyNote(time);
  }

  function scheduleUiUpdate(audioTime, fn) {
    var ctx = engine.ctx;
    var delayMs = Math.max(0, (audioTime - ctx.currentTime) * 1000);
    setTimeout(fn, delayMs);
  }

  function scheduler() {
    var ctx = engine.ctx;
    while (engine.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      scheduleStep(engine.currentStep, engine.nextNoteTime);
      engine.nextNoteTime += stepDuration();
      engine.currentStep = (engine.currentStep + 1) % STEPS_PER_BAR;
    }

    // Every one-shot ambience event below runs on its own irregular clock,
    // not the musical grid -- real weather/wildlife/traffic isn't quantized
    // to the tempo, and locking any of these to 16th steps is what made an
    // earlier version of the rain read as a mechanical hiss instead of drops.

    // Vinyl crackle -- gated by its own toggle now (see els.vinyl). Real
    // crackle isn't quantized to the tempo, so it still gets its own
    // irregular clock instead of a per-16th-step dice roll.
    if (engine.vinylEnabled) {
      if (engine.nextCrackleTime == null || engine.nextCrackleTime < ctx.currentTime) {
        engine.nextCrackleTime = ctx.currentTime + 0.1;
      }
      while (engine.nextCrackleTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        playCrackleTick(engine.nextCrackleTime);
        engine.nextCrackleTime += randRange(0.06, 0.4);
      }
    }

    // Rain and thunder both use the rain wash/drop beds; thunder just runs
    // them denser (faster drops) on top of the louder gain applyPrecip()
    // already set. Precipitation and atmosphere are independent now, so
    // these checks no longer exclude each other.
    if (engine.precipitation === 'rain' || engine.precipitation === 'thunder') {
      var isThunder = engine.precipitation === 'thunder';
      if (engine.nextRainTime == null || engine.nextRainTime < ctx.currentTime) {
        engine.nextRainTime = ctx.currentTime + 0.02;
      }
      while (engine.nextRainTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        playRainDrop(engine.nextRainTime);
        engine.nextRainTime += isThunder ? randRange(0.02, 0.07) : randRange(0.035, 0.14);
      }
    }

    if (engine.precipitation === 'thunder') {
      if (engine.nextThunderTime == null || engine.nextThunderTime < ctx.currentTime) {
        engine.nextThunderTime = ctx.currentTime + randRange(6, 14);
      }
      while (engine.nextThunderTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        playThunderClap(engine.nextThunderTime);
        engine.nextThunderTime += randRange(14, 34);
      }
    }

    if (engine.atmosphere === 'cityscape') {
      // Tightened (was 4-11s gaps) -- cars needed to be a regular presence,
      // not a rare event, for Cityscape to actually read as traffic.
      if (engine.nextTrafficTime == null || engine.nextTrafficTime < ctx.currentTime) {
        engine.nextTrafficTime = ctx.currentTime + 1;
      }
      while (engine.nextTrafficTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        playTrafficPass(engine.nextTrafficTime);
        engine.nextTrafficTime += randRange(2.5, 6);
      }
    }

    if (engine.atmosphere === 'forest') {
      // Tightened (was 3-9s gaps) -- wanted it to show up sooner and more
      // often after landing right in the wind bed's frequency range made it
      // hard to catch at the old spacing.
      if (engine.nextTwigTime == null || engine.nextTwigTime < ctx.currentTime) {
        engine.nextTwigTime = ctx.currentTime + 1;
      }
      while (engine.nextTwigTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        playTwigSnap(engine.nextTwigTime);
        engine.nextTwigTime += randRange(2, 5);
      }
    }

    if (engine.atmosphere === 'fireplace') {
      // Bumped up (was 0.15-0.7s gaps) -- wanted more crackling presence.
      if (engine.nextFireTime == null || engine.nextFireTime < ctx.currentTime) {
        engine.nextFireTime = ctx.currentTime + 0.3;
      }
      while (engine.nextFireTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        playFireCrackle(engine.nextFireTime);
        engine.nextFireTime += randRange(0.08, 0.4);
      }
    }
  }

  function startMacroAutomation() {
    var ctx = engine.ctx;
    engine.macroLfo = ctx.createOscillator();
    engine.macroLfo.frequency.value = 1 / (16 * 60 / engine.tempo * 4);
    engine.macroLfoGain = ctx.createGain();
    engine.macroLfoGain.gain.value = 900;
    engine.masterFilter.frequency.value = 3400;
    engine.macroLfo.connect(engine.macroLfoGain);
    engine.macroLfoGain.connect(engine.masterFilter.frequency);
    engine.macroLfo.start();

    // Subtle volume breathing (~1dB) on breathGain, deliberately a much
    // slower and non-aligned period (37s, not a clean multiple of the
    // filter LFO above) so the two drift in and out of phase with each
    // other rather than moving in lockstep. Shouldn't be consciously
    // audible -- it just keeps the mix from sitting at a perfectly static
    // level the whole time.
    engine.breathLfo = ctx.createOscillator();
    engine.breathLfo.frequency.value = 1 / 37;
    engine.breathLfoGain = ctx.createGain();
    engine.breathLfoGain.gain.value = 0.12;
    engine.breathLfo.connect(engine.breathLfoGain);
    engine.breathLfoGain.connect(engine.breathGain.gain);
    engine.breathLfo.start();
  }

  function stopMacroAutomation() {
    if (engine.macroLfo) {
      try { engine.macroLfo.stop(); } catch (e) {}
      engine.macroLfo = null;
    }
    if (engine.breathLfo) {
      try { engine.breathLfo.stop(); } catch (e) {}
      engine.breathLfo = null;
    }
  }

  function fadeGainTo(gainNode, value, seconds) {
    var now = engine.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(value, now + seconds);
  }

  // Fades every persistent bed in a group to its target level for the given
  // state (0 for any bed that state doesn't use) and records the state.
  // One-shot events (birds, traffic, thunder, fire, crickets) aren't
  // touched here -- they just check engine.precipitation/engine.atmosphere
  // directly in scheduler(). Precipitation and atmosphere are independent
  // toggles, each with its own bed group, so setting one never fades the
  // other's beds.
  function applyPrecip(stateName) {
    engine.precipitation = stateName;
    if (!engine.ctx) return;
    var targets = PRECIP_BEDS[stateName] || {};
    PRECIP_BED_KEYS.forEach(function (key) {
      if (engine[key]) fadeGainTo(engine[key], targets[key] || 0, 0.9);
    });
  }

  function applyAtmosphere(stateName) {
    engine.atmosphere = stateName;
    if (!engine.ctx) return;
    var targets = ATMOSPHERE_BEDS[stateName] || {};
    ATMOSPHERE_BED_KEYS.forEach(function (key) {
      if (engine[key]) fadeGainTo(engine[key], targets[key] || 0, 0.9);
    });
  }

  function applyVinyl(enabled) {
    engine.vinylEnabled = enabled;
    if (!engine.ctx) return;
    fadeGainTo(engine.crackleGain, enabled ? CRACKLE_BASE_GAIN : 0, 0.4);
  }

  function startPlayback() {
    if (!engine.ctx) initEngine();
    if (engine.ctx.state === 'suspended') engine.ctx.resume();

    engine.currentStep = 0;
    engine.currentBar = -1;
    engine.nextNoteTime = engine.ctx.currentTime + 0.06;
    engine.nextRainTime = engine.ctx.currentTime + 0.05;
    engine.nextCrackleTime = null;
    engine.nextTrafficTime = null;
    engine.nextThunderTime = null;
    engine.nextFireTime = null;
    engine.nextTwigTime = null;
    engine.timer = setInterval(scheduler, LOOKAHEAD_MS);
    engine.isPlaying = true;
    startMacroAutomation();
    fadeGainTo(engine.master, 0.9, 0.15);
    applyPrecip(engine.precipitation);
    applyAtmosphere(engine.atmosphere);
    applyVinyl(engine.vinylEnabled);

    els.play.textContent = 'Stop';
    els.play.classList.add('playing');
    els.stateLabel.textContent = 'PLAYING';

    if (!reducedMotionOn()) startVisualizer();
    else drawStaticScope();

    notifyStateChange();
  }

  function stopPlayback() {
    if (engine.timer) clearInterval(engine.timer);
    engine.timer = null;
    engine.isPlaying = false;
    if (engine.ctx) releaseVoices(engine.ctx.currentTime);
    stopMacroAutomation();
    if (engine.ctx) fadeGainTo(engine.master, 0.0001, 0.3);

    els.play.textContent = 'Play';
    els.play.classList.remove('playing');
    els.stateLabel.textContent = 'STOPPED';

    if (engine.animId) cancelAnimationFrame(engine.animId);
    clearScope();

    notifyStateChange();
  }

  // Reads the site's real theme tokens (css/tui.css) instead of the
  // standalone-artifact's own invented --screen-bg/--accent/--accent-2
  // variable names, so the scope adapts to whatever theme/palette the
  // visitor has picked.
  function siteVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function hexToRgbArr(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [13, 17, 23];
  }

  function rgbaStr(rgb, alpha) {
    return 'rgba(' + Math.round(rgb[0]) + ', ' + Math.round(rgb[1]) + ', ' + Math.round(rgb[2]) + ', ' + alpha + ')';
  }

  // Matches .theme-transitioning's 0.3s in css/tui.css -- the rest of the
  // page crossfades its colors over that same window via a CSS transition,
  // which can't reach into a <canvas>'s pixels, so this recreates the same
  // timing by hand for the scope's own colors.
  var COLOR_FADE_MS = 300;

  // .theme-transitioning's transition uses the "ease" timing function
  // (slow-fast-slow), not linear -- linear changes at a constant rate all
  // the way to the last frame, while "ease" decelerates and visually
  // settles before its nominal duration is up, so matching duration alone
  // isn't enough to match pace. Newton-Raphson solve for the same
  // cubic-bezier(0.25, 0.1, 0.25, 1.0) control points "ease" expands to, so
  // this is the same curve, not an approximation of it.
  function makeCubicBezierEase(p1x, p1y, p2x, p2y) {
    function a(x1, x2) { return 1 - 3 * x2 + 3 * x1; }
    function b(x1, x2) { return 3 * x2 - 6 * x1; }
    function c(x1) { return 3 * x1; }
    function bezierX(t) { return ((a(p1x, p2x) * t + b(p1x, p2x)) * t + c(p1x)) * t; }
    function bezierSlopeX(t) { return 3 * a(p1x, p2x) * t * t + 2 * b(p1x, p2x) * t + c(p1x); }
    function bezierY(t) { return ((a(p1y, p2y) * t + b(p1y, p2y)) * t + c(p1y)) * t; }

    return function (x) {
      var t = x;
      for (var i = 0; i < 4; i++) {
        var slope = bezierSlopeX(t);
        if (slope === 0) break;
        t -= (bezierX(t) - x) / slope;
      }
      return bezierY(t);
    };
  }
  var CSS_EASE = makeCubicBezierEase(0.25, 0.1, 0.25, 1.0);

  // Returns a function you call once per redraw to get that CSS custom
  // property's current color as [r,g,b], gliding smoothly toward it over
  // COLOR_FADE_MS whenever it changes instead of snapping -- so the scope's
  // colors move in step with the rest of the page's own fade instead of
  // hard-cutting against a still-fading UI. Snaps instantly under reduced
  // motion, same as every other decorative transition on the site.
  function makeSmoothColor(varName, fallback) {
    var to = hexToRgbArr(siteVar(varName, fallback));
    var from = to;
    var current = to;
    var start = 0;

    return function () {
      var target = hexToRgbArr(siteVar(varName, fallback));
      var changed = target[0] !== to[0] || target[1] !== to[1] || target[2] !== to[2];

      if (reducedMotionOn()) {
        to = target;
        current = target;
        return current;
      }

      if (changed) {
        from = current;
        to = target;
        start = performance.now();
      }

      var linearT = Math.min(1, (performance.now() - start) / COLOR_FADE_MS);
      var t = CSS_EASE(linearT);
      current = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
      ];
      return current;
    };
  }

  var bgColor = makeSmoothColor('--clr-primary-bg', '#0d1117');
  var accentColor = makeSmoothColor('--clr-green', '#7ee787');

  function clearScope() {
    ctx2d.fillStyle = rgbaStr(bgColor(), 1);
    ctx2d.fillRect(0, 0, els.canvas.width, els.canvas.height);
  }

  function startVisualizer() {
    var dataArray = new Uint8Array(engine.analyser.fftSize);

    function draw() {
      engine.animId = requestAnimationFrame(draw);
      engine.analyser.getByteTimeDomainData(dataArray);

      var w = els.canvas.width, h = els.canvas.height;
      // Opaque, not a translucent trail -- a translucent fill only partly
      // overwrites the last frame, which would compound with bgColor()'s
      // own glide and make the background settle slower than the rest of
      // the page's fade. A hard fill keeps this frame's color exactly where
      // the glide says it should be.
      ctx2d.fillStyle = rgbaStr(bgColor(), 1);
      ctx2d.fillRect(0, 0, w, h);

      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = rgbaStr(accentColor(), 1);
      ctx2d.beginPath();
      var bufferLength = dataArray.length;
      var sliceWidth = w / bufferLength;
      var x = 0;
      for (var i = 0; i < bufferLength; i++) {
        var v = dataArray[i] / 128.0;
        var y = (v * h) / 2;
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();
    }
    draw();
  }

  function drawStaticScope() {
    clearScope();
    ctx2d.strokeStyle = rgbaStr(accentColor(), 1);
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(0, els.canvas.height / 2);
    ctx2d.lineTo(els.canvas.width, els.canvas.height / 2);
    ctx2d.stroke();
  }

  // The playing+not-reduced-motion path re-reads/fades its colors every
  // frame (see draw() above) so it's already theme-live on its own. These
  // other two states only ever draw once, on their own trigger (play/stop,
  // mount, a slider move) -- a single re-draw here would show the right
  // final color, but not actually animate the glide the way the page's own
  // fade does, so this keeps re-firing whichever one currently applies for
  // as long as the color fade is still in flight. Snaps in one shot under
  // reduced motion (makeSmoothColor() already skips the glide there, so a
  // single draw is the whole picture).
  var themeTransitionId = null;
  function animateThemeTransition(drawFn) {
    if (themeTransitionId !== null) cancelAnimationFrame(themeTransitionId);
    var start = performance.now();
    (function tick() {
      drawFn();
      // Stops itself once the panel unmounts (canvas detached), same check
      // the other per-frame timers in this file already use, rather than
      // drawing to an invisible canvas for the rest of the transition window.
      if (document.body.contains(els.canvas) && !reducedMotionOn() && performance.now() - start < COLOR_FADE_MS + 40) {
        themeTransitionId = requestAnimationFrame(tick);
      } else {
        themeTransitionId = null;
      }
    })();
  }

  new MutationObserver(function () {
    if (engine.isPlaying) {
      if (reducedMotionOn()) animateThemeTransition(drawStaticScope);
    } else {
      animateThemeTransition(clearScope);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });

  function readyLabel() {
    var first = chordFromIndex(engine.startingChordIndex);
    return 'READY  ·  starts on ' + first.degree + ' (' + first.name + ')  ·  ' + engine.tempo + ' BPM';
  }

  // Mix sliders: each just scales its bus's gain 0-150%. Values are stored
  // on `engine` regardless of whether ctx exists yet, so a slider moved
  // before the first Play still takes effect once initEngine creates the
  // bus nodes (they're initialized from these same values). The slider
  // itself always shows/stores the raw 0-150% the user set; BUS_VOLUME_
  // BASELINE (if this bus has an entry) is applied on top only at the
  // point the value actually reaches the audio graph, so "100%" means
  // the tuned balance, not unity gain.
  function wireVolumeSlider(input, output, volumeKey, busKey) {
    input.addEventListener('input', function () {
      setVolumeRaw(volumeKey, busKey, Number(input.value));
    });
  }

  function setVolumeRaw(volumeKey, busKey, percent) {
    var level = percent / 100;
    engine[volumeKey] = level;
    if (engine.ctx && engine[busKey]) {
      var baseline = BUS_VOLUME_BASELINE[busKey] || 1;
      engine[busKey].gain.setTargetAtTime(level * baseline, engine.ctx.currentTime, 0.01);
    }
    if (uiMounted) syncUIToEngineState();
  }

  // Friendly name -> (engine volume field, bus field) for LofiSketch.setVolume.
  // 'atmosphere' here means the mix slider labeled "Atmosphere" (staticBus,
  // shared by Cityscape/Forest/Ocean/Fireplace + vinyl crackle's old home) --
  // a different thing from engine.atmosphere, the Cityscape/Forest/etc.
  // toggle state. Same naming collision the UI itself already lives with.
  var VOLUME_KEY_MAP = {
    overall: ['overallVolume', 'overallGain'],
    chord: ['chordVolume', 'chordBus'],
    melody: ['melodyVolume', 'melodyBus'],
    drum: ['drumVolume', 'drumBus'],
    rain: ['rainVolume', 'rainBus'],
    atmosphere: ['staticVolume', 'staticBus'],
    vinyl: ['vinylVolume', 'vinylBus']
  };

  function lofiSetVolume(name, percent) {
    var m = VOLUME_KEY_MAP[name];
    if (m) setVolumeRaw(m[0], m[1], percent);
  }

  // Reflects whatever the engine is currently doing onto the mounted panel --
  // called after mount() (so a panel opened while the footer/tile already
  // has it playing shows the real state instead of a stale "Play") and after
  // any programmatic change (LofiSketch.setPrecip/setVolume/etc, which can
  // be called with no panel mounted at all).
  function syncUIToEngineState() {
    els.play.textContent = engine.isPlaying ? 'Stop' : 'Play';
    els.play.classList.toggle('playing', engine.isPlaying);
    els.stateLabel.textContent = engine.isPlaying ? 'PLAYING' : 'STOPPED';
    els.chordLabel.textContent = (engine.isPlaying && engine.currentChord)
      ? (engine.currentChord.degree + '  ·  ' + engine.currentChord.name + '  ·  ' + engine.tempo + ' BPM')
      : readyLabel();

    els.precip.setAttribute('aria-pressed', String(engine.precipitation !== 'off'));
    els.precip.textContent = (engine.precipitation === 'off' ? '+ ' : '− ') + PRECIP_LABELS[engine.precipitation];
    els.atmosphere.setAttribute('aria-pressed', String(engine.atmosphere !== 'off'));
    els.atmosphere.textContent = (engine.atmosphere === 'off' ? '+ ' : '− ') + ATMOSPHERE_LABELS[engine.atmosphere];
    els.vinyl.setAttribute('aria-pressed', String(engine.vinylEnabled));
    els.vinyl.textContent = (engine.vinylEnabled ? '− ' : '+ ') + 'Vinyl';

    Object.keys(VOLUME_KEY_MAP).forEach(function (name) {
      var volumeKey = VOLUME_KEY_MAP[name][0];
      var elKey = name === 'atmosphere' ? 'static' : name;
      var slider = els[elKey + 'Vol'];
      var out = els[elKey + 'VolOut'];
      if (!slider || !out) return;
      var pct = Math.round(engine[volumeKey] * 100);
      slider.value = pct;
      out.textContent = pct + '%';
    });

    if (engine.isPlaying) { if (!reducedMotionOn()) startVisualizer(); else drawStaticScope(); }
    else clearScope();
  }

  // Mounts the full control panel into `container` (expects the lofi-*
  // prefixed ids from the panel markup). Safe to call more than once --
  // each call re-queries fresh elements and re-attaches listeners, which is
  // exactly what's needed when the Projects page's SPA-style navigation
  // re-renders this panel's container on a revisit.
  function mountUI(container) {
    els = buildEls(container);
    ctx2d = els.canvas.getContext('2d');

    els.play.addEventListener('click', function () {
      if (engine.isPlaying) stopPlayback(); else startPlayback();
    });

    els.regen.addEventListener('click', function () {
      var wasPlaying = engine.isPlaying;
      if (wasPlaying) stopPlayback();
      rollParams();
      els.chordLabel.textContent = readyLabel();
      if (wasPlaying) startPlayback();
    });

    // Precipitation and Atmosphere each cycle their own independent state --
    // Off -> Rain -> Thunderstorm -> Off for one, Off -> Cityscape -> Forest
    // -> Ocean -> Fireplace -> Night -> Off for the other. Either can be on,
    // both can be on together, or both off.
    els.precip.addEventListener('click', function () {
      var idx = PRECIP_STATES.indexOf(engine.precipitation);
      applyPrecip(PRECIP_STATES[(idx + 1) % PRECIP_STATES.length]);
      syncUIToEngineState();
    });

    els.atmosphere.addEventListener('click', function () {
      var idx = ATMOSPHERE_STATES.indexOf(engine.atmosphere);
      applyAtmosphere(ATMOSPHERE_STATES[(idx + 1) % ATMOSPHERE_STATES.length]);
      syncUIToEngineState();
    });

    els.vinyl.addEventListener('click', function () {
      applyVinyl(!engine.vinylEnabled);
      syncUIToEngineState();
    });

    wireVolumeSlider(els.overallVol, els.overallVolOut, 'overallVolume', 'overallGain');
    wireVolumeSlider(els.chordVol, els.chordVolOut, 'chordVolume', 'chordBus');
    wireVolumeSlider(els.melodyVol, els.melodyVolOut, 'melodyVolume', 'melodyBus');
    wireVolumeSlider(els.drumVol, els.drumVolOut, 'drumVolume', 'drumBus');
    wireVolumeSlider(els.rainVol, els.rainVolOut, 'rainVolume', 'rainBus');
    wireVolumeSlider(els.staticVol, els.staticVolOut, 'staticVolume', 'staticBus');
    wireVolumeSlider(els.vinylVol, els.vinylVolOut, 'vinylVolume', 'vinylBus');

    uiMounted = true;
    syncUIToEngineState();
  }

  // Play-state pub/sub -- lets js/lofi-player.js (the site-wide footer
  // toggle) keep its own localStorage'd on/off flag in sync no matter which
  // UI actually started/stopped playback (the footer button, the home tile,
  // or the full panel on the Projects page), instead of only knowing about
  // its own button clicks.
  var stateChangeListeners = [];
  function notifyStateChange() {
    var state = getState();
    stateChangeListeners.forEach(function (cb) {
      try { cb(state); } catch (e) {}
    });
  }

  function getState() {
    return {
      isPlaying: engine.isPlaying,
      precipitation: engine.precipitation,
      atmosphere: engine.atmosphere,
      vinylEnabled: engine.vinylEnabled,
      overallVolume: engine.overallVolume,
      chordVolume: engine.chordVolume,
      melodyVolume: engine.melodyVolume,
      drumVolume: engine.drumVolume,
      rainVolume: engine.rainVolume,
      staticVolume: engine.staticVolume,
      vinylVolume: engine.vinylVolume
    };
  }

  rollParams();

  // Public API -- the only thing other scripts (js/lofi-player.js,
  // js/home-tiles.js, js/tui.js's Projects-page demo loader) touch. Nothing
  // outside this file reaches into `engine`/`els` directly, so there's only
  // ever one AudioContext no matter how many of those three UIs are present
  // on the page at once.
  window.LofiSketch = {
    mount: mountUI,
    // Idempotent, and resumes a suspended context either way -- used both
    // to lazily create the audio graph and as the "the visitor just
    // interacted with the page, autoplay policy should be satisfied now"
    // hook (see js/lofi-player.js's armLofiAutoResume).
    ensureEngine: function () {
      if (!engine.ctx) initEngine();
      else if (engine.ctx.state === 'suspended') engine.ctx.resume();
    },
    start: startPlayback,
    stop: stopPlayback,
    isPlaying: function () { return engine.isPlaying; },
    setPrecip: function (state) { applyPrecip(state); if (uiMounted) syncUIToEngineState(); },
    setAtmosphere: function (state) { applyAtmosphere(state); if (uiMounted) syncUIToEngineState(); },
    setVinyl: function (enabled) { applyVinyl(enabled); if (uiMounted) syncUIToEngineState(); },
    setVolume: lofiSetVolume,
    getState: getState,
    getAnalyser: function () { return engine.analyser; },
    onStateChange: function (cb) { stateChangeListeners.push(cb); }
  };
})();

