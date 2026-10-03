// App controller: loads data, wires events, and re-renders from state.
import * as store from './state.js';
import { t, applyI18n, lang } from './i18n.js';
import { loadAll } from './data.js';
import { attachNearestMetro, nearestStation, getMetroStationsByRegion, getPandalsNearMetro } from './metro.js';
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

const byId = (id) => D.pandals.find((p) => String(p.id) === String(id));

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
    (!q || p.name.toLowerCase().includes(q) || (p.nameBn || '').includes(q) ||
      t('area.' + p.area).toLowerCase().includes(q) ||
      (p.metro?.station?.name || '').toLowerCase().includes(q) ||
      D.metro.stations.some((station) => station.name.toLowerCase().includes(q) &&
        ((p.areaGroup || '').toLowerCase().includes(q) || p.region === 'north' && station.lat >= 22.59 ||
          p.region === 'south' && station.lat <= 22.55 || p.region === 'central' && station.lat > 22.55 && station.lat < 22.59)) ||
      (p.routeGroup || p.area || '').toLowerCase().includes(q) ||
      (p.googleMapsQuery || '').toLowerCase().includes(q)));
  if (s.userLoc) list = [...list].sort((a, b) => {
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return 1;
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return -1;
    return haversine(s.userLoc, a) - haversine(s.userLoc, b);
  });
  return list;
}

function renderSuggestions(query) {
  const q = query.trim().toLowerCase();
  const el = $('#suggestions');
  if (!q) { el.hidden = true; el.innerHTML = ''; return; }
  const matches = D.pandals.filter((p) => p.name.toLowerCase().includes(q) ||
    (p.nameBn || '').includes(q) || (p.metro?.station?.name || '').toLowerCase().includes(q) ||
    (p.areaGroup || '').toLowerCase().includes(q) ||
    t('area.' + p.area).toLowerCase().includes(q) ||
    p.area.includes(q) || (p.googleMapsQuery || '').toLowerCase().includes(q) ||
    D.metro.stations.some((station) => station.name.toLowerCase().includes(q) &&
      ((p.areaGroup || '').toLowerCase().includes(station.name.toLowerCase()) ||
        (p.region === 'north' && station.lat >= 22.59) ||
        (p.region === 'south' && station.lat <= 22.55) ||
        (p.region === 'central' && station.lat > 22.55 && station.lat < 22.59)))).slice(0, 5);
  const stations = D.metro.stations.filter((station) => station.name.toLowerCase().includes(q)).slice(0, 3);
  el.innerHTML = [
    ...stations.map((station) => `<button data-action="metro-suggestion" data-id="${station.id}">
      <strong>🚇 ${ui.esc(station.name)}</strong><span>Metro station · ${ui.esc(station.name)}</span>
    </button>`),
    ...matches.map((p) => `<button data-action="suggestion" data-id="${p.id}">
    <strong>${ui.esc(ui.pName(p))}</strong><span>${ui.esc(t('area.' + p.area))}${p.metro ? ` · 🚇 ${ui.esc(p.metro.station.name)}` : ''}</span>
  </button>`)
  ].join('');
  el.hidden = !(matches.length || stations.length);
}

function stationRegion(station) {
  if (station.lat >= 22.59) return 'north';
  if (station.lat <= 22.55) return 'south';
  return 'central';
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
  map.drawRoute((st.point ? [st.point, ...stops] : stops).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)));
  share.syncUrl(s.stops, s.start);
}

function renderMapDiscovery(s) {
  const region = s.mapRegion;
  const stations = region ? getMetroStationsByRegion(region, D.metro.stations) : [];
  const station = s.mapMetro ? D.metro.stations.find((item) => item.id === s.mapMetro) : null;
  const verifiedNearby = station
    ? getPandalsNearMetro(station, D.pandals, D.config.map?.metroPandalRadiusKm || 2)
      .filter(({ pandal }) => !region || pandal.region === region)
    : [];
  const nearby = station && verifiedNearby.length
    ? verifiedNearby
    : station
      ? D.pandals.filter((p) => p.area === region).slice(0, 8).map((p) => ({ pandal: p, distanceKm: null }))
      : [];
  $('#map-breadcrumb').textContent = station
    ? `${t('map.title')} > ${t('area.' + region)} > ${station.name}`
    : region ? `${t('map.title')} > ${t('area.' + region)}` : t('map.title');
  $('#map-discovery-list').innerHTML = ui.mapDiscoveryHtml({ region, station, stations, nearby, lines: D.metro.lines, favs: new Set(s.favs) });
  map.filterMetro(region ? stations : D.metro.stations);
}

function renderDetailView(s) {
  const p = s.detailId ? byId(s.detailId) : null;
  const view = $('#detail-view');
  if (!view) return;
  view.hidden = !p;
  if (p) view.innerHTML = ui.detailViewHtml(p, D.metro.lines, s.favs.includes(p.id));
  document.querySelectorAll('.app > section:not(#detail-view)').forEach((el) => { el.hidden = Boolean(p); });
  const wishlist = $('#wishlist-view');
  if (wishlist) wishlist.hidden = Boolean(p) || !s.wishlist;
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
  renderDetailView(s);
  const wishlist = $('#wishlist-view');
  if (wishlist) {
    wishlist.innerHTML = ui.wishlistHtml(D.pandals.filter((p) => s.favs.includes(p.id)), D.metro.lines);
    wishlist.hidden = Boolean(s.detailId) || !s.wishlist;
  }

  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === s.tab)));
  ['explore', 'plan', 'guide'].forEach((n) => { $('#tab-' + n).hidden = s.tab !== n; });

  const list = visible(s);
  $('#featured-list').innerHTML = D.pandals.filter((p) => p.featured).slice(0, 5).map((p) => ui.featuredHtml(p, D.metro.lines)).join('');
  $('#chips').innerHTML = ui.chipsHtml(s, areas);
  $('#count').textContent = t('list.count', { n: list.length });
  $('#list').innerHTML = list.length
    ? list.map((p) => ui.cardHtml(p, {
        planIndex: s.stops.indexOf(p.id), fav: s.favs.includes(p.id), lines: D.metro.lines,
        distKm: s.userLoc && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? haversine(s.userLoc, p) : null
      })).join('')
    : `<p class="empty">${t('list.empty')}</p>`;

  renderPlan(s);
  renderMapDiscovery(s);
  $('#tab-guide').innerHTML = ui.guideHtml({ config: D.config, status: timeline.status(D.config), lang: s.lang });
  $('#map-summary-count').textContent = t('map.count', { n: list.length });

  const order = new Map(s.stops.map((id, i) => [id, i + 1]));
  const mapPandals = s.mapRegion ? D.pandals.filter((p) => p.area === s.mapRegion) : list;
  map.sync(D.pandals, new Set(mapPandals.map((p) => p.id)), order, new Set(s.favs), popupFor);

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
  add: (el) => { const id = el.dataset.id; const s = store.get(); if (!s.stops.includes(id)) { store.set({ stops: [...s.stops, id] }); toast(t('toast.added')); } },
  remove: (el) => { const id = el.dataset.id; store.set({ stops: store.get().stops.filter((x) => String(x) !== String(id)) }); toast(t('toast.removed')); },
  up: (el) => move(el.dataset.id, -1),
  down: (el) => move(el.dataset.id, 1),
  fav: (el) => {
    const id = el.dataset.id; const favs = store.get().favs;
    const removing = favs.includes(id);
    store.set({ favs: removing ? favs.filter((x) => String(x) !== id) : [...favs, id] });
    toast(removing ? 'Removed from Wishlist' : 'Added to Wishlist');
  },
  focus: (el) => map.focus(el.dataset.id),
  details: (el) => {
    const p = byId(el.dataset.id);
    if (!p) return;
    store.set({ detailId: p.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  suggestion: (el) => {
    const p = byId(el.dataset.id);
    if (!p) return;
    $('#suggestions').hidden = true;
    store.set({ q: p.name, tab: 'explore', wishlist: false });
    actions.details(el);
  },
  'metro-suggestion': (el) => {
    const station = D.metro.stations.find((item) => item.id === el.dataset.id);
    if (!station) return;
    $('#suggestions').hidden = true;
    store.set({ q: '', mapRegion: stationRegion(station), mapMetro: station.id, detailId: null, wishlist: false, tab: 'explore' });
    document.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    map.focusMetro(station);
  },
  'route-group': (el) => {
    store.set({ area: el.dataset.value, mapRegion: el.dataset.value, mapMetro: null, type: 'all', favOnly: false, tab: 'explore' });
    $('#search').focus();
  },
  'close-details': () => store.set({ detailId: null, wishlist: false }),
  'view-map': (el) => {
    const p = byId(el.dataset.id);
    if (!p) return;
    store.set({ detailId: null, tab: 'explore' });
    document.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (p.locationVerified) map.focus(el.dataset.id);
    else toast(t('map.pending'));
  },
  'hero-explore': () => { store.set({ tab: 'explore' }); $('#search').focus(); },
  'hero-plan': () => { store.set({ tab: 'plan' }); },
  'mobile-home': () => { store.set({ tab: 'explore', detailId: null, wishlist: false, favOnly: false, q: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  'mobile-pandals': () => { store.set({ tab: 'explore', detailId: null, wishlist: false, favOnly: false }); $('#list').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'mobile-map': () => { document.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'map-region': (el) => store.set({ mapRegion: el.dataset.value, mapMetro: null }),
  'map-station': (el) => {
    const station = D.metro.stations.find((item) => item.id === el.dataset.id);
    store.set({ mapMetro: el.dataset.id });
    if (station) map.focusMetro(station);
  },
  'map-back-region': () => store.set({ mapMetro: null }),
  'mobile-saved': () => { store.set({ tab: 'explore', detailId: null, wishlist: true, favOnly: false }); window.scrollTo({ top: 0, behavior: 'smooth' }); },
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
  $('#home-search').addEventListener('input', (e) => {
    store.set({ q: e.target.value, tab: 'explore' });
    renderSuggestions(e.target.value);
  });
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
  attachNearestMetro(D.pandals, D.metro.stations, D.config.map?.nearbyMetroRadiusKm);
  areas = [...new Set(D.pandals.map((p) => p.area))];
  const validMapPandals = D.pandals.filter((p) => p.locationVerified && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const missingMapPandals = D.pandals.filter((p) => !p.locationVerified || !Number.isFinite(p.lat) || !Number.isFinite(p.lng));
  console.info('[PANDAL MAP]', {
    totalPandals: D.pandals.length,
    validCoordinates: validMapPandals.length,
    missingCoordinates: missingMapPandals.length,
    missingNames: missingMapPandals.map((p) => p.name)
  });

  map.init($('#map'), D.metro.stations, D.metro.lines, (s) => ui.mapStationPopupHtml(s, D.metro.lines));
  restoreFromUrl();
  // drop stale ids if pandals.json changed since the plan was saved
  store.set({ stops: store.get().stops.filter((id) => byId(id)) });

  if (D.config.sampleData) { const n = $('#notice'); n.hidden = false; n.textContent = t('notice.sample'); }
  store.subscribe(() => {
    if (D.config.sampleData) $('#notice').textContent = t('notice.sample');
    render();
  });
  render();
  map.fit(D.pandals.filter((p) => p.locationVerified));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
}

boot();
