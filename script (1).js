(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const W = 960, H = 540, GY = 470;
const ov = document.createElement('canvas'); ov.width = W; ov.height = H; const oc = ov.getContext('2d');
const scr = document.getElementById('screen'), sTitle = document.getElementById('sTitle'),
      sText = document.getElementById('sText'), startBtn = document.getElementById('startBtn');

/* ================= SPRITES (recortes manuais: x, y, largura, altura) ================= */
let imgOK = false;
const sheet = new Image(); sheet.src = 'assets/protagonista_sprites.png';
// Recortes manuais [x, y, largura, altura] — spritesheet nova
// 0 frente | 1 frente (piscando) | 2 três-quartos (dir.) | 3 costas | 4 perfil (esq.)
// 5-9 caminhada | 10-13 corrida | 14 agachado | 15 pulo (subindo) | 16 pulo (topo) | 17 aterrissagem | 18 ajoelhado (dano)
// 19 mão no bolso | 20 braços cruzados | 21 mão na nuca | 22 olhando p/ baixo | 23 sentado abraçando joelhos
// 24-29 retratos: neutro, bravo, assustado, olhos fechados, triste, olhos vazios
// [x, y, largura, altura, âncora-x (centro dos pés)] — atlas remontado: sprites isolados, com espaço entre eles, já no mesmo porte (2x)
const SP = [
 [10,10,61,208,32],
 [81,10,61,208,32],
 [152,10,64,208,29],
 [226,10,60,207,29],
 [296,10,63,208,31],
 [369,10,90,186,43],
 [469,10,88,185,42],
 [567,10,98,185,47],
 [675,10,92,186,44],
 [777,10,93,184,44],
 [880,10,121,155,49],
 [1011,10,127,158,62],
 [1148,10,117,162,40],
 [1275,10,116,162,36],
 [1401,10,106,160,50],
 [1517,10,105,179,43],
 [1632,10,125,166,55],
 [1767,10,97,159,45],
 [1874,10,96,149,47],
 [10,228,61,209,31],
 [81,228,72,216,40],
 [163,228,69,208,34],
 [242,228,81,212,34],
 [333,228,108,124,52],
 [451,228,131,160,65],
 [592,228,130,160,63],
 [732,228,129,160,62],
 [871,228,132,160,64],
 [1013,228,131,160,64],
 [1154,228,132,160,63]
];
const ANIM = { walk:{f:[5,6,7,8,9],s:8}, run:{f:[10,11,12,13],s:6} };
function drawSprite(i, cx, by, flip, alpha = 1, k = 0.5) {
  if (i === 4) flip = !flip; // o sprite 4 nasce virado para a esquerda
  const s = SP[i]; // todos os sprites já estão normalizados no atlas; só reduzimos de 2x para 1x
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, by); if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.shadowColor = 'rgba(215,205,185,.85)'; ctx.shadowBlur = 6; // contorno de luz
  ctx.drawImage(sheet, s[0], s[1], s[2], s[3], -s[4] * k, -s[3] * k, s[2] * k, s[3] * k);
  ctx.restore();
}

/* ================= ÁUDIO (WebAudio simples) ================= */
let AC = null, master, muted = false, droneO = [], windF, windG, windBase = .04;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = muted ? 0 : .5; master.connect(AC.destination);
  droneO = [55, 58.5, 82].map((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.value = .03; o.connect(g); g.connect(master); o.start(); return o; });
  const n = AC.sampleRate * 3, b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0); let l = 0; // vento / ruído marrom em loop
  for (let i = 0; i < n; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; a[i] = l * 3.5; }
  const src = AC.createBufferSource(); src.buffer = b; src.loop = true; windF = AC.createBiquadFilter(); windF.type = 'lowpass'; windG = AC.createGain(); windG.gain.value = 0;
  src.connect(windF); windF.connect(windG); windG.connect(master); src.start(); setAmbience(typeof lvIdx === 'number' ? lvIdx : 0);
}
// cada capítulo tem seu clima sonoro: graves do zumbido, brilho do vento e volume
const AMB = [ { d:[55,58.5,82], wf:420, wg:.05 }, { d:[50,100,150], wf:1400, wg:.035 }, { d:[49,52,73.5], wf:300, wg:.045 }, { d:[41,43,61], wf:200, wg:.07 }, { d:[55,58,87], wf:700, wg:.06 }, { d:[65,98,130], wf:260, wg:.02 } ];
function setAmbience(i) {
  if (!AC) return; const c = AMB[i], now = AC.currentTime;
  droneO.forEach((o, k) => o.frequency.setTargetAtTime(c.d[k], now, 1.5)); windF.frequency.setTargetAtTime(c.wf, now, 1.5); windBase = c.wg; windG.gain.setTargetAtTime(c.wg, now, 1.5);
}
function ambTick() { // eventos sonoros esporádicos de cada capítulo
  if (!AC || state === 'cut' || state === 'menu' || state === 'end') return; const r = Math.random();
  if (lvIdx === 0) { if (t % 60 === 0) tone(t % 120 ? 1500 : 1900, .04, 'square', .035); if (r < .002) tone(95, .8, 'sawtooth', .05, 70); } // relógio e rangidos da casa
  if (lvIdx === 1) { if (t % 150 === 0) tone(980, .14, 'sine', .05); if (r < .003) noise(.25, .08, 3500); } // monitor cardíaco e estática
  if (lvIdx === 2) { if (t % 110 === 0 && r < .8) { const n = [523, 587, 622, 698, 784, 831][Math.floor(rnd(0, 6))]; tone(n, 1.8, 'triangle', .05); if (Math.random() < .35) tone(n * 1.06, 1.8, 'triangle', .035); } } // caixa de música desafinada
  if (lvIdx === 3) { if (t % 90 === 0 && r < .7) tone(1300 + rnd(0, 600), .12, 'sine', .06, 550); if (r < .0015) { tone(170, .5, 'square', .05, 110); noise(.4, .12, 400); } } // gotas e canos
  if (lvIdx === 4) { if (t % 260 === 0) [110, 116.5, 165, 220.5].forEach(f => tone(f, 3.5, 'sine', .035)); } // coro dissonante
}
function tone(f, d, type = 'sine', v = .15, f2) {
  if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d);
}
function noise(d, v = .2, freq = 1200) {
  if (!AC) return; const n = AC.sampleRate * d, b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (Math.random()*2-1) * (1 - i/n);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = v;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
const sfx = { scare:()=>{noise(.6,.4,450);tone(420,.7,'sawtooth',.14,55)}, scrape:()=>noise(1,.1,260), coin:()=>{tone(880,.1,'triangle',.12,1320)}, jump:()=>tone(200,.15,'square',.05,380), hurt:()=>{tone(120,.4,'sawtooth',.2,40);noise(.3,.3,300)},
  glitch:()=>noise(.35,.25,2500), whisper:()=>noise(.9,.18,900), focus:()=>tone(150,.7,'sine',.2,900), key:()=>{tone(520,.15,'triangle');tone(780,.3,'triangle')}, door:()=>tone(90,.5,'square',.1,60) };

/* ================= DIÁLOGOS ================= */
const seq = (w, a) => a.map((t, i) => ({ w, t, n: i < a.length-1 ? i+1 : -1 }));
let truth = 0;
const D = {
 n1: seq('Diário de {N}', ['"Dia 12. A casa muda quando eu não olho. Mamãe diz que é só cansaço."', '"Descobri algo: quando me concentro (Q), o que é real fica nítido. O resto estremece."', '"Tentei assinar a capa do caderno. A caneta escreveu outra coisa. Não lembro como me chamo."']),
 n2: seq('Bilhete na parede', ['"Se o chão sumir sob seus pés, talvez nunca tenha sido chão."', 'Algumas coisas só aparecem quando você se concentra.']),
 n3: seq('Prontuário', ['"Paciente {N} relata ver pessoas e portas que ninguém mais vê."', '"Orientação: toque, teste, observe. A realidade responde. A ilusão cede."']),
 n4: seq('Foto rasgada', ['Dois meninos diante da casa. Um deles foi apagado com caneta preta.', 'No verso: "Davi, 9 anos. Nunca mais entrei naquele quarto."']),
 davi: [
  { w:'Davi', t:'Você demorou, {N}. Fiquei te esperando aqui o tempo todo.', c:[['Davi? Você não devia estar aqui.',1],['Quem é você?',2],['Você é real?',3,()=>truth++]] },
  { w:'Davi', t:'Eu sempre estive. É você que esquece.', n:4 },
  { w:'Davi', t:'Seu irmão, bobo. A gente brincava de esconde-esconde neste corredor.', n:4 },
  { w:'Davi', t:'...Toque em mim, então. Vai ver.', n:-1 },
  { w:'Davi', t:'Não precisa se concentrar, {N}. Pode confiar no que você vê.', n:-1 } ],
 lucia: [
  { w:'Dra. Lúcia', t:'{N}, sou eu, a Lúcia. Respire. Me diga o que você vê.', c:[['Um corredor que não acaba.',1],['Meu irmão.',2]] },
  { w:'Dra. Lúcia', t:'É a doença falando, não você. Use o foco: o que é firme, permanece.', n:-1 },
  { w:'Dra. Lúcia', t:'{N}... o Davi se foi há dois anos. Sinto muito. Eu estou aqui, e eu sou real.', c:[['Eu sei. Só não queria saber.',-1,()=>truth++],['Mentira. Ele estava aqui!',-1,()=>truth--]] } ],
 voz: [
  { w:'A Voz', t:'Você chegou longe. Ainda não sabe qual de nós dois é a miragem?', c:[['Você é a miragem.',1,()=>truth++],['Fique comigo. Tenho medo do silêncio.',2,()=>truth--]] },
  { w:'A Voz', t:'Talvez. Mas eu te fiz companhia quando ninguém mais fez.', n:-1 },
  { w:'A Voz', t:'Eu fico. Mas lembre: a porta verdadeira nunca precisou de mim.', n:-1 } ],
 n5: seq('Caixas do porão', ['Caixas com o nome de Davi. Dentro, só roupas pequenas e um carrinho quebrado.', 'Uma frase riscada na parede: "Eu não o empurrei."']),
 n6: seq('Última página do diário', ['"Hoje o quarto está silencioso. Pela primeira vez, ouço só a minha respiração."', '"Se a porta existir, ela não vai pedir permissão."']),
 mae: [
  { w:'Mamãe', t:'{N}, o jantar está na mesa. Desça, meu amor.', c:[['Mãe? Você veio me buscar?',1],['Você também não está aqui, está?',2,()=>truth++]] },
  { w:'Mamãe', t:'Sempre estive aqui. Venha comigo.', n:-1 },
  { w:'Mamãe', t:'...Não diga isso. Por favor.', n:-1 } ],
 voz2: [
  { w:'A Voz', t:'Última porta, {N}. Eu posso abri-la, ou você pode.', c:[['Eu abro.',1,()=>truth++],['Abra você.',2,()=>truth--]] },
  { w:'A Voz', t:'Então vá. Não vou te seguir.', n:-1 },
  { w:'A Voz', t:'Eu abro... mas ela vai dar onde eu quiser.', n:-1 } ]
};

/* ================= FASES ================= */
// p: [x, y, largura, tipo]  tipo: real | fake (ilusão sólida que some) | hidden (real, mas quase invisível)
// co: [x, y, fake]  en: [x, y, raio, fake]
const LV = [
 { name:'Capítulo 1 — A Casa que Muda', sub:'"O que eu vejo e o que existe nem sempre são a mesma coisa."', w:1800, c:['#1d1b24','#0a0910'],
   g:[[0,560],[690,1250],[1350,1800]],
   p:[[560,470,130,'fake'],[240,380,130,'real'],[800,360,120,'real'],[980,290,120,'hidden'],[1180,380,110,'fake'],[1440,380,120,'real']],
   co:[[260,340],[820,320],[1000,250],[1200,340,1],[1470,340],[1550,430,1],[1100,430]],
   en:[[950,470,110,0],[1500,470,120,1]],
   ob:[{t:'note',x:140,id:'n1'},{t:'note',x:760,id:'n2'},{t:'key',x:1020,y:268},{t:'door',x:1720}] },
 { name:'Capítulo 2 — O Corredor de Branco', sub:'"Nem toda voz que me chama tem boca."', w:2000, c:['#2b2f2e','#0d1010'],
   g:[[0,500],[640,1100],[1200,2000]],
   p:[[500,470,140,'fake'],[300,380,120,'real'],[700,350,110,'fake'],[840,380,110,'real'],[980,300,100,'real'],[1100,470,100,'fake'],[1300,380,120,'hidden'],[1450,300,130,'real']],
   co:[[320,340],[860,340],[1000,260],[720,310,1],[1320,340],[1480,260],[1700,430],[1800,430,1],[200,430]],
   en:[[750,470,110,0],[1600,470,130,1],[300,470,100,1]],
   ob:[{t:'note',x:150,id:'n3'},{t:'npc',x:400,id:'davi',fake:1},{t:'door',x:900,fake:1},{t:'npc',x:1250,id:'lucia'},{t:'key',x:1500,y:278},{t:'lamp',x:350},{t:'lamp',x:1250},{t:'door',x:1900}] },
 { name:'Capítulo 3 — O Quarto do Fundo', sub:'"A porta verdadeira nunca precisou de mim."', w:2000, c:['#241a1f','#0b0709'],
   g:[[0,400],[540,900],[1050,1400],[1550,2000]],
   p:[[400,470,140,'hidden'],[900,470,150,'fake'],[1400,470,150,'hidden'],[220,380,120,'real'],[600,370,110,'fake'],[720,380,110,'real'],[1100,380,120,'real'],[1250,300,110,'fake'],[1650,380,110,'real'],[1790,300,100,'real']],
   co:[[240,340],[740,340],[1130,340],[1280,260,1],[1670,340],[1800,260],[470,430],[1450,430],[1000,430]],
   en:[[650,470,130,0],[1200,470,130,0],[1700,470,100,1]],
   ob:[{t:'note',x:300,id:'n4'},{t:'key',x:1150,y:358},{t:'npc',x:1620,id:'voz'},{t:'key',x:1820,y:278,fake:1},{t:'door',x:1860,fake:1},{t:'lamp',x:250},{t:'lamp',x:1000},{t:'lamp',x:1700},{t:'door',x:1940}] },
 // p: [x, y, largura, tipo, alcance, velocidade] -> com alcance/velocidade a plataforma se move
 { name:'Capítulo 4 — O Porão', sub:'"O que está enterrado continua respirando."', w:2300, c:['#1c2420','#080b09'],
   g:[[0,420],[600,980],[1150,1500],[1700,2300]],
   p:[[470,440,90,'real',45,.03],[980,470,170,'hidden'],[260,380,110,'fake'],[700,370,110,'real'],[840,300,100,'fake'],[1000,360,110,'real'],[1250,370,110,'real',60,.025],[1520,440,100,'real',50,.03],[1800,380,120,'fake'],[1950,300,120,'real'],[2100,380,110,'hidden']],
   co:[[280,340],[720,330],[860,260,1],[1020,320],[1270,330],[1540,400],[1830,340,1],[1970,260],[2120,340],[800,430],[1350,430]],
   en:[[300,470,110,0],[800,470,120,0],[1300,470,110,1],[1850,470,120,0],[2200,470,60,1]],
   ob:[{t:'note',x:120,id:'n5'},{t:'lamp',x:520},{t:'npc',x:780,id:'mae',fake:1},{t:'lamp',x:1250},{t:'door',x:1450,fake:1},{t:'lamp',x:1900},{t:'key',x:1990,y:278},{t:'key',x:2120,y:358,fake:1},{t:'door',x:2250}] },
 { name:'Capítulo 5 — A Porta', sub:'"Ela nunca precisou de permissão."', w:2500, c:['#2a1c20','#0a0507'],
   g:[[0,350],[560,820],[1000,1200],[1400,1600],[1800,2500]],
   p:[[350,470,210,'fake'],[820,470,180,'hidden'],[1200,440,100,'real',50,.03],[1600,470,200,'fake'],[180,370,120,'real'],[620,370,110,'fake'],[700,390,100,'real'],[820,300,100,'real'],[1050,370,110,'real',60,.03],[1650,380,110,'real'],[1800,300,110,'fake'],[1950,370,110,'real',60,.025],[2150,300,120,'real'],[2300,380,110,'hidden']],
   co:[[200,330],[640,330,1],[720,350],[840,260],[1070,330],[1230,400],[1670,340],[1830,260,1],[1970,330],[2170,260],[2320,340],[400,430],[900,430],[1700,430]],
   en:[[250,470,100,1],[650,470,100,0],[1100,470,80,0],[1500,470,80,1],[1900,470,120,0],[2200,470,100,0],[2400,470,50,1]],
   ob:[{t:'note',x:100,id:'n6'},{t:'lamp',x:250},{t:'door',x:1100,fake:1},{t:'lamp',x:1100},{t:'lamp',x:1900},{t:'key',x:2170,y:278},{t:'key',x:2320,y:358,fake:1},{t:'npc',x:2250,id:'voz2'},{t:'lamp',x:2350},{t:'door',x:2350,fake:1},{t:'door',x:2450}] }
];

/* ================= ESTADO ================= */
const keys = {}; let state = 'menu', t = 0, lvIdx = 0, L, cam = 0, score = 0, lives = 3, hasKey = false;
const START_LIVES = 5, MAXL = 6; // vidas iniciais e máximo
let retryLv = -1, scoreAtLv = 0, truthAtLv = 0, danger = 0, flash = 0, blackout = 0, nextBO = 500, scareCD = 0, cs = null, anx = 0, jumpBuf = 0, P, plats, coins, enemies, objs, dlg = null, msg = { t:'', n:0 }, focus = 0, focusCD = 0, ep = 0, epNext = 700, intro = 0, ghost = null, shake = 0;
const say = (s, n = 220) => { msg = { t:s, n }; };
// O nome do protagonista nunca é revelado: {N} aparece sempre corrompido, mudando a cada instante
const GL = '█▓▒░▚▞#@?§Ø∆Ξ';
function nm() { const k = Math.floor(t / 4); let o = ''; for (let i = 0; i < 5; i++) o += GL[Math.floor(seeded(k * 5 + i + 3) * GL.length)]; return o; }
const gl = str => str.replaceAll('{N}', nm());
const rnd = (a, b) => a + Math.random()*(b-a);

// fragmentos de lucidez (+1 vida): em plataformas mais arriscadas
LV[0].ob.push({ t:'life', x:1500, y:345 }); LV[1].ob.push({ t:'life', x:1030, y:265 }); LV[2].ob.push({ t:'life', x:1840, y:265 });
LV[3].ob.push({ t:'life', x:750, y:335 }); LV[4].ob.push({ t:'life', x:870, y:265 }, { t:'life', x:2350, y:345 });
// tipos de inimigo por capítulo (alternam): sombra, rastejante, vigia (alto, imparável), massa (enorme, imparável)
const KINDS = [['shade','shade'],['shade','watcher'],['crawler','shade'],['watcher','crawler'],['mass','watcher']];
const EH = { shade:78, crawler:46, watcher:112, mass:92 }, ESPD = { shade:1.7, crawler:2.2, watcher:1.1, mass:.8 };
const GAPMAX = 100; // largura máxima de um buraco (px); dá para pular andando, sem correr
function shrunkGaps(g) {
  const gs = g.map(x => x.slice());
  for (let k = 0; k < gs.length - 1; k++) { const gap = gs[k + 1][0] - gs[k][1]; if (gap > GAPMAX) { const e = (gap - GAPMAX) / 2; gs[k][1] += e; gs[k + 1][0] -= e; } }
  return gs;
}
function loadLevel(i) {
  if (AC) setAmbience(i); scoreAtLv = score; truthAtLv = truth;
  lvIdx = i; L = LV[i]; hasKey = false;
  plats = shrunkGaps(L.g).map(g => ({ x:g[0], y:GY, w:g[1]-g[0], type:'real', ground:1 }))
          .concat(L.p.map((p, k) => ({ x:p[0], y:p[1], w:p[2], type:p[3], touch:0, gone:0, timer:0, ground:p[1]===GY, seed:k+i*9, mv:p[4] ? { x0:p[0], r:p[4], sp:p[5] } : null, dx:0 })));
  coins = L.co.map(c => ({ x:c[0], y:c[1], fake:!!c[2], got:0 }));
  enemies = L.en.map((e, j) => { const kind = KINDS[i][j % 2]; return { x:e[0], y:e[1], x0:e[0], r:e[2], fake:!!e[3], dir:1, dead:0, kind, h:EH[kind], seen:0 }; });
  objs = L.ob.map(o => Object.assign({ gone:0, read:0, y:o.y || GY }, o));
  P = { x:60, y:GY, vx:0, vy:0, face:1, on:plats[0], coy:10, inv:0, turn:0, back:0, fr:0, idle:0, land:0, landHard:0, sx:60, sy:GY };
  cam = 0; focus = 0; anx = 0; blackout = 0; nextBO = 500 + rnd(0, 400); flash = 0; ep = 0; epNext = 600 + rnd(0, 500); intro = 240; state = 'intro';
}
function newGame() { setTimeout(() => { const mv = location.hash.match(/vidas=(\d+)/); if (mv) lives = +mv[1]; }, 0); score = 0; lives = START_LIVES; truth = 0; retryLv = -1; scr.classList.add('hidden'); loadLevel(Math.max(0, Math.min(LV.length - 1, +((location.hash.match(/fase=(\d)/) || [])[1] || 1) - 1)));
  if (/final/.test(location.hash)) { truth = /ruim/.test(location.hash) ? 0 : 4; finish(); } }
function endScreen(title, text, btn) { state = 'end'; sTitle.textContent = title; sText.textContent = text; startBtn.textContent = btn; scr.classList.remove('hidden'); cv.style.filter = ''; }

/* ================= ENTRADA ================= */
addEventListener('keydown', e => {
  audioInit();
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); return; }
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return; keys[e.code] = 1; if (e.code === 'Space') jumpBuf = 8;
  if (state === 'intro' && intro < 180) intro = 0;
  if (state === 'cut') { if (['Space','Enter','KeyE'].includes(e.code)) cutNext(); else if (e.code === 'Escape') cutNext(true); return; }
  if (state === 'dialog') {
    const n = dlg.nodes[dlg.i];
    if (n.c) { const k = +e.key; if (k >= 1 && k <= n.c.length) choose(n.c[k-1]); }
    else if (['Space','Enter','KeyE'].includes(e.code)) goNode(n.n);
    return;
  }
  if (state !== 'play') return;
  if (e.code === 'KeyQ' && focusCD <= 0) { focus = 150; focusCD = 480; sfx.focus(); say('Respiro fundo... e foco.', 120); }
  if (['KeyE','ArrowUp','KeyW'].includes(e.code)) interact();
});
addEventListener('keyup', e => { keys[e.code] = 0; if (e.code === 'Space' && P && P.vy < -4) P.vy *= .5; });
cv.addEventListener('click', () => { if (state === 'cut') cutNext(); });
startBtn.onclick = () => { audioInit();
  if (retryLv >= 0) { const r = retryLv; retryLv = -1; lives = START_LIVES; score = scoreAtLv; truth = truthAtLv; scr.classList.add('hidden'); loadLevel(r); return; } // morreu: volta ao início do capítulo
  if (!imgOK) { sheet.src = 'assets/protagonista_sprites.png?' + Date.now(); } newGame(); };
let muteBtn = document.getElementById('muteBtn');
if (!muteBtn) { // se o index.html for de uma versão antiga, o botão é criado aqui mesmo
  muteBtn = document.createElement('button'); muteBtn.id = 'muteBtn'; muteBtn.textContent = '🔊 Som'; muteBtn.title = 'Silenciar (M)';
  Object.assign(muteBtn.style, { position:'absolute', top:'8px', right:'104px', background:'#0008', color:'#9a948b', border:'1px solid #444', padding:'4px 10px', font:'inherit', fontSize:'13px', cursor:'pointer' });
  cv.parentNode.appendChild(muteBtn);
}
function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : .5; muteBtn.textContent = muted ? '🔇 Mudo' : '🔊 Som'; }
muteBtn.onclick = () => { audioInit(); toggleMute(); muteBtn.blur(); };
document.getElementById('restartBtn').onclick = () => { audioInit(); document.activeElement.blur(); newGame(); }; // blur: o Espaço (pulo) não reaciona o botão
sText.textContent = 'Ele esqueceu o próprio nome. Vive entre o que vê e o que existe.\nNem toda plataforma sustenta. Nem toda porta abre. Nem toda voz é de alguém.\n\n← → / A D: andar   Shift: correr   Espaço: pular\nE / ↑ / W: interagir   Q: concentrar-se (revela ilusões)\n\nIlusões tremem e cedem ao toque. O que é real permanece.\n\nAnsiedade sobe com o tempo e perto de sombras reais: respire perto das lâmpadas.\nEm crise, a partir do capítulo 3, os comandos se invertem.\nM: liga/desliga o som.\n\nAviso: horror psicológico, sustos e temas de saúde mental.';

/* ================= DIÁLOGO ================= */
function talk(id, after) { dlg = { nodes:D[id], i:0, after }; state = 'dialog'; }
function goNode(n) { if (n === undefined || n < 0) { state = 'play'; const a = dlg.after; dlg = null; a && a(); } else dlg.i = n; }
function choose(c) { c[2] && c[2](); goNode(c[1]); }

/* ================= INTERAÇÃO ================= */
function interact() {
  let best = null, bd = 60;
  for (const o of objs) if (!o.gone && o.t !== 'key' && o.t !== 'lamp' && o.t !== 'life') { const d = Math.abs(o.x - P.x); if (d < bd) { bd = d; best = o; } }
  if (!best) return;
  if (best.t === 'note') { P.back = 50; best.read = 1; talk(best.id); }
  else if (best.t === 'npc') talk(best.id, () => { if (best.fake) { best.gone = 1; sfx.glitch(); say('Ele se desfez como fumaça. Nunca esteve aqui.'); } });
  else if (best.t === 'door') {
    P.back = 50;
    if (best.fake) { best.gone = 1; sfx.glitch(); say('A porta se desfez entre meus dedos.'); }
    else if (!hasKey) { sfx.door(); say('Trancada. Preciso de uma chave de verdade.'); }
    else { sfx.door(); if (lvIdx < LV.length-1) loadLevel(lvIdx+1); else finish(); }
  }
}
/* ================= CUTSCENE FINAL (lore) ================= */
const CUT_COMMON = [
 { bg:'door', sp:[3,480,0,1], t:'A porta se abre sem ranger. Atrás dela não há outro cômodo: há uma lembrança.' },
 { bg:'stairs', t:'{N} tinha catorze anos. Davi, nove. Era só uma tarde de esconde-esconde na casa velha.' },
 { bg:'stairs2', t:'Davi se escondeu no porão. Os degraus estavam úmidos. {N} nunca soube contar o resto: só o som, e depois o silêncio.' },
 { bg:'room', sp:[23,480,0,1], t:'Ninguém culpou {N}. Ele se culpou por todos. Meses depois, a casa começou a mudar quando ele não estava olhando.' },
 { bg:'void', face:29, t:'As vozes chegaram. Os médicos deram um nome: esquizofrenia. A Voz deu outro: "só quero te fazer companhia".' },
 { bg:'corridor', face:26, t:'Cada plataforma falsa, cada porta que sumiu, cada Davi sorrindo... era a mente de {N} tentando não encarar o que era real.' } ];
const CUT_GOOD = [
 { bg:'hosp', sp:[19,480,0,1], t:'{N} abre os olhos. Teto branco. A mão da Dra. Lúcia segura a dele. "Você voltou." "Eu só me perdi."' },
 { bg:'hosp2', face:24, t:'A Voz ainda aparece, às vezes. Mas agora ele testa o chão antes de pisar, e pede ajuda antes de a casa mudar.' },
 { bg:'dawn', sp:[0,480,0,1], t:'Davi não volta. Mas, pela primeira vez, {N} consegue dizer o nome dele em voz alta, sem que o mundo desabe.' } ];
const CUT_BAD = [
 { bg:'house', sp:[4,480,0,1], t:'A porta se fecha atrás dele. Mesma sala. Mesmo papel de parede. A mesma foto rasgada sobre a mesa.' },
 { bg:'void', face:28, t:'Talvez seja a vida real. Talvez a Voz tenha vencido de novo. Do corredor, vem uma risada de criança.' },
 { bg:'void', sp:[23,480,0,1], t:'Em algum lugar, uma mão real segura a dele. Ele ainda não consegue senti-la.' } ];
function finish() {
  const good = truth >= 3; cv.style.filter = ''; ep = 0;
  cs = { slides: CUT_COMMON.concat(good ? CUT_GOOD : CUT_BAD), i:0, n:0, fade:0, good }; state = 'cut'; sfx.whisper(); setAmbience(5);
}
const DEATH_TXT = { fall:'O chão não estava lá. Talvez nunca tenha estado.', shade:'A sombra o alcança. Não tem peso, nem cheiro. Só frio.', crawler:'Algo rasteja por cima dele, e o rosto pálido sorri de perto demais.', watcher:'O Vigia inclina a cabeça sem rosto, e o mundo fica branco.', mass:'Todos os olhos olham ao mesmo tempo, e ele deixa de ser um só.' };
const DEATH_HINT = ['Plataformas que tremem não sustentam. Teste o chão antes de confiar nele.', 'Concentre-se (Q): o que é firme fica nítido, o resto estremece.', 'Quando a ansiedade subir, respire sob as lâmpadas.', 'Algumas sombras são só sombras. Outras mordem.', 'A porta verdadeira nunca precisou de permissão.'];
function die(cause) { // cutscene de morte: muda conforme o que o matou e termina com uma dica do capítulo
  cv.style.filter = ''; ep = 0; flash = 0;
  cs = { slides: [ { bg:'void', sp:[18,480,0,1], t:DEATH_TXT[cause] || DEATH_TXT.fall },
                   { bg:'void', face:29, t:'As vozes ficam altas demais. Todas ao mesmo tempo. Todas chamando por {N}.' },
                   { bg:'room', sp:[23,480,0,1], t:'Em algum lugar, uma mão real tenta alcançar a dele. Ele ainda não consegue sentir.' },
                   { bg:'void', face:24, t:'Respire. ' + DEATH_HINT[lvIdx] } ], i:0, n:0, fade:0, good:false, death:true };
  state = 'cut'; setAmbience(5);
}
function cutNext(skip) {
  if (!cs) return; const sl = cs.slides[cs.i];
  if (!skip && cs.n < gl(sl.t).length * 2) { cs.n = 9999; return; }
  tone(220, .5, 'sine', .08, 150);
  if (skip || ++cs.i >= cs.slides.length) {
    const g = cs.good, d = cs.death; cs = null;
    if (d) { retryLv = -1; endScreen('A MIRAGEM VENCEU', 'Ele cai de novo. A casa recomeça do início, e a porta ainda está lá.\n\nPontos: ' + score, 'Recomeçar o jogo'); return; }
    endScreen(g ? 'FIM — ACORDAR' : 'FIM — O CICLO',
      (g ? 'Ele ainda ouve a Voz. Mas agora tem alguém para ouvir com ele.' : 'O ciclo recomeça. Será que ele quer mesmo sair?') +
      '\n\nPontos: ' + score, 'Jogar de novo');
  } else { cs.n = 0; cs.fade = 0; }
}
function drawCutBg(k) {
  const C = { door:['#2a2218','#050403'], stairs:['#1f2326','#07090a'], stairs2:['#1a1214','#040203'], room:['#1a1b26','#07070c'], void:['#150a12','#030102'], corridor:['#2b312f','#0b0e0d'],
              hosp:['#8f9d9b','#4e5a59'], hosp2:['#a9b4b0','#5d6866'], dawn:['#d2ab78','#3d2a2a'], house:['#1d1b24','#0a0910'] }[k];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
  if (k === 'door') { glow(W/2, 190, 320, 'rgba(255,230,170,.65)'); ctx.fillStyle = 'rgba(255,240,200,.9)'; ctx.fillRect(W/2 - 70, 50, 140, 270); ctx.strokeRect(W/2 - 70, 50, 140, 270); }
  if (k === 'stairs' || k === 'stairs2') { for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (.18 + i * .04) + ')'; ctx.fillRect(100 + i * 80, 90 + i * 34, W, H); }
    if (k === 'stairs') { ctx.fillStyle = 'rgba(200,190,170,.7)'; ctx.beginPath(); ctx.arc(150, 70, 14, 0, 7); ctx.fill(); ctx.fillRect(140, 84, 20, 30); } else { glow(W - 160, 370, 160, 'rgba(120,20,30,.35)'); } }
  if (k === 'room') { ctx.fillStyle = 'rgba(120,135,180,.2)'; ctx.fillRect(660, 70, 150, 190); ctx.strokeRect(660, 70, 150, 190); ctx.fillStyle = 'rgba(230,230,210,.6)'; ctx.beginPath(); ctx.arc(740, 130, 20, 0, 7); ctx.fill(); }
  if (k === 'corridor') { ctx.strokeStyle = 'rgba(200,215,205,.18)'; for (const [x, y] of [[0, 0], [W, 0], [0, 400], [W, 400]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(W/2, 200); ctx.stroke(); } for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(W/2 - 200 + i * 66 + Math.sin(t / 40 + i) * 4, 150 + (i % 2) * 20, 30, 56); } }
  if (k === 'hosp' || k === 'hosp2') { for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(100 + i * 230, 30, 110, 8); } ctx.fillStyle = 'rgba(240,245,245,.55)'; ctx.fillRect(560, 320, 340, 40); ctx.fillStyle = 'rgba(70,80,80,.6)'; ctx.fillRect(560, 360, 340, 50); }
  if (k === 'dawn') { glow(W/2, 330, 380, 'rgba(255,225,160,.8)'); ctx.fillStyle = 'rgba(60,40,40,.55)'; ctx.fillRect(0, 400, W, H); }
  if (k === 'house') { ctx.strokeStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < W; x += 38) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 420); ctx.stroke(); } ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 410, W, 130); }
  if (k === 'void') { for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(210,180,190,.18)'; ctx.fillRect((i * 97 + t * .3) % W, (i * 53) % 400, 2, 2); } }
  if (k === 'door' || k === 'hosp' || k === 'hosp2' || k === 'dawn' || k === 'house' || k === 'room' || k === 'stairs' || k === 'stairs2' || k === 'corridor') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 395, W, 8); }
}
function drawCut() {
  const sl = cs.slides[cs.i]; drawCutBg(sl.bg);
  if (sl.sp) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sl.sp[1], 398, 70, 10, 0, 0, 7); ctx.fill(); drawSprite(sl.sp[0], sl.sp[1], 398, sl.sp[2], 1, sl.sp[3]); }
  if (sl.face !== undefined) drawFace(sl.face, W/2 - 95, 90, 240);
  ctx.fillStyle = 'rgba(5,4,8,.9)'; ctx.strokeStyle = '#9a9488'; ctx.lineWidth = 3; hrect(40, H - 130, W - 80, 112, 5); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#e4dcc8'; ctx.font = '19px "Segoe Print", cursive'; wrap(gl(sl.t).slice(0, Math.floor(cs.n / 2)), 64, H - 92, W - 130, 28);
  ctx.textAlign = 'right'; ctx.fillStyle = '#888'; ctx.font = '13px "Segoe Print", cursive'; ctx.fillText((cs.i + 1) + '/' + cs.slides.length + '   [Espaço] continuar   [Esc] pular', W - 56, H - 28);
  if (cs.fade < 40) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - cs.fade / 40) + ')'; ctx.fillRect(0, 0, W, H); }
}
function hurt(cause = 'fall') {
  if (P.inv > 0) return; lives--; P.inv = 100; shake = 22; flash = 18; sfx.hurt(); P.vy = -7; P.vx = -P.face * 5;
  if (lives <= 0) die(cause);
}

/* ================= ATUALIZAÇÃO ================= */
function update() {
  t++; ambTick();
  if (state === 'intro') { if (--intro <= 0) state = 'play'; return; }
  if (state === 'cut') { cs.n++; cs.fade++; return; }
  if (state !== 'play') return;
  for (const s of plats) if (s.mv) { const nx = s.mv.x0 + Math.sin(t * s.mv.sp) * s.mv.r; s.dx = nx - s.x; s.x = nx; }
  if (P.on && P.on.dx) P.x += P.on.dx;
  const Lk = keys.ArrowLeft || keys.KeyA, Rk = keys.ArrowRight || keys.KeyD, run = keys.ShiftLeft || keys.ShiftRight;
  const raw = (Rk ? 1 : 0) - (Lk ? 1 : 0), dir = (ep > 0 && lvIdx >= 2) ? -raw : raw, max = run ? 4.8 : 2.6;
  if (dir) { P.vx += dir * .5; if (P.face !== dir) { P.face = dir; P.turn = 6; } } else P.vx *= .78;
  P.vx = Math.max(-max, Math.min(max, P.vx)); if (Math.abs(P.vx) < .05) P.vx = 0;
  P.vy = Math.min(14, P.vy + .62);
  P.x = Math.max(20, Math.min(L.w - 20, P.x + P.vx));
  const old = P.y, fallV = P.vy; P.y += P.vy; let on = null;
  if (P.vy >= 0) for (const s of plats) {
    if (s.gone > 0) continue;
    if (P.x + 18 > s.x && P.x - 18 < s.x + s.w && old <= s.y + 1 && P.y >= s.y) { P.y = s.y; P.vy = 0; on = s; break; }
  }
  if (on && !P.on && fallV > 6) noise(.14, .1, 110);
  if (on && !P.on && fallV > 3) { P.land = 7; P.landHard = fallV > 10; }
  P.on = on; P.coy = on ? 10 : P.coy - 1;
  if (on) {
    if (on.type === 'fake' && !on.touch) { on.touch = 1; on.timer = 22; sfx.glitch(); say('O chão... estremece.', 140); }
    if (on.type !== 'fake') { P.sx = Math.max(30, P.x - 20); P.sy = on.y; }
  }
  if (jumpBuf > 0) jumpBuf--;
  if (jumpBuf > 0 && P.coy > 0) { P.vy = -13.5; P.coy = 0; jumpBuf = 0; sfx.jump(); }
  for (const s of plats) if (s.type === 'fake') {
    if (s.touch && s.gone <= 0 && --s.timer <= 0) { s.gone = 260; }
    else if (s.gone > 0 && --s.gone === 0) s.touch = 0;
  }
  if (P.y > H + 120) { hurt('fall'); if (lives > 0) { P.x = P.sx; P.y = P.sy; P.vx = P.vy = 0; } }
  if (P.on && Math.abs(P.vx) > .4 && P.fr % (Math.abs(P.vx) > 3.4 ? 13 : 21) === 0) noise(.07, .06, 160 + rnd(0, 90)); // passos
  P.idle = (dir || !P.on || P.back > 0) ? 0 : P.idle + 1; if (P.land > 0) P.land--;
  P.inv--; if (P.turn > 0) P.turn--; if (P.back > 0) P.back--; P.fr++;
  if (Math.abs(P.vx) > .3 || P.back > 0) { if (P.back > 0 && !dir) {} }
  // moedas
  for (const c of coins) if (!c.got && Math.abs(c.x - P.x) < 24 && Math.abs(c.y - (P.y - 40)) < 46) {
    c.got = 1;
    if (c.fake) { sfx.glitch(); say('Essa lembrança nunca esteve aqui.'); } else { score += 10; sfx.coin(); }
  }
  // inimigos
  for (const e of enemies) if (!e.dead) {
    const dxp = P.x - e.x, sight = e.kind === 'watcher' ? 400 : 270;
    if (Math.abs(dxp) < sight && Math.abs(P.y - e.y) < 100) { // persegue quando percebe o jogador
      if (!e.seen && scareCD <= 0) { e.seen = 1; scareCD = 150; shake = 14; sfx.scare(); anx = Math.min(100, anx + 10); say(['Algo me viu.', 'Está vindo na minha direção.', 'Não olhe para trás.'][Math.floor(rnd(0, 3))], 160); }
      e.dir = dxp > 0 ? 1 : -1; e.x += e.dir * ESPD[e.kind] * (e.kind === 'crawler' && Math.abs(dxp) < 120 ? 1.8 : 1);
      e.x = Math.max(e.x0 - e.r - 160, Math.min(e.x0 + e.r + 160, e.x));
    } else { e.seen = 0; if (Math.abs(e.x - e.x0) > e.r) e.dir = e.x > e.x0 ? -1 : 1; e.x += e.dir * .9; }
    if (Math.abs(e.x - P.x) < (e.kind === 'mass' ? 46 : e.kind === 'crawler' ? 34 : 24) && P.y > e.y - e.h && P.y - 95 < e.y) {
      if (e.fake) { e.dead = 1; sfx.glitch(); say('Atravessou meu corpo. Era só uma sombra.'); }
      else if (P.vy > 2 && P.y < e.y - 25 && e.kind !== 'watcher' && e.kind !== 'mass') { e.dead = 1; P.vy = -9; score += 25; sfx.coin(); }
      else hurt(e.kind);
    }
  }
  for (const o of objs) if (o.t === 'life' && !o.gone && Math.abs(o.x - P.x) < 26 && Math.abs(o.y - (P.y - 40)) < 50) {
    o.gone = 1; sfx.key();
    if (lives < MAXL) { lives++; say('Um fragmento de lucidez. Respiro melhor. (+1 vida)'); } else { score += 25; say('Lucidez de sobra. Guardo na memória. (+25)'); }
  }
  // chaves (automático)
  for (const o of objs) if (o.t === 'key' && !o.gone && Math.abs(o.x - P.x) < 26 && Math.abs(o.y - (P.y - 40)) < 50) {
    o.gone = 1;
    if (o.fake) { sfx.glitch(); say('A chave virou pó. Era uma miragem.'); } else { hasKey = true; sfx.key(); say('Uma chave de verdade. Pesa na mão.'); }
  }
  // ansiedade: sobe com o tempo (cada capítulo mais rápido) e perto de sombras reais; lâmpadas acalmam
  const lampNear = objs.some(o => o.t === 'lamp' && Math.abs(o.x - P.x) < 110);
  const threat = enemies.some(e => !e.dead && !e.fake && Math.abs(e.x - P.x) < 220);
  anx = Math.max(0, Math.min(100, anx + .012 * lvIdx + (threat ? .09 : 0) - (lampNear ? .45 : 0)));
  if (anx >= 100 && ep === 0) { anx = 45; epNext = 0; say('O coração dispara. Não consigo respirar...', 200); }
  let nearD = 0; for (const e of enemies) if (!e.dead) nearD = Math.max(nearD, 1 - Math.abs(e.x - P.x) / 320);
  danger = Math.max(0, nearD, anx / 110); if (scareCD > 0) scareCD--;
  if (AC && t % 8 === 0) windG.gain.setTargetAtTime(windBase * (1 + danger * 2.5 + (blackout > 0 ? 1 : 0)), AC.currentTime, .25); // vento cresce com o perigo
  if (danger > .45 && t % Math.max(18, Math.floor(60 - danger * 34)) === 0) tone(55, .28, 'sine', .32, 38); // batimento acelera com o perigo
  if (danger > .7 && t % 4 === 0) shake = Math.max(shake, 2);
  if (lvIdx >= 1) { if (--nextBO <= 0) { blackout = 25 + rnd(0, 35); nextBO = 500 + rnd(0, 600); sfx.glitch(); } if (t % 600 === 300) sfx.scrape(); }
  if (blackout > 0) blackout--;
  // focos, episódios
  if (focus > 0) focus--; if (focusCD > 0) focusCD--;
  if (ep > 0) { if (--ep === 0) { cv.style.filter = ''; ghost = null; } }
  else if (--epNext <= 0) {
    ep = 320; epNext = 900 + rnd(0, 700); sfx.whisper(); shake = 20;
    cv.style.filter = 'hue-rotate(' + (Math.random() < .5 ? 150 : -40) + 'deg) saturate(1.6) contrast(1.15)';
    say(['Eles estão sussurrando de novo...', 'Tudo parece tão nítido. Tão falso.', 'Alguém está atrás de mim.', 'O que é real? O que é real?'][Math.floor(rnd(0, 4))], 280);
  }
  if (ep > 0 && lvIdx >= 2 && !P.invMsg) { P.invMsg = 1; say('Meus passos estão trocados... esquerda é direita.', 220); } if (ep === 0) P.invMsg = 0;
  if (ep > 0 && t % 70 === 0) ghost = { x:cam + rnd(80, W-80), n:45 };
  if (ghost && --ghost.n <= 0) ghost = null;
  if (msg.n > 0) msg.n--;
  cam = Math.max(0, Math.min(L.w - W, P.x - W/2));
}

/* ================= DESENHO ================= */
function hrect(x, y, w, h, seed) {
  const j = i => Math.sin(seed*12.9 + i*78.2) * 2.2;
  ctx.beginPath(); ctx.moveTo(x+j(1), y+j(2)); ctx.lineTo(x+w+j(3), y+j(4)); ctx.lineTo(x+w+j(5), y+h+j(6)); ctx.lineTo(x+j(7), y+h+j(8)); ctx.closePath();
}
function seeded(n) { return Math.abs(Math.sin(n*127.1 + 311.7) * 43758.5453) % 1; }

/* ---------- Cenários: um por capítulo, ligados ao nome da fase ---------- */
function tiles(f, sp, fn) { const b = Math.floor(cam * f / sp); for (let k = b - 1; k <= b + Math.ceil(W / sp) + 1; k++) fn(k * sp - cam * f, k, seeded(k * 7.3 + lvIdx * 19)); }
function tilted(x, y, w, h, a) { ctx.save(); ctx.translate(x + w/2, y + h/2); ctx.rotate(a); ctx.beginPath(); ctx.rect(-w/2, -h/2, w, h); ctx.fill(); ctx.stroke(); ctx.restore(); }
function glow(x, y, r, col) { const g = ctx.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r*2, r*2); }

function bgHouse() { // Cap. 1 — A Casa que Muda: sala velha, quadros que mudam de ângulo
  ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 2; ctx.beginPath();
  tiles(.5, 38, x => { ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(x) * 3, GY); }); ctx.stroke();
  tiles(.5, 240, (x, k, r) => {
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    if (r < .33) { ctx.fillStyle = 'rgba(120,130,170,.17)'; ctx.fillRect(x, 110, 74, 120); ctx.strokeRect(x, 110, 74, 120); ctx.beginPath(); ctx.moveTo(x + 37, 110); ctx.lineTo(x + 37, 230); ctx.moveTo(x, 170); ctx.lineTo(x + 74, 170); ctx.stroke(); }
    else if (r < .68) { ctx.fillStyle = 'rgba(80,66,52,.4)'; tilted(x, 140, 62, 80, Math.sin(t / 80 + k * 2) * (ep > 0 ? .3 : .035)); tilted(x + 90, 160, 40, 52, Math.sin(t / 110 + k) * (ep > 0 ? .35 : .05)); }
    else { ctx.fillStyle = 'rgba(46,34,28,.6)'; ctx.fillRect(x + 10, GY - 200, 44, 200); ctx.strokeRect(x + 10, GY - 200, 44, 200); ctx.beginPath(); ctx.arc(x + 32, GY - 168, 13, 0, 7); const a = t / (ep > 0 ? 6 : 140); ctx.moveTo(x + 32, GY - 168); ctx.lineTo(x + 32 + Math.cos(a) * 9, GY - 168 + Math.sin(a) * 9); ctx.stroke(); }
  });
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, GY - 14, W, 14);
}
function bgHospital() { // Cap. 2 — O Corredor de Branco: azulejos, portas numeradas, luzes que piscam
  ctx.fillStyle = 'rgba(190,210,200,.09)'; ctx.fillRect(0, GY - 160, W, 160); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, GY - 162, W, 3); ctx.fillRect(0, GY - 95, W, 4);
  tiles(.5, 270, (x, k) => { ctx.fillStyle = 'rgba(25,34,32,.75)'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.fillRect(x, GY - 175, 66, 175); ctx.strokeRect(x, GY - 175, 66, 175);
    ctx.fillStyle = 'rgba(190,210,200,.14)'; ctx.fillRect(x + 18, GY - 160, 30, 34); ctx.fillStyle = 'rgba(210,225,215,.35)'; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(((k % 40) + 40) % 40 + 101), x + 33, GY - 182); });
  tiles(.5, 210, (x, k, r) => { const on = ((t + k * 37) % 280) > (r < .3 ? 45 : 5); ctx.fillStyle = on ? 'rgba(215,230,220,.3)' : 'rgba(0,0,0,.25)'; ctx.fillRect(x + 40, 26, 100, 8); if (on) glow(x + 90, 40, 120, 'rgba(200,225,210,.12)'); });
  tiles(.4, 760, (x, k, r) => { if (r < .55) { ctx.fillStyle = 'rgba(60,70,68,.5)'; ctx.fillRect(x, GY - 62, 150, 14); ctx.fillRect(x + 6, GY - 48, 4, 38); ctx.fillRect(x + 140, GY - 48, 4, 38); ctx.beginPath(); ctx.arc(x + 10, GY - 8, 8, 0, 7); ctx.arc(x + 140, GY - 8, 8, 0, 7); ctx.fill(); } });
}
function bgBedroom() { // Cap. 3 — O Quarto do Fundo: cama, janela com lua, brinquedos, desenhos de criança
  tiles(.3, 70, (x, k, r) => { if (r < .45) { ctx.fillStyle = 'rgba(200,220,150,' + (.15 + .15 * Math.sin(t / 30 + k)) + ')'; ctx.fillRect(x, 18 + r * 90, 3, 3); } });
  tiles(.5, 330, (x, k, r) => { const m = ((k % 4) + 4) % 4; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    if (m === 0) { ctx.fillStyle = 'rgba(60,50,70,.55)'; ctx.fillRect(x, GY - 70, 210, 52); ctx.strokeRect(x, GY - 70, 210, 52); ctx.fillRect(x - 8, GY - 130, 14, 112); ctx.fillStyle = 'rgba(190,190,210,.18)'; ctx.fillRect(x + 10, GY - 86, 56, 18); }
    else if (m === 1) { ctx.fillStyle = 'rgba(120,135,180,.2)'; ctx.fillRect(x, 90, 110, 150); ctx.strokeRect(x, 90, 110, 150); ctx.fillStyle = 'rgba(230,230,210,.5)'; ctx.beginPath(); ctx.arc(x + 70, 140, 16, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(70,40,50,.6)'; ctx.fillRect(x - 12, 84, 22, 164); ctx.fillRect(x + 100, 84, 22, 164); }
    else if (m === 2) { ctx.fillStyle = 'rgba(50,38,30,.6)'; ctx.fillRect(x, GY - 120, 150, 10); ctx.fillRect(x, GY - 60, 150, 10); ctx.fillStyle = 'rgba(150,110,80,.4)'; ctx.fillRect(x + 12, GY - 144, 22, 24); ctx.fillRect(x + 44, GY - 134, 18, 14); ctx.beginPath(); ctx.arc(x + 110, GY - 134, 12, 0, 7); ctx.arc(x + 110, GY - 154, 8, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(190,180,150,.2)'; ctx.fillRect(x, 120, 130, 100); ctx.strokeStyle = 'rgba(210,190,140,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 30, 150, 8, 0, 7); ctx.moveTo(x + 30, 158); ctx.lineTo(x + 30, 188); ctx.arc(x + 85, 160, 8, 0, 7); ctx.moveTo(x + 85, 168); ctx.lineTo(x + 85, 198); ctx.moveTo(x + 30, 170); ctx.lineTo(x + 85, 178); ctx.stroke(); ctx.strokeStyle = 'rgba(120,30,30,.5)'; ctx.beginPath(); for (let i = 0; i < 8; i++) { ctx.lineTo(x + 70 + (i % 2) * 30, 140 + i * 8); } ctx.stroke(); }
  });
}
function bgBasement() { // Cap. 4 — O Porão: tijolos, canos que pingam, lâmpada balançando, caixas
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.beginPath();
  tiles(.5, 46, x => { for (let row = 0; row < 21; row++) ctx.rect(x + (row % 2) * 23 - 23, row * 23, 46, 23); }); ctx.stroke();
  ctx.fillStyle = 'rgba(62,56,50,.7)'; ctx.fillRect(0, 70, W, 14); ctx.fillRect(0, 100, W, 8);
  tiles(.6, 190, (x, k, r) => { ctx.fillStyle = 'rgba(40,36,32,.9)'; ctx.fillRect(x, 64, 9, 26); ctx.fillStyle = 'rgba(140,170,180,.5)'; const y = 90 + ((t * 2 + k * 53) % 300); if (y < GY) { ctx.beginPath(); ctx.arc(x + 4, y, 2.5, 0, 7); ctx.fill(); } });
  tiles(.5, 540, (x, k) => { const bx = x + Math.sin(t / 55 + k) * 22; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(bx, 150); ctx.stroke(); glow(bx, 156, 190, 'rgba(235,200,120,.2)'); ctx.fillStyle = 'rgba(250,225,150,.8)'; ctx.beginPath(); ctx.arc(bx, 156, 6, 0, 7); ctx.fill(); });
  tiles(.5, 340, (x, k, r) => { ctx.fillStyle = 'rgba(70,52,38,.6)'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.fillRect(x, GY - 56, 70, 56); ctx.strokeRect(x, GY - 56, 70, 56); ctx.fillRect(x + 80, GY - 46, 54, 46); ctx.strokeRect(x + 80, GY - 46, 54, 46); if (r > .5) { ctx.fillRect(x + 12, GY - 108, 56, 52); ctx.strokeRect(x + 12, GY - 108, 56, 52); } });
}
function bgDoor() { // Cap. 5 — A Porta: vazio, arcos de portas, fragmentos flutuantes, luz vazando do fim
  const prog = Math.min(1, cam / Math.max(1, L.w - W));
  tiles(.25, 280, (x, k, r) => { ctx.strokeStyle = 'rgba(150,100,120,' + (.1 + r * .1) + ')'; ctx.lineWidth = 3; const h = 230 + r * 110; ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x, GY - h + 50); ctx.arc(x + 50, GY - h + 50, 50, Math.PI, 0); ctx.lineTo(x + 100, GY); ctx.stroke(); });
  tiles(.65, 360, (x, k, r) => { const y = 90 + r * 150 + Math.sin(t / 50 + k) * 16; ctx.fillStyle = 'rgba(30,18,22,.8)'; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.lineWidth = 3; tilted(x, y, 50, 90, Math.sin(t / 90 + k) * .4); });
  glow(W + 40 - prog * 60, GY - 120, 260 + prog * 300, 'rgba(255,225,170,' + (.12 + prog * .38) + ')');
  if (prog > .55) { const dx = W - 150 + (1 - prog) * 260; ctx.fillStyle = 'rgba(255,235,190,' + (prog - .4) + ')'; ctx.fillRect(dx, GY - 230, 120, 230); }
  tiles(.9, 90, (x, k, r) => { ctx.fillStyle = 'rgba(210,180,190,.25)'; ctx.fillRect(x, (r * 400 + t * (.2 + r * .3)) % GY, 2, 2); });
}
const BG = [bgHouse, bgHospital, bgBedroom, bgBasement, bgDoor];
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.c[0]); g.addColorStop(1, L.c[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.textAlign = 'left'; BG[lvIdx](); decor(); ctx.restore();
}
function drawPlat(s) {
  if (s.gone > 0) { return; }
  const th = s.ground ? H - s.y : 18, f = focus > 0;
  let a = 1, seed = s.seed || s.x, stroke = '#07060a', fill = lvIdx === 1 ? '#3a3f3e' : '#2a2830';
  if (s.type === 'hidden') { a = f ? .75 : (ep > 0 ? .03 : .06 + .03*Math.sin(t/20)); stroke = f ? '#9ac' : '#222'; }
  if (s.type === 'fake') {
    if (s.touch) { seed += Math.floor(t/2); a = .5 + .5*Math.random(); }
    else if (ep === 0) { seed += Math.floor(t/9); if (!f && t % 90 < 4) a = .7; }
    if (f) { ctx.setLineDash([5, 4]); stroke = '#c44'; a *= .75; }
  }
  ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.lineWidth = 3; ctx.strokeStyle = stroke;
  hrect(s.x, s.y, s.w, th, seed); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  if (s.type !== 'fake' || !f) { ctx.fillStyle = f && s.type === 'real' ? 'rgba(220,230,210,.5)' : 'rgba(150,140,130,.25)'; ctx.fillRect(s.x + 3, s.y + 1, s.w - 6, 3); }
  ctx.globalAlpha = 1;
}
function drawCoin(c) {
  if (c.got) return; const y = c.y + Math.sin(t/20 + c.x) * 4; ctx.save();
  if (c.fake && ep === 0) ctx.globalAlpha = .55 + .4 * Math.sin(t/3 + c.x);
  if (c.fake && focus > 0) { ctx.strokeStyle = '#c44'; ctx.setLineDash([3, 3]); } else ctx.strokeStyle = '#3a2f12';
  ctx.fillStyle = '#c9a85a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x + (c.fake && ep===0 ? rnd(-1, 1) : 0), y, 8, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,180,.5)'; ctx.fillRect(c.x - 3, y - 4, 3, 3); ctx.restore();
}
const ENEMY = {
  shade: (n, br) => { // sombra alta de braços longos, sorriso rasgado que se abre quando você chega perto
    ctx.beginPath(); ctx.moveTo(-22, 0); for (let i = 1; i <= 6; i++) ctx.lineTo(-22 + i * 7.3, i % 2 ? -9 : 0);
    ctx.bezierCurveTo(26, -40, 14, -70, 0, -78 + br); ctx.bezierCurveTo(-18, -70, -28, -40, -22, 0); ctx.fill(); ctx.stroke();
    const hx = 30 + (n ? 8 : 0); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, -52); ctx.quadraticCurveTo(34, -30, hx, -4 + br);
    for (const gx of [8, 0, -7]) { ctx.moveTo(hx, -4 + br); ctx.lineTo(hx + gx, 6); } ctx.stroke();
    ctx.fillStyle = '#e8e4d0'; ctx.beginPath(); ctx.ellipse(-3, -58, 4, 2, .3, 0, 7); ctx.ellipse(9, -58, 4, 2, -.3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -47); for (let i = 0; i < 9; i++) ctx.lineTo(-4 + i * 2.1, -47 + (i % 2 ? 4 + (n ? 5 : 1) : -1)); ctx.stroke(); },
  crawler: (n, br) => { // rastejante: membros de aranha com rosto humano pálido
    ctx.strokeStyle = '#3a3340'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const sd = i < 3 ? -1 : 1, k = i % 3, ph = Math.sin(t / 5 + i * 1.7) * 6; ctx.beginPath(); ctx.moveTo(sd * 8, -26); ctx.lineTo(sd * (24 + k * 9), -46 + ph); ctx.lineTo(sd * (34 + k * 12), -3 + ph / 2); ctx.stroke(); }
    ctx.fillStyle = '#040305'; ctx.beginPath(); ctx.ellipse(0, -28, 22, 14, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b9b1a4'; ctx.beginPath(); ctx.ellipse(22, -34, 9, 12, .4, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(20, -38, 2.6, 0, 7); ctx.arc(26, -37, 2.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(15, -29); ctx.lineTo(28, -27 - (n ? 5 : 0)); ctx.stroke(); },
  watcher: (n, br) => { // vigia: altíssimo, magro, rosto branco sem traços, boca vertical
    const sw = Math.sin(t / 30) * 3; ctx.fillStyle = '#040305'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-4 + sw, -92); ctx.lineTo(8 + sw, -92); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a3340'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-2 + sw, -86); ctx.quadraticCurveTo(-26, -50, -16 + sw * 2, -2); ctx.moveTo(8 + sw, -86); ctx.quadraticCurveTo(34, -52, 24 - sw * 2, 0); ctx.stroke();
    ctx.fillStyle = '#d4cdbd'; ctx.beginPath(); ctx.ellipse(2 + sw, -104 + br / 2, 11, 16, .08, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-1 + sw, -106, 2.2, 3.4, 0, 0, 7); ctx.ellipse(6 + sw, -106, 2.2, 3.4, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(2.5 + sw, -96, 2.4, n ? 9 : 4, 0, 0, 7); ctx.fill(); },
  mass: (n, br) => { // massa: amontoado enorme de olhos e dentes
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.bezierCurveTo(-62, -40, -44, -92 + br, -10, -90 + br); ctx.bezierCurveTo(16, -98 + br, 56, -78, 52, -30); ctx.bezierCurveTo(54, -10, 50, 0, 44, 0);
    for (let i = 0; i < 8; i++) ctx.lineTo(44 - i * 12.5, i % 2 ? -6 - (i % 3) * 5 : 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const [ex, ey, er] of [[-28,-60,7],[-8,-72,8],[18,-62,6],[34,-44,5],[-34,-34,5],[6,-50,4]]) { ctx.fillStyle = '#d8d0bc'; ctx.beginPath(); ctx.arc(ex, ey + br / 2, er, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + (n ? 2 : 0), ey + br / 2, er * .45, 0, 7); ctx.fill(); }
    const o = n ? 16 : 7; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(4, -18, 24, o, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 10; i++) { ctx.moveTo(-18 + i * 4.6, -18 - o + 1); ctx.lineTo(-16 + i * 4.6, -18 - o + 7); } ctx.stroke(); }
};
function drawEnemy(e) {
  if (e.dead) return;
  const near = Math.abs(e.x - P.x) < 200, jit = e.fake && ep === 0 ? rnd(-2, 2) : rnd(-.6, .6), br = Math.sin(t / 14 + e.x) * 2;
  ctx.save(); ctx.translate(e.x + jit, e.y); if (e.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = e.fake && ep === 0 ? .55 + .3 * Math.random() : 1; ctx.fillStyle = '#040305'; ctx.strokeStyle = focus > 0 && e.fake ? '#c44' : '#3a2f3a'; ctx.lineWidth = 2;
  ENEMY[e.kind](near, br); ctx.restore();
}
function drawEyes() { // olhos brilham no escuro, mesmo fora da luz
  const EY = { shade:[[-3,-58],[9,-58]], crawler:[[22,-38]], watcher:[[-1,-106],[6,-106]], mass:[[-28,-60],[-8,-72],[18,-62]] };
  ctx.save(); ctx.translate(-Math.round(cam), 0);
  for (const e of enemies) if (!e.dead && Math.abs(e.x - P.x) < 560 && (e.x - cam > -40 && e.x - cam < W + 40)) {
    if ((t + e.x) % 200 < 6) continue; const fl = e.fake && ep === 0 ? .35 + Math.random() * .65 : 1;
    for (const [ex, ey] of EY[e.kind]) { const X = e.x + ex * e.dir, Y = e.y + ey; glow(X, Y, 26, 'rgba(230,50,40,' + .3 * fl + ')'); ctx.fillStyle = 'rgba(245,70,55,' + .95 * fl + ')'; ctx.beginPath(); ctx.arc(X, Y, 2.6, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function drawFear() { // vinheta, pulso vermelho, granulado e flash de dano
  const v = ctx.createRadialGradient(W/2, H/2, 200, W/2, H/2, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,' + (.65 + danger * .25) + ')'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (danger > .15) { const p = .5 + .5 * Math.sin(t / (14 - danger * 7)), r = ctx.createRadialGradient(W/2, H/2, 260, W/2, H/2, 600); r.addColorStop(0, 'rgba(120,0,10,0)'); r.addColorStop(1, 'rgba(140,0,12,' + danger * (.25 + .2 * p) + ')'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  if (flash > 0) { ctx.fillStyle = 'rgba(160,0,10,' + flash / 18 * .55 + ')'; ctx.fillRect(0, 0, W, H); flash--; }
}
const WRITE = ['NÃO FOI EU', 'ELES SABEM', 'RESPIRA', 'DAVI?', 'ACORDA', 'NÃO OLHE'];
function decor() { // manchas, arranhões e escritos nas paredes (mais frequentes a cada capítulo)
  tiles(.5, 360, (x, k, r) => {
    if (r < .14 + lvIdx * .09) { ctx.fillStyle = 'rgba(95,8,14,.32)'; ctx.fillRect(x, 70 + r * 80, 6, 90 + r * 160); ctx.beginPath(); ctx.arc(x + 3, 160 + r * 240, 5, 0, 7); ctx.fill(); }
    else if (r > .9 - lvIdx * .02) { ctx.strokeStyle = 'rgba(100,10,14,.4)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(x + i * 9, 130); ctx.lineTo(x + i * 9 + 22, 232 + i * 4); } ctx.stroke(); }
    else if (lvIdx >= 1 && r > .5 && r < .54 + .05 * lvIdx) { ctx.save(); ctx.translate(x, 190); ctx.rotate(-.08 + r * .1); ctx.font = '26px "Segoe Print", cursive'; ctx.fillStyle = 'rgba(125,12,18,.55)'; ctx.fillText(WRITE[((k % 6) + 6) % 6], 0, 0); ctx.restore(); }
  });
}
function drawObj(o) {
  if (o.gone) return; const near = Math.abs(o.x - P.x) < 60, f = focus > 0 && o.fake;
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = f ? '#c44' : '#050407'; if (f) ctx.setLineDash([5, 4]);
  if (o.fake && ep === 0) ctx.globalAlpha = .65 + .3*Math.sin(t/4);
  if (o.t === 'note') { ctx.fillStyle = o.read ? '#6d675c' : '#b8ae96'; hrect(o.x - 12, GY - 34, 24, 30, o.x); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#333'; for (let i = 0; i < 3; i++) ctx.fillRect(o.x - 8, GY - 27 + i*7, 16, 2); }
  if (o.t === 'lamp') { ctx.fillStyle = '#2b2a2e'; ctx.fillRect(o.x - 3, GY - 130, 6, 130); const fl = .75 + .25 * Math.sin(t / 7 + o.x);
    const g = ctx.createRadialGradient(o.x, GY - 130, 4, o.x, GY - 130, 90); g.addColorStop(0, 'rgba(240,210,140,' + (.7 * fl) + ')'); g.addColorStop(1, 'rgba(240,210,140,0)');
    ctx.fillStyle = g; ctx.fillRect(o.x - 95, GY - 225, 190, 190); ctx.fillStyle = '#f0d890'; ctx.beginPath(); ctx.arc(o.x, GY - 130, 6, 0, 7); ctx.fill(); }
  if (o.t === 'life') { const y = o.y + Math.sin(t / 12) * 4; glow(o.x, y, 34, 'rgba(235,90,110,.35)'); ctx.fillStyle = '#e8606e'; ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillText('♥', o.x, y + 8); }
  if (o.t === 'door') { ctx.fillStyle = lvIdx === 1 ? '#7a7f7c' : '#3d2c2a'; hrect(o.x - 28, GY - 104, 56, 104, o.x); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b79b52'; ctx.beginPath(); ctx.arc(o.x + 16, GY - 50, 4, 0, 7); ctx.fill(); }
  if (o.t === 'key') { const y = o.y + Math.sin(t/15)*4; ctx.strokeStyle = f ? '#c44' : '#3a2f12'; ctx.fillStyle = '#d4b45a'; ctx.beginPath(); ctx.arc(o.x, y, 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillRect(o.x - 2, y + 6, 4, 16); ctx.fillRect(o.x - 2, y + 16, 9, 3); }
  if (o.t === 'npc') { ctx.fillStyle = o.fake ? '#8a93a0' : '#9b8f8a'; ctx.strokeStyle = f ? '#c44' : '#050407';
    ctx.beginPath(); ctx.moveTo(o.x - 16, GY); ctx.quadraticCurveTo(o.x - 18, GY - 56, o.x, GY - 62); ctx.quadraticCurveTo(o.x + 18, GY - 56, o.x + 16, GY); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(o.x, GY - 72, 12, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(o.x - 6, GY - 75, 3, 4); ctx.fillRect(o.x + 3, GY - 75, 3, 4);
    if (o.id === 'voz') { ctx.globalAlpha = .5; ctx.fillStyle = '#000'; ctx.fillRect(o.x - 18, GY - 90, 36, 90); } }
  ctx.restore();
  if (near && o.t !== 'key' && o.t !== 'lamp' && o.t !== 'life') { ctx.fillStyle = '#e8e0cc'; ctx.font = '14px "Segoe Print", cursive'; ctx.textAlign = 'center'; ctx.fillText('[E]', o.x, GY - 118); }
}
function wrap(txt, x, y, w, lh) {
  const words = txt.split(' '); let line = '';
  for (const wd of words) { const tt = line + wd + ' '; if (ctx.measureText(tt).width > w && line) { ctx.fillText(line, x, y); line = wd + ' '; y += lh; } else line = tt; }
  ctx.fillText(line, x, y); return y;
}
function idleFrame() {
  const n = P.idle; // parado por muito tempo: o personagem muda de pose
  if (n < 200) return Math.floor(P.fr / 50) % 4 === 3 ? 1 : 0;
  if (n < 460) return 19; if (n < 720) return 20; if (n < 980) return 21; if (n < 1250) return 22; return 23;
}
function drawPlayer() {
  const flip = P.face < 0; let fi;
  const pick = a => a.f[Math.floor(P.fr / a.s) % a.f.length];
  if (P.back > 0) fi = 3;
  else if (P.inv > 88) fi = 18;
  else if (!P.on) fi = P.vy < -3 ? 15 : 16;
  else if (P.land > 0) fi = P.landHard ? 14 : 17;
  else if (P.turn > 0 && Math.abs(P.vx) < 3) fi = 2;
  else if (Math.abs(P.vx) > 3.4) fi = pick(ANIM.run);
  else if (Math.abs(P.vx) > .4) fi = pick(ANIM.walk);
  else fi = idleFrame();
  const al = P.inv > 0 && Math.floor(P.inv / 4) % 2 ? .4 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(P.x, P.y, 22, 5, 0, 0, 7); ctx.fill();
  const hg = ctx.createRadialGradient(P.x, P.y - 50, 5, P.x, P.y - 50, 85); hg.addColorStop(0, 'rgba(150,145,135,.45)'); hg.addColorStop(1, 'rgba(150,145,135,0)');
  ctx.fillStyle = hg; ctx.fillRect(P.x - 90, P.y - 140, 180, 150);
  drawSprite(fi, P.x, P.y, flip, al);
}
function drawFace(i, x, y, h) { // retrato de expressão do protagonista
  const s = SP[i], w = h * s[2] / s[3];
  ctx.fillStyle = 'rgba(62,62,70,.92)'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8); ctx.strokeStyle = '#9a9488'; ctx.lineWidth = 2; ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.drawImage(sheet, s[0], s[1], s[2], s[3], x, y, w, h);
}
function drawDark() {
  const R = (blackout > 0 ? .4 : 1) * ((focus > 0 ? 330 : 195) - Math.max(0, anx - 50) * 1.4 + (ep > 0 ? Math.sin(t/5) * 25 : 0)), px = P.x - cam, py = P.y - 45;
  oc.globalCompositeOperation = 'source-over'; oc.clearRect(0, 0, W, H); oc.fillStyle = 'rgba(2,2,6,' + (blackout > 0 ? .985 : ep > 0 ? .86 : .9 + lvIdx * .012) + ')'; oc.fillRect(0, 0, W, H);
  oc.globalCompositeOperation = 'destination-out';
  const g = oc.createRadialGradient(px, py, 25, px, py, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.6, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  oc.fillStyle = g; oc.fillRect(0, 0, W, H);
  for (const o of objs) if (o.t === 'lamp' && blackout <= 0) { const lx = o.x - cam, ly = GY - 110, lg = oc.createRadialGradient(lx, ly, 10, lx, ly, 170); lg.addColorStop(0, 'rgba(0,0,0,.9)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); oc.fillStyle = lg; oc.fillRect(lx - 180, ly - 180, 360, 360); }
  ctx.drawImage(ov, 0, 0);
}
function drawHUD() {
  ctx.textAlign = 'left'; ctx.font = '16px "Segoe Print", cursive'; ctx.fillStyle = '#d8d0c0';
  ctx.fillText('Lembranças: ' + score, 16, 28); ctx.fillText('Sanidade: ' + '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, MAXL - lives)), 16, 50);
  ctx.fillText(hasKey ? '🗝 chave' : '', 16, 72);
  ctx.fillStyle = '#222'; ctx.fillRect(16, 82, 110, 7); ctx.fillStyle = focusCD > 0 ? '#554' : '#9ac'; ctx.fillRect(16, 82, 110 * (1 - focusCD / 480), 7);
  ctx.fillStyle = '#8a857c'; ctx.font = '11px "Segoe Print", cursive'; ctx.fillText('foco [Q]', 132, 90);
  ctx.font = '11px "Segoe Print", cursive'; ctx.fillStyle = '#222'; ctx.fillRect(16, 96, 110, 7); ctx.fillStyle = anx > 70 ? '#b33' : '#7a5a8a'; ctx.fillRect(16, 96, 110 * anx / 100, 7);
  ctx.fillStyle = '#8a857c'; ctx.fillText('ansiedade', 132, 104); if (ep > 0 && lvIdx >= 2) { ctx.fillStyle = '#c66'; ctx.fillText('⇄ comandos invertidos', 16, 122); }
  let mood = 24;
  if (ep > 0) mood = Math.floor(t / 12) % 3 === 2 ? 26 : 29; else if (P.inv > 40) mood = 26; else if (focus > 0) mood = 27;
  else if (lives === 1) mood = 28; else if (enemies.some(e => !e.dead && !e.fake && Math.abs(e.x - P.x) < 170)) mood = 25;
  drawFace(mood, W - 76, 46, 64);
  if (msg.n > 0) { ctx.globalAlpha = Math.min(1, msg.n / 30); ctx.textAlign = 'center'; ctx.font = '18px "Segoe Print", cursive'; ctx.fillStyle = '#000'; ctx.fillText(msg.t, W/2 + 2, H - 28); ctx.fillStyle = '#d4cbb8'; ctx.fillText(msg.t, W/2, H - 30); ctx.globalAlpha = 1; }
}
function drawDialog() {
  const n = dlg.nodes[dlg.i]; ctx.fillStyle = 'rgba(5,4,8,.93)'; ctx.strokeStyle = '#9a9488'; ctx.lineWidth = 3; hrect(40, H - 190, W - 80, 170, 3); ctx.fill(); ctx.stroke();
  const pt = /Diário|Bilhete|Prontuário|Foto/.test(n.w), tx = pt ? 168 : 62;
  if (pt) drawFace(n.w === 'Foto rasgada' ? 28 : 24, 62, H - 178, 120);
  ctx.textAlign = 'left'; ctx.fillStyle = '#c9a85a'; ctx.font = 'bold 18px "Segoe Print", cursive'; ctx.fillText(gl(n.w), tx, H - 160);
  ctx.fillStyle = '#e4dcc8'; ctx.font = '17px "Segoe Print", cursive'; let y = wrap(gl(n.t), tx, H - 128, W - 80 - tx - 20, 24);
  if (n.c) { ctx.fillStyle = '#9ac'; n.c.forEach((c, i) => { y += 28; ctx.fillText((i + 1) + ') ' + c[0], tx + 8, y); }); }
  else { ctx.fillStyle = '#888'; ctx.font = '13px "Segoe Print", cursive'; ctx.textAlign = 'right'; ctx.fillText('[Espaço] continuar', W - 62, H - 32); }
}
function glitchPass() {
  if (ep <= 0) return;
  for (let y = 0; y < H; y += 6) { const o = Math.sin(y/17 + t/6) * (4 + ep/60) * (Math.random() < .15 ? 3 : 1); ctx.drawImage(cv, 0, y, W, 6, o, y, W, 6); }
}
function render() {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (state === 'menu' || state === 'end') { ctx.restore(); return; }
  if (state === 'cut') { drawCut(); ctx.restore(); return; }
  if (shake > 0) { shake--; ctx.translate(rnd(-3, 3), rnd(-3, 3)); }
  drawBackground();
  ctx.save(); ctx.translate(-Math.round(cam), 0);
  plats.forEach(drawPlat); objs.forEach(drawObj); coins.forEach(drawCoin); enemies.forEach(drawEnemy);
  if (ghost) { ctx.globalAlpha = .6; ctx.fillStyle = '#000'; ctx.fillRect(ghost.x - 14, GY - 150, 28, 150); ctx.beginPath(); ctx.arc(ghost.x, GY - 160, 18, 0, 7); ctx.fill(); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(ghost.x - 8, GY - 163, 4, 4); ctx.fillRect(ghost.x + 4, GY - 163, 4, 4); ctx.globalAlpha = 1; }
  drawPlayer();
  ctx.restore();
  drawDark(); drawEyes(); glitchPass(); drawFear(); drawHUD();
  if (state === 'dialog') drawDialog();
  if (state === 'intro') {
    const a = Math.min(1, intro / 60); ctx.fillStyle = 'rgba(0,0,0,' + (intro > 180 ? 1 : a) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.globalAlpha = intro > 180 ? 1 : a; ctx.fillStyle = '#cfc7b6'; ctx.font = '30px "Segoe Print", cursive'; ctx.fillText(L.name, W/2, H/2 - 10);
    ctx.font = '16px "Segoe Print", cursive'; ctx.fillStyle = '#8c867c'; ctx.fillText(L.sub, W/2, H/2 + 30); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
sheet.onload = () => { imgOK = true; };
sheet.onerror = () => { endScreen('SPRITES NÃO ENCONTRADOS', 'Não consegui carregar assets/protagonista_sprites.png.\n\nConfira se a pasta se chama "assets" (minúsculas), ao lado do index.html,\ne se o arquivo se chama exatamente protagonista_sprites.png.', 'Tentar de novo'); startBtn.onclick = () => location.reload(); };
(function loop() {
  try { if (imgOK || state === 'menu') { update(); render(); } } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
})();
})();