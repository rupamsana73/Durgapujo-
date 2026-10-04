// Pure template functions: data in, HTML string out. No DOM access, no state mutation.
import { t, lang } from './i18n.js';
import { placeUrl, dirUrl } from './route.js';
import { fmtKm } from './geo.js';
import { lineColor } from './metro.js';
import { PARTS, parseDate } from './timeline.js';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pName = (p) => (lang() === 'bn' && p.nameBn ? p.nameBn : p.name);
const spName = (sp) => (lang() === 'bn' && sp.nameBn ? sp.nameBn : sp.name);
const ext = 'target="_blank" rel="noopener noreferrer"';

function metroLine(p, lines) {
  if (!p.metro) return `<p class="info muted">📍 ${t('detail.unverifiedShort')}</p>`;
  const m = p.metro;
  const nearby = (p.nearbyMetro || []).slice(0, 3).map((x) =>
    `<li>${esc(x.station.name)} · ~${fmtKm(x.walkKm)} km</li>`).join('');
  return `<div class="metro-info"><p class="info"><span class="mdot" style="background:${lineColor(lines, m.station)}"></span>
    <span>${esc(t('card.walk', { station: m.station.name, km: '~' + fmtKm(m.walkKm), min: m.walkMin }))}</span></p>
    ${nearby ? `<details><summary>${t('card.nearby')}</summary><ul>${nearby}</ul></details>` : ''}</div>`;
}

function actions(p, inPlan) {
  const metroUrl = p.metro ? dirUrl({ dest: p.metro.station, mode: 'transit' }) : null;
  return `<div class="actions">
    <a class="btn btn-primary btn-small" href="${placeUrl(p)}" ${ext}>${t('btn.gmaps')}</a>
    ${p.locationVerified ? `<a class="btn btn-ghost btn-small" href="${dirUrl({ dest: p, mode: 'transit' })}" ${ext}>${t('btn.directions')}</a>` : ''}
    ${metroUrl ? `<a class="btn btn-ghost btn-small" href="${metroUrl}" ${ext}>${t('btn.metro')}</a>` : ''}
    <button class="btn btn-ghost btn-small" data-action="details" data-id="${p.id}">${t('btn.details')}</button>
    <button class="btn btn-ghost btn-small" data-action="${inPlan ? 'remove' : 'add'}" data-id="${p.id}">${t(inPlan ? 'btn.remove' : 'btn.add')}</button>
  </div>`;
}

export function chipsHtml(s, areas) {
  const chip = (action, value, label, pressed) =>
    `<button class="chip" data-action="${action}" data-value="${value}" aria-pressed="${pressed}">${esc(label)}</button>`;
  const row1 = [chip('area', 'all', t('filter.all'), s.area === 'all'),
    ...areas.map((a) => chip('area', a, t('area.' + a), s.area === a))].join('');
  const row2 = [chip('type', 'all', t('filter.all'), s.type === 'all'),
    chip('type', 'famous', t('type.famous'), s.type === 'famous'),
    chip('type', 'offbeat', t('type.offbeat'), s.type === 'offbeat'),
    chip('favs', 'toggle', '♥ ' + t('filter.favs'), s.favOnly)].join('');
  return `<div class="chips">${row1}</div><div class="chips">${row2}</div>`;
}

export function cardHtml(p, { planIndex, fav, distKm, lines }) {
  const inPlan = planIndex >= 0;
  return `<article class="card ${p.type}" data-id="${p.id}">
    <div class="card-head">
      <button class="card-title" data-action="focus" data-id="${p.id}">${esc(pName(p))}</button>
      <button class="icon-btn" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="${t(fav ? 'btn.unfav' : 'btn.fav')}">${fav ? '♥' : '♡'}</button>
    </div>
    <p class="tags">
      <span class="tag ${p.type === 'famous' ? 'famous' : ''}">${t('type.' + p.type)}</span>
      <span class="tag">${t('area.' + p.area)}</span>
      <span class="tag">${esc(p.areaGroup || p.region || '')}</span>
      <span class="tag">${t('theme.' + p.theme)}</span>
    </p>
    ${metroLine(p, lines)}
    ${p.bestTime ? `<p class="info muted">${t('card.best', { part: t('part.' + p.bestTime) })}</p>` : ''}
    ${distKm != null ? `<p class="info muted">${t('card.away', { km: fmtKm(distKm) })}</p>` : ''}
    ${actions(p, inPlan)}
  </article>`;
}

export function wishlistHtml(pandals, lines) {
  if (!pandals.length) return `<h2>♥ ${t('nav.saved')}</h2><p class="empty">♡ ${t('wishlist.empty')}</p><p class="hint">${t('wishlist.hint')}</p>`;
  return `<h2>♥ ${t('nav.saved')}</h2><div class="wishlist-list">${pandals.map((p) => `<article class="card wishlist-card">
    <div class="card-head"><div><h3>${esc(pName(p))}</h3><p class="tags">${esc(t('area.' + p.area))} · ${esc(p.areaGroup || p.region || '')}</p></div>
      <button class="icon-btn" data-action="fav" data-id="${p.id}" aria-label="${t('btn.unfav')}">♥</button></div>
    ${p.metro ? `<p class="info">🚇 ${esc(p.metro.station.name)} · ~${fmtKm(p.metro.estimatedWalkingDistanceKm)} km</p>` : `<p class="info muted">📍 ${t('map.pending')}</p>`}
    <div class="actions"><button class="btn btn-primary btn-small" data-action="details" data-id="${p.id}">${t('wishlist.view')}</button>
      <button class="btn btn-ghost btn-small" data-action="fav" data-id="${p.id}">${t('wishlist.remove')}</button></div>
  </article>`).join('')}</div>`;
}

export function featuredHtml(p, lines) {
  const metro = p.metro?.station?.name || '';
  return `<article class="featured-card">
    <h3>${esc(pName(p))}</h3>
    <p>${esc(t('area.' + p.area))}${metro ? ` · 🚇 ${esc(metro)}` : ''}</p>
    <div class="featured-actions">
      <button class="btn btn-primary btn-small" data-action="details" data-id="${p.id}">${t('btn.details')}</button>
      <a class="btn btn-ghost btn-small" href="${dirUrl({ dest: p, mode: 'transit' })}" ${ext}>${t('btn.directions')}</a>
    </div>
  </article>`;
}

export function popupHtml(p, { inPlan = false, lines } = {}) {
  const isVer = p.locationVerified && Number.isFinite(p.lat) && Number.isFinite(p.lng);
  return `<div class="pop pandal-pop">
    <strong>🛕 ${esc(pName(p))}</strong>
    ${p.nameBn && lang() !== 'bn' ? `<small class="pop-bn">${esc(p.nameBn)}</small>` : ''}
    <p class="info muted">${esc(t('area.' + p.area))} · ${esc(p.areaGroup || p.region || '')}</p>
    ${p.metro ? `<p class="info metro-stat"><span class="mdot" style="background:${lineColor(lines, p.metro.station)}"></span> 🚇 ${esc(p.metro.station.name)} (~${fmtKm(p.metro.walkKm)} km)</p>` : (isVer ? '' : '<p class="info muted">📍 Location pending</p>')}
    <div class="actions">
      <a class="btn btn-primary btn-small" href="pandal.html?id=${encodeURIComponent(p.id)}">${t('btn.details')}</a>
      <a class="btn btn-ghost btn-small" href="${dirUrl({ dest: p, mode: 'transit' })}" ${ext}>${t('btn.directions')}</a>
      <button class="btn btn-ghost btn-small" data-action="${inPlan ? 'remove' : 'add'}" data-id="${p.id}">${t(inPlan ? 'btn.remove' : 'btn.add')}</button>
    </div>
  </div>`;
}

export function metroPopupHtml(s, lines) {
  const names = s.lines.map((l) => (lang() === 'bn' ? lines[l]?.nameBn : lines[l]?.name) || l).join(', ');
  return `<div class="pop metro-pop">
    <strong>🚇 ${esc(s.name)}</strong>
    <p class="info muted">${esc(names)}</p>
    <div class="actions">
      <a class="btn btn-primary btn-small" href="metro-station.html?id=${encodeURIComponent(s.id)}">Station Details</a>
      <a class="btn btn-ghost btn-small" href="${dirUrl({ dest: s, mode: 'transit' })}" ${ext}>${t('btn.directions')}</a>
    </div>
  </div>`;
}

export function mapStationPopupHtml(s, lines, nearby = []) {
  const names = s.lines.map((l) => (lang() === 'bn' ? lines[l]?.nameBn : lines[l]?.name) || l).join(', ');
  const color = lineColor(lines, s);
  const nearbySlice = (nearby || []).slice(0, 3);
  const nearbyList = nearbySlice.length ? nearbySlice.map((item) =>
    `<li>🛕 ${esc(pName(item.pandal))} ${item.distanceKm != null ? `(~${fmtKm(item.distanceKm)} km)` : ''}</li>`
  ).join('') : '';

  return `<div class="pop metro-pop">
    <strong style="color:${color}">🚇 ${esc(s.name)}</strong>
    <p class="info muted">${esc(names)}</p>
    ${nearbyList ? `<div class="pop-nearby-pandals"><small class="pop-subhead">Nearby pandals:</small><ul class="pop-nearby-list">${nearbyList}</ul></div>` : ''}
    <div class="actions">
      <a class="btn btn-primary btn-small" href="metro-station.html?id=${encodeURIComponent(s.id)}">Station Details</a>
      <a class="btn btn-ghost btn-small" href="${dirUrl({ dest: s, mode: 'transit' })}" ${ext}>${t('btn.directions')}</a>
    </div>
  </div>`;
}

export function mapDiscoveryHtml({ region, station, stations, nearby = [], lines, favs = new Set() }) {
  const regKey = region || 'north';
  const regionTitles = {
    north: 'North Kolkata',
    south: 'South Kolkata',
    central: 'Central Kolkata'
  };
  const regionLabel = regionTitles[regKey] || regKey;

  if (station) {
    return `<div class="station-discovery-view">
      <div class="discovery-header">
        <button class="text-btn" data-action="map-back-region">← All ${esc(regionLabel)} stations</button>
        <h3>🚇 ${esc(station.name)}</h3>
        <p class="hint">${esc(station.lines.map((l) => lines[l]?.name || l).join(' / '))}</p>
        <div class="actions">
          <a class="btn btn-primary btn-small" href="metro-station.html?id=${encodeURIComponent(station.id)}">Station Full Page</a>
          <a class="btn btn-ghost btn-small" href="${dirUrl({ dest: station, mode: 'transit' })}" ${ext}>Directions</a>
        </div>
      </div>
      <div class="discovery-list">
        ${nearby.length ? nearby.map(({ pandal, distanceKm, estimatedWalkingTime }) => `
          <article class="discovery-card pandal-card">
            <div class="discovery-link">
              <strong>🛕 ${esc(pName(pandal))}</strong>
              <span>${esc(t('area.' + pandal.area))} · ${distanceKm != null ? `~${fmtKm(distanceKm)} km (${estimatedWalkingTime || ''})` : t('detail.unverifiedShort')}</span>
            </div>
            <div class="actions">
              <a class="btn btn-primary btn-small" href="pandal.html?id=${encodeURIComponent(pandal.id)}">${t('btn.details')}</a>
              <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: station, dest: pandal, mode: 'walking' })}" ${ext}>🚶 ${t('mode.walking')}</a>
              <button class="icon-btn" data-action="fav" data-id="${pandal.id}" aria-label="${t(favs.has(pandal.id) ? 'btn.unfav' : 'btn.fav')}" aria-pressed="${favs.has(pandal.id)}">${favs.has(pandal.id) ? '♥' : '♡'}</button>
            </div>
          </article>
        `).join('') : `<p class="empty">${t('map.noVerifiedPandals')}</p>`}
      </div>
    </div>`;
  }

  return `<div class="region-discovery-view">
    <div class="discovery-heading">
      <h3>${esc(regionLabel.toUpperCase())} (${stations.length})</h3>
      <p class="hint">Click any station to view its details and nearby Durga Puja pandals</p>
    </div>
    <div class="metro-stations-grid">
      ${stations.map((s) => {
        const color = lineColor(lines, s);
        return `<a class="station-card" href="metro-station.html?id=${encodeURIComponent(s.id)}">
          <span class="station-icon" style="background:${color}">🚇</span>
          <div class="station-card-info">
            <strong class="station-name">${esc(s.name)}</strong>
            <small class="station-lines">${esc(s.lines.map((l) => lines[l]?.name || l).join(' / '))}</small>
          </div>
          <span class="station-arrow">→</span>
        </a>`;
      }).join('')}
    </div>
  </div>`;
}

export function detailViewHtml(p, lines, fav = false, inPlan = false) {
  const metro = p.metro;
  const metroLines = metro ? metro.station.lines.map((line) =>
    (lang() === 'bn' ? lines[line]?.nameBn : lines[line]?.name) || line).join(' / ') : '';
  const isVer = p.locationVerified && Number.isFinite(p.lat) && Number.isFinite(p.lng);

  const nearby = (p.nearbyMetro || []).slice(0, 3).map((x) =>
    `<li class="nearby-metro-item">
      <div class="nearby-metro-main">
        <strong>🚇 ${esc(x.station.name)}</strong>
        <span class="meta">${x.estimatedWalkingDistanceKm != null ? `~${fmtKm(x.estimatedWalkingDistanceKm)} km · ${esc(x.estimatedWalkingTime)} ${t('detail.minutes')}` : ''}</span>
      </div>
      <div class="actions">
        <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: x.station, dest: p, mode: 'walking' })}" ${ext}>${t('btn.walkFrom')}</a>
        <a class="btn btn-ghost btn-small" href="metro-station.html?id=${encodeURIComponent(x.station.id)}">Station Details</a>
      </div>
    </li>`).join('');

  const directions = isVer ? `<section class="detail-section">
    <h3>${t('detail.directions')}</h3>
    <div class="actions">
      <a class="btn btn-ghost" href="${dirUrl({ dest: p, mode: 'walking' })}" ${ext}>🚶 ${t('mode.walking')}</a>
      <a class="btn btn-ghost" href="${dirUrl({ dest: p, mode: 'driving' })}" ${ext}>🚗 ${t('mode.driving')}</a>
      <a class="btn btn-ghost" href="${dirUrl({ dest: p, mode: 'transit' })}" ${ext}>🚇 ${t('mode.transit')}</a>
      <a class="btn btn-ghost" href="${dirUrl({ dest: p, mode: 'walking', navigate: true })}" ${ext}>🧭 ${t('btn.navigate')}</a>
    </div>
  </section>` : `<section class="detail-section unverified">
    <h3>${t('detail.directions')}</h3>
    <p><strong>Location verification pending</strong></p>
    <p class="hint">Precise GPS coordinates are pending verification for this pandal. You can search directly on Google Maps:</p>
    <div class="actions">
      <a class="btn btn-primary" href="${placeUrl(p)}" ${ext}>Google Maps</a>
    </div>
  </section>`;

  return `<div class="detail-page pandal-detail-page">
    <div class="detail-nav-bar">
      <button class="text-btn back-btn" data-action="close-details">← ${t('btn.back')}</button>
    </div>

    <div class="detail-hero-card">
      <div class="detail-visual">
        <span class="detail-visual-icon">🛕</span>
        <span class="detail-visual-motif">✨ শুভ শারদীয়া ✨</span>
      </div>

      <div class="detail-header-info">
        <p class="eyebrow">${esc(t('area.' + p.area))} · ${esc(p.region?.toUpperCase() || '')}</p>
        <h2>${esc(p.name)}</h2>
        ${p.nameBn ? `<h3 class="detail-bengali-title">${esc(p.nameBn)}</h3>` : ''}

        <p class="detail-region">
          <span class="tag ${p.type === 'famous' ? 'famous' : ''}">${t('type.' + (p.type || 'traditional'))}</span>
          <span class="tag">${t('area.' + p.area)}</span>
          <span class="tag">${esc(p.areaGroup || p.region || '')}</span>
          ${p.theme ? `<span class="tag">${t('theme.' + p.theme)}</span>` : ''}
        </p>

        <div class="location-status-badge ${isVer ? 'status-verified' : 'status-pending'}">
          ${isVer ? '✓ Verified Location' : '⚠️ Location verification pending'}
        </div>
      </div>

      <div class="detail-primary-actions">
        <button class="btn ${inPlan ? 'btn-secondary in-plan' : 'btn-primary'}" data-action="${inPlan ? 'remove' : 'add'}" data-id="${p.id}">
          ${inPlan ? '✓ ' + (t('btn.remove') || 'Remove from Plan') : '+ ' + (t('btn.add') || 'Add to Plan')}
        </button>
        <button class="btn btn-ghost" data-action="fav" data-id="${p.id}" aria-pressed="${fav}">
          ${fav ? '♥ ' + t('btn.unfav') : '♡ ' + t('btn.fav')}
        </button>
        <button class="btn btn-ghost" data-action="view-map" data-id="${p.id}">
          🗺️ ${t('btn.viewMap')}
        </button>
        <a class="btn btn-ghost" href="${placeUrl(p)}" ${ext}>
          Google Maps
        </a>
      </div>
    </div>

    <section class="detail-section">
      <h3>📍 ${t('detail.location')}</h3>
      <p class="detail-address-text">${esc(p.address || (isVer ? `${p.googleMapsQuery || p.name} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})` : t('map.pending')))}</p>
      <div class="actions">
        <button class="btn btn-primary" data-action="view-map" data-id="${p.id}">${t('btn.viewMap')}</button>
        <a class="btn btn-ghost" href="${placeUrl(p)}" ${ext}>Google Maps</a>
      </div>
    </section>

    ${metro ? `<section class="detail-section metro-section">
      <h3>🚇 ${t('detail.metro')}</h3>
      <div class="metro-card-detail">
        <div class="metro-main">
          <h4>${esc(metro.station.name)}</h4>
          <p class="metro-lines-text">${esc(metroLines)}</p>
          <p class="metro-distance-stat">
            <strong>~${fmtKm(metro.estimatedWalkingDistanceKm)} km</strong>
            <span>·</span>
            <span>~${metro.estimatedWalkingTime} ${t('detail.minutes')} walk</span>
          </p>
        </div>
        <div class="actions">
          <a class="btn btn-primary btn-small" href="metro-station.html?id=${encodeURIComponent(metro.station.id)}">Station Details</a>
          <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: metro.station, dest: p, mode: 'walking' })}" ${ext}>${t('btn.walkFrom')}</a>
        </div>
      </div>
    </section>` : `<section class="detail-section unverified">
      <h3>🚇 ${t('detail.metro')}</h3>
      <strong>Location verification pending</strong>
      <p>${t('detail.verifyNote') || 'Metro distances and walking times are shown once coordinates are verified.'}</p>
    </section>`}

    ${nearby ? `<section class="detail-section">
      <h3>${t('detail.nearby')}</h3>
      <ul class="nearby-metro-list">${nearby}</ul>
    </section>` : ''}

    ${directions}

    <section class="detail-section">
      <h3>${t('detail.howToReach')}</h3>
      <p class="route-info-text">
        ${metro ? `🚇 ${esc(metro.station.name)} Metro Station → 🚶 ~${metro.estimatedWalkingTime} ${t('detail.minutes')} walk → 🛕 ${esc(pName(p))}` : (t('detail.verifyNote') || 'Search on Google Maps for current directions.')}
      </p>
    </section>
  </div>`;
}

export function metroStationDetailHtml(station, nearby = [], lines, favs = new Set(), inPlan = new Set()) {
  const lineNames = station.lines
    .map((line) => (lang() === 'bn' ? lines[line]?.nameBn : lines[line]?.name) || line)
    .join(' / ');
  const color = lineColor(lines, station);

  const pandalCards = nearby.map(({ pandal, distanceKm, walkKm: wKm, walkMin: wMin, estimatedWalkingTime }) => {
    const isVerified = distanceKm != null;
    const distText = isVerified ? `~${fmtKm(distanceKm)} km` : null;
    const walkText = isVerified ? (estimatedWalkingTime || (wMin != null ? `~${wMin} min walk` : '')) : null;
    const isFav = favs.has(pandal.id);
    const isInPlan = inPlan.has(pandal.id);

    return `<article class="card nearby-pandal-card ${pandal.type || ''}" data-id="${pandal.id}">
      <div class="card-head">
        <div>
          <h3 class="nearby-pandal-title"><span class="pandal-icon">🛕</span> ${esc(pName(pandal))}</h3>
          ${pandal.nameBn && lang() !== 'bn' ? `<small class="detail-bn">${esc(pandal.nameBn)}</small>` : ''}
          <p class="tags">
            <span class="tag">${esc(t('area.' + pandal.area))}</span>
            <span class="tag">${esc(pandal.areaGroup || pandal.region || '')}</span>
            <span class="tag ${pandal.type === 'famous' ? 'famous' : ''}">${t('type.' + (pandal.type || 'traditional'))}</span>
          </p>
        </div>
        <button class="icon-btn" data-action="fav" data-id="${pandal.id}" aria-label="${t(isFav ? 'btn.unfav' : 'btn.fav')}" aria-pressed="${isFav}">${isFav ? '♥' : '♡'}</button>
      </div>

      <div class="nearby-pandal-metrics">
        ${isVerified ? `
          <p class="walk-stat">
            <span class="stat-icon">🚶</span>
            <strong>${distText}</strong>
            <span class="stat-divider">·</span>
            <span>${walkText}</span>
          </p>
        ` : `
          <p class="status-pending-badge">📍 ${t('detail.unverifiedShort') || 'Location verification pending'}</p>
        `}
      </div>

      <div class="nearby-pandal-actions">
        <a class="btn btn-primary btn-small" href="pandal.html?id=${encodeURIComponent(pandal.id)}">${t('btn.details')}</a>
        ${isVerified ? `
          <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: station, dest: pandal, mode: 'walking' })}" ${ext}>🚶 ${t('mode.walking')}</a>
          <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: station, dest: pandal, mode: 'driving' })}" ${ext}>🚗 ${t('mode.driving')}</a>
          <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: station, dest: pandal, mode: 'transit' })}" ${ext}>🚇 ${t('mode.transit')}</a>
          <a class="btn btn-ghost btn-small" href="${dirUrl({ origin: station, dest: pandal, mode: 'transit' })}" ${ext}>${t('btn.directions')}</a>
        ` : `
          <a class="btn btn-ghost btn-small" href="${placeUrl(pandal)}" ${ext}>Google Maps</a>
        `}
        <button class="btn btn-ghost btn-small" data-action="${isInPlan ? 'remove' : 'add'}" data-id="${pandal.id}">${t(isInPlan ? 'btn.remove' : 'btn.add')}</button>
      </div>
    </article>`;
  }).join('');

  return `<div class="detail-page station-page">
    <div class="detail-nav-bar">
      <a class="text-btn back-btn" href="metro.html?region=${encodeURIComponent(stationRegionKey(station))}">← ${t('btn.back') || 'Back to Metro'}</a>
    </div>

    <div class="station-header-card">
      <div class="station-title-row">
        <span class="station-badge-icon" style="background:${color}">🚇</span>
        <div>
          <h2>${esc(station.name.toUpperCase())}</h2>
          <p class="detail-region">
            <span class="metro-line-pill" style="border-color:${color};color:${color}">${esc(lineNames)}</span>
            <span class="region-pill">${esc(stationRegionLabel(station))}</span>
          </p>
        </div>
      </div>

      <div class="station-meta-grid">
        <div class="meta-item">
          <small>Metro Line</small>
          <strong>${esc(lineNames)}</strong>
        </div>
        <div class="meta-item">
          <small>Station Location</small>
          <strong>${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}</strong>
        </div>
      </div>

      <div class="station-actions-row">
        <a class="btn btn-primary" href="${placeUrl(station)}" ${ext}>Google Maps</a>
        <a class="btn btn-ghost" href="${dirUrl({ dest: station, mode: 'transit' })}" ${ext}>Directions</a>
        <a class="btn btn-ghost" href="map.html?station=${encodeURIComponent(station.id)}">View on Map</a>
      </div>
    </div>

    <section class="nearby-pandals-section">
      <div class="section-title-row">
        <h3>Nearby Pandals (${nearby.length})</h3>
        <span class="section-hint">Sorted by walking distance</span>
      </div>
      ${nearby.length ? `<div class="nearby-pandals-list">${pandalCards}</div>` : `<p class="empty">${t('map.noVerifiedPandals')}</p>`}
    </section>
  </div>`;
}

export function notFoundHtml(kind, backPage) {
  const isMetro = kind.toLowerCase().includes('metro');
  const label = isMetro ? '← Back to Metro' : '← Back to Explore';
  return `<section class="empty-state panel pad">
    <h2>${esc(kind)} not found</h2>
    <p>The requested ${esc(kind.toLowerCase())} could not be found.</p>
    <div class="actions">
      <a class="btn btn-primary" href="${esc(backPage)}">${label}</a>
    </div>
  </section>`;
}

export function stationRegionKey(station) {
  if (station.region) return station.region;
  if (station.lat >= 22.59) return 'north';
  if (station.lat <= 22.55) return 'south';
  return 'central';
}

export function stationRegionLabel(station) {
  const reg = stationRegionKey(station);
  if (reg === 'north') return 'North Kolkata';
  if (reg === 'south') return 'South Kolkata';
  return 'Central Kolkata';
}

export function planHtml(v) {
  const startOpts = [`<option value="me"${v.start === 'me' ? ' selected' : ''}>${t('plan.me')}</option>`,
    ...v.startPoints.map((sp) => `<option value="${sp.id}"${v.start === sp.id ? ' selected' : ''}>${esc(spName(sp))}</option>`)].join('');
  const modeOpts = ['walking', 'driving', 'bicycling']
    .map((m) => `<option value="${m}"${v.mode === m ? ' selected' : ''}>${t('mode.' + m)}</option>`).join('');

  const items = v.stops.map((p, i) => {
    const leg = v.legs[i];
    const from = i === 0 ? v.startLabel : pName(v.stops[i - 1]);
    return `<li class="stop">
      <span class="num">${i + 1}</span>
      <div class="stop-body"><strong>${esc(pName(p))}</strong>
        <a class="leg" href="${leg.url}" ${ext}>${esc(from)} → ${esc(pName(p))}</a></div>
      <div class="stop-ctl">
        <button class="icon-btn" data-action="up" data-id="${p.id}" aria-label="${t('btn.up')}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="icon-btn" data-action="down" data-id="${p.id}" aria-label="${t('btn.down')}" ${i === v.stops.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="icon-btn" data-action="remove" data-id="${p.id}" aria-label="${t('btn.remove')}">✕</button>
      </div></li>`;
  }).join('');

  const body = v.stops.length
    ? `<ol class="stops">${items}</ol>
      <div class="summary">
        <p>${t('plan.total', { km: fmtKm(v.total) })}</p>
        <p class="hint">${t('plan.legs')}</p>
        <div class="row">
          <button class="btn btn-ghost btn-small" data-action="auto">${t('plan.auto')}</button>
          <button class="btn btn-ghost btn-small" data-action="clear">${t('plan.clear')}</button>
        </div>
      </div>
      <div class="field"><label for="sel-mode">${t('plan.mode')}</label>
        <select id="sel-mode" data-change="mode">${modeOpts}</select></div>
      <div class="pad row">
        <a class="btn btn-primary" href="${v.full.url}" ${ext}>${t('plan.full')}</a>
        <button class="btn btn-ghost" data-action="copy">${t('plan.copy')}</button>
        <a class="btn btn-ghost" href="${v.waUrl}" ${ext}>${t('plan.whatsapp')}</a>
      </div>
      <p class="pad hint">${t('plan.fullNote')}</p>
      ${v.full.truncated ? `<p class="pad warn">${t('plan.truncated')}</p>` : ''}`
    : `<p class="empty">${t('plan.empty')}</p>`;

  return `<div class="field"><label for="sel-start">${t('plan.start')}</label>
    <select id="sel-start" data-change="start">${startOpts}</select></div>${body}`;
}

export function guideHtml({ config, status, lang: lg }) {
  const fmt = new Intl.DateTimeFormat(lg === 'bn' ? 'bn-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const days = config.days.map((d) => {
    const today = status.state === 'during' && status.day === d.key;
    const parts = PARTS.map((p) => {
      const lvl = config.crowd[d.key]?.[p];
      return lvl ? `<span class="part lvl-${lvl}"><span>${t('part.' + p)}</span><strong>${t('crowd.' + lvl)}</strong></span>` : '';
    }).join('');
    return `<section class="day${today ? ' today' : ''}">
      <h3>${t('day.' + d.key)}</h3>
      <p class="date">${fmt.format(parseDate(d.date))}</p>
      <div class="parts">${parts}</div></section>`;
  }).join('');
  return `<h2 class="pad" style="font-size:1.25rem;margin-bottom:10px">${t('guide.title')}</h2>${days}
    <p class="pad hint">${t('guide.crowdNote')}</p>
    <p class="pad hint">${t('guide.datesNote')}</p>
    <p class="pad hint">${t('guide.metroNote')} <a href="${esc(config.metroInfoUrl)}" ${ext}>${t('guide.metroLink')}</a></p>
    <section class="culture pad"><h2>${t('culture.title')}</h2><div class="culture-grid">
      ${['dhak','shankha','dhunuchi','anjali','bhog','art'].map((x) => `<span><b>${t('culture.' + x + '.icon')}</b>${t('culture.' + x)}</span>`).join('')}
    </div></section>
    <section class="gallery pad"><h2>${t('gallery.title')}</h2><p class="hint">${t('gallery.fallback')}</p></section>`;
}
