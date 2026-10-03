// Map layer. Only this file knows about Leaflet, so swapping to the Google Maps JS API later
// means rewriting this one module and keeping the rest of the app unchanged.
const L = window.L;

const KOLKATA = [22.5726, 88.3639];
let map, pandalLayer, metroLayer, routeLayer, userMarker;
const markers = new Map(); // pandal id -> Leaflet marker

export function init(el, metro, lineColors, metroPopup) {
  map = L.map(el, { zoomControl: true }).setView(KOLKATA, 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  routeLayer = L.layerGroup().addTo(map);
  metroLayer = L.layerGroup().addTo(map);
  pandalLayer = L.layerGroup().addTo(map);

  for (const s of metro) {
    const color = lineColors[s.lines[0]]?.color || '#555';
    const icon = L.divIcon({
      className: 'pin-wrap', iconSize: [18, 18], iconAnchor: [9, 9],
      html: `<span class="mpin" style="background:${color}">M</span>`
    });
    L.marker([s.lat, s.lng], { icon, title: s.name, zIndexOffset: -500 })
      .bindPopup(() => metroPopup(s), { maxWidth: 240 })
      .addTo(metroLayer);
  }
  L.control.layers(null, { Pandals: pandalLayer, Metro: metroLayer }, { collapsed: true }).addTo(map);
  window.addEventListener('resize', () => map.invalidateSize());
}

const pinIcon = (p, n, fav) =>
  L.divIcon({
    className: 'pin-wrap',
    iconSize: n ? [32, 32] : [26, 26],
    iconAnchor: n ? [16, 16] : [13, 13],
    html: `<span class="pin ${p.type}${n ? ' planned' : ''}${fav ? ' fav' : ''}">${n || ''}</span>`
  });

/**
 * Keep one marker per pandal and update in place, so an open popup is not destroyed
 * when someone taps "Add to plan".
 */
export function sync(allPandals, visibleIds, order, favs, popupHtml) {
  for (const p of allPandals) {
    if (!p.locationVerified || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    let m = markers.get(p.id);
    const n = order.get(p.id) || 0;
    const fav = favs.has(p.id);
    if (!m) {
      m = L.marker([p.lat, p.lng], { icon: pinIcon(p, n, fav), title: p.name, keyboard: true });
      m.bindPopup(() => popupHtml(p), { maxWidth: 280 });
      markers.set(p.id, m);
    } else {
      m.setIcon(pinIcon(p, n, fav));
      if (m.isPopupOpen()) m.getPopup().setContent(popupHtml(p));
    }
    const show = visibleIds.has(p.id);
    if (show && !pandalLayer.hasLayer(m)) m.addTo(pandalLayer);
    if (!show && pandalLayer.hasLayer(m)) pandalLayer.removeLayer(m);
  }
}

export function focus(id) {
  const m = markers.get(id);
  if (!m) return;
  map.setView(m.getLatLng(), Math.max(map.getZoom(), 15));
  m.openPopup();
}

export function fit(pandals) {
  const located = pandals.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!located.length) return;
  map.fitBounds(L.latLngBounds(located.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
}

export function drawRoute(points) {
  routeLayer.clearLayers();
  if (points.length > 1) {
    L.polyline(points.map((p) => [p.lat, p.lng]), { color: '#B0102A', weight: 4, dashArray: '8 8', opacity: 0.9 }).addTo(routeLayer);
  }
}

export function setUser(loc, recenter = false) {
  if (!loc) return;
  const ll = [loc.lat, loc.lng];
  if (!userMarker) {
    userMarker = L.marker(ll, {
      icon: L.divIcon({ className: 'pin-wrap', iconSize: [16, 16], iconAnchor: [8, 8], html: '<span class="me-dot"></span>' }),
      interactive: false, zIndexOffset: 1000
    }).addTo(map);
  } else {
    userMarker.setLatLng(ll);
  }
  if (recenter) map.setView(ll, Math.max(map.getZoom(), 14));
}
