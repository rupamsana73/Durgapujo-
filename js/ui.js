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
      <span class="tag">${t('theme.' + p.theme)}</span>
    </p>
    ${metroLine(p, lines)}
    ${p.bestTime ? `<p class="info muted">${t('card.best', { part: t('part.' + p.bestTime) })}</p>` : ''}
    ${distKm != null ? `<p class="info muted">${t('card.away', { km: fmtKm(distKm) })}</p>` : ''}
    ${actions(p, inPlan)}
  </article>`;
}

export function featuredHtml(p, lines) {
  const metro = p.metro?.station?.name || '';
  return `<article class="featured-card">
    <h3>${esc(pName(p))}</h3>
    <p>${esc(t('area.' + p.area))}${metro ? ` · 🚇 ${esc(metro)}` : ''}</p>
    <div class="featured-actions">
      <button class="btn btn-primary btn-small" data-action="details" data-id="${p.id}">${t('btn.details')}</button>
      <a class="btn btn-ghost btn-small" href="${placeUrl(p)}" ${ext}>${t('btn.directions')}</a>
    </div>
  </article>`;
}

export function popupHtml(p, { inPlan, lines }) {
  return `<div class="pop">
    <strong>${esc(pName(p))}</strong>
    <p class="info muted">${t('area.' + p.area)}, ${t('theme.' + p.theme)}</p>
    ${metroLine(p, lines)}
    ${actions(p, inPlan)}
  </div>`;
}

export function detailsHtml(p, lines) {
  const metro = p.metro;
  const nearby = (p.nearbyMetro || []).slice(0, 3).map((x) =>
    `<li><strong>${esc(x.station.name)}</strong><span>${esc(x.station.lines.map((l) => lines[l]?.name || l).join(' / '))} · ~${fmtKm(x.estimatedWalkingDistanceKm)} km · ${esc(x.estimatedWalkingTime)} min</span>
      <a href="${dirUrl({ origin: x.station, dest: p, mode: 'walking' })}" ${ext}>${t('btn.walkFrom')}</a></li>`).join('');
  return `<div class="detail-dialog">
    <button class="icon-btn dialog-close" data-action="close-details" aria-label="${t('btn.close')}">✕</button>
    <p class="eyebrow">${t('area.' + p.area)}</p>
    <h2 id="details-title">${esc(pName(p))}</h2>
    ${p.nameBn ? `<p class="detail-bn">${esc(p.nameBn)}</p>` : ''}
    <section class="location-status"><strong>📍 ${t('detail.location')}</strong><span>${p.locationVerified ? `✓ ${t('detail.verified')}` : t('detail.unverified')}</span>
      <a href="${placeUrl(p)}" ${ext}>${t('btn.gmaps')}</a></section>
    <div class="detail-grid">
      <p><strong>${t('detail.theme')}</strong><br>${t('theme.' + p.theme)}</p>
      <p><strong>${t('detail.type')}</strong><br>${t('type.' + p.type)}</p>
      ${metro ? `<p><strong>${t('detail.metro')}</strong><br>${esc(metro.station.name)}<br><span class="hint">${esc(metro.station.lines.map((l) => lines[l]?.name || l).join(' / '))}</span></p>
      <p><strong>${t('detail.walk')}</strong><br>~${fmtKm(metro.estimatedWalkingDistanceKm)} km<br>${esc(metro.estimatedWalkingTime)} ${t('detail.minutes')}
        <br><a href="${dirUrl({ origin: p, dest: metro.station, mode: 'walking' })}" ${ext}>${t('btn.walkTo')}</a></p>` : ''}
    </div>
    ${!p.locationVerified ? `<section class="unverified"><strong>🚇 ${t('detail.metroUnavailable')}</strong><p>${t('detail.verifyNote')}</p></section>` : ''}
    ${nearby ? `<section class="nearby-detail"><h3>${t('detail.nearby')}</h3><ol>${nearby}</ol></section>` : ''}
    <p class="detail-fallback">${t('detail.imageFallback')}</p>
    <div class="actions">
      <a class="btn btn-primary" href="${placeUrl(p)}" ${ext}>${t('btn.gmaps')}</a>
      <button class="btn btn-ghost" data-action="add" data-id="${p.id}">${t('btn.add')}</button>
    </div>
  </div>`;
}

export function metroPopupHtml(s, lines) {
  const names = s.lines.map((l) => (lang() === 'bn' ? lines[l]?.nameBn : lines[l]?.name) || l).join(', ');
  return `<div class="pop"><strong>${esc(s.name)}</strong>
    <p class="info muted">${esc(names)}</p>
    <div class="actions"><a class="btn btn-primary btn-small" href="${placeUrl(s)}" ${ext}>${t('btn.gmaps')}</a></div></div>`;
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
