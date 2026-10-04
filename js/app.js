import * as store from './state.js';
import { t, applyI18n, lang } from './i18n.js';
import { loadAll, findPandal, findStation, getHomeFeatured } from './data.js';
import { attachNearestMetro, getMetroStationsByRegion, getPandalsNearMetro, nearestStation, lineColor } from './metro.js';
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

const byId = (id) => findPandal(data?.pandals || [], id);
const stationById = (id) => findStation(data?.metro?.stations || [], id);
const valid = (p) => p && p.locationVerified && Number.isFinite(p.lat) && Number.isFinite(p.lng);

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2800);
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
  footer.innerHTML = '<div class="footer-content"><strong>Pujo Planner</strong><span>Kolkata Durga Puja 2026</span></div>';
  document.body.append(footer);
}

function renderMobileNav() {
  let nav = document.querySelector('.mobile-nav');
  if (!nav) {
    nav = document.createElement('nav');
    document.body.appendChild(nav);
  }
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
  const activePage = (page === 'pandal' ? 'explore' : page === 'metro-station' ? 'map' : page === 'metro' ? 'map' : page);
  nav.innerHTML = items.map(([key, href, icon, label]) => {
    const active = key === activePage;
    return `<a class="mobile-nav-item${active ? ' active' : ''}" href="${root}${href}"${active ? ' aria-current="page"' : ''}>
      <span aria-hidden="true">${icon}</span><small>${label}</small></a>`;
  }).join('');
}

function renderDesktopNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  const labels = [
    ['explore', 'Explore'],
    ['map', 'Map'],
    ['metro', 'Metro'],
    ['planner', 'Planner'],
    ['favourites', 'Favourites'],
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
  if (!q) {
    node.innerHTML = '';
    node.hidden = true;
    return;
  }

  // Category / Region matches
  const categories = [
    { key: 'north', nameEn: 'North Kolkata', nameBn: 'উত্তর কলকাতা', icon: '🟠' },
    { key: 'south', nameEn: 'South Kolkata', nameBn: 'দক্ষিণ কলকাতা', icon: '🔵' },
    { key: 'central', nameEn: 'Central Kolkata', nameBn: 'মধ্য কলকাতা', icon: '🟢' }
  ].filter((c) =>
    c.key.includes(q) ||
    c.nameEn.toLowerCase().includes(q) ||
    c.nameBn.includes(q) ||
    (q.startsWith('dak') && c.key === 'south') ||
    (q.startsWith('utt') && c.key === 'north') ||
    (q.startsWith('mad') && c.key === 'central')
  );

  const catResults = categories.map((c) => `<a class="search-result category-result" href="${pageUrl('metro', { region: c.key })}">
    <span class="search-result-icon" aria-hidden="true">${c.icon}</span>
    <span class="search-result-content">
      <strong class="search-result-title">${ui.esc(lang() === 'bn' ? c.nameBn : c.nameEn)}</strong>
      <small class="search-result-meta">Zone · Metro & Pandals</small>
    </span>
  </a>`);

  const stations = data.metro.stations.filter((s) =>
    s.name.toLowerCase().includes(q) || (s.region && s.region.toLowerCase().includes(q))
  ).slice(0, 3);

  const stationResults = stations.map((s) => `<a class="search-result metro-result" href="${pageUrl('metro-station', { id: s.id })}">
    <span class="search-result-icon" aria-hidden="true">🚇</span>
    <span class="search-result-content">
      <strong class="search-result-title">${ui.esc(s.name)}</strong>
      <small class="search-result-meta">Metro station · ${ui.esc(s.name)}</small>
    </span>
  </a>`);

  const pandals = data.pandals.filter((p) =>
    [p.name, p.nameBn, p.area, p.areaGroup, p.region, p.googleMapsQuery]
      .filter(Boolean).some((value) => value.toLowerCase().includes(q)) ||
    (p.metro?.station?.name || '').toLowerCase().includes(q)).slice(0, 5);

  const pandalResults = pandals.map((p) => {
    const regionName = p.region
      ? (p.region.charAt(0).toUpperCase() + p.region.slice(1) + ' Kolkata')
      : (p.areaGroup || p.area || 'Kolkata');
    return `<a class="search-result pandal-result" href="${pageUrl('pandal', { id: p.id })}">
      <span class="search-result-icon" aria-hidden="true">🛕</span>
      <span class="search-result-content">
        <strong class="search-result-title">${ui.esc(p.name)}</strong>
        <small class="search-result-meta">Pandal · ${ui.esc(regionName)}</small>
      </span>
    </a>`;
  });

  const allItems = [...catResults, ...stationResults, ...pandalResults];

  node.innerHTML = allItems.length
    ? `<div class="search-results-heading">Search suggestions</div>${allItems.join('')}`
    : `<div class="search-results-empty"><small>No results found for "${ui.esc(query)}"</small></div>`;
  node.hidden = false;
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
  const query = new URLSearchParams(location.search);
  const region = query.get('region') || state.mapRegion || 'north';
  const stationId = query.get('station') || query.get('id');
  const station = stationById(stationId);
  const stations = getMetroStationsByRegion(region, data.metro.stations);
  const nearby = station ? getPandalsNearMetro(station, data.pandals) : [];
  list.innerHTML = ui.mapDiscoveryHtml({
    region, station, stations, nearby, lines: data.metro.lines, favs: new Set(state.favs)
  });

  const regionChips = document.querySelectorAll('.map-regions a');
  regionChips.forEach((chip) => {
    const href = chip.getAttribute('href') || '';
    const isActive = href.includes(`region=${region}`);
    chip.classList.toggle('active', isActive);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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
  if (featured) {
    const famous5 = getHomeFeatured(data.pandals);
    featured.innerHTML = famous5.map((p) => ui.featuredHtml(p, data.metro.lines)).join('');
  }

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
    const id = query.get('id') || query.get('slug') || query.get('pandal');
    const detail = $('#detail-view');
    const pandal = byId(id);
    const inPlan = pandal ? state.stops.includes(pandal.id) : false;
    const isFav = pandal ? state.favs.includes(pandal.id) : false;
    if (detail) {
      detail.innerHTML = pandal ? ui.detailViewHtml(pandal, data.metro.lines, isFav, inPlan) :
        ui.notFoundHtml('Pandal', 'explore.html');
    }
    if (pandal && $('#map')) {
      map.sync(data.pandals, new Set([pandal.id]), new Map(), new Set(state.favs),
        (p) => ui.popupHtml(p, { inPlan: state.stops.includes(p.id), lines: data.metro.lines }));
      if (valid(pandal)) map.focus(pandal.id);
    }
  }
  if (page === 'metro-station') {
    const query = new URLSearchParams(location.search);
    const id = query.get('id') || query.get('slug') || query.get('name') || query.get('station');
    const station = stationById(id);
    const detail = $('#station-detail-view');
    if (detail) {
      if (station) {
        const nearby = getPandalsNearMetro(station, data.pandals);
        detail.innerHTML = ui.metroStationDetailHtml(station, nearby, data.metro.lines, new Set(state.favs), new Set(state.stops));
      } else {
        detail.innerHTML = ui.notFoundHtml('Metro station', 'metro.html');
      }
    }
  }
  if (page === 'map' || page === 'metro') renderDiscovery();
  const badge = $('#plan-badge');
  if (badge) badge.textContent = state.stops.length || '';

  if (page === 'home') {
    const regions = $('#home-regions');
    if (regions) {
      regions.innerHTML = [
        { key: 'north', icon: '🟠', nameBn: 'উত্তর কলকাতা', nameEn: 'North Kolkata' },
        { key: 'south', icon: '🔵', nameBn: 'দক্ষিণ কলকাতা', nameEn: 'South Kolkata' },
        { key: 'central', icon: '🟢', nameBn: 'মধ্য কলকাতা', nameEn: 'Central Kolkata' }
      ].map((r) => {
        const label = lang() === 'bn' ? r.nameBn : r.nameEn;
        return `<a class="route-chip category-link ${r.key}" href="pages/metro.html?region=${r.key}">
          <span class="route-chip-icon">${r.icon}</span>
          <span class="route-chip-title">${ui.esc(label)}</span>
          <small class="route-chip-desc">Metro & Pandals →</small>
        </a>`;
      }).join('');
    }
  }

  if ($('#map') && page === 'map') {
    const list = visible(state);
    const order = new Map(state.stops.map((id, i) => [id, i + 1]));
    map.sync(data.pandals, new Set(list.map((p) => p.id)), order, new Set(state.favs),
      (p) => ui.popupHtml(p, { inPlan: state.stops.includes(p.id), lines: data.metro.lines }));
    map.fit(data.pandals.filter(valid));

    const query = new URLSearchParams(location.search);
    const pandalParam = query.get('pandal');
    if (pandalParam) {
      const selectedPandal = byId(pandalParam);
      if (selectedPandal) {
        if (valid(selectedPandal)) {
          map.focus(selectedPandal.id);
        } else {
          toast(`📍 ${ui.pName(selectedPandal)}: Location verification pending. Showing Kolkata Durga Puja map.`);
        }
      }
    }
    const stationParam = query.get('station');
    if (stationParam) {
      const selectedStation = stationById(stationParam);
      if (selectedStation) {
        map.focusMetro(selectedStation);
      }
    }
  }
}

function action(el) {
  const state = store.get();
  const id = el.dataset.id;
  if (el.dataset.action === 'add' && id) {
    if (!state.stops.includes(id)) {
      store.set({ stops: [...state.stops, id] });
      toast('Added to your Puja plan ✓');
    }
  }
  if (el.dataset.action === 'remove' && id) {
    store.set({ stops: state.stops.filter((item) => item !== id) });
    toast('Removed from your Puja plan');
  }
  if (el.dataset.action === 'fav' && id) {
    const isFav = state.favs.includes(id);
    store.set({ favs: isFav ? state.favs.filter((item) => item !== id) : [...state.favs, id] });
    toast(isFav ? 'Removed from favourites' : 'Saved to favourites ♥');
  }
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
  if (el.dataset.action === 'clear') {
    store.set({ stops: [] });
    toast('Puja plan cleared');
  }
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
  if (el.dataset.action === 'map-back-region') {
    const query = new URLSearchParams(location.search);
    const reg = query.get('region') || state.mapRegion || 'north';
    location.href = pageUrl('metro', { region: reg });
    return;
  }
  if (el.dataset.action === 'view-map') {
    const pandal = byId(id);
    if (!pandal) return;
    location.href = pageUrl('map', { pandal: pandal.id });
    return;
  }
  if (el.dataset.action === 'locate' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      store.set({ userLoc: loc });
      map.setUser(loc, true);
      const nearest = nearestStation(loc, data.metro.stations);
      if (nearest) toast(t('loc.found', { s: nearest.station.name, km: `~${fmtKm(nearest.walkKm)}` }));
    }, () => {
      toast('Location access was not granted. You can still browse all pandals and metro stations on the map.');
    });
  }
  if (el.dataset.action === 'close-details') {
    if (window.history.length > 1) {
      history.back();
    } else {
      location.href = page === 'metro-station' ? 'metro.html' : 'explore.html';
    }
  }
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
    store.set({ q: event.target.value });
    renderSuggestions(event.target.value);
  });
  // Close suggestions when clicking outside
  document.addEventListener('click', (event) => {
    const suggestions = $('#suggestions');
    if (suggestions && !suggestions.hidden && !event.target.closest('.search-wrap')) {
      suggestions.hidden = true;
    }
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
  if ($('#map')) {
    map.init($('#map'), data.metro.stations, data.metro.lines, (s) =>
      ui.mapStationPopupHtml(s, data.metro.lines, getPandalsNearMetro(s, data.pandals, 2))
    );
  }
  renderPage();
}

boot().catch((error) => {
  console.error(error);
  const notice = $('#notice');
  if (notice) { notice.hidden = false; notice.textContent = t('error.data'); }
});

