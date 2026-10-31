/* ======================= FOODS ======================= */
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const FOODS = {};
FOOD_RAW.forEach(r => {
  const id = slug(r[0]);
  FOODS[id] = {id, n:r[0], sv:r[1], k:r[2], p:r[3], c:r[4], f:r[5], fb:r[6], s:r[7], na:r[8], g:r[9], d:r[10],
               vg:r[11], fg:r[12], j:r[13], fe:r[14], ca:r[15], vc:r[16], pr:r[17] ? r[17].split(',') : [], t:r[18]};
});
const GROUPS = ['All','Rotis & breads','Rice & breakfast','Dal & pulses','Vegetables','Fruits','Dairy','Egg & meat','Nuts & seeds','Snacks','Sweets','Drinks','Extras','My foods'];
const MEALS = [['breakfast','🌅 Breakfast'],['lunch','🍛 Lunch'],['snacks','🍎 Snacks'],['dinner','🌙 Dinner']];
const NUTR = ['k','p','c','f','fb','s','na','fe','ca','vc','vg','fg','j'];

/* ======================= STATE ======================= */
const KEY = 'foodTracker.v1';
/* Family: ROOT holds every person; S is the person currently selected.
   Custom foods and recently used foods are shared by the whole family. */
const emptyPerson = (name, emoji) => ({name, emoji, profile:null, plan:{breakfast:[],lunch:[],snacks:[],dinner:[]}, days:{}, quick:{}});
let ROOT, S;
function loadRoot(raw) {
  let r = raw;
  if (!r || !r.people) {                       // old single-person format → becomes "Me"
    const me = Object.assign(emptyPerson('Me', '🙂'), r ? {profile:r.profile, plan:r.plan || emptyPerson().plan, days:r.days || {}, quick:r.quick || {}, suggestN:r.suggestN} : {});
    r = {people:{me}, order:['me'], active:'me', custom:(r && r.custom) || [], recent:(r && r.recent) || []};
    r.people.mother = emptyPerson('Mother', '👩'); r.people.father = emptyPerson('Father', '👨'); r.order.push('mother', 'father');
  }
  r.custom = r.custom || []; r.recent = r.recent || [];
  r.order = (r.order || Object.keys(r.people)).filter(id => r.people[id]);
  if (!r.people[r.active]) r.active = r.order[0];
  r.order.forEach(id => {
    const p = r.people[id];
    p.quick = p.quick || {}; p.days = p.days || {}; p.plan = p.plan || emptyPerson().plan;
    Object.defineProperty(p, 'custom', {get: () => ROOT.custom, set: v => ROOT.custom = v, enumerable: false, configurable: true});
    Object.defineProperty(p, 'recent', {get: () => ROOT.recent, set: v => ROOT.recent = v, enumerable: false, configurable: true});
  });
  ROOT = r; S = r.people[r.active];
}
try { loadRoot(JSON.parse(localStorage.getItem(KEY))); } catch (e) { loadRoot(null); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ROOT)); } catch (e) {} };
save();
const food = id => FOODS[id] || S.custom.find(c => c.id === id);

const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
let cur = keyOf(today());
let calView = new Date(today().getFullYear(), today().getMonth(), 1);
const $ = id => document.getElementById(id);
const r0 = x => Math.round(x), r1 = x => Math.round(x * 10) / 10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtQ = q => q === 0.5 ? '½' : (q % 1 === 0.5 ? Math.floor(q) + '½' : String(q));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1600); }

function day(k, create) {
  if (!S.days[k] && create) S.days[k] = {meals:{breakfast:[],lunch:[],snacks:[],dinner:[]}, water:0};
  return S.days[k];
}
const allItems = d => d ? MEALS.flatMap(([m]) => d.meals[m] || []) : [];
function mealNow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h < 11 ? 'breakfast' : h < 15.5 ? 'lunch' : h < 18.5 ? 'snacks' : 'dinner';
}
let qMeal = mealNow();

/* pieces per serving, e.g. "2 pieces" → 2, "Omelette (2 eggs)" → 2 */
function pieces(f) {
  const m = (f.n.match(/\((\d+) eggs?\)/) || f.sv.match(/^(\d+) (pieces|whites)/) || f.sv.match(/^(\d+)$/));
  return m ? +m[1] : 1;
}

/* ======================= TARGETS =======================
   Calories: Mifflin-St Jeor BMR × activity, ± goal (gentle, never below a safe floor).
   ICMR-NIN 2024 guidelines: fat ≤ 30% of calories, salt < 5 g/day, free sugar ≤ 5% of calories,
   vegetables ≥ 400 g + fruit ≥ 100 g. ICMR-NIN 2020 RDAs: iron 19 mg (men, women 50+) / 29 mg (women),
   calcium 1000 mg, vitamin C 80 mg (men) / 65 mg (women).
   Protein 1.0 g/kg (1.2 g/kg if training most days). Fibre 15 g per 1000 kcal. */
function targets(p) {
  p = p || {sex:'m', age:30, ht:170, wt:70, act:1.375, goal:'keep', diet:'v'};
  const bmr = 10*p.wt + 6.25*p.ht - 5*p.age + (p.sex === 'm' ? 5 : -161);
  const tdee = bmr * p.act;
  let k = tdee + (p.goal === 'lose' ? -400 : p.goal === 'gain' ? 300 : 0);
  if (p.goal === 'lose') k = Math.max(k, bmr, p.sex === 'm' ? 1500 : 1200);
  k = Math.round(k / 10) * 10;
  const protein = Math.round(p.wt * (p.act >= 1.55 || p.goal === 'gain' ? 1.2 : 1.0));
  const fat = Math.round(k * 0.25 / 9);
  const carbs = Math.round((k - protein*4 - fat*9) / 4);
  return {k, p:protein, c:carbs, f:fat, fatMax:Math.round(k*0.30/9), fb:Math.max(25, Math.round(k/1000*15)),
          s:Math.round(k*0.05/4), na:2000, vg:400, fg:100, fe:p.sex === 'f' && p.age < 50 ? 29 : 19, ca:1000, vc:p.sex === 'f' ? 65 : 80,
          water:Math.max(8, Math.round(p.wt*35/250)), tdee:Math.round(tdee)};
}
const T = () => targets(S.profile);

function totals(items) {
  const t = {n:0, roti:0, rice:0, dal:0, tea:0, egg:0, prod:{}, fruitN:0, vegN:0};
  NUTR.forEach(x => t[x] = 0);
  items.forEach(it => {
    const fd = food(it.id); if (!fd) return;
    NUTR.forEach(x => t[x] += (fd[x] || 0) * it.q);
    t.n++;
    if (fd.t && t[fd.t] !== undefined) t[fd.t] += it.q * pieces(fd);
    (fd.pr || []).forEach(p => t.prod[p] = (t.prod[p] || 0) + it.q);
    if (fd.fg > 0) t.fruitN += it.q;
    if (fd.g === 'Vegetables') t.vegN += it.q;
  });
  return t;
}
const FRUIT_NAMES = new Set(FRUIT_PICKS.map(x => (food(x[2]) || {pr:[]}).pr).flat());
const isFruit = p => FRUIT_NAMES.has(p);

/* ======================= HEALTH SCORE ======================= */
function evaluate(k) {
  const d = day(k), t = T(), tot = totals(allItems(d));
  if (!d || tot.n === 0) return null;
  const isToday = k === keyOf(today());
  const final = !isToday || new Date().getHours() >= 21;    // judge "too little" only once the day is over
  let s = 100; const bad = [], good = [];
  const pen = (pts, msg) => { s -= pts; bad.push(msg); };
  const diet = S.profile ? S.profile.diet : 'v';
  const kr = tot.k / t.k;
  if (kr > 1.3) pen(25, `Calories far over: ${r0(tot.k)} of ${t.k} kcal`);
  else if (kr > 1.15) pen(12, `Calories a bit over: ${r0(tot.k)} of ${t.k} kcal`);
  else if (final && kr < 0.6) pen(20, `Ate too little: ${r0(tot.k)} of ${t.k} kcal (or log incomplete)`);
  else if (final && kr < 0.8) pen(8, `Calories low: ${r0(tot.k)} of ${t.k} kcal`);
  else if (kr >= 0.85) good.push('Calories on target');
  if (final) {
    const src = 'dal, paneer, curd, sprouts, soya' + (diet !== 'v' ? ', eggs' : '') + (diet === 'n' ? ', chicken/fish' : '');
    if (tot.p < t.p*0.6) pen(20, `Protein very low: ${r0(tot.p)} of ${t.p} g — add ${src}`);
    else if (tot.p < t.p*0.85) pen(10, `Protein low: ${r0(tot.p)} of ${t.p} g — add ${src}`);
    else good.push('Protein on target');
    if (tot.fb < t.fb*0.5) pen(15, `Fibre very low: ${r0(tot.fb)} of ${t.fb} g — more veg, fruit, whole grains, dal`);
    else if (tot.fb < t.fb*0.8) pen(8, `Fibre low: ${r0(tot.fb)} of ${t.fb} g`);
    else good.push('Good fibre');
    if (tot.vg < 200) pen(15, `Too few vegetables: ~${r0(tot.vg)} of ${t.vg} g`);
    else if (tot.vg < 350) pen(7, `Vegetables a bit low: ~${r0(tot.vg)} of ${t.vg} g`);
    else good.push('Plenty of vegetables');
    if (tot.fg < 50) pen(8, `No fruit today — aim for ${t.fg} g`); else good.push('Had fruit');
    if (tot.ca < t.ca*0.5) pen(5, `Calcium low: ${r0(tot.ca)} of ${t.ca} mg — curd, milk, paneer, ragi, til`);
    if (tot.fe < t.fe*0.5) pen(5, `Iron low: ${r1(tot.fe)} of ${t.fe} mg — greens, dal, bajra, chana, jaggery`);
    if (tot.vc < t.vc*0.5) pen(3, `Vitamin C low: ${r0(tot.vc)} of ${t.vc} mg — amla, guava, orange, capsicum`);
    if ((d.water || 0) < t.water*0.6) pen(5, `Drank little water: ${d.water || 0} of ${t.water} glasses`);
    const vegKinds = Object.keys(tot.prod).filter(p => !isFruit(p)).length;
    if (vegKinds >= 4) good.push(`Good variety: ${vegKinds} different vegetables`);
  }
  if (tot.s > t.s*2) pen(20, `Way too much sugar: ${r0(tot.s)} g (limit ${t.s} g)`);
  else if (tot.s > t.s) pen(10, `Sugar over limit: ${r0(tot.s)} g (limit ${t.s} g)`);
  if (tot.na > t.na*1.5) pen(15, `Too much salt: ${r0(tot.na)} mg sodium (limit ${t.na})`);
  else if (tot.na > t.na) pen(8, `Salt a bit high: ${r0(tot.na)} mg sodium (limit ${t.na})`);
  const fatPct = tot.k ? tot.f*9/tot.k*100 : 0;
  if (tot.k > 600 && fatPct > 35) pen(10, `Too oily: ${r0(fatPct)}% of calories from fat (keep under 30%)`);
  if (tot.j >= 3) pen(15, `${r0(tot.j)} servings of fried/junk/sweets`);
  else if (tot.j >= 1.5) pen(8, `${r1(tot.j)} servings of fried/junk/sweets`);
  else if (tot.j >= 1) pen(3, `1 fried/junk/sweet item`);
  s = Math.max(0, Math.min(100, s));
  return {s, rating: s >= 75 ? 'good' : s >= 50 ? 'ok' : 'bad', bad, good, tot, final};
}
const RLABEL = {good:'Healthy day 💚', ok:'Okay day 🟠', bad:'Unhealthy day 🔴'};
const RCOLOR = {good:'var(--good)', ok:'var(--ok)', bad:'var(--bad)'};

/* ======================= QUICK LOG TILES ======================= */
const TILES = [
  {key:'roti',  em:'🫓', lb:'Chapati',   def:'roti-chapati-no-ghee', group:'Rotis & breads', match:f => f.t === 'roti', count:t => t.roti},
  {key:'rice',  em:'🍚', lb:'Rice',      def:'white-rice-cooked',    group:'Rice & breakfast', match:f => f.t === 'rice', count:t => t.rice},
  {key:'dal',   em:'🍲', lb:'Dal',       def:'dal-toor-moong-plain', group:'Dal & pulses', match:f => f.t === 'dal', count:t => t.dal},
  {key:'veg',   em:'🥬', lb:'Sabzi',     grid:'veg',   match:f => f.g === 'Vegetables', count:t => r1(t.vegN)},
  {key:'fruit', em:'🍎', lb:'Fruit',     grid:'fruit', match:f => f.fg > 0, count:t => r1(t.fruitN)},
  {key:'dairy', em:'🥛', lb:'Curd/milk', def:'curd-dahi', group:'Dairy', match:f => f.g === 'Dairy'},
  {key:'tea',   em:'☕', lb:'Tea/coffee', def:'tea-with-milk-sugar', group:'Drinks', match:f => f.t === 'tea', count:t => t.tea},
  {key:'water', em:'💧', lb:'Water'},
  {key:'egg',   em:'🥚', lb:'Egg',       def:'boiled-egg', group:'Egg & meat', match:f => f.t === 'egg', count:t => t.egg, diet:'e'},
  {key:'meat',  em:'🍗', lb:'Chicken/fish', def:'chicken-curry', group:'Egg & meat', match:f => f.g === 'Egg & meat' && f.t !== 'egg', diet:'n'},
  {key:'nuts',  em:'🥜', lb:'Nuts',      def:'almonds', group:'Nuts & seeds', match:f => f.g === 'Nuts & seeds'},
  {key:'other', em:'➕', lb:'Other food'},
];
function visibleTiles() {
  const diet = S.profile ? S.profile.diet : 'v';
  return TILES.filter(t => !t.diet || (t.diet === 'e' && diet !== 'v') || (t.diet === 'n' && diet === 'n'));
}
function renderTiles() {
  const d = day(cur), items = allItems(d), tot = totals(items), t = T();
  $('qMealChips').innerHTML = MEALS.map(([m, l]) => `<div class="chip ${m === qMeal ? 'on' : ''}" onclick="setQMeal('${m}')">${l}</div>`).join('');
  $('tiles').innerHTML = visibleTiles().map(tl => {
    let ct;
    if (tl.key === 'water') ct = `${d ? d.water || 0 : 0}<span class="small muted">/${t.water}</span>`;
    else if (tl.key === 'other') ct = '';
    else if (tl.count) ct = tl.count(tot);
    else ct = r1(items.filter(it => food(it.id) && tl.match(food(it.id))).reduce((a, it) => a + it.q, 0));
    const deflt = tl.def ? food(S.quick[tl.key] || tl.def) : null;
    const sub = deflt ? deflt.n.replace(/\s*\(.*\)/, '').split(' / ')[0] : tl.lb;
    if (tl.key === 'other') return `<div class="tile" onclick="openAdd('day','${qMeal}')" style="cursor:pointer"><div class="em">${tl.em}</div>
       <div class="lb">${tl.lb}</div><div class="ct" style="font-size:.8rem;margin-top:8px">Search</div></div>`;
    return `<div class="tile"><div class="em" onclick="tileMenu('${tl.key}')">${tl.em}</div>
      <div class="lb" onclick="tileMenu('${tl.key}')" title="${esc(sub)}">${esc(tl.key === 'water' || tl.grid ? tl.lb : sub)} ${tl.def ? '▾' : ''}</div>
      <div class="ct">${ct}</div>
      <div class="pm"><button onclick="tileMinus('${tl.key}')">−</button><button class="plus" onclick="tilePlus('${tl.key}')">+</button></div></div>`;
  }).join('');

  // today's plate summary
  const vegs = Object.entries(tot.prod).filter(([p]) => !isFruit(p)).map(([p]) => cap(p));
  const fruits = Object.entries(tot.prod).filter(([p]) => isFruit(p)).map(([p]) => cap(p));
  const parts = [];
  if (tot.roti) parts.push(`🫓 <b>${r1(tot.roti)}</b> chapati/roti`);
  if (tot.rice) parts.push(`🍚 <b>${r1(tot.rice)}</b> katori rice`);
  if (tot.dal) parts.push(`🍲 <b>${r1(tot.dal)}</b> katori dal`);
  if (tot.egg) parts.push(`🥚 <b>${r1(tot.egg)}</b> eggs`);
  if (tot.tea) parts.push(`☕ <b>${r1(tot.tea)}</b> cup${tot.tea === 1 ? '' : 's'} tea/coffee`);
  $('plate').innerHTML = (parts.length ? parts.join(' · ') + '<br>' : '') +
    `🥬 Vegetables: ${vegs.length ? `<b>${vegs.length}</b> — ${esc(vegs.join(', '))}` : '<span class="muted">none yet</span>'}<br>` +
    `🍎 Fruits: ${fruits.length ? `<b>${fruits.length}</b> — ${esc(fruits.join(', '))}` : '<span class="muted">none yet</span>'}`;
}
window.setQMeal = m => { qMeal = m; renderTiles(); };
window.tilePlus = key => {
  const tl = TILES.find(x => x.key === key);
  if (key === 'water') { day(cur, true).water++; save(); renderAll(); return; }
  if (tl.grid) { openGrid(tl.grid); return; }
  const id = S.quick[key] || tl.def;
  addItem('day', qMeal, id, 1);
  toast(`+1 ${food(id).n.replace(/\s*\(.*\)/, '')} → ${MEALS.find(m => m[0] === qMeal)[1].slice(3)}`);
};
window.tileMinus = key => {
  const tl = TILES.find(x => x.key === key), d = day(cur, true);
  if (key === 'water') { d.water = Math.max(0, d.water - 1); save(); renderAll(); return; }
  // remove from the selected meal first, then from any meal (latest first)
  const order = [qMeal, ...MEALS.map(m => m[0]).filter(m => m !== qMeal).reverse()];
  for (const m of order) {
    const arr = d.meals[m];
    for (let i = arr.length - 1; i >= 0; i--) {
      const fd = food(arr[i].id);
      if (fd && tl.match(fd)) { arr[i].q -= 1; if (arr[i].q <= 0) arr.splice(i, 1); save(); renderAll(); return; }
    }
  }
};
window.tileMenu = key => {
  const tl = TILES.find(x => x.key === key);
  if (key === 'water') return;
  if (tl.grid) { openGrid(tl.grid); return; }
  openAdd('day', qMeal, tl.group, key);
};

/* ======================= RENDER: TODAY ======================= */
function bar(label, val, tgt, unit, kind, dec) {
  const pct = tgt ? val / tgt : 0;
  let col;
  if (kind === 'limit') col = pct > 1 ? 'var(--bad)' : pct > 0.8 ? 'var(--ok)' : 'var(--good)';
  else if (kind === 'range') col = pct > 1.15 ? 'var(--bad)' : pct >= 0.85 ? 'var(--good)' : 'var(--accent)';
  else col = pct >= 0.9 ? 'var(--good)' : 'var(--accent)';
  return `<div class="bar"><div class="lbl"><span>${label}</span><span><b>${dec ? r1(val) : r0(val)}</b> / ${tgt} ${unit}${kind === 'limit' ? ' max' : ''}</span></div>
    <div class="track"><div class="fill" style="width:${Math.min(100, pct*100)}%;background:${col}"></div></div></div>`;
}
function macroDonut(tot) {
  const kc = tot.p*4 + tot.c*4 + tot.f*9;
  if (!kc) return '';
  const P = tot.p*4/kc*100, C = tot.c*4/kc*100, F = tot.f*9/kc*100;
  return `<div class="macro"><div class="donut" style="background:conic-gradient(var(--carb) 0 ${C}%, var(--prot) ${C}% ${C+P}%, var(--fat) ${C+P}% 100%)">
      <span>Where<br>calories<br>came from</span></div>
    <div class="mleg">
      <div><i style="background:var(--carb)"></i>Carbs <b>${r0(C)}%</b> <span class="muted small">(ideal 50–60%)</span></div>
      <div><i style="background:var(--prot)"></i>Protein <b>${r0(P)}%</b> <span class="muted small">(ideal 15–25%)</span></div>
      <div><i style="background:var(--fat)"></i>Fat <b>${r0(F)}%</b> <span class="muted small">(max 30%)</span></div>
    </div></div>`;
}

function renderToday() {
  const dt = parseKey(cur), diff = Math.round((dt - today()) / 864e5);
  $('dLabel').textContent = (diff === 0 ? 'Today · ' : diff === -1 ? 'Yesterday · ' : diff === 1 ? 'Tomorrow · ' : '') +
    dt.toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'});
  $('setupNote').style.display = S.profile ? 'none' : 'block';
  const d = day(cur), t = T(), tot = totals(allItems(d)), ev = evaluate(cur);
  renderTiles();

  if (ev) {
    $('scoreNum').textContent = ev.s;
    $('ring').style.background = `conic-gradient(${RCOLOR[ev.rating]} ${ev.s*3.6}deg, var(--none) 0)`;
    $('ratingTxt').textContent = (ev.final ? '' : 'So far: ') + RLABEL[ev.rating];
    $('ratingTxt').style.color = RCOLOR[ev.rating];
    $('ratingSub').textContent = `${r0(tot.k)} kcal · ${r0(tot.p)} g protein` + (ev.final ? '' : ' · full check after 9 pm');
    let html = ev.bad.map(b => `<li>⚠️<span>${esc(b)}</span></li>`).join('') + ev.good.map(g => `<li>✅<span>${esc(g)}</span></li>`).join('');
    if (!ev.final) {
      const h = [];
      if (tot.p < t.p) h.push(`${r0(t.p - tot.p)} g protein`);
      if (tot.vg < t.vg) h.push(`~${r0(t.vg - tot.vg)} g vegetables`);
      if (tot.fg < t.fg) h.push('a fruit');
      if (tot.fb < t.fb) h.push(`${r0(t.fb - tot.fb)} g fibre`);
      if (tot.ca < t.ca * 0.7) h.push(`${r0(t.ca - tot.ca)} mg calcium`);
      html += `<li>💡<span>Still to go: ${t.k > tot.k ? r0(t.k - tot.k) + ' kcal' : 'calories done'}${h.length ? ' · ' + h.join(', ') : ''}</span></li>`;
    }
    $('issues').innerHTML = html;
  } else {
    $('scoreNum').textContent = '–'; $('ring').style.background = 'var(--none)';
    $('ratingTxt').textContent = 'Nothing logged yet'; $('ratingTxt').style.color = 'var(--text)';
    $('ratingSub').textContent = `Your target: ${t.k} kcal · ${t.p} g protein`; $('issues').innerHTML = '';
  }

  $('nutri').innerHTML = macroDonut(tot) +
    '<h4>Energy & macros</h4>' +
    bar('🔥 Calories', tot.k, t.k, 'kcal', 'range') + bar('💪 Protein', tot.p, t.p, 'g', 'goal') +
    bar('🌾 Carbohydrates', tot.c, t.c, 'g', 'range') + bar('🧈 Fat', tot.f, t.fatMax, 'g', 'limit') +
    bar('🥦 Fibre', tot.fb, t.fb, 'g', 'goal') +
    '<h4>Keep these low</h4>' +
    bar('🍬 Added sugar', tot.s, t.s, 'g', 'limit') + bar('🧂 Sodium (salt)', tot.na, t.na, 'mg', 'limit') +
    '<h4>Vitamins & minerals</h4>' +
    bar('🩸 Iron', tot.fe, t.fe, 'mg', 'goal', 1) + bar('🦴 Calcium', tot.ca, t.ca, 'mg', 'goal') + bar('🍊 Vitamin C', tot.vc, t.vc, 'mg', 'goal') +
    '<h4>My plate</h4>' +
    bar('🥕 Vegetables', tot.vg, t.vg, 'g', 'goal') + bar('🍌 Fruit', tot.fg, t.fg, 'g', 'goal') +
    `<div class="row between" style="margin-top:12px"><span class="small">💧 Water <b>${d ? d.water || 0 : 0} / ${t.water} glasses</b></span></div>
     <div class="water">${Array.from({length: Math.max(t.water, d ? d.water || 0 : 0)}, (_, i) => `<div class="glass ${d && i < d.water ? 'on' : ''}"></div>`).join('')}</div>`;

  const y = day(addDays(cur, -1));
  $('meals').innerHTML = MEALS.map(([m, label]) => {
    const eaten = d ? d.meals[m] : [], et = totals(eaten);
    const eatenIds = new Set(eaten.map(x => x.id));
    const planned = (S.plan[m] || []).filter(x => !eatenIds.has(x.id) && food(x.id));
    const rows = eaten.map((it, i) => { const fd = food(it.id); if (!fd) return '';
      return `<div class="item"><div class="nm"><div>${esc(fd.n)}${fd.j ? '<span class="tag j">junk</span>' : ''}</div>
        <div class="small muted">${fmtQ(it.q)} × ${esc(fd.sv)} · ${r0(fd.k*it.q)} kcal · ${r1(fd.p*it.q)} g protein</div></div>
        <button class="iconbtn" onclick="changeQ('${m}',${i},-0.5)">−</button><button class="iconbtn" onclick="changeQ('${m}',${i},0.5)">+</button>
        <button class="iconbtn" onclick="removeItem('${m}',${i})">🗑</button></div>`; }).join('');
    const prow = planned.map(it => { const fd = food(it.id);
      return `<div class="item planned"><div class="nm"><div>${esc(fd.n)}<span class="tag p">plan</span></div>
        <div class="small muted">${fmtQ(it.q)} × ${esc(fd.sv)} · ${r0(fd.k*it.q)} kcal</div></div>
        <button class="iconbtn ok" onclick="atePlanned('${m}','${it.id}',${it.q})">✓ Ate</button></div>`; }).join('');
    const copy = !eaten.length && y && y.meals[m] && y.meals[m].length
      ? `<button class="btn ghost sm" style="margin-top:8px" onclick="copyYesterday('${m}')">↻ Same as yesterday (${y.meals[m].length} items)</button>` : '';
    return `<div class="card meal"><h3><span>${label} <span class="small muted">${et.n ? r0(et.k) + ' kcal · ' + r0(et.p) + ' g protein' : ''}</span></span>
      <button class="btn sm" onclick="openAdd('day','${m}')">+ Add</button></h3>${rows}${prow}
      ${!rows && !prow ? '<div class="small muted">Nothing yet</div>' : ''}${copy}</div>`;
  }).join('');
}
window.changeQ = (m, i, dq) => { const it = day(cur).meals[m][i]; it.q = Math.max(0.5, it.q + dq); save(); renderAll(); };
window.removeItem = (m, i) => { day(cur).meals[m].splice(i, 1); save(); renderAll(); };
window.atePlanned = (m, id, q) => { day(cur, true).meals[m].push({id, q}); save(); renderAll(); };
window.copyYesterday = m => { const y = day(addDays(cur, -1)); day(cur, true).meals[m] = y.meals[m].map(x => ({...x})); save(); renderAll(); toast('Copied from yesterday'); };

/* ======================= RENDER: PLAN ======================= */
function renderPlan() {
  const t = T(), all = MEALS.flatMap(([m]) => S.plan[m]), tot = totals(all);
  $('planTotals').innerHTML = all.length ? `
    <table>
      <tr><td>Calories</td><td>${r0(tot.k)} / ${t.k} kcal</td></tr>
      <tr><td>Protein</td><td>${r0(tot.p)} / ${t.p} g</td></tr>
      <tr><td>Fibre</td><td>${r0(tot.fb)} / ${t.fb} g</td></tr>
      <tr><td>Iron · Calcium · Vit C</td><td>${r1(tot.fe)} mg · ${r0(tot.ca)} mg · ${r0(tot.vc)} mg</td></tr>
      <tr><td>Vegetables · Fruit</td><td>${r0(tot.vg)} g · ${r0(tot.fg)} g</td></tr>
      <tr><td>Fat · Added sugar · Sodium</td><td>${r0(tot.f)} g · ${r0(tot.s)} g · ${r0(tot.na)} mg</td></tr>
    </table>${tot.na > t.na ? `<div class="tip">🧂 Home-cooked food usually has more salt than the 5 g/day limit. Cook with light salt and skip pickle, papad and salted chaas to stay under ${t.na} mg.</div>` : ''}`
    : '<p class="small muted">No plan yet. Tap “Suggest a healthy plan” to get one built for your targets, then change anything you like.</p>';
  $('planMeals').innerHTML = MEALS.map(([m, label]) => {
    const rows = S.plan[m].map((it, i) => { const fd = food(it.id); if (!fd) return '';
      return `<div class="item"><div class="nm"><div>${esc(fd.n)}</div>
        <div class="small muted">${fmtQ(it.q)} × ${esc(fd.sv)} · ${r0(fd.k*it.q)} kcal · ${r1(fd.p*it.q)} g protein</div></div>
        <button class="iconbtn" onclick="planQ('${m}',${i},-0.5)">−</button><button class="iconbtn" onclick="planQ('${m}',${i},0.5)">+</button>
        <button class="iconbtn" onclick="planDel('${m}',${i})">🗑</button></div>`; }).join('');
    return `<div class="card meal"><h3><span>${label} <span class="small muted">${S.plan[m].length ? r0(totals(S.plan[m]).k) + ' kcal' : ''}</span></span>
      <button class="btn sm" onclick="openAdd('plan','${m}')">+ Add</button></h3>${rows || '<div class="small muted">Nothing planned</div>'}</div>`;
  }).join('');
}
window.planQ = (m, i, dq) => { const it = S.plan[m][i]; it.q = Math.max(0.5, it.q + dq); save(); renderAll(); };
window.planDel = (m, i) => { S.plan[m].splice(i, 1); save(); renderAll(); };

// Balanced Indian day templates (ICMR "My Plate" style), scaled to your calories.
const TEMPLATES = [
  { breakfast:[['besan-chilla',2],['curd-dahi',1],['papaya',1]],
    lunch:[['roti-chapati-no-ghee',2],['dal-toor-moong-plain',1],['bhindi-sabzi',1],['green-salad-cucumber-tomato-onion-carrot',1],['buttermilk-chaas',1]],
    snacks:[['roasted-chana',1],['tea-with-milk-no-sugar',1],['almonds',1]],
    dinner:[['roti-chapati-no-ghee',2],['palak-paneer',1],['lauki-tori-tinda-sabzi',1]] },
  { breakfast:[['poha',1],['moong-sprouts-salad',1],['guava',1]],
    lunch:[['brown-rice-cooked',1],['rajma-curry',1],['gobi-cabbage-sabzi',1],['green-salad-cucumber-tomato-onion-carrot',1],['curd-dahi',1]],
    snacks:[['roasted-makhana',1],['tea-with-milk-no-sugar',1],['walnuts',1],['apple',1]],
    dinner:[['jowar-roti',2],['masoor-dal',1],['french-beans-sabzi',1],['vegetable-soup',1]] },
  { breakfast:[['idli',3],['sambar',1],['orange-mosambi',1]],
    lunch:[['roti-chapati-no-ghee',2],['chole',1],['palak-saag',1],['veg-raita',1],['green-salad-cucumber-tomato-onion-carrot',1]],
    snacks:[['peanuts-roasted',1],['buttermilk-chaas',1],['banana',1]],
    dinner:[['vegetable-daliya',1],['paneer-plain',1],['boiled-steamed-vegetables',1]] },
  { breakfast:[['methi-thepla',2],['curd-dahi',1],['apple',1]],
    lunch:[['bajra-roti',2],['moong-dal',1],['gajar-matar',1],['kachumber-cucumber',1],['buttermilk-chaas',1]],
    snacks:[['sprouts-chaat',1],['tea-with-milk-no-sugar',1],['amla',1]],
    dinner:[['roti-chapati-no-ghee',2],['tofu-bhurji',1],['tori-turai-sabzi',1]] },
];
const GRAIN_IDS = new Set(['roti-chapati-no-ghee','brown-rice-cooked','jowar-roti','bajra-roti','vegetable-daliya','poha','idli','methi-thepla']);
function suggestPlan() {
  const p = S.profile || {diet:'v'}, t = T();
  S.suggestN = (S.suggestN || 0) + 1;
  const tpl = JSON.parse(JSON.stringify(TEMPLATES[S.suggestN % TEMPLATES.length]));
  if (p.diet === 'e' || p.diet === 'n') tpl.breakfast = [['omelette-2-eggs',1],['brown-whole-wheat-bread',2],['orange-mosambi',1]];
  if (p.diet === 'n') tpl.dinner = tpl.dinner.map(([id,q]) => ['paneer-plain','palak-paneer','tofu-bhurji','masoor-dal'].includes(id)
      ? (S.suggestN % 2 ? ['chicken-curry',1] : ['fish-curry',1]) : [id,q]);
  const plan = {}; MEALS.forEach(([m]) => plan[m] = tpl[m].map(([id,q]) => ({id,q})));
  const flat = () => MEALS.flatMap(([m]) => plan[m]);
  const all = flat();
  const grain = totals(all.filter(x => GRAIN_IDS.has(x.id))).k, rest = totals(all.filter(x => !GRAIN_IDS.has(x.id))).k;
  const f = grain ? Math.min(1.5, Math.max(0.5, (t.k - rest) / grain)) : 1;   // at most ~3 rotis per meal
  all.forEach(x => { if (GRAIN_IDS.has(x.id)) x.q = Math.max(0.5, Math.round(x.q * f * 2) / 2); });
  const extras = [['snacks','milk-toned-no-sugar',1],['snacks','peanuts-roasted',1],['breakfast','banana',1],
                  ['dinner','curd-dahi',1],['snacks','mixed-nuts',1],['lunch','roti-chapati-no-ghee',1],['dinner','roti-chapati-no-ghee',1]];
  for (const [m, id, q] of extras) {
    if (t.k - totals(flat()).k < 120) break;
    const ex = plan[m].find(x => x.id === id); if (ex) ex.q += q; else plan[m].push({id, q});
  }
  const trims = [['snacks','roasted-makhana'],['snacks','walnuts'],['snacks','almonds'],['snacks','peanuts-roasted'],
                 ['snacks','roasted-chana'],['breakfast','brown-whole-wheat-bread'],['lunch','curd-dahi'],['lunch','veg-raita'],
                 ['lunch','buttermilk-chaas'],['snacks','buttermilk-chaas'],['breakfast','curd-dahi'],['breakfast','besan-chilla'],['breakfast','methi-thepla']];
  for (const [m, id] of trims) {
    if (totals(flat()).k - t.k < 80) break;
    const i = plan[m].findIndex(x => x.id === id); if (i < 0) continue;
    if (plan[m][i].q > 1) plan[m][i].q -= 1; else plan[m].splice(i, 1);
  }
  let tp = totals(flat()).p;
  if (tp < t.p * 0.9) { plan.snacks.push({id:'greek-yogurt-hung-curd', q:1}); tp += 9; }
  if (tp < t.p * 0.9) plan.lunch.push({id: p.diet === 'v' ? 'moong-sprouts-salad' : 'boiled-egg', q: p.diet === 'v' ? 1 : 2});
  S.plan = plan; save(); renderAll();
}

/* ======================= RENDER: INSIGHTS ======================= */
let range = 7, metric = 'k';
const METRICS = [
  ['score','Score','',100], ['k','Calories','kcal','k'], ['p','Protein','g','p'], ['roti','Chapatis','',null], ['fb','Fibre','g','fb'],
  ['vg','Vegetables','g','vg'], ['fg','Fruit','g','fg'], ['s','Sugar','g','s'], ['na','Sodium','mg','na'],
  ['fe','Iron','mg','fe'], ['ca','Calcium','mg','ca'], ['vc','Vitamin C','mg','vc'], ['water','Water','glasses','water'],
];
function lastDays(n, includeToday) {
  const out = [];
  for (let i = includeToday ? 0 : 1; out.length < n; i++) out.unshift(addDays(keyOf(today()), -i));
  return out;
}
function renderInsights() {
  renderFamily();
  // calendar
  $('mLabel').textContent = calView.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  const first = (calView.getDay() + 6) % 7, n = new Date(calView.getFullYear(), calView.getMonth() + 1, 0).getDate(), tk = keyOf(today());
  let html = ['M','T','W','T','F','S','S'].map(x => `<div class="dow">${x}</div>`).join('');
  for (let i = 0; i < first; i++) html += '<div class="d e"></div>';
  for (let i = 1; i <= n; i++) {
    const k = keyOf(new Date(calView.getFullYear(), calView.getMonth(), i)), ev = evaluate(k);
    const cls = !ev ? '' : (k === tk && !ev.final) ? 'prog' : ev.rating;
    html += `<div class="d ${cls} ${k === tk ? 'today' : ''}" onclick="openDay('${k}')">${i}</div>`;
  }
  $('cal').innerHTML = html;

  // trend chart
  const t = T();
  $('rangeChips').innerHTML = [7, 30].map(r => `<div class="chip ${r === range ? 'on' : ''}" onclick="setRange(${r})">${r} days</div>`).join('');
  $('metricChips').innerHTML = METRICS.map(([k, l]) => `<div class="chip ${k === metric ? 'on' : ''}" onclick="setMetric('${k}')">${l}</div>`).join('');
  const days = lastDays(range, true);
  const M = METRICS.find(x => x[0] === metric);
  const vals = days.map(k => { const ev = evaluate(k); if (!ev) return null;
    return metric === 'score' ? ev.s : metric === 'water' ? (day(k).water || 0) : metric === 'roti' ? ev.tot.roti : ev.tot[metric]; });
  const tgt = M[3] === null ? null : typeof M[3] === 'number' ? null : t[M[3]];
  const max = Math.max(1, ...vals.filter(v => v !== null), tgt || 0) * 1.1;
  const W = 340, H = 170, pl = 30, pb = 20, bw = (W - pl) / days.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-size="9" fill="#94a3b8">`;
  for (let g = 0; g <= 2; g++) { const yv = max / 1.1 * g / 2, y = H - pb - (yv / max) * (H - pb - 6);
    svg += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#334155" stroke-width="0.5"/><text x="${pl - 4}" y="${y + 3}" text-anchor="end">${r0(yv)}</text>`; }
  days.forEach((k, i) => {
    const v = vals[i], x = pl + i * bw + bw * 0.15, w = bw * 0.7;
    if (v !== null) {
      const h = (v / max) * (H - pb - 6), ev = evaluate(k);
      const col = ev.rating === 'good' ? '#22c55e' : ev.rating === 'ok' ? '#f59e0b' : '#ef4444';
      svg += `<rect x="${x}" y="${H - pb - h}" width="${w}" height="${h}" rx="2" fill="${col}" opacity="${k === keyOf(today()) ? 0.55 : 0.9}"><title>${k}: ${r1(v)}</title></rect>`;
    }
    if (range === 7 || i % 5 === 0 || i === days.length - 1) {
      const dd = parseKey(k);
      svg += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${range === 7 ? dd.toLocaleDateString(undefined, {weekday:'short'}).slice(0, 2) : dd.getDate()}</text>`;
    }
  });
  if (tgt) { const y = H - pb - (tgt / max) * (H - pb - 6);
    svg += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#38bdf8" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${W - 2}" y="${y - 3}" text-anchor="end" fill="#38bdf8">${['s','na'].includes(metric) ? 'limit' : 'target'} ${r0(tgt)}</text>`; }
  svg += '</svg>';
  const logged = vals.filter(v => v !== null);
  $('chart').innerHTML = logged.length ? svg + `<p class="small muted" style="margin:6px 0 0">Average: <b>${r1(logged.reduce((a, b) => a + b, 0) / logged.length)} ${M[2]}</b> over ${logged.length} logged day(s). Bar colour = how healthy that day was.</p>`
    : '<p class="small muted">No days logged in this period yet.</p>';

  // averages + fix-first
  const past = lastDays(range, false).map(k => [k, evaluate(k)]).filter(x => x[1]);
  if (!past.length) {
    $('avgCard').innerHTML = `<h3>📊 Your averages</h3><p class="small muted">Log a few full days to see your averages, variety and streaks.</p>`;
  } else {
    const avg = f => past.reduce((a, [, e]) => a + e.tot[f], 0) / past.length;
    const c = {good:0, ok:0, bad:0}; past.forEach(([, e]) => c[e.rating]++);
    const row = (lbl, v, tg, unit, lim) => { const okv = lim ? v <= tg : v >= tg * 0.85;
      return `<tr><td>${okv ? '✅' : '⚠️'} ${lbl}</td><td>${unit === 'mg' && v < 50 ? r1(v) : r0(v)} / ${tg} ${unit}</td></tr>`; };
    const cnt = {};
    past.forEach(([, e]) => e.bad.forEach(b => { const key = b.split(/[:—]/)[0].replace(/^[\d.]+ servings of/, 'Fried/junk/sweets').replace(/^1 fried.*/, 'Fried/junk/sweets').trim(); cnt[key] = (cnt[key] || 0) + 1; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $('avgCard').innerHTML = `<h3>📊 Daily averages (last ${range} days, ${past.length} logged)</h3>
      <p class="small">💚 ${c.good} healthy · 🟠 ${c.ok} okay · 🔴 ${c.bad} unhealthy · avg score <b>${r0(past.reduce((a, [, e]) => a + e.s, 0) / past.length)}</b></p>
      <table>${row('Calories', avg('k'), t.k, 'kcal')}${row('Protein', avg('p'), t.p, 'g')}${row('Carbs', avg('c'), t.c, 'g')}
      ${row('Fat', avg('f'), t.fatMax, 'g', 1)}${row('Fibre', avg('fb'), t.fb, 'g')}${row('Added sugar', avg('s'), t.s, 'g', 1)}
      ${row('Sodium', avg('na'), t.na, 'mg', 1)}${row('Iron', avg('fe'), t.fe, 'mg')}${row('Calcium', avg('ca'), t.ca, 'mg')}
      ${row('Vitamin C', avg('vc'), t.vc, 'mg')}${row('Vegetables', avg('vg'), t.vg, 'g')}${row('Fruit', avg('fg'), t.fg, 'g')}</table>
      <p class="small muted">🫓 ${r1(avg('roti'))} chapatis/day · 🍚 ${r1(avg('rice'))} katori rice/day · ☕ ${r1(avg('tea'))} cups tea/coffee/day · 🍟 ${r1(avg('j'))} junk servings/day</p>
      ${top.length ? '<h3 style="margin-top:12px">🎯 Fix these first</h3>' + top.map(([k, v]) => `<div class="tip">${esc(k)} — ${v} of ${past.length} days</div>`).join('') : ''}`;
  }

  // variety
  const vegC = {}, frC = {};
  lastDays(range, true).forEach(k => { const d = day(k); if (!d) return; Object.entries(totals(allItems(d)).prod).forEach(([p, q]) => {
    const o = isFruit(p) ? frC : vegC; o[p] = (o[p] || 0) + 1; }); });
  const pills = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([p, n]) => `<span class="pill">${esc(cap(p))} ×${n}</span>`).join('');
  const allVeg = ['palak','methi','bhindi','gobi','lauki','karela','beans','gajar','shimla mirch','baingan','tori','tinda','kaddu','beetroot','sarson','drumstick','mushroom','matar','patta gobhi'];
  const allFr = ['guava','amla','orange','papaya','banana','apple','pomegranate','pear','watermelon','mango','kiwi','pineapple'];
  const missV = allVeg.filter(v => !vegC[v]).slice(0, 6), missF = allFr.filter(v => !frC[v]).slice(0, 4);
  const goalV = range === 7 ? 10 : 20;
  $('varietyCard').innerHTML = `<h3>🌈 Variety (last ${range} days)</h3>
    <p class="small"><b>${Object.keys(vegC).length}</b> different vegetables (aim ${goalV}+) · <b>${Object.keys(frC).length}</b> different fruits (aim ${range === 7 ? 5 : 10}+)</p>
    <h4>Vegetables</h4><div class="pills">${pills(vegC) || '<span class="small muted">None logged</span>'}</div>
    <h4>Fruits</h4><div class="pills">${pills(frC) || '<span class="small muted">None logged</span>'}</div>
    ${missV.length || missF.length ? `<div class="tip" style="margin-top:12px">💡 Try next: ${esc(missV.concat(missF).map(cap).join(', '))}. Different colours give you different vitamins & minerals.</div>` : ''}`;

  // streaks
  const streak = test => { let n = 0, k = keyOf(today());
    const ev0 = evaluate(k); if (!(ev0 && test(ev0))) k = addDays(k, -1);
    for (;;) { const ev = evaluate(k); if (ev && test(ev)) { n++; k = addDays(k, -1); } else break; } return n; };
  $('streakCard').innerHTML = `<h3>🔥 Streaks</h3><div class="streaks">
    <div class="streak"><b>${streak(e => e.final && e.rating === 'good')}</b><span>healthy days in a row</span></div>
    <div class="streak"><b>${streak(e => e.tot.fg >= 50)}</b><span>days with fruit</span></div>
    <div class="streak"><b>${streak(e => e.tot.vg >= t.vg * 0.9)}</b><span>days with 400 g+ vegetables</span></div>
    <div class="streak"><b>${streak(e => e.tot.j < 1)}</b><span>days without junk</span></div>
    <div class="streak"><b>${streak(e => e.tot.p >= t.p * 0.9)}</b><span>days protein on target</span></div>
    <div class="streak"><b>${streak(e => e.tot.s <= t.s)}</b><span>days under sugar limit</span></div></div>`;
}
window.setRange = r => { range = r; renderInsights(); };
window.setMetric = m => { metric = m; renderInsights(); };
window.openDay = k => { cur = k; showTab('today'); };

/* ======================= RENDER: PROFILE ======================= */
function loadProfile() {
  const p = S.profile || {sex:'m', age:'', ht:'', wt:'', act:1.55, goal:'keep', diet:'v'};
  $('pSex').value = p.sex; $('pAge').value = p.age; $('pHt').value = p.ht; $('pWt').value = p.wt;
  $('pAct').value = String(p.act); $('pGoal').value = p.goal; $('pDiet').value = p.diet;
  $('pName').value = S.name; $('pEmoji').value = S.emoji;
  $('removePerson').style.display = ROOT.order.length > 1 ? 'inline-block' : 'none';
  $('removePerson').textContent = `Remove ${S.name}`;
}
function renderTargets() {
  if (!S.profile) { $('targetCard').innerHTML = '<h3>🎯 Your ideal daily amounts</h3><p class="small muted">Fill in the form above to see them.</p>'; return; }
  const t = T(), p = S.profile, bmi = p.wt / ((p.ht / 100) ** 2);
  const bmiTxt = bmi < 18.5 ? 'underweight' : bmi < 23 ? 'healthy range (Asian cut-off)' : bmi < 25 ? 'overweight (Asian cut-off)' : 'obese range (Asian cut-off)';
  $('targetCard').innerHTML = `<h3>🎯 Your ideal daily amounts</h3>
    <table>
      <tr><td>🔥 Calories</td><td>${t.k} kcal</td></tr>
      <tr><td>💪 Protein</td><td>${t.p} g</td></tr>
      <tr><td>🌾 Carbohydrates</td><td>~${t.c} g</td></tr>
      <tr><td>🧈 Fat</td><td>~${t.f} g (max ${t.fatMax} g)</td></tr>
      <tr><td>🥦 Fibre</td><td>${t.fb} g or more</td></tr>
      <tr><td>🍬 Added sugar</td><td>under ${t.s} g (~${Math.round(t.s / 5)} tsp)</td></tr>
      <tr><td>🧂 Salt</td><td>under 5 g (1 tsp) = ${t.na} mg sodium</td></tr>
      <tr><td>🩸 Iron</td><td>${t.fe} mg</td></tr>
      <tr><td>🦴 Calcium</td><td>${t.ca} mg</td></tr>
      <tr><td>🍊 Vitamin C</td><td>${t.vc} mg</td></tr>
      <tr><td>🥕 Vegetables</td><td>${t.vg} g+ (~3 katoris, 4–5 kinds)</td></tr>
      <tr><td>🍌 Fruit</td><td>${t.fg} g+ (1–2 fruits)</td></tr>
      <tr><td>💧 Water</td><td>${t.water} glasses</td></tr>
    </table>
    <p class="small muted">BMI ${r1(bmi)} — ${bmiTxt}. Maintenance ≈ ${t.tdee} kcal/day${p.goal === 'lose' ? '; you eat ~400 less to lose about ⅓ kg a week' : p.goal === 'gain' ? '; you eat ~300 more to support muscle gain with your gym training' : ''}.</p>
    <div class="tip">🍽️ ICMR plate rule: half the plate vegetables + fruit, a quarter whole grains/millets, a quarter dal/paneer/curd${p.diet !== 'v' ? '/egg' : ''}${p.diet === 'n' ? '/chicken/fish' : ''}. Limit fried food, sweets, packaged snacks and sugary drinks.</div>`;
}
$('saveProfile').onclick = () => {
  const p = {sex:$('pSex').value, age:+$('pAge').value, ht:+$('pHt').value, wt:+$('pWt').value,
             act:+$('pAct').value, goal:$('pGoal').value, diet:$('pDiet').value};
  if (!(p.age >= 14 && p.age <= 100 && p.ht >= 120 && p.ht <= 230 && p.wt >= 30 && p.wt <= 250)) {
    $('targetCard').innerHTML = '<p style="color:var(--bad)">Please enter a valid age, height (cm) and weight (kg).</p>'; return; }
  S.name = $('pName').value.trim() || S.name; S.emoji = $('pEmoji').value;
  S.profile = p; save(); loadProfile(); renderAll(); toast(`${S.name}'s profile saved`); $('targetCard').scrollIntoView({behavior:'smooth'});
};

/* ======================= ADD-FOOD SHEET ======================= */
let addMode = 'day', addMeal = 'breakfast', addGroup = 'All', picked = null, pickQ = 1, tileKey = null, gridKind = null;
function addItem(mode, meal, id, q) {
  const it = {id, q};
  if (mode === 'plan') S.plan[meal].push(it);
  else { const arr = day(cur, true).meals[meal]; const ex = arr.find(x => x.id === id); if (ex) ex.q += q; else arr.push(it); }
  S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 12);
  save(); renderAll();
}
function openSheet(view) { showView(view); $('sheet').classList.add('on'); $('sheetBg').classList.add('on'); }
function closeSheet() { $('sheet').classList.remove('on'); $('sheetBg').classList.remove('on'); }
function showView(v) { ['pickView','gridView','qtyView','customView'].forEach(x => $(x).classList.toggle('on', x === v)); }
const mealChipHtml = () => MEALS.map(([m, l]) => `<div class="chip ${m === addMeal ? 'on' : ''}" onclick="setMeal('${m}')">${l}</div>`).join('');

window.openAdd = (mode, meal, group, tKey) => {
  addMode = mode; addMeal = meal; addGroup = group || 'All'; tileKey = tKey || null; $('search').value = '';
  $('sheetTitle').textContent = tKey ? 'Choose type (becomes the default for this button)' : mode === 'plan' ? 'Add to plan' : 'Add what you ate';
  renderPicker(); openSheet('pickView');
  setTimeout(() => { if (!tKey) $('search').focus(); }, 50);
};
function openGrid(kind) {
  addMode = 'day'; addMeal = qMeal; gridKind = kind; tileKey = null;
  $('gridTitle').textContent = kind === 'veg' ? '🥬 Which vegetable?' : '🍎 Which fruit?';
  renderGrid(); openSheet('gridView');
}
function renderGrid() {
  $('mealChips2').innerHTML = mealChipHtml();
  const list = gridKind === 'veg' ? VEG_PICKS : FRUIT_PICKS;
  $('pgrid').innerHTML = list.filter(x => food(x[2])).map(([em, lb, id]) => `<div class="pk" onclick="pick('${id}')"><b>${em}</b>${esc(lb)}</div>`).join('');
}
function renderPicker() {
  $('mealChips').innerHTML = mealChipHtml();
  $('mealChips').style.display = tileKey ? 'none' : 'flex';
  $('groupChips').innerHTML = GROUPS.map(g => `<div class="chip ${g === addGroup ? 'on' : ''}" onclick="setGroup('${g}')">${g}</div>`).join('');
  const q = $('search').value.trim().toLowerCase(), diet = S.profile ? S.profile.diet : 'n';
  const okDiet = f => diet === 'n' || f.d === 'v' || (diet === 'e' && f.d === 'e');
  let list = [...Object.values(FOODS), ...S.custom].filter(okDiet);
  if (addGroup === 'My foods') list = S.custom.slice();
  else if (addGroup !== 'All') list = list.filter(f => f.g === addGroup);
  if (q) list = list.filter(f => q.split(/\s+/).every(w => (f.n + ' ' + (f.pr || []).join(' ')).toLowerCase().includes(w)));
  else if (addGroup === 'All') { const rec = S.recent.map(food).filter(Boolean).filter(okDiet); list = [...rec, ...list.filter(f => !S.recent.includes(f.id))]; }
  $('results').innerHTML = list.slice(0, 100).map(f => `<div class="res" onclick="pick('${f.id}')">
     <div>${esc(f.n)}${f.j ? '<span class="tag j">junk</span>' : ''}<div class="small muted">${esc(f.sv)}</div></div>
     <div class="small" style="text-align:right;flex:none">${r0(f.k)} kcal<div class="muted">${r1(f.p)} g protein</div></div></div>`).join('')
     || '<p class="small muted">No match — try another word, or add your own food below.</p>';
}
window.setMeal = m => { addMeal = m; if ($('gridView').classList.contains('on')) renderGrid(); else renderPicker(); };
window.setGroup = g => { addGroup = g; renderPicker(); };
let backView = 'pickView';
window.pick = id => {
  if (tileKey) { S.quick[tileKey] = id; save(); closeSheet(); renderAll(); toast(`${food(id).n} set as default`); return; }
  backView = $('gridView').classList.contains('on') ? 'gridView' : 'pickView';
  picked = food(id); pickQ = 1; showView('qtyView'); renderQty();
};
function renderQty() {
  const f = picked, q = pickQ;
  $('qName').textContent = f.n; $('qServing').textContent = `1 serving = ${f.sv}`; $('qVal').textContent = fmtQ(q);
  $('qInfo').innerHTML = `<table>
    <tr><td>Calories</td><td>${r0(f.k*q)} kcal</td></tr><tr><td>Protein</td><td>${r1(f.p*q)} g</td></tr>
    <tr><td>Carbs · Fat</td><td>${r0(f.c*q)} g · ${r0(f.f*q)} g</td></tr><tr><td>Fibre</td><td>${r1(f.fb*q)} g</td></tr>
    <tr><td>Added sugar · Sodium</td><td>${r0(f.s*q)} g · ${r0(f.na*q)} mg</td></tr>
    <tr><td>Iron · Calcium · Vit C</td><td>${r1((f.fe||0)*q)} · ${r0((f.ca||0)*q)} · ${r0((f.vc||0)*q)} mg</td></tr></table>`;
  $('qAdd').textContent = addMode === 'plan' ? `Add to plan · ${MEALS.find(m => m[0] === addMeal)[1]}` : `Add to ${MEALS.find(m => m[0] === addMeal)[1]}`;
}
$('qMinus').onclick = () => { pickQ = Math.max(0.5, pickQ - 0.5); renderQty(); };
$('qPlus').onclick = () => { pickQ += 0.5; renderQty(); };
$('qBack').onclick = () => showView(backView);
$('qAdd').onclick = () => { addItem(addMode, addMeal, picked.id, pickQ); closeSheet(); toast(`Added ${picked.n.replace(/\s*\(.*\)/, '')}`); };
$('cGroup').innerHTML = GROUPS.filter(g => g !== 'All' && g !== 'My foods').map(g => `<option>${g}</option>`).join('');
$('customBtn').onclick = () => { showView('customView'); $('cName').value = $('search').value; };
$('gridMore').onclick = () => { addGroup = gridKind === 'veg' ? 'Vegetables' : 'Fruits'; $('search').value = ''; renderPicker(); showView('pickView'); };
$('cBack').onclick = () => showView('pickView');
$('cSave').onclick = () => {
  const n = $('cName').value.trim();
  if (!n || $('cK').value === '') { $(n ? 'cK' : 'cName').focus(); return; }
  const num = id => +$(id).value || 0;
  const g = $('cGroup').value;
  const f = {id:'c' + Date.now(), n, sv:$('cServ').value.trim() || '1 serving', k:num('cK'), p:num('cP'), c:num('cC'), f:num('cF'),
             fb:num('cFb'), s:num('cS'), na:num('cNa'), fe:num('cFe'), ca:num('cCa'), vc:num('cVc'), vg:num('cVg'), fg:num('cFg'),
             j:$('cJ').checked ? 1 : 0, d:'v', g, pr:[], t: g === 'Rotis & breads' ? 'roti' : ''};
  S.custom.push(f); save(); backView = 'pickView'; picked = f; pickQ = 1; showView('qtyView'); renderQty();
  ['cName','cServ','cK','cP','cC','cF','cFb','cS','cNa','cFe','cCa','cVc','cVg','cFg'].forEach(x => $(x).value = ''); $('cJ').checked = false;
};
$('search').oninput = renderPicker;
$('closeSheet').onclick = closeSheet; $('closeSheet2').onclick = closeSheet; $('sheetBg').onclick = closeSheet;

/* ======================= NAV & WIRING ======================= */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  renderAll(); window.scrollTo(0, 0);
}
window.showTab = showTab;
document.querySelectorAll('nav button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('dPrev').onclick = () => { cur = addDays(cur, -1); renderAll(); };
$('dNext').onclick = () => { cur = addDays(cur, 1); renderAll(); };
$('mPrev').onclick = () => { calView.setMonth(calView.getMonth() - 1); renderInsights(); };
$('mNext').onclick = () => { calView.setMonth(calView.getMonth() + 1); renderInsights(); };
$('suggestBtn').onclick = () => { suggestPlan(); toast('New plan suggested'); };
$('clearPlan').onclick = () => { MEALS.forEach(([m]) => S.plan[m] = []); save(); renderAll(); };
$('exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(ROOT, null, 1)], {type:'application/json'}));
  a.download = `family-food-backup-${keyOf(today())}.json`; a.click();
};
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = e => { const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { try { const imp = JSON.parse(t); if (imp && imp.people) { loadRoot(imp); save(); loadProfile(); renderAll(); toast('Family backup restored'); }
    else if (imp && imp.days) { Object.assign(S, {profile:imp.profile, plan:imp.plan, days:imp.days, quick:imp.quick || {}}); (imp.custom || []).forEach(c => { if (!food(c.id)) ROOT.custom.push(c); }); save(); loadProfile(); renderAll(); toast('Backup restored for ' + S.name); } } catch (err) { toast('Could not read that file'); } }); };

/* ======================= FAMILY ======================= */
function renderPeople() {
  $('people').innerHTML = ROOT.order.map(id => { const p = ROOT.people[id];
      return `<div class="chip person ${id === ROOT.active ? 'on' : ''}" onclick="switchPerson('${id}')">${p.emoji} ${esc(p.name)}</div>`; }).join('') +
    `<div class="chip person" onclick="addPerson()">＋ Add</div>`;
  document.title = `${S.name} · Food Tracker`;
  $('who').textContent = ROOT.order.length > 1 ? ` — ${S.emoji} ${S.name}` : '';
}
window.switchPerson = id => {
  if (id === ROOT.active) return;
  ROOT.active = id; S = ROOT.people[id]; save(); qMeal = mealNow();
  loadProfile();
  if (!S.profile) showTab('profile'); else renderAll();
  toast(`Now tracking ${S.emoji} ${S.name}`);
};
window.addPerson = () => {
  const id = 'p' + Date.now();
  ROOT.people[id] = emptyPerson(`Person ${ROOT.order.length + 1}`, '🧑'); ROOT.order.push(id);
  loadRoot(ROOT); save(); switchPerson(id);
  setTimeout(() => { $('pName').focus(); $('pName').select(); }, 100);
};
$('removePerson').onclick = () => {
  if (ROOT.order.length < 2) return;
  const btn = $('removePerson');
  if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = `Tap again to delete all of ${S.name}'s data`; setTimeout(() => { delete btn.dataset.sure; loadProfile(); }, 4000); return; }
  delete btn.dataset.sure;
  const gone = S.name;
  delete ROOT.people[ROOT.active]; ROOT.order = ROOT.order.filter(x => x !== ROOT.active);
  ROOT.active = ROOT.order[0]; S = ROOT.people[ROOT.active]; save(); loadProfile(); renderAll(); toast(`Removed ${gone}`);
};
function renderFamily() {
  if (ROOT.order.length < 2) { $('familyCard').style.display = 'none'; return; }
  $('familyCard').style.display = 'block';
  const keep = S, days = lastDays(7, false);
  const rows = ROOT.order.map(id => {
    S = ROOT.people[id];
    const evs = days.map(evaluate).filter(Boolean), t = T();
    const c = {good:0, ok:0, bad:0}; evs.forEach(e => c[e.rating]++);
    const avg = f => evs.length ? evs.reduce((a, e) => a + e.tot[f], 0) / evs.length : 0;
    const td = evaluate(keyOf(today()));
    return `<tr onclick="switchPerson('${id}')" style="cursor:pointer"><td>${S.emoji} <b>${esc(S.name)}</b>
        <div class="small muted">${evs.length ? `💚${c.good} 🟠${c.ok} 🔴${c.bad} · protein ${r0(avg('p'))}/${t.p} g · veg ${r0(avg('vg'))} g` : (S.profile ? 'No full days logged yet' : 'Profile not set up')}</div></td>
      <td>${evs.length ? r0(evs.reduce((a, e) => a + e.s, 0) / evs.length) : '–'}<div class="small muted">today ${td ? td.s : '–'}</div></td></tr>`;
  }).join('');
  S = keep;
  $('familyCard').innerHTML = `<h3>👨‍👩‍👦 Family — last 7 days</h3><table><tr><td class="small muted">Person</td><td class="small muted">Avg score</td></tr>${rows}</table>
    <p class="small muted" style="margin-bottom:0">Tap a name to switch to that person.</p>`;
}

function activeTab() { const t = document.querySelector('.tab.on'); return t ? t.id.slice(4) : 'today'; }
function renderAll() {
  renderPeople();
  const a = activeTab();
  if (a === 'today') renderToday(); else if (a === 'plan') renderPlan(); else if (a === 'insights') renderInsights(); else renderTargets();
}
loadProfile();
if (!S.profile) showTab('profile'); else renderAll();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
