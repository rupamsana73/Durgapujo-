import * as store from './state.js';
import { t, applyI18n, lang } from './i18n.js';
import { loadAll } from './data.js';
import { attachNearestMetro, getMetroStationsByRegion, getPandalsNearMetro, nearestStation } from './metro.js';
import { haversine, fmtKm } from './geo.js';
import * as route from './route.js';
import * as share from './share.js';
import * as timeline from './timeline.js';
import * as map from './map.js';
import * as ui from './ui.js';

const $ = (selector) => document.querySelector(selector);
const page = document.body.dataset.page || 'home';
const pageUrl = (name, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const prefix = page === 'home' ? 'pages/' : '';
  return `${prefix}${name}.html${query ? `?${query}` : ''}`;
};

let data;
let areas = [];
let toastTimer;
const sameIdentifier = (value, identifier) =>
  value != null && identifier != null && String(value).toLowerCase() === String(identifier).toLowerCase();
const byId = (id) => data.pandals.find((p) => sameIdentifier(p.id, id) || sameIdentifier(p.slug, id));
const stationById = (id) => data.metro.stations.find((s) =>
  sameIdentifier(s.id, id) || sameIdentifier(s.slug, id) || sameIdentifier(s.name, id));
const valid = (p) => p.locationVerified && Number.isFinite(p.lat) && Number.isFinite(p.lng);

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

function applyTheme() {
  const state = store.get();
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const theme = $('meta[name="theme-color"]');
  if (theme) theme.content = dark ? '#14122A' : '#B0102A';
}

function renderHeader() {
  const node = $('#countdown');
  if (!node) return;
  const status = timeline.status(data.config);
  if (status.state === 'before') node.textContent = t('cd.before', { n: status.days, day: t(`day.${status.target}`) });
  else if (status.state === 'during') node.textContent = t('cd.during', { day: t(`day.${status.day}`) });
  else node.textContent = t('cd.after');
  const langButton = $('#btn-lang');
  if (langButton) langButton.textContent = lang() === 'bn' ? 'EN' : 'বাং';
}

function renderFooter() {
  if (document.querySelector('.site-footer')) return;
  const footer = document.createElement('footer');
  footer.className = 'site-footer pad';
  footer.innerHTML = '<strong>Pujo Planner</strong><span>Kolkata Durga Puja 2026</span>';
  document.body.append(footer);
}

function renderMobileNav() {
  const nav = document.querySelector('.mobile-nav') || document.body.appendChild(document.createElement('nav'));
  nav.className = 'mobile-nav';
  nav.setAttribute('aria-label', 'Primary mobile navigation');
  const root = page === 'home' ? '' : '../';
  const items = [
    ['home', 'index.html', '⌂', 'Home'],
    ['explore', 'pages/explore.html', '🛕', 'Pandals'],
    ['map', 'pages/map.html', '🗺️', 'Map'],
    ['favourites', 'pages/favourites.html', '♥', 'Saved'],
    ['planner', 'pages/planner.html', '📋', 'Plan']
  ];
  nav.innerHTML = items.map(([key, href, icon, label]) => {
    const active = key === page || (page === 'pandal' && key === 'explore') ||
      (page === 'metro' && key === 'map') || (page === 'metro-station' && key === 'map');
    return `<a class="mobile-nav-item${active ? ' active' : ''}" href="${root}${href}"${active ? ' aria-current="page"' : ''}>
      <span aria-hidden="true">${icon}</span><small>${label}</small></a>`;
  }).join('');
}

function renderDesktopNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  const labels = [
    ['explore', 'Pandals'],
    ['map', 'Map'],
    ['metro', 'Metro'],
    ['planner', 'Plan'],
    ['favourites', 'Saved'],
    ['guide', 'Guide']
  ];
  const activePage = page === 'pandal' ? 'explore' : page === 'metro-station' ? 'metro' : page;
  nav.querySelectorAll('a').forEach((link) => {
    const match = labels.find(([key]) => link.getAttribute('href')?.includes(`${key}.html`));
    if (match) link.textContent = match[1];
    const active = link.getAttribute('href')?.includes(`${activePage === 'home' ? 'index' : activePage}.html`);
    if (active) link.setAttribute('aria-current', 'page');
  });
}

function startInfo(state) {
  if (state.start === 'me') return { point: state.userLoc, origin: null, label: t('plan.me') };
  const point = data.config.startPoints.find((item) => item.id === state.start);
  return point ? { point, origin: point, label: lang() === 'bn' && point.nameBn ? point.nameBn : point.name } :
    { point: state.userLoc, origin: null, label: t('plan.me') };
}

function visible(state) {
  const query = state.q.trim().toLowerCase();
  const result = data.pandals.filter((p) =>
    (state.area === 'all' || p.area === state.area) &&
    (state.type === 'all' || p.type === state.type) &&
    (!state.favOnly || state.favs.includes(p.id)) &&
    (!query || [p.name, p.nameBn, p.area, p.areaGroup, p.region, p.googleMapsQuery]
      .filter(Boolean).some((value) => value.toLowerCase().includes(query)) ||
      (p.metro?.station?.name || '').toLowerCase().includes(query)));
  return state.userLoc ? [...result].sort((a, b) => {
    if (!valid(a)) return 1;
    if (!valid(b)) return -1;
    return haversine(state.userLoc, a) - haversine(state.userLoc, b);
  }) : result;
}

function renderSuggestions(query) {
  const node = $('#suggestions');
  if (!node) return;
  const q = query.trim().toLowerCase();
  const pandals = q ? data.pandals.filter((p) =>
    [p.name, p.nameBn, p.area, p.areaGroup, p.region, p.googleMapsQuery]
      .filter(Boolean).some((value) => value.toLowerCase().includes(q)) ||
    (p.metro?.station?.name || '').toLowerCase().includes(q)).slice(0, 5) : [];
  const stations = q ? data.metro.stations.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 3) : [];
  const results = [
    ...stations.map((s) => `<a class="search-result" href="${pageUrl('metro-station', { id: s.id })}">
      <span class="search-result-icon" aria-hidden="true">🚇</span>
      <span class="search-result-content"><strong class="search-result-title">${ui.esc(s.name)}</strong>
        <small class="search-result-meta">Metro Station · ${ui.esc(s.lines.map((line) => data.metro.lines[line]?.name || line).join(' / '))}</small></span>
    </a>`),
    ...pandals.map((p) => `<a class="search-result" href="${pageUrl('pandal', { id: p.id })}">
      <span class="search-result-icon" aria-hidden="true">🛕</span>
      <span class="search-result-content"><strong class="search-result-title">${ui.esc(ui.pName(p))}</strong>
        <small class="search-result-meta">${ui.esc(t(`area.${p.area}`))} · Pandal</small></span>
    </a>`)
  ];
  node.innerHTML = [
    results.length ? `<div class="search-results-heading">Search results</div>${results.join('')}` : ''
  ].join('');
  node.hidden = !pandals.length && !stations.length;
}

function renderCards() {
  const list = $('#list');
  if (!list) return;
  const state = store.get();
  const items = visible(state);
  const count = $('#count');
  if (count) count.textContent = t('list.count', { n: items.length });
  list.innerHTML = items.length ? items.map((p) => ui.cardHtml(p, {
    planIndex: state.stops.indexOf(p.id),
    fav: state.favs.includes(p.id),
    lines: data.metro.lines,
    distKm: state.userLoc && valid(p) ? haversine(state.userLoc, p) : null
  })).join('') : `<p class="empty">${t('list.empty')}</p>`;
  const chips = $('#chips');
  if (chips) chips.innerHTML = ui.chipsHtml(state, areas);
}

function renderPlan() {
  const node = $('#tab-plan, #plan');
  if (!node) return;
  const state = store.get();
  const info = startInfo(state);
  const stops = state.stops.map(byId).filter(Boolean);
  node.innerHTML = ui.planHtml({
    stops, start: state.start, startLabel: info.label, startPoints: data.config.startPoints,
    mode: state.mode, legs: route.buildLegs(info.origin, stops, 'transit'),
    full: route.fullRoute(info.origin, stops, state.mode), total: route.totalKm(info.point, stops),
    waUrl: share.whatsappUrl(t('plan.shareText'), share.buildUrl(state.stops, state.start))
  });
  const badge = $('#plan-badge');
  if (badge) badge.textContent = stops.length || '';
  if ($('#map')) map.drawRoute((info.point ? [info.point, ...stops] : stops).filter(valid));
}

function renderDiscovery() {
  const list = $('#map-discovery-list');
  if (!list) return;
  const state = store.get();
  const region = new URLSearchParams(location.search).get('region') || state.mapRegion;
  const query = new URLSearchParams(location.search);
  const stationId = query.get('station') || query.get('id') || state.mapMetro;
  const station = stationById(stationId);
  const stations = getMetroStationsByRegion(region, data.metro.stations);
  const nearby = station ? getPandalsNearMetro(station, data.pandals, data.config.map?.metroPandalRadiusKm || 2) : [];
  list.innerHTML = ui.mapDiscoveryHtml({
    region, station, stations, nearby, lines: data.metro.lines, favs: new Set(state.favs)
  });
  if ($('#map')) map.filterMetro(region ? stations : data.metro.stations);
}

function renderPage() {
  const state = store.get();
  applyTheme();
  applyI18n();
  renderHeader();
  renderFooter();
  renderDesktopNav();
  renderMobileNav();
  const featured = $('#featured-list');
  if (featured) featured.innerHTML = data.pandals.filter((p) => p.featured).slice(0, 5)
    .map((p) => ui.featuredHtml(p, data.metro.lines)).join('');
  if (page === 'explore') renderCards();
  if (page === 'planner') renderPlan();
  if (page === 'guide') {
    const guide = $('#guide');
    if (guide) guide.innerHTML = ui.guideHtml({ config: data.config, status: timeline.status(data.config), lang: state.lang });
  }
  if (page === 'favourites') {
    const saved = $('#wishlist-view');
    if (saved) saved.innerHTML = ui.wishlistHtml(data.pandals.filter((p) => state.favs.includes(p.id)), data.metro.lines);
  }
  if (page === 'pandal') {
    const query = new URLSearchParams(location.search);
    const id = query.get('id') || query.get('slug');
    const detail = $('#detail-view');
    const pandal = byId(id);
    if (detail) detail.innerHTML = pandal ? ui.detailViewHtml(pandal, data.metro.lines, state.favs.includes(pandal.id)) :
      ui.notFoundHtml('Pandal', 'explore.html');
    if (pandal && $('#map')) {
      map.sync(data.pandals, new Set([pandal.id]), new Map(), new Set(state.favs),
        (p) => ui.popupHtml(p, { inPlan: state.stops.includes(p.id), lines: data.metro.lines }));
      if (valid(pandal)) map.focus(pandal.id);
    }
  }
  if (page === 'metro-station') {
    const query = new URLSearchParams(location.search);
    const station = stationById(query.get('id') || query.get('slug') || query.get('name'));
    const detail = $('#station-detail-view');
    if (detail) detail.innerHTML = station
      ? ui.metroStationDetailHtml(station, getPandalsNearMetro(
        station, data.pandals, data.config.map?.metroPandalRadiusKm || 2
      ), data.metro.lines)
      : ui.notFoundHtml('Metro station', 'metro.html');
  }
  if (page === 'map' || page === 'metro') renderDiscovery();
  const badge = $('#plan-badge');
  if (badge) badge.textContent = state.stops.length || '';
  if (page === 'home') {
    const regions = $('#home-regions');
    if (regions) regions.innerHTML = ['north', 'south', 'central'].map((region) =>
      `<a class="route-chip ${region}" href="${pageUrl('explore', { region })}">${t(`route.${region}`)}</a>`).join('');
  }
  if ($('#map') && page === 'map') {
    const list = visible(state);
    const order = new Map(state.stops.map((id, i) => [id, i + 1]));
    map.sync(data.pandals, new Set(list.map((p) => p.id)), order, new Set(state.favs),
      (p) => ui.popupHtml(p, { inPlan: state.stops.includes(p.id), lines: data.metro.lines }));
    map.fit(data.pandals.filter(valid));
    const query = new URLSearchParams(location.search);
    const selectedPandal = byId(query.get('pandal'));
    if (selectedPandal && valid(selectedPandal)) map.focus(selectedPandal.id);
  }
}

function action(el) {
  const state = store.get();
  const id = el.dataset.id;
  if (el.dataset.action === 'add' && id && !state.stops.includes(id)) store.set({ stops: [...state.stops, id] });
  if (el.dataset.action === 'remove') store.set({ stops: state.stops.filter((item) => item !== id) });
  if (el.dataset.action === 'fav') store.set({ favs: state.favs.includes(id) ? state.favs.filter((item) => item !== id) : [...state.favs, id] });
  if (el.dataset.action === 'up' || el.dataset.action === 'down') {
    const index = state.stops.indexOf(id);
    const next = index + (el.dataset.action === 'up' ? -1 : 1);
    if (index >= 0 && next >= 0 && next < state.stops.length) {
      const stops = [...state.stops]; [stops[index], stops[next]] = [stops[next], stops[index]]; store.set({ stops });
    }
  }
  if (el.dataset.action === 'auto') {
    const info = startInfo(state);
    store.set({ stops: route.orderStops(info.point, state.stops.map(byId).filter(Boolean)).map((p) => p.id) });
  }
  if (el.dataset.action === 'clear') store.set({ stops: [] });
  if (el.dataset.action === 'lang') store.set({ lang: lang() === 'bn' ? 'en' : 'bn' });
  if (el.dataset.action === 'theme') store.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' });
  if (el.dataset.action === 'area') store.set({ area: el.dataset.value });
  if (el.dataset.action === 'type') store.set({ type: el.dataset.value });
  if (el.dataset.action === 'favs') store.set({ favOnly: !state.favOnly });
  if (el.dataset.action === 'details') {
    location.href = pageUrl('pandal', { id });
    return;
  }
  if (el.dataset.action === 'focus' && $('#map')) map.focus(id);
  if (el.dataset.action === 'map-station') {
    location.href = pageUrl('metro-station', { id });
    return;
  }
  if (el.dataset.action === 'view-map') {
    const pandal = byId(id);
    if (!pandal) return;
    if (!valid(pandal)) {
      toast('Map location is unavailable until this pandal is verified.');
      return;
    }
    location.href = pageUrl('map', { pandal: pandal.id });
    return;
  }
  if (el.dataset.action === 'locate' && navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => {
    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    store.set({ userLoc: loc }); map.setUser(loc, true);
    const nearest = nearestStation(loc, data.metro.stations);
    if (nearest) toast(t('loc.found', { s: nearest.station.name, km: `~${fmtKm(nearest.walkKm)}` }));
  }, () => toast(t('loc.denied')));
  if (el.dataset.action === 'close-details') history.back();
}

function wire() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (el) action(el);
  });
  document.addEventListener('change', (event) => {
    const el = event.target.closest('[data-change]');
    if (!el) return;
    store.set({ [el.dataset.change === 'start' ? 'start' : 'mode']: el.value });
  });
  const search = $('#search');
  if (search) search.addEventListener('input', (event) => store.set({ q: event.target.value }));
  const homeSearch = $('#home-search');
  if (homeSearch) homeSearch.addEventListener('input', (event) => {
    store.set({ q: event.target.value }); renderSuggestions(event.target.value);
  });
  store.subscribe(renderPage);
}

async function boot() {
  wire();
  data = await loadAll();
  attachNearestMetro(data.pandals, data.metro.stations, data.config.map?.nearbyMetroRadiusKm);
  areas = [...new Set(data.pandals.map((p) => p.area))];
  const query = new URLSearchParams(location.search);
  const region = query.get('region');
  if (region && ['north', 'south', 'central'].includes(region)) store.set({ area: region, mapRegion: region });
  if ($('#map')) map.init($('#map'), data.metro.stations, data.metro.lines, (s) => ui.mapStationPopupHtml(s, data.metro.lines));
  renderPage();
}

boot().catch((error) => {
  console.error(error);
  const notice = $('#notice');
  if (notice) { notice.hidden = false; notice.textContent = t('error.data'); }
});
