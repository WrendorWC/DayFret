/* ============================================================
   DERELICT: Escape from Station Echo
   A small Sierra-style graphical adventure.
   ============================================================ */
'use strict';

// ---------- canvas & constants ----------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = 320, H = 180;
const XMIN = 8, XMAX = 312, YMIN = 132, YMAX = 172;
const SAVEKEY = 'derelict_save_v1';

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function Rt(c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function stars(x, y, w, h, seed, n) {
  Rt('#05060f', x, y, w, h);
  const rnd = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + rnd() * w | 0, sy = y + rnd() * h | 0, c = rnd();
    ctx.fillStyle = c < .6 ? '#9aa3c0' : (c < .85 ? '#e8ecff' : '#5868a0');
    ctx.fillRect(sx, sy, 1, 1);
  }
}

// ---------- audio ----------
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, delay, type, vol) {
  const a = ac(); if (!a) return;
  type = type || 'square'; vol = vol || 0.07;
  const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
const SFX = {
  pickup() { tone(660, .06); tone(990, .09, .06); },
  score()  { tone(523, .07, 0, 'triangle', .1); tone(659, .07, .08, 'triangle', .1); tone(784, .12, .16, 'triangle', .1); },
  denied() { tone(170, .16, 0, 'sawtooth'); },
  door()   { tone(130, .16, 0, 'triangle', .12); tone(95, .2, .06, 'triangle', .1); },
  death()  { [392, 330, 262, 196, 131].forEach((f, i) => tone(f, .22, i * .17, 'sawtooth', .09)); },
  power()  { [196, 262, 330, 392, 523].forEach((f, i) => tone(f, .45, i * .12, 'triangle', .09)); },
  launch() { for (let i = 0; i < 14; i++) tone(70 + i * 42, .12, i * .06, 'sawtooth', .06); },
  funk()   { [392, 523, 466, 392, 587, 523].forEach((f, i) => tone(f, .11, i * .13, 'square', .07)); },
  blip()   { tone(880, .05, 0, 'square', .05); },
};

// ---------- state ----------
let S = null;
function newState() {
  return {
    room: 'docking', x: 50, y: 152, dir: 'down', step: 0, stepT: 0, moving: false,
    inv: [], flags: {}, score: 0, scored: {}, visited: {},
    mode: 'title', verb: 'walk', active: null,
    input: null, walkT: null, pending: null, flash: 0, msgCool: 0,
  };
}

// ---------- score ----------
const SCORES = {
  prybar: 4, pried: 6, medkit: 4, keycard: 6, datapad: 4, locker: 6, flashlight: 4,
  snack: 6, hatch: 2, feed: 8, cell: 8, install: 10, log: 6, code: 8,
  lockdown: 6, heal: 8, launch: 4,
};
const MAXSCORE = Object.values(SCORES).reduce((a, b) => a + b, 0);
function award(k) {
  if (S.scored[k]) return;
  S.scored[k] = 1; S.score += SCORES[k];
  SFX.score(); msg('[+' + SCORES[k] + ' points]', 'pts'); hud(); save();
}

// ---------- messages ----------
const logEl = document.getElementById('log');
function msg(t, cls) {
  const d = document.createElement('div');
  d.className = 'm' + (cls ? ' ' + cls : '');
  d.textContent = t;
  logEl.appendChild(d);
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------- items ----------
const ITEMS = {
  prybar:    { n: 'Prybar', d: 'A meter of dense alloy with a flattened end. The universal key.' },
  medkit:    { n: 'Medkit', d: 'A TraumaTech field kit. The label promises "NOW WITH 40% MORE GAUZE."' },
  keycard:   { n: 'Keycard', d: "Dr. Hobbs' level-3 station ID. The photo shows a man who clearly hated photo day." },
  datapad:   { n: 'Datapad', d: () => datapadText() },
  flashlight:{ n: 'Flashlight', d: 'A heavy-duty maintenance torch. Bright enough to interrogate someone.' },
  snackbar:  { n: 'NutriBar', d: 'NutriBar, "Simulated Cheese Product" flavor. Shelf-stable for 40 years; edibility legally contested. It smells strong enough to wake the dead — or at least interest them.' },
  fuelcell:  { n: 'Fuel cell', d: 'A sealed plasma cell, humming faintly. Warm, like a loaf of extremely dangerous bread.' },
  authchip:  { n: 'Auth chip', d: "Lt. Vance's pilot authorization chip. The closest you will ever get to a pilot's license." },
};
function has(i) { return S.inv.includes(i); }
function give(i) {
  if (has(i)) return;
  S.inv.push(i); SFX.pickup();
  msg('You got: ' + ITEMS[i].n, 'item'); renderInv(); save();
}
function drop(i) {
  S.inv = S.inv.filter(x => x !== i);
  if (S.active === i) S.active = null;
  renderInv(); save();
}

// ---------- default responses ----------
const DEF = {
  look: ["You see nothing special about it.", "Fascinating. Well... no, not really.", "It's exactly what it appears to be, which is rare and refreshing."],
  use:  ["That doesn't seem to do anything.", "You poke it. It remains unmoved by your efforts.", "Nothing happens. The station judges you silently."],
  take: ["You don't need that.", "It's attached to the station, and the station outweighs you considerably."],
  talk: ["You make small talk. It's a very one-sided conversation.", "No response. Rude."],
  item: ["That doesn't work.", "You wave it around meaningfully. The universe declines to react.", "Creative. Ineffective, but creative."],
};

// ---------- text blocks ----------
function datapadText() {
  award('datapad');
  return 'PERSONAL PAD — TECH. J. OKAFOR. Last entry: "Locker code reset to 2389 (anniversary of the Great Zero-G Fondue Incident — never again). The sublevel has started HISSING at me, so my flashlight stays locked up safe like a rational adult\'s would. Shuttle leaves at 0600. I am extremely on it."';
}
function captainsLog() {
  award('log'); S.flags.knowCode = 1;
  msg('FINAL LOG — CPT. R. OKONKWO, STATION ECHO-7:');
  msg('"The spore bloom got into hydroponics, so I\'m pulling everyone out. Hobbs stayed behind for his samples. Hobbs, if you ever read this: you\'re an idiot, and I\'m sorry."');
  msg('"Sublevel update: the lab specimen got loose down there and ate our spare fuel cells. It\'s harmless if fed. FEED IT BEFORE YOU GO NEAR THE RACK."');
  msg('"Bridge override code is 7264. The lockdown lifts from the bridge security console. Lock the door on your way out. — R.O."');
  save();
}

// ---------- input-code prompt ----------
function askCode(prompt, cb) {
  S.input = { buf: '', prompt: prompt, cb: cb };
  msg(prompt + '  (type digits, ENTER to confirm, ESC to cancel)');
  hudStatus();
}

// ---------- core actions ----------
function findH(id) {
  const hs = ROOMS[S.room].hotspots();
  for (const h of hs) if (h.id === id) return h;
  return null;
}
function doAction(h, verb, item) {
  let r;
  if (item) {
    r = h.item ? h.item(item) : undefined;
    if (r === undefined) r = pick(DEF.item);
  } else {
    const hh = h[verb];
    r = (typeof hh === 'function') ? hh() : hh;
    if (r === undefined) r = pick(DEF[verb]);
  }
  if (typeof r === 'string' && r.length) msg(r);
  S.active = null; renderInv(); hudStatus();
}
function tryAct(h, verb, item) {
  const cx = clamp(h.rect[0] + h.rect[2] / 2, XMIN, XMAX);
  const cy = clamp(h.rect[1] + h.rect[3] + 4, YMIN, YMAX);
  if (Math.hypot(S.x - cx, S.y - cy) > 58) {
    S.walkT = { x: cx, y: cy };
    S.pending = { id: h.id, verb: verb, item: item };
  } else {
    doAction(h, verb, item);
  }
}

function goRoom(id, x, y) {
  S.room = id; S.x = x; S.y = y;
  S.walkT = null; S.pending = null;
  SFX.door(); hud();
  if (!S.visited[id]) {
    S.visited[id] = 1;
    msg('— ' + ROOMS[id].name.toUpperCase() + ' —', 'room');
    msg(ROOMS[id].intro);
  }
  save();
}

function die(text) {
  S.mode = 'dead'; S.walkT = null; S.pending = null; S.input = null;
  SFX.death(); msg(text, 'die');
  showOverlay(
    '<h1 class="dead">YOU HAVE DIED</h1>' +
    '<p>' + esc(text) + '</p>' +
    '<p class="dim">The station generously resets the scene. Try not to do that again.</p>' +
    '<button id="ovbtn1">TRY AGAIN</button>',
    () => revive()
  );
}
function revive() {
  S.mode = 'play'; hideOverlay();
  const r = ROOMS[S.room];
  if (r.safe) { S.x = r.safe[0]; S.y = r.safe[1]; }
}

function endGame() {
  award('launch');
  S.mode = 'end'; SFX.launch();
  try { localStorage.removeItem(SAVEKEY); } catch (e) {}
  const rank = S.score >= MAXSCORE ? 'SANITATION ENGINEER, FIRST CLASS'
    : S.score >= 80 ? 'ACTING CAPTAIN MATERIAL'
    : 'ALIVE, TECHNICALLY';
  showOverlay(
    '<h1>YOU ESCAPED</h1>' +
    '<h2>STATION ECHO-7 RECEDES BEHIND YOU</h2>' +
    '<p>The pod kicks free with a thump. Vance flies it like she\'s owed money. Behind you, ECHO-7 shrinks to a glint — distress beacon blinking, lights on, nobody home but a well-fed something in the sublevel.</p>' +
    '<p>You begin drafting the incident report. Under CAUSE OF ABANDONMENT you write: "Nobody fed the dog."</p>' +
    '<p style="color:#ffd34d">FINAL SCORE: ' + S.score + ' of ' + MAXSCORE + '</p>' +
    '<p style="color:#6fe3a0">RANK ACHIEVED: ' + rank + '</p>' +
    '<p class="dim">DEX MURPHY WILL RETURN IN "DERELICT II: MOP HARDER"</p>' +
    '<button id="ovbtn1">PLAY AGAIN</button>',
    () => { newGame(); }
  );
}

// ---------- overlay ----------
const ovEl = document.getElementById('overlay');
const ovInner = document.getElementById('ovinner');
let ovPrimary = null;
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function showOverlay(html, primary, secondary) {
  ovInner.innerHTML = html;
  ovEl.classList.remove('hidden');
  ovPrimary = primary || null;
  const b1 = document.getElementById('ovbtn1');
  if (b1 && primary) b1.onclick = () => { ac(); primary(); };
  const b2 = document.getElementById('ovbtn2');
  if (b2 && secondary) b2.onclick = () => { ac(); secondary(); };
}
function hideOverlay() { ovEl.classList.add('hidden'); ovPrimary = null; }

function showTitle() {
  S.mode = 'title';
  let hasSave = false;
  try { hasSave = !!localStorage.getItem(SAVEKEY); } catch (e) {}
  showOverlay(
    '<h1>DERELICT</h1>' +
    '<h2>ESCAPE FROM STATION ECHO</h2>' +
    '<p>You are <b>Dex Murphy</b>, second-shift sanitation engineer of the freighter <i>Mop Bucket</i>. Your shuttle\'s reactor died mid-run, and you\'ve drifted into the only port in range: research station <b>ECHO-7</b> — silent for fourteen months.</p>' +
    '<p>Dock. Find power. Get out. Easy, right?</p>' +
    '<p class="dim">Click verbs (keys 1–5), then click the world. Arrow keys / WASD walk. Right-click cycles verbs. HINT if stuck. There are ways to die — the game will reset the scene, but your dignity is on its own.</p>' +
    '<button id="ovbtn1">NEW GAME</button>' +
    (hasSave ? '<button id="ovbtn2">CONTINUE</button>' : ''),
    () => newGame(),
    () => continueGame()
  );
}

// ---------- save / load ----------
function save() {
  if (!S || S.mode !== 'play') return;
  try {
    localStorage.setItem(SAVEKEY, JSON.stringify({
      room: S.room, x: S.x, y: S.y, inv: S.inv, flags: S.flags,
      score: S.score, scored: S.scored, visited: S.visited,
    }));
  } catch (e) {}
}
function newGame() {
  S = newState(); S.mode = 'play';
  try { localStorage.removeItem(SAVEKEY); } catch (e) {}
  hideOverlay(); logEl.innerHTML = '';
  S.visited.docking = 1;
  msg('— DOCKING BAY 2 —', 'room');
  msg(ROOMS.docking.intro);
  hud(); renderInv(); hudStatus();
}
function continueGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVEKEY)); } catch (e) {}
  if (!d) { newGame(); return; }
  S = newState();
  Object.assign(S, d); S.mode = 'play';
  hideOverlay(); logEl.innerHTML = '';
  msg('— ' + ROOMS[S.room].name.toUpperCase() + ' —', 'room');
  msg('(Game restored. The station missed you. It says so with flickering lights.)');
  hud(); renderInv(); hudStatus();
}

// ---------- HUD ----------
const roomEl = document.getElementById('roomname');
const scoreEl = document.getElementById('scoreline');
const statusEl = document.getElementById('statustext');
let hover = null;
function hud() {
  roomEl.textContent = ROOMS[S.room].name;
  scoreEl.textContent = 'Score: ' + S.score + ' of ' + MAXSCORE;
}
function hudStatus() {
  if (S.input) {
    statusEl.innerHTML = esc(S.input.prompt) + ': <b>' + esc(S.input.buf) + '_</b>';
    return;
  }
  let t = S.verb.toUpperCase();
  if (S.active) t = 'USE ' + ITEMS[S.active].n.toUpperCase() + ' ON';
  let h = hover ? ' <span class="hov">&#9658; ' + esc(hover.name) + '</span>' : '';
  statusEl.innerHTML = t + h;
}

// ---------- inventory UI ----------
const invEl = document.getElementById('inv');
function renderInv() {
  invEl.innerHTML = '';
  for (const i of S.inv) {
    const b = document.createElement('button');
    b.className = 'ibtn' + (S.active === i ? ' sel' : '');
    b.textContent = ITEMS[i].n;
    b.onclick = () => {
      ac();
      if (S.mode !== 'play') return;
      if (S.verb === 'look') {
        const d = ITEMS[i].d;
        msg(typeof d === 'function' ? d() : d);
      } else {
        S.active = (S.active === i) ? null : i;
        if (S.active) SFX.blip();
        renderInv(); hudStatus();
      }
    };
    invEl.appendChild(b);
  }
}

// ---------- hints ----------
function giveHint() {
  const f = S.flags;
  let h;
  if (!has('prybar') && !f.prybarTaken) h = 'That prybar racked on the docking bay wall looks like the most useful thing on this station.';
  else if (!f.doorPried) h = 'The corridor door is jammed. You are holding a meter of leverage. Connect the dots.';
  else if (!has('keycard')) h = "Someone in the med bay has a keycard they're no longer using.";
  else if (!f.lockerOpen) h = 'The locker in the crew quarters is code-locked. Somebody around there probably wrote the code down. People always do.';
  else if (!has('flashlight') && !f.flashTaken) h = 'There is a flashlight sitting in the open locker. Future-you will want it.';
  else if (!has('snackbar') && !f.snackGot) h = 'The AutoChef in the mess hall is holding a NutriBar hostage. Negotiate with the prybar.';
  else if (!f.hatchOpen) h = 'There is a floor hatch in the mess hall marked SUBLEVEL. Power problems usually live downstairs.';
  else if (!f.fed && !has('fuelcell')) h = 'Something in the sublevel is guarding the fuel cell. Guards can be bribed. This one prefers snacks.';
  else if (!has('fuelcell') && !f.cellTaken) h = 'The creature is fed and gone. The fuel cell is right there in the rack.';
  else if (!f.power) h = 'Engineering has an empty fuel cradle. Your keycard opens the engineering door.';
  else if (!f.log) h = 'Power is on. The terminal in the crew quarters might have something to say now.';
  else if (!f.cryoOpen) h = 'The cryo pod in the med bay has power now — and an occupant.';
  else if (!f.vanceHealed) h = 'Vance is dying of cryo-sickness on the med bay floor. You are carrying a medkit. This one is not a riddle.';
  else if (!f.bridgeOpen) h = "The captain's log mentioned a bridge override code. The keypad is in the east corridor.";
  else if (!f.lockdownLifted) h = 'The lockdown releases from the bridge security console. The button is large and honest.';
  else h = 'Pod bay, west corridor. Auth chip in the console. Go home, Dex.';
  if (f.log) S.flags.log = 1; // no-op guard
  msg('HINT: ' + h, 'hint');
}

/* ============================================================
   SPRITES
   ============================================================ */
const PCOL = { H: '#8a5a2b', S: '#f0c8a0', J: '#5868d8', D: '#3a4690', B: '#3c3c46', K: '#181818' };
const VCOL = { H: '#2a2a30', S: '#e8c098', J: '#3da35d', D: '#2a7340', B: '#3c3c46', K: '#181818' };

const FR = {
  down: [
    [ // stand
      "....HHHH....","...HHHHHH...","...HSSSSH...","...SSSSSS...","...SKSSKS...","...SSSSSS...",
      "....SSSS....",".....SS.....","...JJJJJJ...","..JJJJJJJJ..",".JJ.JJJJ.JJ.",".JJ.JJJJ.JJ.",
      ".JJ.DDDD.JJ.",".SS.JJJJ.SS.","....JJJJ....","...JJJJJJ...","...JJ..JJ...","...JJ..JJ...",
      "...JJ..JJ...","...JJ..JJ...","...BB..BB...","..BBB..BBB..",
    ],
    [ // stride
      "....HHHH....","...HHHHHH...","...HSSSSH...","...SSSSSS...","...SKSSKS...","...SSSSSS...",
      "....SSSS....",".....SS.....","...JJJJJJ...","..JJJJJJJJ..",".JJ.JJJJ.JJ.",".JJ.JJJJ.JJ.",
      ".JJ.DDDD.JJ.",".SS.JJJJ.SS.","....JJJJ....","...JJJJJJ...","...JJ..JJ...","..JJ....JJ..",
      "..JJ....JJ..",".JJ......JJ.",".BB......BB.",".BBB....BBB.",
    ],
    [ // passing
      "....HHHH....","...HHHHHH...","...HSSSSH...","...SSSSSS...","...SKSSKS...","...SSSSSS...",
      "....SSSS....",".....SS.....","...JJJJJJ...","..JJJJJJJJ..",".JJ.JJJJ.JJ.",".JJ.JJJJ.JJ.",
      ".JJ.DDDD.JJ.",".SS.JJJJ.SS.","....JJJJ....","...JJJJJJ...","....JJJJ....","....JJJJ....",
      "....J..J....","....J..J....","....BB.B....","...BBB.BB...",
    ],
  ],
  up: [
    [
      "....HHHH....","...HHHHHH...","...HHHHHH...","...HHHHHH...","...SHHHHS...","...SSHHSS...",
      "....SSSS....",".....SS.....","...JJJJJJ...","..JJJJJJJJ..",".JJ.JJJJ.JJ.",".JJ.JJJJ.JJ.",
      ".JJ.DDDD.JJ.",".SS.JJJJ.SS.","....JJJJ....","...JJJJJJ...","...JJ..JJ...","...JJ..JJ...",
      "...JJ..JJ...","...JJ..JJ...","...BB..BB...","..BBB..BBB..",
    ],
    [
      "....HHHH....","...HHHHHH...","...HHHHHH...","...HHHHHH...","...SHHHHS...","...SSHHSS...",
      "....SSSS....",".....SS.....","...JJJJJJ...","..JJJJJJJJ..",".JJ.JJJJ.JJ.",".JJ.JJJJ.JJ.",
      ".JJ.DDDD.JJ.",".SS.JJJJ.SS.","....JJJJ....","...JJJJJJ...","...JJ..JJ...","..JJ....JJ..",
      "..JJ....JJ..",".JJ......JJ.",".BB......BB.",".BBB....BBB.",
    ],
    [
      "....HHHH....","...HHHHHH...","...HHHHHH...","...HHHHHH...","...SHHHHS...","...SSHHSS...",
      "....SSSS....",".....SS.....","...JJJJJJ...","..JJJJJJJJ..",".JJ.JJJJ.JJ.",".JJ.JJJJ.JJ.",
      ".JJ.DDDD.JJ.",".SS.JJJJ.SS.","....JJJJ....","...JJJJJJ...","....JJJJ....","....JJJJ....",
      "....J..J....","....J..J....","....BB.B....","...BBB.BB...",
    ],
  ],
  side: [
    [ // stand (faces right)
      "....HHHH....","...HHHHHH...","...HHSSSS...","...HHSSSS...","...HSSSKS...","....SSSSS...",
      "....SSSS....",".....SS.....","....JJJJ....","...JJJJJJ...","...JJJJJJ...","...JJJJJJ...",
      "...JDDDDJ...","...JJSJJJ...","....JJJJ....","....JJJJ....","....JJJJ....","....JJJ.....",
      "....JJJ.....","....JJJ.....","....BBB.....","....BBBB....",
    ],
    [ // stride
      "....HHHH....","...HHHHHH...","...HHSSSS...","...HHSSSS...","...HSSSKS...","....SSSSS...",
      "....SSSS....",".....SS.....","....JJJJ....","...JJJJJJ...","...JJJJJJ...","...JJJJJJ...",
      "...JDDDDJ...","...JJSJJJ...","....JJJJ....","....JJJJ....","...JJJJJ....","...JJ.JJ....",
      "..JJ...JJ...","..JJ...JJ...",".BBB...BB...",".BBB...BBB..",
    ],
    [ // passing
      "....HHHH....","...HHHHHH...","...HHSSSS...","...HHSSSS...","...HSSSKS...","....SSSSS...",
      "....SSSS....",".....SS.....","....JJJJ....","...JJJJJJ...","...JJJJJJ...","...JJJJJJ...",
      "...JDDDDJ...","...JJSJJJ...","....JJJJ....","....JJJJ....","....JJJ.....","....JJ......",
      "....JJJ.....","....JJJ.....","....BBB.....","...BBBB.....",
    ],
  ],
};

function drawMap(map, colors, x, y, flip) {
  x |= 0; y |= 0;
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const col = colors[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + (flip ? row.length - 1 - c : c), y + r, 1, 1);
    }
  }
}
const WALKCYCLE = [1, 0, 2, 0];
function drawPlayer() {
  const setName = (S.dir === 'up') ? 'up' : (S.dir === 'down') ? 'down' : 'side';
  const set = FR[setName];
  const f = S.moving ? set[WALKCYCLE[S.step]] : set[0];
  drawMap(f, PCOL, S.x - 6, S.y - 22, S.dir === 'left');
}
function drawNPC(x, y, colors) {
  drawMap(FR.down[0], colors, x - 6, y - 22, false);
}
function drawVanceDown(x, y) { // collapsed on the floor
  Rt('#3da35d', x, y, 26, 7);       // body
  Rt('#2a7340', x + 4, y + 2, 18, 2);
  Rt('#e8c098', x + 26, y, 6, 6);   // head
  Rt('#2a2a30', x + 29, y - 2, 5, 4); // hair
  Rt('#3c3c46', x - 5, y + 2, 6, 4);  // boots
}

/* ============================================================
   SCENERY HELPERS
   ============================================================ */
const POW = () => !!S.flags.power;

function baseRoom(wallDim, wallLit, floorDim, floorLit) {
  const wall = POW() ? wallLit : wallDim;
  const floor = POW() ? (floorLit || '#3a4150') : (floorDim || '#22252e');
  Rt(wall, 0, 0, W, 126);
  Rt('#0c0e16', 0, 14, W, 2);          // ceiling seam
  Rt(floor, 0, 126, W, 54);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 134; y < 180; y += 9) ctx.fillRect(0, y, W, 1);
  for (let x = 24; x < W; x += 48) { ctx.fillRect(x, 126, 1, 54); }
  Rt('#10121c', 0, 124, W, 2);          // wall/floor seam
}
function lightsRow() {
  for (let x = 22; x < W; x += 64) {
    if (POW()) { Rt('#cfe8ff', x, 4, 26, 4); Rt('rgba(160,210,255,0.12)', x - 6, 8, 38, 30); }
    else { Rt('#571820', x, 4, 26, 4); Rt('rgba(170,40,50,0.10)', x - 6, 8, 38, 24); }
  }
}
function wallPanels(step) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = step; x < W; x += step) ctx.fillRect(x, 16, 1, 108);
}
function doorN(x, st, signColor) {
  const lit = POW();
  Rt(lit ? '#596180' : '#2e3346', x - 4, 52, 42, 74);
  Rt('#10121c', x - 1, 55, 36, 71);
  if (st === 'open') {
    Rt('#0a0c14', x, 56, 34, 70);
    Rt('#171c2a', x, 116, 34, 10);
  } else {
    Rt(lit ? '#7c86a3' : '#454c63', x, 56, 34, 70);
    Rt('#262b3d', x + 16, 56, 2, 70);
    const col = (st === 'locked' || st === 'sealed') ? '#e04848' : (st === 'jammed' ? '#c9a227' : '#43d17a');
    Rt(col, x + 5, 88, 4, 4); Rt(col, x + 25, 88, 4, 4);
    if (st === 'sealed') Rt('#e04848', x - 3, 78, 40, 5);
    if (st === 'jammed') Rt('#07080e', x + 13, 56, 7, 70);
  }
  if (signColor) { Rt(signColor, x + 7, 42, 20, 7); Rt('#0b0d14', x + 9, 44, 16, 3); }
}
function cardReader(x, y, ok) {
  Rt('#1a1e2a', x, y, 7, 12);
  Rt(ok ? '#43d17a' : '#e04848', x + 2, y + 3, 3, 3);
}
function hazard(x, y, w, h) {
  for (let i = 0; i < w; i += 8) { Rt('#c9a227', x + i, y, 4, h); Rt('#15151c', x + i + 4, y, 4, h); }
}

/* ============================================================
   ROOMS
   ============================================================ */
const ROOMS = {

  // ------------------------------------------------ DOCKING BAY
  docking: {
    name: 'Docking Bay 2',
    safe: [50, 152],
    intro: 'Docking Bay 2. Your shuttle is on the wrong side of that viewport, drifting like a brick with ambitions. The bay smells of ozone and abandoned budgets. Emergency lighting only — the station is running on fumes and battery.',
    draw() {
      baseRoom('#1c2030', '#39415c');
      lightsRow(); wallPanels(80);
      // viewport
      Rt('#0e1018', 20, 16, 108, 70);
      stars(24, 20, 100, 62, 7, 44);
      Rt('#777e90', 32, 46, 28, 9);  // your shuttle
      Rt('#aa3344', 32, 49, 28, 2);
      Rt('#cfe8ff', 54, 47, 3, 2);
      Rt('#2e3346', 20, 16, 108, 3); Rt('#2e3346', 20, 83, 108, 3);
      Rt('#2e3346', 20, 16, 3, 70); Rt('#2e3346', 125, 16, 3, 70);
      Rt('#2e3346', 72, 16, 3, 70);
      // airlock
      Rt('#2c3142', 148, 50, 54, 76);
      Rt('#171b28', 152, 54, 46, 68);
      hazard(148, 120, 54, 6);
      Rt('#3a4054', 170, 60, 10, 10); // porthole
      Rt('#05060f', 172, 62, 6, 6);
      cardReader(138, 86, false);
      Rt('#e04848', 137, 76, 8, 6); // big red button
      // crates
      Rt('#5a4a33', 206, 94, 30, 32);
      Rt('#6b5940', 212, 78, 24, 16);
      Rt('#c9a227', 210, 102, 10, 5);
      Rt('#15151c', 211, 103, 8, 3);
      // prybar rack
      Rt('#2e3346', 252, 82, 12, 42);
      if (!S.flags.prybarTaken) {
        Rt('#c0c6d6', 256, 86, 3, 34);
        Rt('#8d96ad', 255, 84, 5, 4);
      } else {
        Rt('#454c63', 255, 100, 6, 4);
      }
      // jammed door east
      doorN(272, S.flags.doorPried ? 'open' : 'jammed', '#c9a227');
      // floor stain
      Rt('rgba(10,12,8,0.5)', 90, 150, 46, 8);
    },
    hotspots() {
      const hs = [];
      hs.push({ id: 'viewport', name: 'Viewport', rect: [20, 16, 108, 70],
        look: 'Beyond the glass: stars, slow-tumbling debris, and your shuttle, parked at the angle of a vehicle whose driver has given up.',
        use: "It's a window. It is already operating at peak window." });
      hs.push({ id: 'shuttle', name: 'Your shuttle', rect: [32, 44, 28, 12],
        look: 'The "Second Mortgage." Reactor flatlined an hour ago. It got you here, which is more than the warranty promised.',
        talk: 'You whisper an apology to the Second Mortgage. It drifts, unmoved. Like the bank.' });
      hs.push({ id: 'airlock', name: 'EVA airlock', rect: [148, 50, 54, 76],
        look: 'The EVA airlock. The suit locker beside it is empty, naturally. A faded sticker on the glass reads: SPACE — NOW WITH 0% AIR.',
        use: 'The inner door is sealed. The controls are on that panel beside it.' });
      hs.push({ id: 'airbtn', name: 'Airlock controls', rect: [134, 74, 14, 26],
        look: 'The airlock cycle control. The status display reads: OUTER DOOR FAULT. A wise person reads that as "do not press."',
        use: () => { die('You press CYCLE. The airlock, fourteen months past its last safety inspection, opens both doors at once. You leave Station ECHO-7 at a brisk 340 m/s, achieving your childhood dream of spaceflight in the worst possible way.'); return null; } });
      hs.push({ id: 'crates', name: 'Shipping crates', rect: [206, 76, 30, 50],
        look: 'Shipping crates stenciled HYDROPONICS — RUSH. Whatever was urgent about them expired about fourteen months ago.',
        use: 'Sealed, mag-locked, and full of someone else\'s regret.',
        take: 'Each one weighs more than your shuttle\'s resale value.' });
      if (!S.flags.prybarTaken) hs.push({ id: 'prybar', name: 'Prybar', rect: [252, 82, 12, 42],
        look: 'A maintenance prybar, racked on the wall. One meter of "every door is a suggestion."',
        take: () => { S.flags.prybarTaken = 1; give('prybar'); award('prybar'); return 'You liberate the prybar from its clamp. You feel roughly 60% more competent.'; },
        use: () => { S.flags.prybarTaken = 1; give('prybar'); award('prybar'); return 'You take the prybar. Best to have it and not need it.'; } });
      hs.push({ id: 'jamdoor', name: 'Corridor door', rect: [268, 52, 42, 74],
        look: S.flags.doorPried ? 'The way into the station proper. It gave up with dignity.' :
          "The corridor door, jammed a hand's width open. The motor died mid-slide. It needs persuading — the mechanical kind.",
        use: S.flags.doorPried ? "It's open. You did that. Hero." :
          'You wedge your fingers into the gap and heave. The door does not laugh at you, but only because it lacks the hardware.',
        item: (i) => {
          if (i !== 'prybar') return undefined;
          if (S.flags.doorPried) return 'It is already as open as it is going to get.';
          S.flags.doorPried = 1; award('pried'); SFX.door();
          return 'You jam the prybar into the gap and heave. With a shriek of abused metal, the door surrenders. The corridor beyond exhales fourteen months of stale air at you.';
        } });
      return hs;
    },
    zones() {
      return [
        { rect: [272, 126, 34, 12], check: () => S.flags.doorPried ? { room: 'corw', x: 18, y: 150 } : 'The door is jammed. There is a gap, but you are not a gap-shaped person.' },
      ];
    },
  },

  // ------------------------------------------------ CORRIDOR WEST
  corw: {
    name: 'West Corridor',
    safe: [40, 150],
    intro: 'A long corridor, ribs of pale metal vanishing in both directions. Doors here lead to the MED BAY and the ESCAPE PODS. The pod bay door is barred with a red lockdown strip, which is the station\'s way of saying "not yet."',
    draw() {
      baseRoom('#1e2233', '#3c4565');
      lightsRow(); wallPanels(64);
      doorN(62, 'open', '#43d17a');                                       // med bay
      doorN(202, S.flags.lockdownLifted ? 'open' : 'sealed', '#e04848');  // pods
      // poster
      Rt('#cab98a', 138, 64, 28, 36);
      Rt('#7a6f4a', 140, 68, 24, 4); Rt('#7a6f4a', 140, 76, 24, 3);
      Rt('#aa3344', 144, 84, 14, 8);
      // hanging cable
      Rt('#10121c', 178, 16, 3, 38);
      Rt('#c9a227', 178, 52, 3, 4);
      // pipes
      Rt('#2a3045', 0, 20, W, 5); Rt('#262b3d', 0, 27, W, 3);
    },
    hotspots() {
      return [
        { id: 'meddoor', name: 'Med bay door', rect: [58, 52, 42, 74],
          look: 'MED BAY. The door is open, which on this station counts as hospitality.' },
        { id: 'poddoor', name: 'Pod bay door', rect: [198, 52, 42, 74],
          look: S.flags.lockdownLifted ? 'ESCAPE PODS. Open at last. The exit sign of your dreams.' :
            'ESCAPE PODS — with a red LOCKDOWN bar across the door. The station is not letting anyone leave without paperwork.',
          use: S.flags.lockdownLifted ? 'Just walk in. Savor it.' :
            'You push, pull, and attempt light diplomacy. The lockdown bar does not negotiate with janitors.' },
        { id: 'poster', name: 'Safety poster', rect: [138, 64, 28, 36],
          look: 'A safety poster: "ECHO-7 — 412 DAYS WITHOUT AN INCIDENT." Someone crossed out 412 and wrote 0. Then drew a small unhappy face. Then, judging by the pen marks, stabbed it.' },
        { id: 'cable', name: 'Hanging cable', rect: [174, 16, 11, 42],
          look: 'A power cable hangs from the ceiling like a question mark. You elect not to answer it.',
          use: 'You have seen the training videos about dangling cables. The actors were never seen again.' },
      ];
    },
    zones() {
      return [
        { rect: [0, 132, 8, 42], check: () => ({ room: 'docking', x: 289, y: 140 }) },
        { rect: [312, 132, 8, 42], check: () => ({ room: 'core', x: 16, y: 150 }) },
        { rect: [64, 126, 32, 12], check: () => ({ room: 'medbay', x: 160, y: 166 }) },
        { rect: [204, 126, 32, 12], check: () => S.flags.lockdownLifted ? { room: 'pods', x: 160, y: 166 } : 'A red bar of light declares: LOCKDOWN. The door declines to discuss it.' },
      ];
    },
  },

  // ------------------------------------------------ CORRIDOR EAST
  core: {
    name: 'East Corridor',
    safe: [40, 150],
    intro: 'The corridor continues east, lined with doors: CREW QUARTERS, MESS HALL, ENGINEERING — and at the far end, the BRIDGE, sealed beside a small keypad. A dead maintenance bot rests against the wall, dustpan arm raised mid-sweep.',
    draw() {
      baseRoom('#1e2233', '#3c4565');
      lightsRow(); wallPanels(64);
      doorN(24, 'open', '#43d17a');     // crew
      doorN(120, 'open', '#43d17a');    // mess
      doorN(196, S.flags.engOpen ? 'open' : 'locked', '#c9a227'); // engineering
      cardReader(240, 84, !!S.flags.engOpen);
      doorN(268, S.flags.bridgeOpen ? 'open' : 'locked', '#7fd6ff'); // bridge
      // keypad
      Rt('#1a1e2a', 252, 80, 10, 16);
      Rt(POW() ? '#43d17a' : '#26282f', 254, 83, 6, 3);
      Rt('#33384a', 254, 88, 6, 6);
      // vent
      Rt('#10121c', 150, 102, 24, 14);
      ctx.fillStyle = '#3a4054';
      for (let i = 0; i < 5; i++) ctx.fillRect(152, 104 + i * 3, 20, 1);
      Rt('#3a4054', 168, 100, 6, 2); // bent grille
      // dead bot
      Rt('#454c63', 60, 138, 26, 12);
      Rt('#33384a', 64, 132, 18, 8);
      Rt('#7d83ad', 84, 130, 3, 10);
      Rt('#26282f', 70, 136, 4, 3);
    },
    hotspots() {
      return [
        { id: 'crewdoor', name: 'Crew quarters door', rect: [20, 52, 42, 74],
          look: 'CREW QUARTERS. Where the crew kept their socks, secrets, and locker codes.' },
        { id: 'messdoor', name: 'Mess hall door', rect: [116, 52, 42, 74],
          look: 'MESS HALL. Fourteen-month-old leftovers. Approach with respect.' },
        { id: 'engdoor', name: 'Engineering door', rect: [192, 52, 42, 74],
          look: S.flags.engOpen ? 'ENGINEERING. The card reader glows a welcoming green.' :
            'ENGINEERING. A card reader blinks red beside it, demanding credentials you were not born with.' },
        { id: 'bridgedoor', name: 'Bridge door', rect: [264, 52, 42, 74],
          look: S.flags.bridgeOpen ? 'The bridge stands open. Captain Murphy. It has a ring to it.' :
            POW() ? 'BRIDGE. Sealed. The keypad beside it glows, awaiting a code you do not technically know yet.' :
              'BRIDGE. Sealed tight. The keypad beside it is dark — no power, no opinions.' },
        { id: 'keypad', name: 'Keypad', rect: [250, 78, 14, 20],
          look: POW() ? 'A keypad beside the bridge door. It glows expectantly, like a vending machine that only sells doors.' :
            'A keypad, currently dark. Like everything else here, it wants power before it wants conversation.',
          use: () => {
            if (S.flags.bridgeOpen) return 'The bridge is already open.';
            if (!POW()) return 'Dead. Dark. Much like your career prospects if you stay here.';
            askCode('BRIDGE OVERRIDE CODE', (code) => {
              if (code === '7264') {
                S.flags.bridgeOpen = 1; award('code'); SFX.door();
                msg('The keypad chirps. The bridge door grinds open with the air of a butler who has been knocked unconscious for a year.');
                save();
              } else { SFX.denied(); msg('BZZT. The keypad flashes ACCESS DENIED, then plays a tiny animation of a door not opening. Cute.'); }
            });
            return null;
          } },
        { id: 'bot', name: 'Maintenance bot', rect: [58, 128, 32, 24],
          look: 'A maintenance bot, dead where it rolled, dustpan arm raised mid-sweep. A colleague. You observe a moment of professional silence.',
          talk: '"Any last words, brother?" The bot says nothing. They never do.',
          take: 'You already have a job.',
          use: 'Its power cell is fused solid. It died doing what it loved: mandatory tasks.' },
        { id: 'vent', name: 'Wall vent', rect: [148, 100, 28, 18],
          look: 'A wall vent. The grille is bent outward. From the inside. You file this under "problems for future you" and sincerely hope there is one.' },
      ];
    },
    zones() {
      return [
        { rect: [0, 132, 8, 42], check: () => ({ room: 'corw', x: 304, y: 150 }) },
        { rect: [312, 132, 8, 42], check: () => 'The corridor ends in a maintenance bulkhead and a poster about stretching.' },
        { rect: [26, 126, 32, 12], check: () => ({ room: 'crew', x: 160, y: 166 }) },
        { rect: [122, 126, 32, 12], check: () => ({ room: 'mess', x: 160, y: 166 }) },
        { rect: [198, 126, 32, 12], check: () => {
            if (S.flags.engOpen) return { room: 'eng', x: 160, y: 166 };
            if (has('keycard')) {
              S.flags.engOpen = 1; SFX.blip();
              msg("You swipe Dr. Hobbs' keycard. The reader thinks about it, decides you look trustworthy enough, and turns green.");
              return { room: 'eng', x: 160, y: 166 };
            }
            return 'The card reader blinks red: CARD REQUIRED. You pat your pockets. Mostly lint in there.';
          } },
        { rect: [270, 126, 32, 12], check: () => S.flags.bridgeOpen ? { room: 'bridge', x: 160, y: 166 } :
            (POW() ? 'Sealed. The keypad beside the door awaits a code.' : 'Sealed, and the keypad is dead. Power first.') },
      ];
    },
  },

  // ------------------------------------------------ MED BAY
  medbay: {
    name: 'Med Bay',
    safe: [160, 160],
    intro: 'The med bay: white once, gray now. An exam bed holds a figure in a lab coat who is well past triage. Against the far wall, a cryo pod stands frosted over, its panel dark.',
    draw() {
      baseRoom('#202b2d', '#3d585c', '#242c2d', '#3a4a4c');
      lightsRow(); wallPanels(80);
      // exam bed + Hobbs
      Rt('#3a4450', 38, 100, 78, 8);   // bed frame
      Rt('#5a6470', 42, 108, 6, 18); Rt('#5a6470', 104, 108, 6, 18);
      Rt('#c8cdd8', 38, 92, 78, 9);    // sheet
      Rt('#e8e8ee', 46, 86, 56, 7);    // lab coat body
      Rt('#9aa0ad', 100, 86, 9, 7);    // head
      Rt('#777e90', 104, 84, 6, 3);    // hair
      Rt('#3c3c46', 38, 87, 9, 5);     // shoes
      if (!has('keycard')) { Rt('#ffd34d', 92, 88, 7, 4); Rt('#7fd6ff', 93, 89, 2, 2); }
      // medkit cabinet
      Rt('#d8dce4', 134, 58, 26, 22);
      if (!S.flags.medkitTaken) { Rt('#e04848', 143, 62, 8, 3); Rt('#e04848', 145, 60, 3, 8); }
      else Rt('#33384a', 138, 62, 18, 14);
      // scanner
      Rt('#2c3744', 168, 56, 22, 50);
      Rt(POW() ? '#43d17a' : '#26282f', 172, 62, 14, 8);
      // cryo pod
      Rt('#3a4a5c', 226, 42, 56, 84);
      Rt(S.flags.cryoOpen ? '#0a0c14' : (POW() ? '#7fd6ff' : '#9fb2c4'), 234, 50, 40, 60);
      if (!S.flags.cryoOpen) {
        Rt('rgba(255,255,255,0.55)', 236, 52, 36, 56);
        Rt('#caa', 248, 66, 12, 10);   // a face, dimly
      }
      Rt(POW() ? '#43d17a' : '#26282f', 250, 116, 8, 5);
      // NPCs
      if (S.flags.vanceDown && !S.flags.vanceHealed) drawVanceDown(192, 146);
      if (S.flags.vanceHealed && !S.flags.vanceAtPods) drawNPC(244, 152, VCOL);
    },
    hotspots() {
      const hs = [];
      hs.push({ id: 'body', name: 'Dr. Hobbs', rect: [38, 82, 78, 26],
        look: 'Dr. Hobbs — per the badge — lies on the exam bed where he ran out of time, samples clutched in one hand. He has been gone a long while. He looks peaceful. Researchers usually do, once the grant cycle ends.',
        talk: '"I\'m going to borrow some things," you explain. Dr. Hobbs raises no objection. You take that as enthusiastic consent.',
        use: 'There is nothing to be done for him. There hasn\'t been for a long time.' });
      if (!has('keycard')) hs.push({ id: 'keycard', name: 'Keycard', rect: [90, 86, 11, 8],
        look: "A level-3 keycard clipped to the doctor's coat.",
        take: () => { give('keycard'); award('keycard'); return 'You unclip Dr. Hobbs\' keycard. "Strictly a loan," you assure him.'; },
        use: () => { give('keycard'); award('keycard'); return 'You pocket the keycard with the practiced ease of a man who cleans offices after hours.'; } });
      hs.push({ id: 'medcab', name: 'Medical cabinet', rect: [134, 58, 26, 22],
        look: S.flags.medkitTaken ? 'The cabinet hangs open and empty, like your stomach.' : 'A wall cabinet with a red cross. Inside, presumably, the good stuff.',
        use: () => takeMedkit(), take: () => takeMedkit() });
      hs.push({ id: 'scanner', name: 'Diagnostic scanner', rect: [168, 56, 22, 50],
        look: 'A diagnostic scanner. Its last log entry reads: PATIENT UNCOOPERATIVE (DECEASED).',
        use: POW() ? 'You scan yourself. Diagnosis: stressed, underpaid, alive. Two out of three are fixable.' : 'No power. The scanner dreams of electric sheep.' });
      hs.push({ id: 'cryo', name: 'Cryo pod', rect: [226, 42, 56, 84],
        look: S.flags.cryoOpen ? 'The pod stands open, dripping thawed frost.' :
          POW() ? 'The cryo pod hums, panel alive: OCCUPANT — VANCE, M., LT. VITALS: LOW. The emergency release glows invitingly.' :
            'A cryo pod, frosted over. Through the glass: a face. The panel is dead, but pods this model sip from internal batteries for years. Someone might still be alive in there. Power would tell you.',
        use: () => {
          if (S.flags.cryoOpen) return 'It is already open. And dripping.';
          if (!POW()) return 'You press the release. Nothing. The pod needs station power to cycle safely, and "safely" feels important here.';
          S.flags.cryoOpen = 1; S.flags.vanceDown = 1; SFX.door(); save();
          msg('You hit the emergency release. The pod hisses, cracks, and a woman in a green flight suit spills out in a cloud of vapor, shaking violently.');
          msg('She is alive — barely. Cryo-sickness. She needs medical attention NOW.');
          return null;
        } });
      if (S.flags.vanceDown && !S.flags.vanceHealed) hs.push({ id: 'vance', name: 'Lt. Vance', rect: [186, 138, 46, 18],
        look: 'Lt. Vance, half-frozen on the floor, shivering through cryo-sickness. Without help, she will not make it.',
        talk: '"Cryo..." she manages. "...sickness. Med...kit..." Helpfully specific, even while dying.',
        use: 'She needs medicine, not encouragement.',
        take: 'You are not carrying her anywhere in this state. Either of you.',
        item: (i) => {
          if (i !== 'medkit') return 'She needs a medkit, not that.';
          drop('medkit'); S.flags.vanceHealed = 1; S.flags.vanceDown = 0; award('heal');
          if (S.flags.lockdownLifted) S.flags.vanceAtPods = 1;
          msg('You crack open the TraumaTech kit: thermal wrap, stim hypo, instructions in Comic Sans. You administer all three.');
          msg('"Lt. Mira Vance," she rasps, color returning. "Pilot. The evac missed me — my pod glitched. Fourteen MONTHS? ...Okay. Crying later. Flying now."');
          give('authchip');
          msg('She presses a chip into your hand — her pilot authorization. "Lockdown is keyed from the bridge, captain\'s override. Get it lifted. I\'ll prep the last pod."');
          if (S.flags.lockdownLifted) msg('"Lockdown\'s already off? Then move it, janitor — pod bay, west corridor!" She jogs out, wobbling only slightly.');
          save();
          return null;
        } });
      if (S.flags.vanceHealed && !S.flags.vanceAtPods) hs.push({ id: 'vance', name: 'Lt. Vance', rect: [234, 130, 22, 42],
        look: 'Lt. Vance, upright and steadier by the minute. She is doing pilot stretches. They look made up.',
        talk: '"Bridge override gets the lockdown off — captain\'s code, the keypad in the east corridor. Then meet me at the pods. And hey... thanks, janitor." "Sanitation engineer," you correct. "First class."',
        item: () => 'She is fine now. Better than you, arguably.' });
      return hs;
    },
    zones() {
      return [
        { rect: [128, 164, 64, 16], check: () => ({ room: 'corw', x: 80, y: 140 }) },
      ];
    },
  },

  // ------------------------------------------------ CREW QUARTERS
  crew: {
    name: 'Crew Quarters',
    safe: [160, 160],
    intro: 'Crew quarters: triple bunks, personal lockers, and the particular silence of a room where alarm clocks will never ring again. A terminal sits on the corner desk.',
    draw() {
      baseRoom('#242031', '#46405e', '#262230', '#3e3850');
      lightsRow(); wallPanels(80);
      // bunks
      Rt('#3a3550', 28, 56, 80, 64);
      Rt('#5a527a', 30, 70, 76, 6); Rt('#5a527a', 30, 96, 76, 6);
      Rt('#8d86a8', 32, 62, 72, 7); Rt('#8d86a8', 32, 88, 72, 7); Rt('#8d86a8', 32, 112, 72, 7);
      Rt('#c8c2dd', 34, 61, 18, 5);  // pillows
      Rt('#c8c2dd', 34, 87, 18, 5);
      Rt('#aa3344', 60, 110, 30, 6); // unmade blanket
      if (!S.flags.padTaken) { Rt('#1a1e2a', 62, 104, 14, 6); Rt('#43d17a', 64, 105, 4, 2); }
      // locker
      Rt('#3e4458', 146, 58, 30, 66);
      if (S.flags.lockerOpen) {
        Rt('#14161f', 150, 62, 22, 58);
        if (!S.flags.flashTaken) { Rt('#ffd34d', 154, 84, 14, 6); Rt('#8d96ad', 164, 82, 5, 10); }
      } else {
        Rt('#2c3142', 158, 60, 2, 62);
        Rt('#c9a227', 166, 86, 5, 6);
        Rt('#7fd6ff', 150, 66, 7, 7); Rt('#e04848', 150, 76, 7, 5); // stickers
      }
      // desk + terminal
      Rt('#4a4036', 222, 96, 76, 6);
      Rt('#3a322a', 226, 102, 6, 24); Rt('#3a322a', 288, 102, 6, 24);
      Rt('#2c3142', 238, 62, 44, 34);
      Rt(POW() ? '#1a3a1a' : '#0c0e14', 242, 66, 36, 26);
      if (POW()) { Rt('#43d17a', 245, 70, 26, 2); Rt('#43d17a', 245, 75, 30, 2); Rt('#43d17a', 245, 80, 20, 2); }
    },
    hotspots() {
      const hs = [];
      hs.push({ id: 'bunks', name: 'Bunks', rect: [28, 56, 80, 64],
        look: 'Triple bunks, made with military precision. Except one, which is made with civilian honesty.',
        use: 'Tempting. But napping through your own rescue would be very on-brand, and you refuse.' });
      if (!S.flags.padTaken) hs.push({ id: 'datapad', name: 'Datapad', rect: [60, 102, 18, 10],
        look: () => datapadText(),
        take: () => { S.flags.padTaken = 1; give('datapad'); return datapadText(); },
        use: () => { S.flags.padTaken = 1; give('datapad'); return datapadText(); } });
      hs.push({ id: 'locker', name: 'Locker', rect: [146, 58, 30, 66],
        look: S.flags.lockerOpen ?
          (S.flags.flashTaken ? 'Open and empty. It served well.' : 'Open. A heavy flashlight sits inside, exactly as promised.') :
          'A personal locker, code-locked. Stickers: a band called GRAVITY WELL, and one that reads MY OTHER LOCKER IS ALSO A LOCKER.',
        use: () => {
          if (S.flags.lockerOpen) return 'It is already open.';
          askCode('LOCKER CODE', (code) => {
            if (code === '2389') {
              S.flags.lockerOpen = 1; award('locker'); SFX.door();
              msg('CLUNK. The locker swings open. The Great Zero-G Fondue Incident saves a life at last.');
              save();
            } else { SFX.denied(); msg('The locker buzzes at you, unimpressed. Wrong code.'); }
          });
          return null;
        },
        item: (i) => i === 'prybar' ? 'You consider prying it, but the hinges are inboard and the metal is honest. This one needs the code.' : undefined });
      if (S.flags.lockerOpen && !S.flags.flashTaken) hs.push({ id: 'flashlight', name: 'Flashlight', rect: [152, 80, 18, 12],
        look: 'A maintenance flashlight. Heavy enough to double as a counterargument.',
        take: () => { S.flags.flashTaken = 1; give('flashlight'); award('flashlight'); return 'You take the flashlight. Darkness, consider yourself on notice.'; },
        use: () => { S.flags.flashTaken = 1; give('flashlight'); award('flashlight'); return 'Flashlight: acquired. Confidence: restored.'; } });
      hs.push({ id: 'terminal', name: 'Terminal', rect: [226, 60, 60, 42],
        look: POW() ? "The terminal glows. The captain's final log is queued on screen, flagged ALL HANDS." :
          'A crew terminal, dark. Its dead screen reflects you: tired, lightly heroic, in need of a shave.',
        use: () => {
          if (!POW()) return 'You press the power stud. The screen stays a flawless, useless black. Power first.';
          captainsLog();
          return null;
        } });
      return hs;
    },
    zones() {
      return [
        { rect: [128, 164, 64, 16], check: () => ({ room: 'core', x: 42, y: 140 }) },
      ];
    },
  },

  // ------------------------------------------------ MESS HALL
  mess: {
    name: 'Mess Hall',
    safe: [160, 160],
    intro: 'The mess hall. Bolted tables, racked chairs, and an AutoChef 3000 standing guard over the last NutriBar on the station. Something on the stove has outlived its makers. In the corner, a floor hatch is stenciled SUBLEVEL — MAINTENANCE.',
    draw() {
      baseRoom('#252118', '#4a4534', '#28241c', '#403a2c');
      lightsRow(); wallPanels(80);
      // counter + stove + pot
      Rt('#4a4036', 40, 86, 104, 8);
      Rt('#3a322a', 44, 94, 8, 32); Rt('#3a322a', 130, 94, 8, 32);
      Rt('#33384a', 60, 78, 22, 8);   // stove
      Rt('#5a6470', 64, 70, 14, 9);   // pot
      Rt('#4a7a3a', 66, 68, 10, 3);   // the chowder. it knows.
      // tables
      Rt('#4a4036', 36, 130, 56, 5); Rt('#3a322a', 42, 135, 5, 14); Rt('#3a322a', 82, 135, 5, 14);
      Rt('#4a4036', 104, 142, 56, 5); Rt('#3a322a', 110, 147, 5, 14); Rt('#3a322a', 150, 147, 5, 14);
      // AutoChef
      Rt('#8d96ad', 176, 56, 48, 70);
      Rt('#2c3142', 182, 62, 36, 20);
      Rt('#0c0e14', 184, 64, 32, 16);
      Rt('#1a1e2a', 184, 92, 32, 12);  // slot
      if (!S.flags.snackGot) Rt('#ffd34d', 192, 96, 14, 5);
      if (S.flags.snackGot) Rt('#454c63', 198, 100, 14, 8); // dent
      Rt('#e04848', 186, 110, 6, 6); Rt('#43d17a', 196, 110, 6, 6);
      // hatch
      if (S.flags.hatchOpen) { Rt('#07080e', 240, 146, 32, 18); Rt('#3a4054', 244, 148, 3, 14); Rt('#3a4054', 264, 148, 3, 14); }
      else { Rt('#3a4054', 240, 146, 32, 18); Rt('#262b3d', 244, 150, 24, 10); Rt('#c9a227', 252, 153, 8, 4); }
      hazard(240, 142, 32, 4);
      // jukebox
      Rt('#6a3a8a', 280, 58, 32, 68);
      Rt('#ffd34d', 286, 64, 20, 8);
      Rt('#7fd6ff', 286, 76, 8, 8); Rt('#e04848', 298, 76, 8, 8);
    },
    hotspots() {
      return [
        { id: 'tables', name: 'Tables', rect: [36, 126, 124, 34],
          look: 'Bolted tables, chairs neatly racked. The evacuation was orderly — in here, at least.' },
        { id: 'pot', name: 'Pot of chowder', rect: [60, 66, 22, 20],
          look: 'A pot on the cold stove. Fourteen-month chowder. The surface flexes slightly when you look at it, as if looking back. It may have unionized.',
          take: 'You reach for the pot. The chowder growls. You withdraw the hand and your ambitions.',
          talk: 'You address the chowder. It burbles something in a language older than soup.',
          use: () => { die('You taste the chowder. The chowder — in a development that surprises absolutely no one but you — tastes you back. The station\'s oldest lifeform claims another victory.'); return null; } },
        { id: 'autochef', name: 'AutoChef 3000', rect: [176, 56, 48, 70],
          look: S.flags.snackGot ? 'The AutoChef 3000, now with one (1) commemorative dent. Out of order, and out of NutriBars.' :
            'An AutoChef 3000 food printer. The service panel is locked. A single NutriBar is visible behind the dispenser slot, taunting you.',
          use: 'You press SNACK. The screen replies: "INSUFFICIENT POWER. INSUFFICIENT CREDIT. INSUFFICIENT PATIENCE DETECTED."',
          take: 'It is bolted down with the conviction of a machine that has been stolen before.',
          item: (i) => {
            if (i !== 'prybar') return undefined;
            if (S.flags.snackGot) return 'The AutoChef has nothing left to give. You have taken everything from it.';
            S.flags.snackGot = 1; give('snackbar'); award('snack'); SFX.door();
            return 'You apply leverage to the service panel. The AutoChef makes a noise best described as betrayal, and a lone NutriBar rattles out of the slot.';
          } },
        { id: 'hatch', name: 'Floor hatch', rect: [238, 142, 36, 22],
          look: S.flags.hatchOpen ? 'The open hatch breathes cool air. A ladder descends into the sublevel dark. Something down there is either ventilation or breathing.' :
            'A floor hatch stenciled SUBLEVEL — MAINTENANCE. The handle is heavy and the stencil is peeling.',
          use: () => {
            if (S.flags.hatchOpen) return 'It is open. The hole seems content.';
            S.flags.hatchOpen = 1; award('hatch'); SFX.door(); save();
            return 'You haul the hatch open. From below: darkness, the smell of machine oil, and a faint rhythmic sound. Probably ventilation. Probably.';
          } },
        { id: 'jukebox', name: 'Jukebox', rect: [280, 58, 32, 68],
          look: 'A "SpaceTunes" entertainment console. Top track for 61 straight weeks: "Station Funk (Extended Mix)."',
          use: () => { SFX.funk(); return 'You hit PLAY. Three glorious seconds of Station Funk echo through the empty mess hall. Morale improves measurably.'; },
          talk: 'You request a track. It requests a credit chip. Stalemate.' },
      ];
    },
    zones() {
      return [
        { rect: [128, 164, 64, 16], check: () => ({ room: 'core', x: 138, y: 140 }) },
        { rect: [242, 150, 28, 14], check: () => {
            if (!S.flags.hatchOpen) return null;
            if (!has('flashlight')) return 'It is very, very dark down there. Climbing into monster-flavored darkness without a light strikes you as a rookie move, and you are at least mid-career.';
            return { room: 'sub', x: 262, y: 152 };
          } },
      ];
    },
  },

  // ------------------------------------------------ SUBLEVEL
  sub: {
    name: 'Sublevel',
    safe: [262, 152],
    intro: 'The sublevel. Your flashlight carves a cone out of darkness that feels occupied. Pipes sweat overhead. Against the far wall, a rack holds one intact fuel cell — its charge light a small green star. The darkness around it has scales.',
    draw() {
      baseRoom('#101218', '#1a1d26', '#0e1014', '#14161c');
      // pipes
      Rt('#262b3d', 0, 18, W, 6); Rt('#1d2130', 0, 26, W, 4);
      Rt('#262b3d', 40, 18, 5, 108); Rt('#262b3d', 200, 18, 5, 108);
      // rack + cell
      Rt('#33384a', 50, 80, 38, 46);
      Rt('#262b3d', 54, 84, 30, 38);
      if (!S.flags.cellTaken) { Rt('#5a6470', 60, 92, 18, 24); Rt('#7fd6ff', 64, 96, 10, 14); }
      // creature mass
      if (!S.flags.fed) {
        Rt('#13241b', 84, 76, 74, 50);
        Rt('#0e1c14', 96, 66, 50, 24);
        Rt('#13241b', 150, 96, 30, 30);
      }
      // ladder
      Rt('#3a4054', 252, 20, 4, 110); Rt('#3a4054', 266, 20, 4, 110);
      ctx.fillStyle = '#3a4054';
      for (let y = 26; y < 128; y += 10) ctx.fillRect(252, y, 18, 3);
      // puddle
      Rt('rgba(40,60,80,0.5)', 120, 152, 50, 6);
    },
    post() {
      // darkness with flashlight cone
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(S.x, S.y - 12, 52, 0, 7);
      ctx.fillStyle = 'rgba(2,3,10,0.93)';
      ctx.fill('evenodd');
      ctx.restore();
      // things visible in the dark
      if (!S.flags.cellTaken) Rt('#9fe8ff', 66, 99, 6, 3); // cell glow
      if (!S.flags.fed) {
        const blink = (Math.floor(Date.now() / 1400) % 5) !== 0;
        if (blink) { Rt('#ffd34d', 108, 84, 4, 3); Rt('#ffd34d', 120, 86, 4, 3); }
      }
    },
    hotspots() {
      const hs = [];
      if (!S.flags.cellTaken) hs.push({ id: 'cell', name: 'Fuel cell', rect: [50, 80, 38, 46],
        look: S.flags.fed ? 'The fuel cell sits in its rack, fully charged and — crucially — no longer guarded.' :
          'A rack holding one intact fuel cell, charge light green. Around its base, the darkness is thicker than physics requires. The thick part has scales. The scales are breathing.',
        take: () => takeCell(), use: () => takeCell() });
      if (!S.flags.fed) hs.push({ id: 'creature', name: 'Something in the dark', rect: [84, 64, 96, 62],
        look: 'Two amber eyes regard you from the dark, blinking out of sync. Below them, the suggestion of a very committed digestive system. It is coiled around the fuel cell rack like a scaly security deposit.',
        talk: '"Nice... whatever you are," you offer. It purrs like a garbage disposal clearing its throat.',
        use: 'You are NOT petting that.',
        take: 'Other way around, more likely.',
        item: (i) => {
          if (i !== 'snackbar') return 'The eyes track the object with polite disinterest. Wrong offering.';
          drop('snackbar'); S.flags.fed = 1; award('feed'); save();
          msg('You unwrap the NutriBar. The aroma of Simulated Cheese Product rolls into the dark like a foghorn.');
          msg('The eyes go wide. A tongue — you will be unpacking that detail in therapy — snatches the bar from your hand. The creature scoops itself lovingly around its prize and flows away into a floor vent, satisfied.');
          msg('The fuel cell rack stands unguarded.');
          return null;
        } });
      hs.push({ id: 'pipes', name: 'Pipes', rect: [0, 16, 200, 16],
        look: 'Pipes sweat in the dark. One is labeled COOLANT in the hopeful way of labels everywhere.' });
      hs.push({ id: 'ladder', name: 'Ladder', rect: [248, 18, 24, 112],
        look: 'The ladder back up to civilization, or at least to the mess hall.',
        use: () => { goRoom('mess', 256, 160); return null; } });
      return hs;
    },
    zones() {
      return [
        { rect: [290, 132, 30, 42], check: () => ({ room: 'mess', x: 256, y: 160 }) },
      ];
    },
  },

  // ------------------------------------------------ ENGINEERING
  eng: {
    name: 'Engineering',
    safe: [160, 160],
    intro: 'Engineering. A toroidal reactor dominates the room, cold and dark, its fuel cradle conspicuously empty. To one side, a ruptured conduit spits fat blue sparks. The consoles are dead, but the room still smells faintly of competence.',
    draw() {
      baseRoom('#231d2a', '#41384e', '#241f28', '#3a3344');
      lightsRow(); wallPanels(80);
      // conduit
      Rt('#2c3142', 34, 50, 20, 74);
      Rt('#10121c', 38, 64, 12, 30);
      if (Math.random() < 0.55) {
        const sy = 64 + Math.random() * 28, sx = 38 + Math.random() * 10;
        Rt('#7fd6ff', sx, sy, 2, 2); Rt('#ffffff', sx + 2, sy + 1, 1, 1);
        if (Math.random() < .3) Rt('#7fd6ff', sx - 3, sy + 4, 2, 1);
      }
      // reactor torus
      const on = POW();
      Rt('#33384a', 108, 34, 104, 80);
      Rt(on ? '#1a4a5c' : '#14161f', 120, 44, 80, 60);
      Rt(on ? '#7fd6ff' : '#26282f', 136, 58, 48, 32);
      Rt(on ? '#d8f6ff' : '#1a1d26', 150, 68, 20, 12);
      // fuel cradle
      Rt('#3a4054', 140, 108, 40, 14);
      if (on) { Rt('#5a6470', 150, 110, 18, 10); Rt('#7fd6ff', 154, 112, 10, 6); }
      else Rt('#0c0e14', 150, 110, 18, 10);
      // consoles
      Rt('#2c3142', 232, 64, 70, 50);
      Rt(on ? '#1a3a1a' : '#0c0e14', 238, 70, 26, 18);
      Rt(on ? '#1a3a1a' : '#0c0e14', 270, 70, 26, 18);
      if (on) { Rt('#43d17a', 241, 74, 18, 2); Rt('#43d17a', 241, 79, 14, 2); Rt('#e04848', 273, 74, 8, 2); Rt('#43d17a', 273, 79, 18, 2); }
      Rt('#3a4054', 236, 96, 62, 12);
    },
    hotspots() {
      return [
        { id: 'conduit', name: 'Sparking conduit', rect: [34, 50, 20, 74],
          look: 'A ruptured power conduit, spitting blue sparks even on battery reserve. It hums a low song about amperage and consequences.',
          use: () => { die('You reach toward the sparking conduit and briefly become the brightest thing on Station ECHO-7. Somewhere, your high-school physics teacher feels a sudden, unexplained surge of vindication.'); return null; },
          take: () => { die('You grab the sparking conduit with both hands, demonstrating the kind of decisiveness that gets mentioned at funerals.'); return null; } },
        { id: 'reactor', name: 'Reactor', rect: [108, 34, 104, 80],
          look: POW() ? 'The reactor hums along, rings glowing a contented cyan. It is doing more work than anyone else on this station, including you.' :
            'A toroidal fusion reactor, cold and dark. Without a fuel cell it is just very expensive furniture.' },
        { id: 'socket', name: 'Fuel cradle', rect: [136, 104, 48, 20],
          look: POW() ? 'The fuel cell sits snug in its cradle, doing quiet heroic work.' :
            'The reactor\'s fuel cradle — empty. A cell-shaped absence at the exact center of all your problems.',
          use: POW() ? 'It is working. Touching it further would be showing off.' :
            'The cradle clamps sit open, waiting for a cell that someone, somewhere, definitely did not eat.',
          item: (i) => {
            if (i !== 'fuelcell') return POW() ? 'The reactor needs nothing further.' : 'The cradle wants a fuel cell. That is not a fuel cell.';
            if (POW()) return 'Already humming.';
            drop('fuelcell'); S.flags.power = 1; award('install');
            SFX.power(); S.flash = 26; save();
            msg('You seat the cell. The clamps lock. Somewhere deep in the station, a very large machine clears its throat...');
            msg('Lights stutter awake, deck by deck. Air handlers exhale. Consoles boot and immediately start complaining. Station ECHO-7 is ALIVE.');
            msg('Somewhere, faintly, something beeps that has not beeped in fourteen months.');
            return null;
          } },
        { id: 'engcon', name: 'Consoles', rect: [232, 64, 70, 50],
          look: POW() ? 'Status boards scroll: LIFE SUPPORT NOMINAL. GRAVITY NOMINAL. COFFEE MACHINE: ERROR 418.' :
            'Dead consoles. The screens hold your reflection and nothing else.',
          use: POW() ? 'You acknowledge forty-one accumulated alerts. The console seems grateful.' : 'You press keys. The console maintains its vow of silence.' },
      ];
    },
    zones() {
      return [
        { rect: [128, 164, 64, 16], check: () => ({ room: 'core', x: 214, y: 140 }) },
      ];
    },
  },

  // ------------------------------------------------ BRIDGE
  bridge: {
    name: 'Bridge',
    safe: [160, 160],
    intro: 'The bridge. A wide viewscreen frames the local star and a freckled moon. The captain\'s chair waits, high-backed and suspiciously comfortable. On the security console, one light blinks red: LOCKDOWN.',
    draw() {
      baseRoom('#1a2030', '#333e5e');
      lightsRow();
      // viewscreen
      Rt('#10121c', 56, 14, 208, 62);
      stars(60, 18, 200, 54, 99, 70);
      ctx.fillStyle = '#8a6fae';
      ctx.beginPath(); ctx.arc(220, 46, 16, 0, 7); ctx.fill();
      ctx.fillStyle = '#6f5790';
      ctx.beginPath(); ctx.arc(214, 42, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(226, 52, 3, 0, 7); ctx.fill();
      Rt('#ffe9a0', 96, 34, 3, 3);  // the local star, glamour shot
      // console row
      Rt('#2c3142', 60, 86, 90, 26);
      Rt(POW() ? '#1a3a1a' : '#0c0e14', 66, 90, 34, 14);
      Rt(POW() ? '#1a3a1a' : '#0c0e14', 106, 90, 34, 14);
      if (POW()) { Rt('#43d17a', 69, 94, 24, 2); Rt('#7fd6ff', 109, 94, 20, 2); }
      // security console
      Rt('#2c3142', 258, 74, 48, 46);
      Rt(POW() ? '#3a1a1a' : '#0c0e14', 264, 80, 36, 18);
      if (POW()) Rt(S.flags.lockdownLifted ? '#43d17a' : '#e04848', 270, 85, S.flags.lockdownLifted ? 24 : 14, 4);
      Rt(S.flags.lockdownLifted ? '#2a5a3a' : '#7a2a2a', 270, 102, 24, 12); // the big honest button
      // captain's chair
      Rt('#3a4054', 144, 96, 32, 10);
      Rt('#4a5066', 148, 78, 24, 20);
      Rt('#2c3142', 154, 106, 12, 16);
    },
    hotspots() {
      return [
        { id: 'viewscreen', name: 'Viewscreen', rect: [56, 14, 208, 62],
          look: 'The forward viewscreen: the local star, and the freckled curve of an unnamed moon. A real estate listing would call the view "unbeatable" and the station "cozy."' },
        { id: 'chair', name: "Captain's chair", rect: [140, 76, 40, 46],
          look: 'The captain\'s chair. High-backed, command-grade, suspiciously comfortable-looking.',
          use: 'You sit. Authority flows through you — figuratively. You feel approximately 8% more important. You stand up before it goes to your head.',
          take: 'It is bolted to the deck, like all the best chairs.' },
        { id: 'navcon', name: 'Nav console', rect: [60, 86, 90, 26],
          look: POW() ? 'The nav console\'s last entry: an evacuation course, executed fourteen months ago. Beneath it, a sticky note: "If found, water the plants. — Cpt." The plants did not make it.' :
            'A dead nav console.',
          use: POW() ? 'You check the boards: every shuttle and pod logged out long ago. All but one — Pod Bay 1, west corridor. Your ride.' :
            'Nothing. It dreams of vectors.' },
        { id: 'lockcon', name: 'Security console', rect: [258, 74, 48, 46],
          look: S.flags.lockdownLifted ? 'The security console glows a serene green: LOCKDOWN RELEASED.' :
            'A security console blinking LOCKDOWN ACTIVE: DOCKING & POD BAYS. Below the warning sits one large, honest button labeled RELEASE.',
          use: () => {
            if (!POW()) return 'Dead, like everything else before you fixed the reactor.';
            if (S.flags.lockdownLifted) return 'Already released. Pressing it again would just be for the feeling, and you respect buttons too much for that.';
            S.flags.lockdownLifted = 1; award('lockdown'); SFX.door();
            msg('You press RELEASE. A klaxon chirps once, embarrassed. "LOCKDOWN RELEASED," the station announces, to an audience of approximately two.');
            if (S.flags.vanceHealed) { S.flags.vanceAtPods = 1; msg('Your borrowed comm crackles. Vance: "Felt that from here. Pod bay, west corridor. Move it, janitor."'); }
            save();
            return null;
          } },
      ];
    },
    zones() {
      return [
        { rect: [128, 164, 64, 16], check: () => ({ room: 'core', x: 286, y: 140 }) },
      ];
    },
  },

  // ------------------------------------------------ POD BAY
  pods: {
    name: 'Pod Bay 1',
    safe: [160, 160],
    intro: 'Pod Bay 1. Four cradles stand empty, dust outlining where hope used to park. The fifth holds a stubby escape pod, hatch open, pre-flight lights green. After fourteen months, this room still smells like leaving.',
    draw() {
      baseRoom('#1c2430', '#37485e');
      lightsRow(); wallPanels(80);
      // empty cradles
      for (let i = 0; i < 3; i++) {
        const x = 34 + i * 50;
        Rt('#2c3142', x, 92, 36, 30);
        Rt('#171b28', x + 4, 96, 28, 22);
        Rt('#454c63', x + 4, 118, 28, 4);
      }
      // pod console
      Rt('#2c3142', 182, 80, 24, 44);
      Rt(POW() ? '#3a1a1a' : '#0c0e14', 186, 86, 16, 10);
      if (POW()) Rt('#e04848', 189, 89, 10, 3);
      Rt('#1a1e2a', 186, 100, 16, 6); // chip slot
      // the pod
      Rt('#3a4054', 216, 110, 90, 14);  // cradle
      Rt('#8d96ad', 222, 56, 80, 56);   // hull
      Rt('#aab2c4', 230, 50, 60, 10);   // top
      Rt('#0a0c14', 238, 66, 22, 30);   // open hatch
      Rt('#43d17a', 270, 64, 5, 5); Rt('#43d17a', 270, 74, 5, 5); Rt('#43d17a', 270, 84, 5, 5);
      Rt('#7fd6ff', 286, 66, 10, 16);   // window
      hazard(216, 124, 90, 5);
      if (S.flags.vanceAtPods) drawNPC(150, 152, VCOL);
    },
    hotspots() {
      const hs = [];
      hs.push({ id: 'cradles', name: 'Empty cradles', rect: [34, 92, 136, 30],
        look: 'Empty pod cradles, dust shadows where the rest of the fleet used to sit. The crew got out. Eventually, so will you.' });
      hs.push({ id: 'pod', name: 'Escape pod', rect: [216, 50, 90, 74],
        look: 'Escape Pod 1: a stubby lifeboat with seating for four and ambitions of seating two comfortably. Pre-flight lights are green. It looks eager.',
        use: 'The hatch is open, but the cradle console controls the launch — and it wants pilot authorization.',
        take: 'That is the plan, yes, but paperwork first.' });
      hs.push({ id: 'podcon', name: 'Cradle console', rect: [182, 80, 24, 44],
        look: 'The cradle console. A slot blinks insistently: PILOT AUTH REQUIRED.',
        use: '"PILOT AUTHORIZATION REQUIRED," the console insists. You, a sanitation engineer, are technically authorized to launch only mops.',
        item: (i) => {
          if (i !== 'authchip') return 'The slot is chip-shaped. That is not chip-shaped.';
          if (!S.flags.vanceAtPods) return 'The console accepts the chip, then adds: PILOT PRESENCE REQUIRED. It wants Vance here in person. Where did she get to?';
          msg('You slot Vance\'s chip. The console turns green top to bottom. "AUTHORIZATION CONFIRMED. WELCOME ABOARD."');
          msg('Vance is already strapping in. "Hold onto your mop," she says.');
          endGame();
          return null;
        } });
      if (S.flags.vanceAtPods) hs.push({ id: 'vance2', name: 'Lt. Vance', rect: [140, 130, 22, 42],
        look: 'Lt. Vance runs the pre-flight like she has done it a thousand times, because she has.',
        talk: '"Chip in the console, strap in, and we are GONE. First round at Waypoint Station is on me. The second round is also somehow on you."',
        use: 'She is busy. And armed with checklists.' });
      return hs;
    },
    zones() {
      return [
        { rect: [128, 164, 64, 16], check: () => ({ room: 'corw', x: 220, y: 140 }) },
      ];
    },
  },
};

// shared multi-room handlers
function takeMedkit() {
  if (S.flags.medkitTaken) return 'The cabinet is empty. You have already pillaged it, medically speaking.';
  S.flags.medkitTaken = 1; give('medkit'); award('medkit');
  return 'You take the TraumaTech medkit. Forty percent more gauze. You feel ready for anything bandageable.';
}
function takeCell() {
  if (S.flags.cellTaken) return 'You already have it.';
  if (!S.flags.fed) {
    die('You reach for the fuel cell. The darkness uncoils. The last thing you see is teeth — quite a lot of teeth, arranged with no particular plan but tremendous enthusiasm.');
    return null;
  }
  S.flags.cellTaken = 1; give('fuelcell'); award('cell');
  return 'You ease the fuel cell from its rack. Still warm, fully charged, and only lightly drooled upon.';
}

/* ============================================================
   INPUT
   ============================================================ */
const K = { left: 0, right: 0, up: 0, down: 0 };
const VERBS = ['walk', 'look', 'use', 'take', 'talk'];

function setVerb(v) {
  S.verb = v; S.active = null;
  document.querySelectorAll('.vbtn[data-v]').forEach(b => b.classList.toggle('sel', b.dataset.v === v));
  renderInv(); hudStatus();
}
document.querySelectorAll('.vbtn[data-v]').forEach(b => {
  b.onclick = () => { ac(); if (S.mode === 'play') setVerb(b.dataset.v); };
});
document.getElementById('hintbtn').onclick = () => { ac(); if (S.mode === 'play') giveHint(); };

function mpos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function topHot(p) {
  const hs = ROOMS[S.room].hotspots();
  for (let i = hs.length - 1; i >= 0; i--) {
    const h = hs[i], r = h.rect;
    if (p.x >= r[0] && p.x <= r[0] + r[2] && p.y >= r[1] && p.y <= r[1] + r[3]) return h;
  }
  return null;
}
cv.addEventListener('mousemove', e => {
  if (!S || S.mode !== 'play') { hover = null; return; }
  hover = topHot(mpos(e)); hudStatus();
});
cv.addEventListener('mouseleave', () => { hover = null; if (S && S.mode === 'play') hudStatus(); });
cv.addEventListener('click', e => {
  ac();
  if (!S || S.mode !== 'play' || S.input) return;
  const p = mpos(e);
  const h = topHot(p);
  if (S.active) {
    if (h) tryAct(h, 'use', S.active);
    else { msg('Use it on something specific. The air is not interested.'); S.active = null; renderInv(); hudStatus(); }
    return;
  }
  if (S.verb === 'walk') {
    S.walkT = { x: clamp(p.x, XMIN, XMAX), y: clamp(p.y, YMIN, YMAX) };
    S.pending = null;
    return;
  }
  if (!h) { msg(pick(['Nothing interesting there.', 'That is a wall. Classic wall.', 'You admire the deck plating. Industrial chic.'])); return; }
  tryAct(h, S.verb);
});
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!S || S.mode !== 'play') return;
  const i = (VERBS.indexOf(S.verb) + 1) % VERBS.length;
  setVerb(VERBS[i]); SFX.blip();
});

document.addEventListener('keydown', e => {
  if (!S) return;
  if (S.mode === 'title' || S.mode === 'dead' || S.mode === 'end') {
    if (e.key === 'Enter' && ovPrimary) { ac(); ovPrimary(); }
    return;
  }
  if (S.mode !== 'play') return;
  if (S.input) {
    if (e.key >= '0' && e.key <= '9') { if (S.input.buf.length < 6) S.input.buf += e.key; SFX.blip(); }
    else if (e.key === 'Backspace') S.input.buf = S.input.buf.slice(0, -1);
    else if (e.key === 'Enter') { const b = S.input.buf, cb = S.input.cb; S.input = null; cb(b); }
    else if (e.key === 'Escape') { S.input = null; msg('You step back from the keypad, keeping your dignity and your wrong guesses to yourself.'); }
    hudStatus(); e.preventDefault();
    return;
  }
  let handled = true;
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': K.left = 1; break;
    case 'ArrowRight': case 'd': case 'D': K.right = 1; break;
    case 'ArrowUp': case 'w': case 'W': K.up = 1; break;
    case 'ArrowDown': case 's': case 'S': K.down = 1; break;
    case '1': setVerb('walk'); break;
    case '2': setVerb('look'); break;
    case '3': setVerb('use'); break;
    case '4': setVerb('take'); break;
    case '5': setVerb('talk'); break;
    case 'h': case 'H': giveHint(); break;
    case 'Escape': S.active = null; S.walkT = null; S.pending = null; renderInv(); hudStatus(); break;
    default: handled = false;
  }
  if (handled) e.preventDefault();
});
document.addEventListener('keyup', e => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': K.left = 0; break;
    case 'ArrowRight': case 'd': case 'D': K.right = 0; break;
    case 'ArrowUp': case 'w': case 'W': K.up = 0; break;
    case 'ArrowDown': case 's': case 'S': K.down = 0; break;
  }
});

/* ============================================================
   UPDATE & RENDER
   ============================================================ */
function checkZones(px, py) {
  const zs = ROOMS[S.room].zones();
  for (const z of zs) {
    const r = z.rect;
    if (S.x >= r[0] && S.x <= r[0] + r[2] && S.y >= r[1] && S.y <= r[1] + r[3]) {
      const res = z.check();
      if (res && typeof res === 'object') { goRoom(res.room, res.x, res.y); return; }
      if (typeof res === 'string') {
        S.x = px; S.y = py; S.walkT = null; S.pending = null;
        if (S.msgCool <= 0) { msg(res); S.msgCool = 90; }
      }
      // res === null/undefined: zone inert right now, walk through freely
      return;
    }
  }
}

function update() {
  if (!S || S.mode !== 'play') return;
  if (S.msgCool > 0) S.msgCool--;
  let dx = 0, dy = 0;
  if (!S.input) {
    if (K.left) dx -= 1; if (K.right) dx += 1;
    if (K.up) dy -= 1; if (K.down) dy += 1;
  }
  if (dx || dy) { S.walkT = null; S.pending = null; }
  else if (S.walkT) {
    const ddx = S.walkT.x - S.x, ddy = S.walkT.y - S.y;
    const d = Math.hypot(ddx, ddy);
    if (d < 2.2) {
      S.x = S.walkT.x; S.y = S.walkT.y; S.walkT = null;
      if (S.pending) {
        const h = findH(S.pending.id);
        const pend = S.pending; S.pending = null;
        if (h) doAction(h, pend.verb, pend.item);
      }
    } else { dx = ddx / d; dy = ddy / d; }
  }
  if (dx || dy) {
    const sp = 1.6, px = S.x, py = S.y;
    const n = Math.hypot(dx, dy) || 1;
    S.x = clamp(S.x + dx / n * sp, XMIN, XMAX);
    S.y = clamp(S.y + dy / n * sp, YMIN, YMAX);
    S.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    S.moving = true;
    S.stepT++;
    if (S.stepT % 7 === 0) S.step = (S.step + 1) % 4;
    checkZones(px, py);
  } else {
    S.moving = false; S.step = 0;
  }
}

function render() {
  if (!S) return;
  const room = ROOMS[S.room];
  room.draw();
  drawPlayer();
  if (room.post) room.post();
  if (S.flash > 0) {
    S.flash--;
    if (S.flash % 4 < 2) Rt('rgba(255,255,255,0.65)', 0, 0, W, H);
  }
}

function frame() {
  update();
  render();
  requestAnimationFrame(frame);
}

/* ============================================================
   DEBUG / TEST HOOKS
   ============================================================ */
window.G = {
  get S() { return S; },
  newGame, continueGame, goRoom, revive, giveHint,
  act(id, verb, item) {
    const h = findH(id);
    if (!h) return 'NO HOTSPOT: ' + id;
    doAction(h, verb, item);
    return 'ok';
  },
  code(c) {
    if (!S.input) return 'NO INPUT MODE';
    const cb = S.input.cb; S.input = null; cb(c); return 'ok';
  },
};

/* ============================================================
   BOOT
   ============================================================ */
S = newState();
hud(); renderInv(); hudStatus();
showTitle();
frame();
