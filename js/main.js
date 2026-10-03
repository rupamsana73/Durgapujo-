// App controller: loads data, wires events, and re-renders from state.
import * as store from './state.js';
import { t, applyI18n, lang } from './i18n.js';
import { loadAll } from './data.js';
import { attachNearestMetro, nearestStation } from './metro.js';
import { haversine, fmtKm } from './geo.js';
import * as route from './route.js';
import * as share from './share.js';
import * as timeline from './timeline.js';
import * as map from './map.js';
import * as ui from './ui.js';

const $ = (sel) => document.querySelector(sel);
let D; // { pandals, metro, config }
let areas = [];
let toastTimer;

const byId = (id) => D.pandals.find((p) => p.id === id);

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function startInfo(s) {
  if (s.start === 'me') return { point: s.userLoc, origin: null, label: t('plan.me') };
  const sp = D.config.startPoints.find((x) => x.id === s.start);
  if (!sp) return { point: s.userLoc, origin: null, label: t('plan.me') };
  return { point: sp, origin: sp, label: lang() === 'bn' && sp.nameBn ? sp.nameBn : sp.name };
}

function visible(s) {
  const q = s.q.trim().toLowerCase();
  let list = D.pandals.filter((p) =>
    (s.area === 'all' || p.area === s.area) &&
    (s.type === 'all' || p.type === s.type) &&
    (!s.favOnly || s.favs.includes(p.id)) &&
    (!q || p.name.toLowerCase().includes(q) || (p.nameBn || '').includes(q) || t('area.' + p.area).toLowerCase().includes(q)));
  if (s.userLoc) list = [...list].sort((a, b) => haversine(s.userLoc, a) - haversine(s.userLoc, b));
  return list;
}

const popupFor = (p) => ui.popupHtml(p, { inPlan: store.get().stops.includes(p.id), lines: D.metro.lines });

function applyTheme(s) {
  const dark = s.theme ? s.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#14122A' : '#B0102A';
}

function renderHeader() {
  const st = timeline.status(D.config);
  let text = '';
  if (st.state === 'before') text = t('cd.before', { n: st.days, day: t('day.' + st.target) });
  else if (st.state === 'during') {
    text = t('cd.during', { day: t('day.' + st.day) });
    if (st.crowd) text += `. ${t('cd.crowd', { level: t('crowd.' + st.crowd) })}`;
  } else text = t('cd.after');
  $('#countdown').textContent = text;
  $('#btn-lang').textContent = lang() === 'bn' ? 'EN' : 'বাং';
}

function renderPlan(s) {
  const stops = s.stops.map(byId).filter(Boolean);
  const st = startInfo(s);
  const view = {
    stops, start: s.start, startLabel: st.label, startPoints: D.config.startPoints, mode: s.mode,
    legs: route.buildLegs(st.origin, stops, 'transit'),
    full: route.fullRoute(st.origin, stops, s.mode),
    total: route.totalKm(st.point, stops),
    waUrl: share.whatsappUrl(t('plan.shareText'), share.buildUrl(s.stops, s.start))
  };
  $('#tab-plan').innerHTML = ui.planHtml(view);
  $('#plan-badge').textContent = stops.length || '';
  map.drawRoute(st.point ? [st.point, ...stops] : stops);
  share.syncUrl(s.stops, s.start);
}

function render() {
  const s = store.get();
  // remember keyboard focus so re-rendering does not drop it
  const a = document.activeElement;
  let focusKey = null;
  if (a && a.dataset && a.dataset.action) {
    focusKey = `[data-action="${a.dataset.action}"]`;
    for (const k of ['id', 'value', 'tab']) if (a.dataset[k] !== undefined) focusKey += `[data-${k}="${a.dataset[k]}"]`;
  }

  document.documentElement.lang = s.lang;
  applyTheme(s);
  applyI18n();
  renderHeader();

  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === s.tab)));
  ['explore', 'plan', 'guide'].forEach((n) => { $('#tab-' + n).hidden = s.tab !== n; });

  const list = visible(s);
  $('#chips').innerHTML = ui.chipsHtml(s, areas);
  $('#count').textContent = t('list.count', { n: list.length });
  $('#list').innerHTML = list.length
    ? list.map((p) => ui.cardHtml(p, {
        planIndex: s.stops.indexOf(p.id), fav: s.favs.includes(p.id), lines: D.metro.lines,
        distKm: s.userLoc ? haversine(s.userLoc, p) : null
      })).join('')
    : `<p class="empty">${t('list.empty')}</p>`;

  renderPlan(s);
  $('#tab-guide').innerHTML = ui.guideHtml({ config: D.config, status: timeline.status(D.config), lang: s.lang });

  const order = new Map(s.stops.map((id, i) => [id, i + 1]));
  map.sync(D.pandals, new Set(list.map((p) => p.id)), order, new Set(s.favs), popupFor);

  if (focusKey) document.querySelector(focusKey)?.focus();
}

function locate() {
  if (!navigator.geolocation) return toast(t('loc.denied'));
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      store.set({ userLoc: loc });
      map.setUser(loc, true);
      const n = nearestStation(loc, D.metro.stations);
      if (n) toast(t('loc.found', { s: n.station.name, km: '~' + fmtKm(n.walkKm) }));
    },
    () => toast(t('loc.denied')),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function move(id, delta) {
  const stops = [...store.get().stops];
  const i = stops.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= stops.length) return;
  [stops[i], stops[j]] = [stops[j], stops[i]];
  store.set({ stops });
}

const actions = {
  add: (el) => { const id = +el.dataset.id; const s = store.get(); if (!s.stops.includes(id)) { store.set({ stops: [...s.stops, id] }); toast(t('toast.added')); } },
  remove: (el) => { const id = +el.dataset.id; store.set({ stops: store.get().stops.filter((x) => x !== id) }); toast(t('toast.removed')); },
  up: (el) => move(+el.dataset.id, -1),
  down: (el) => move(+el.dataset.id, 1),
  fav: (el) => {
    const id = +el.dataset.id; const favs = store.get().favs;
    store.set({ favs: favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id] });
  },
  focus: (el) => map.focus(+el.dataset.id),
  tab: (el) => store.set({ tab: el.dataset.tab }),
  area: (el) => { store.set({ area: el.dataset.value }); map.fit(visible(store.get())); },
  type: (el) => { store.set({ type: el.dataset.value }); map.fit(visible(store.get())); },
  favs: () => store.set({ favOnly: !store.get().favOnly }),
  locate,
  auto: () => {
    const s = store.get();
    const ordered = route.orderStops(startInfo(s).point, s.stops.map(byId).filter(Boolean));
    store.set({ stops: ordered.map((p) => p.id) });
  },
  clear: () => store.set({ stops: [] }),
  copy: async () => { const s = store.get(); toast((await share.copy(share.buildUrl(s.stops, s.start))) ? t('toast.copied') : ''); },
  lang: () => store.set({ lang: lang() === 'bn' ? 'en' : 'bn' }),
  theme: () => store.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' })
};

function wireEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'start') store.set({ start: el.value });
    if (el.dataset.change === 'mode') store.set({ mode: el.value });
  });
  $('#search').addEventListener('input', (e) => store.set({ q: e.target.value }));
}

function restoreFromUrl() {
  const { stops, start } = share.parseUrl();
  const patch = {};
  if (stops.length) { patch.stops = stops.filter((id) => byId(id)); patch.tab = 'plan'; }
  if (start && (start === 'me' || D.config.startPoints.some((sp) => sp.id === start))) patch.start = start;
  if (Object.keys(patch).length) store.set(patch);
}

async function boot() {
  applyTheme(store.get());
  applyI18n();
  wireEvents();
  try {
    D = await loadAll();
  } catch (err) {
    console.error(err);
    const n = $('#notice'); n.hidden = false; n.textContent = t('error.data');
    return;
  }
  attachNearestMetro(D.pandals, D.metro.stations);
  areas = [...new Set(D.pandals.map((p) => p.area))];

  map.init($('#map'), D.metro.stations, D.metro.lines, (s) => ui.metroPopupHtml(s, D.metro.lines));
  restoreFromUrl();
  // drop stale ids if pandals.json changed since the plan was saved
  store.set({ stops: store.get().stops.filter((id) => byId(id)) });

  if (D.config.sampleData) { const n = $('#notice'); n.hidden = false; n.textContent = t('notice.sample'); }
  store.subscribe(() => {
    if (D.config.sampleData) $('#notice').textContent = t('notice.sample');
    render();
  });
  render();
  map.fit(D.pandals);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
}

boot();
