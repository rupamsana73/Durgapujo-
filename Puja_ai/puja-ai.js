/**
 * Puja AI — Floating Assistant for Pujo Planner
 *
 * Architecture:
 *   puja-ai-data.js  -> static knowledge (guide + destinations + quick actions)
 *   puja-ai.js       -> UI, matching engine, local storage, delegated interaction system
 *   puja-ai.css      -> styling & animations (light & dark mode, mobile responsiveness)
 *   /api/chat        -> server-side OpenRouter proxy (Vercel serverless)
 *
 * Hybrid flow:
 *   1. Local-first intent detection (guide, destinations, pandals, metro, planner)
 *   2. If local answer or action exists -> render rich interactive card immediately
 *   3. Otherwise -> call secure /api/chat endpoint
 *   4. If API fails or offline -> friendly Bengali/English fallback
 */

import { PUJA_AI_DATA } from './puja-ai-data.js';

// -------------------------------------------------
//  Constants & Storage Keys
// -------------------------------------------------
const LS_CHAT_KEY     = 'pujo-planner:ai-chat:v1';
const LEGACY_CHAT_KEY = 'pujaAIChatHistory';
const LS_STATE_KEY    = 'pujo-planner:v1';
const LS_FAVS_KEY     = 'pujoPlanner.favourites';
const MAX_HISTORY     = 60;
const API_WINDOW      = 12;

// -------------------------------------------------
//  App data cache (loaded lazily)
// -------------------------------------------------
let _pandals = null;
let _stations = null;
let _cachedUserLoc = null;

function getPageUrl(pageName, queryParams = {}) {
  const isInsidePages = window.location.pathname.includes('/pages/');
  const base = isInsidePages ? `${pageName}.html` : `pages/${pageName}.html`;
  const entries = Object.entries(queryParams).filter(([_, v]) => v != null && v !== '');
  if (!entries.length) return base;
  const sp = new URLSearchParams(entries).toString();
  return `${base}?${sp}`;
}

async function loadAppData() {
  if (_pandals && _stations) return;
  try {
    const isInsidePages = window.location.pathname.includes('/pages/');
    const prefix = isInsidePages ? '../' : '';
    const [pRes, mRes] = await Promise.all([
      fetch(`${prefix}data/pandals.json`),
      fetch(`${prefix}data/metro.json`),
    ]);
    const pandals = pRes.ok ? await pRes.json() : [];
    const metro   = mRes.ok ? await mRes.json() : { stations: [] };
    _pandals  = Array.isArray(pandals) ? pandals : [];
    _stations = Array.isArray(metro.stations) ? metro.stations : [];
  } catch (err) {
    console.warn('[Puja AI] Error loading app data:', err);
    _pandals  = _pandals  || [];
    _stations = _stations || [];
  }
}

// -------------------------------------------------
//  Favourites helper (syncs with existing Pujo Planner)
// -------------------------------------------------
function isPandalSaved(pandalId) {
  if (!pandalId) return false;
  try {
    const strId = String(pandalId);
    const legacy = JSON.parse(localStorage.getItem(LS_FAVS_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.map(String).includes(strId)) return true;
    const main = JSON.parse(localStorage.getItem(LS_STATE_KEY) || '{}');
    return Array.isArray(main.favs) && main.favs.map(String).includes(strId);
  } catch {
    return false;
  }
}

function toggleSavePandal(pandalId) {
  if (!pandalId) return false;
  try {
    const strId = String(pandalId);
    let favs = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_FAVS_KEY) || '[]');
      if (Array.isArray(parsed)) favs = parsed.map(String);
    } catch { favs = []; }

    const idx = favs.indexOf(strId);
    let nowSaved = false;

    if (idx >= 0) {
      favs.splice(idx, 1);
      nowSaved = false;
    } else {
      favs.push(strId);
      nowSaved = true;
    }

    localStorage.setItem(LS_FAVS_KEY, JSON.stringify(favs));

    let mainState = {};
    try { mainState = JSON.parse(localStorage.getItem(LS_STATE_KEY) || '{}'); } catch {}
    mainState.favs = favs;
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(mainState));

    window.dispatchEvent(new CustomEvent('pujo:favs-changed', {
      detail: { favs, pandalId: strId, saved: nowSaved }
    }));

    return nowSaved;
  } catch {
    return false;
  }
}

// -------------------------------------------------
//  LocalStorage helpers
// -------------------------------------------------
function loadHistory() {
  try {
    let raw = localStorage.getItem(LS_CHAT_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_CHAT_KEY);
      if (raw) {
        localStorage.setItem(LS_CHAT_KEY, raw);
        localStorage.removeItem(LEGACY_CHAT_KEY);
      }
    }
    const items = JSON.parse(raw || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    const trimmed = history.slice(-MAX_HISTORY).map(item => ({
      role: item.role,
      content: item.content,
      timestamp: item.timestamp || Date.now()
    }));
    localStorage.setItem(LS_CHAT_KEY, JSON.stringify(trimmed));
  } catch {}
}

function clearHistory() {
  try {
    localStorage.removeItem(LS_CHAT_KEY);
    localStorage.removeItem(LEGACY_CHAT_KEY);
  } catch {}
}

// -------------------------------------------------
//  Haversine distance calculation (in km)
// -------------------------------------------------
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// -------------------------------------------------
//  Text & matching helpers
// -------------------------------------------------
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[.,!?।\-_/\\#@$%^&*()+=~`{}[\]:;"'<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeywords(query, keywords) {
  const q = normalize(query);
  return keywords.some(kw => {
    const k = normalize(kw);
    return k && q.includes(k);
  });
}

function matchGuide(query) {
  const sections = PUJA_AI_DATA.guide?.sections || PUJA_AI_DATA.guide || [];
  const arr = Array.isArray(sections) ? sections : Object.values(sections);
  for (const sec of arr) {
    const implicit = [sec.id, ...(sec.title || '').split(/\s+/), ...(sec.keywords || [])];
    if (matchesKeywords(query, implicit)) return sec;
  }
  return null;
}

// Puja tradition questions answered locally
function matchPujaTradition(query) {
  const q = normalize(query);
  const traditionMap = [
    { pattern: /মহালয়া|mahalaya/, id: 'mahalaya' },
    { pattern: /ষষ্ঠী|shasthi|shashthi|বোধন/, id: 'shasthi' },
    { pattern: /সপ্তমী|saptami|নবপত্রিকা|কলাবউ/, id: 'saptami' },
    { pattern: /অষ্টমী|ashtami|অঞ্জলি|কুমারী|সন্ধিপূজা|সন্ধি পূজা/, id: 'ashtami' },
    { pattern: /নবমী|navami/, id: 'navami' },
    { pattern: /সিঁদুর খেলা|sindoor khela|সিঁদুর/, id: 'sindoor-khela' },
    { pattern: /দশমী|dashami|বিসর্জন/, id: 'dashami' },
    { pattern: /বিজয়া|bijoya|কোলাকুলি|মিষ্টিমুখ/, id: 'bijoya' },
    { pattern: /প্যান্ডেল হপ|pandal hop|পরিক্রমা/, id: 'pandal-hopping' },
    { pattern: /ভিড়|crowd|ভিড়ের/, id: 'crowd' },
    { pattern: /নিরাপ|safety|safe|পুলিশ|police/, id: 'safety' },
    { pattern: /পরিবার|বাচ্চা|শিশু|family/, id: 'family-planning' },
    { pattern: /রাত|night|রাতের/, id: 'night-hopping' },
    { pattern: /google maps|গুগল ম্যাপ|directions|দিকনির্দেশ|ম্যাপ/, id: 'maps' },
    { pattern: /মেট্রো ব্যবহার|metro use|মেট্রোয়|metro দিয়ে/, id: 'metro' },
    { pattern: /প্ল্যান|plan|পরিকল্পনা|একদিন/, id: 'planning' },
  ];
  const sections = PUJA_AI_DATA.guide?.sections || [];
  for (const { pattern, id } of traditionMap) {
    if (pattern.test(q)) {
      const found = sections.find(s => s.id === id);
      if (found) return found;
    }
  }
  return null;
}

// -------------------------------------------------
//  Canonical Destination Resolver
// -------------------------------------------------
function resolveCanonicalDestination(query) {
  const q = normalize(query);
  const dests = PUJA_AI_DATA.destinations || [];

  // 1. Check curated destinations list
  for (const d of dests) {
    if (d.keywords && d.keywords.some(kw => q.includes(normalize(kw)))) {
      return { ...d };
    }
  }

  // 2. Check metro stations from metro.json
  if (_stations) {
    for (const s of _stations) {
      const sNorm = normalize(s.name);
      if (q.includes(sNorm)) {
        return {
          name: s.name,
          nameBn: s.nameBn || s.name,
          type: 'Metro Station',
          googleMapsQuery: `${s.name} Metro Station Kolkata`,
          lat: s.lat,
          lng: s.lng,
          nearestMetro: s.id,
          keyword: sNorm
        };
      }
    }
  }

  // 3. Check pandals dataset for distinctive name or area
  if (_pandals) {
    for (const p of _pandals) {
      const pNorm = normalize(p.name);
      const agNorm = normalize(p.areaGroup || '');
      if (pNorm.length > 5 && q.includes(pNorm)) {
        return {
          name: p.name,
          nameBn: p.nameBn || p.name,
          type: 'Durga Puja Pandal',
          googleMapsQuery: p.googleMapsQuery || `${p.name} Kolkata`,
          lat: p.lat,
          lng: p.lng,
          nearestMetro: p.metro?.station?.id || null,
          keyword: p.areaGroup || p.name
        };
      }
      if (agNorm.length > 3 && q.includes(agNorm)) {
        return {
          name: p.areaGroup,
          nameBn: p.areaGroup,
          type: 'Pandal Area',
          googleMapsQuery: `${p.areaGroup} Durga Puja Kolkata`,
          lat: p.lat,
          lng: p.lng,
          nearestMetro: p.metro?.station?.id || null,
          keyword: p.areaGroup
        };
      }
    }
  }

  return null;
}

// Find nearby pandals using geospatial distance and area matching
function findNearbyPandals(dest) {
  if (!_pandals || !_pandals.length) return [];
  const kw = normalize(dest.keyword || dest.name || '');

  // 1. Proximity matching when destination coordinates are available
  if (dest.lat && dest.lng && Number.isFinite(Number(dest.lat)) && Number.isFinite(Number(dest.lng))) {
    const withDist = _pandals
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(p => ({
        ...p,
        distanceKm: haversineKm(dest.lat, dest.lng, p.lat, p.lng)
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withDist.length && withDist[0].distanceKm < 4.5) {
      return withDist.filter(p => p.distanceKm <= 4.0).slice(0, 8);
    }
  }

  // 2. Keyword fallback (areaGroup, area, name, or googleMapsQuery)
  const matched = _pandals.filter(p => {
    const ag = normalize(p.areaGroup || '');
    const a  = normalize(p.area || '');
    const n  = normalize(p.name || '');
    const g  = normalize(p.googleMapsQuery || '');
    return (ag && (ag.includes(kw) || kw.includes(ag))) ||
           (a && (a.includes(kw) || kw.includes(a))) ||
           (n && (n.includes(kw) || kw.includes(n))) ||
           (g && g.includes(kw));
  });

  return matched;
}

function detectQuickIntent(query) {
  const q = normalize(query);
  if (/পুজোর গাইড|puja guide|guide দাও|গাইড দাও|full guide|দুর্গাপুজোর.*গাইড/.test(q)) return 'puja-guide';
  if (/প্যান্ডেল খুঁজ|find pandal|pandal list|প্যান্ডেল দেখ|প্যান্ডেল.*খুঁজে/.test(q)) return 'find-pandal';
  if (/মেট্রো খুঁজ|metro খুঁজ|find metro|metro route|কাছের মেট্রো|কাছাকাছি মেট্রো|মেট্রো.*সাহায্য/.test(q)) return 'find-metro';
  if (/কোথায় যাব|where to go|কোথায় যেত|জায়গায় যেতে|যেতে চাই/.test(q)) return 'go-somewhere';
  if (/পুজো প্ল্যান|puja plan|plan your puja|প্ল্যান দেখতে|প্ল্যান বানাও/.test(q)) return 'puja-plan';
  if (/জনপ্রিয় প্যান্ডেল|popular pandal|famous pandal|বিখ্যাত প্যান্ডেল|জনপ্রিয়/.test(q)) return 'popular-pandals';
  return null;
}

// -------------------------------------------------
//  Google Maps Navigation & Geolocation Handlers
// -------------------------------------------------
function appendBotNotice(msg) {
  const messagesEl = document.getElementById('puja-ai-messages');
  if (!messagesEl) return;
  const wrap = document.createElement('div');
  wrap.className = 'puja-ai-message bot';
  wrap.style.cssText = 'color:#b0102a;font-size:12.5px;line-height:1.5;background:#fff2f4;border:1px solid #ffd1d8;';
  wrap.textContent = msg;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function handleDirections(dest) {
  if (!dest || (!dest.name && !dest.query && !dest.lat)) {
    appendBotNotice('এই জায়গাটির তথ্য এখন পাওয়া যাচ্ছে না।\nI couldn\'t find reliable information for this destination.');
    return;
  }

  const queryStr = dest.query || (dest.name ? `${dest.name} Kolkata` : '');
  const destParam = (dest.lat && dest.lng && Number.isFinite(Number(dest.lat)) && Number.isFinite(Number(dest.lng)))
    ? `${dest.lat},${dest.lng}`
    : queryStr;

  const encodedDest = encodeURIComponent(destParam);
  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}&travelmode=transit&dir_action=navigate`;

  // Check cached location first
  let userLoc = _cachedUserLoc;
  if (!userLoc) {
    try {
      const stateObj = JSON.parse(localStorage.getItem(LS_STATE_KEY) || '{}');
      if (stateObj.userLoc && Number.isFinite(stateObj.userLoc.lat) && Number.isFinite(stateObj.userLoc.lng)) {
        userLoc = stateObj.userLoc;
        _cachedUserLoc = userLoc;
      }
    } catch {}
  }

  if (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng)) {
    const originParam = `${userLoc.lat},${userLoc.lng}`;
    const directUrl = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${encodedDest}&travelmode=transit&dir_action=navigate`;
    window.open(directUrl, '_blank', 'noopener');
    return;
  }

  // Pre-open blank tab synchronously on click to bypass browser popup blocker
  const mapWin = window.open('about:blank', '_blank');

  if (!navigator.geolocation) {
    if (mapWin) mapWin.location.href = fallbackUrl;
    else window.open(fallbackUrl, '_blank', 'noopener');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      _cachedUserLoc = { lat, lng };
      try {
        const stateObj = JSON.parse(localStorage.getItem(LS_STATE_KEY) || '{}');
        stateObj.userLoc = { lat, lng };
        localStorage.setItem(LS_STATE_KEY, JSON.stringify(stateObj));
      } catch {}

      const originParam = `${lat},${lng}`;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${encodedDest}&travelmode=transit&dir_action=navigate`;
      if (mapWin && !mapWin.closed) {
        mapWin.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener');
      }
    },
    () => {
      if (mapWin && !mapWin.closed) {
        mapWin.location.href = fallbackUrl;
      } else {
        window.open(fallbackUrl, '_blank', 'noopener');
      }
      appendBotNotice('আপনার বর্তমান location ব্যবহার করতে permission দিন। তারপর আবার Directions চাপুন।\n\nPlease allow location access to start directions from your current location.');
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
  );
}

function handleOpenPlaceMap({ name, query }) {
  const q = query || (name ? `${name} Kolkata` : '');
  if (!q) {
    appendBotNotice('এই জায়গাটির তথ্য এখন পাওয়া যাচ্ছে না।\nI couldn\'t find reliable information for this destination.');
    return;
  }
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  window.open(url, '_blank', 'noopener');
}

// -------------------------------------------------
//  DOM Node Builders (Controlled HTML with data-action)
// -------------------------------------------------
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildWelcomeNode() {
  const data = PUJA_AI_DATA.welcome;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div style="margin-bottom:8px;font-weight:700;font-size:14px;color:#b0102a;line-height:1.4;">
      ${escapeHtml(data.bn || '').replace(/\n/g, '<br>')}
    </div>
    <div style="font-size:12px;line-height:1.5;color:#555;">
      ${escapeHtml(data.en || '').replace(/\n/g, '<br>')}
    </div>`;
  return wrap;
}

function buildGuideAllNode() {
  const sections = PUJA_AI_DATA.guide?.sections || PUJA_AI_DATA.guide || [];
  const arr = Array.isArray(sections) ? sections : Object.values(sections);
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div style="font-weight:700;font-size:14px;color:#b0102a;margin-bottom:10px;">🪔 কলকাতা দুর্গাপুজো গাইড</div>`;
  arr.forEach(sec => {
    const card = document.createElement('div');
    card.className = 'puja-ai-guide-card';
    card.innerHTML = `<h4>${escapeHtml(sec.title || '')}</h4><p>${escapeHtml(sec.content || '').replace(/\n/g, '<br>')}</p>`;
    wrap.appendChild(card);
  });
  return wrap;
}

function buildDestNode(dests) {
  const wrap = document.createElement('div');
  dests.forEach(dest => {
    const card = document.createElement('div');
    card.className = 'puja-ai-action-card';

    const dName = escapeHtml(dest.name || dest.nameBn || '');
    const dNameBn = dest.nameBn && dest.nameBn !== dest.name ? `<small style="font-weight:normal;color:#666;">(${escapeHtml(dest.nameBn)})</small>` : '';
    const dType = escapeHtml(dest.type || 'Destination');
    const dQuery = escapeHtml(dest.googleMapsQuery || `${dest.name} Kolkata`);
    const dLat = dest.lat != null ? String(dest.lat) : '';
    const dLng = dest.lng != null ? String(dest.lng) : '';
    const dMetroId = escapeHtml(dest.nearestMetro || '');
    const dKw = escapeHtml(dest.keyword || dest.name || '');

    card.innerHTML = `
      <div style="font-size:14px;margin-bottom:2px;">📍 <strong>${dName}</strong> ${dNameBn}</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px;">${dType}</div>
      <div class="puja-ai-dest-actions">
        <button class="puja-ai-action-button" data-action="directions" data-dest-name="${dName}" data-query="${dQuery}" data-lat="${dLat}" data-lng="${dLng}" aria-label="${dName} যাওয়ার পথ">🚶 Directions</button>
        <button class="puja-ai-action-button" style="background:#555;" data-action="open-map" data-dest-name="${dName}" data-query="${dQuery}" aria-label="${dName} গুগল ম্যাপ">🗺️ Open in Maps</button>
        <button class="puja-ai-action-button" style="background:#20639b;" data-action="dest-metro" data-dest-name="${dName}" data-station-id="${dMetroId}" aria-label="${dName} মেট্রো">🚇 Metro</button>
        <button class="puja-ai-action-button" style="background:#8f0d22;" data-action="dest-nearby-pandals" data-dest-name="${dName}" data-keyword="${dKw}" data-lat="${dLat}" data-lng="${dLng}" aria-label="${dName} কাছের প্যান্ডেল">🎪 Nearby Pandals</button>
      </div>`;

    wrap.appendChild(card);
  });
  return wrap;
}

function buildPandalResultsNode(pandals, areaLabel = '') {
  if (!pandals || pandals.length === 0) return buildPandalListNode();
  const wrap = document.createElement('div');
  const count = Math.min(pandals.length, 5);
  const heading = areaLabel
    ? `🎪 ${escapeHtml(areaLabel)}-এর কাছের প্যান্ডেল (${count})`
    : `🎪 প্যান্ডেল তালিকা (${count})`;

  wrap.innerHTML = `<div style="font-weight:700;font-size:13px;color:#b0102a;margin-bottom:8px;">${heading}</div>`;

  pandals.slice(0, 5).forEach(p => {
    const card = document.createElement('div');
    card.className = 'puja-ai-action-card';

    const isFav = isPandalSaved(p.id);
    const verifiedBadge = p.locationVerified
      ? `<span style="font-size:10px;background:#e6f4ea;color:#137333;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:4px;">✓ Verified</span>`
      : '';
    const distText = p.distanceKm != null ? ` (~${p.distanceKm.toFixed(1)} km)` : '';

    card.innerHTML = `
      <div style="font-size:13px;margin-bottom:2px;display:flex;align-items:center;justify-content:space-between;">
        <span>🛕 <strong>${escapeHtml(p.name)}</strong></span>
        ${verifiedBadge}
      </div>
      <div style="font-size:11px;color:#888;margin-bottom:6px;">
        📍 এলাকা: ${escapeHtml(p.areaGroup || p.area || '')}${distText}
      </div>
      <div class="puja-ai-pandal-actions">
        <button class="puja-ai-action-button" data-action="view-pandal" data-pandal-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.name)} বিস্তারিত">View Details</button>
        <button class="puja-ai-action-button" style="background:#555;" data-action="pandal-map" data-pandal-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.name)} ম্যাপ">View Map</button>
        <button class="puja-ai-action-button" style="background:#20639b;" data-action="pandal-directions" data-pandal-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.name)} পথ">Directions</button>
        <button class="puja-ai-action-button ${isFav ? 'saved' : ''}" style="background:${isFav ? '#8f0d22' : '#eadadd'};color:${isFav ? '#fff' : '#333'};" data-action="save-pandal" data-pandal-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.name)} সংরক্ষণ">${isFav ? '♥ Saved' : '♡ Save'}</button>
      </div>`;

    wrap.appendChild(card);
  });

  if (pandals.length > 5) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'puja-ai-more-link';
    moreBtn.setAttribute('data-action', 'explore');
    moreBtn.textContent = `+ আরও ${pandals.length - 5}টি প্যান্ডেল দেখতে Explore পেজে যান`;
    wrap.appendChild(moreBtn);
  }

  return wrap;
}

function buildFeaturedPandalsNode() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div style="font-weight:700;font-size:13px;color:#b0102a;margin-bottom:8px;">⭐ জনপ্রিয় ও ঐতিহ্যবাহী প্যান্ডেল</div>`;
  const featured = (_pandals || []).filter(p => p.featured);
  if (featured.length > 0) {
    wrap.appendChild(buildPandalResultsNode(featured));
  } else {
    wrap.appendChild(buildPandalListNode());
  }
  return wrap;
}

function buildPandalListNode() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div style="font-size:13px;line-height:1.6;color:#333;">
    <strong style="color:#b0102a;">🎪 জনপ্রিয় প্যান্ডেল অঞ্চল:</strong><br><br>
    • <strong>উত্তর:</strong> বাগবাজার সর্বজনীন, কুমারটুলি পার্ক, আহিরীটোলা<br>
    • <strong>মধ্য:</strong> কলেজ স্কয়ার, সন্তোষ মিত্র স্কয়ার, মহম্মদ আলি পার্ক<br>
    • <strong>দক্ষিণ:</strong> দেশপ্রিয় পার্ক, একডালিয়া এভারগ্রীন, চেতলা অগ্রণী, সুরুচি সংঘ<br><br>
    <span style="color:#888;font-size:12px;">নির্দিষ্ট প্যান্ডেল বা এলাকার নাম লিখলে সরাসরি দিকনির্দেশ ও প্যান্ডেল তালিকা দেখতে পারবেন।</span>
  </div>`;
  return wrap;
}

function buildMetroResultNode(station) {
  const wrap = document.createElement('div');
  const card = document.createElement('div');
  card.className = 'puja-ai-action-card';

  const regionLabel = { north: 'উত্তর কলকাতা', south: 'দক্ষিণ কলকাতা', central: 'মধ্য কলকাতা' }[station.region] || '';
  const linesLabel = Array.isArray(station.lines)
    ? station.lines.map(l => l.toUpperCase() + ' Line').join(', ')
    : 'Blue Line';

  card.innerHTML = `
    <div style="font-size:14px;margin-bottom:2px;">🚇 <strong>${escapeHtml(station.name)}</strong></div>
    <div style="font-size:11px;color:#888;margin-bottom:8px;">${linesLabel} • ${regionLabel}</div>
    <div class="puja-ai-station-actions">
      <button class="puja-ai-action-button" data-action="view-station" data-station-id="${escapeHtml(station.id)}" aria-label="${escapeHtml(station.name)} বিস্তারিত">Station Details</button>
      <button class="puja-ai-action-button" style="background:#555;" data-action="station-map" data-station-id="${escapeHtml(station.id)}" aria-label="${escapeHtml(station.name)} ম্যাপ">View Map</button>
      <button class="puja-ai-action-button" style="background:#20639b;" data-action="station-directions" data-station-id="${escapeHtml(station.id)}" aria-label="${escapeHtml(station.name)} পথ">Directions</button>
    </div>`;

  wrap.appendChild(card);
  return wrap;
}

function buildMetroListNode() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div style="font-weight:700;font-size:13px;color:#b0102a;margin-bottom:8px;">🚇 কলকাতা মেট্রো স্টেশন (স্টেশনে ট্যাপ করে বিস্তারিত দেখুন)</div>`;

  if (_stations && _stations.length > 0) {
    const groups = { north: [], central: [], south: [] };
    _stations.forEach(s => { if (groups[s.region]) groups[s.region].push(s); });
    const labels = { north: 'উত্তর কলকাতা', central: 'মধ্য কলকাতা', south: 'দক্ষিণ কলকাতা' };

    for (const [region, sts] of Object.entries(groups)) {
      if (!sts.length) continue;
      const sec = document.createElement('div');
      sec.innerHTML = `<div style="font-size:11px;font-weight:700;color:#888;margin:6px 0 4px;">${labels[region]}</div>`;
      sts.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'puja-ai-metro-chip';
        btn.textContent = s.name;
        btn.setAttribute('data-action', 'select-station');
        btn.setAttribute('data-station-id', s.id);
        btn.setAttribute('aria-label', `${s.name} মেট্রো স্টেশন`);
        sec.appendChild(btn);
      });
      wrap.appendChild(sec);
    }
    return wrap;
  }

  // Static fallback if stations not loaded yet
  const fallbackStations = [
    { id: 'dakshineswar', name: 'Dakshineswar' },
    { id: 'dumdum', name: 'Dum Dum' },
    { id: 'shyambazar', name: 'Shyambazar' },
    { id: 'esplanade', name: 'Esplanade' },
    { id: 'howrah', name: 'Howrah' },
    { id: 'kalighat', name: 'Kalighat' },
    { id: 'sectorv', name: 'Sector V' },
  ];
  fallbackStations.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'puja-ai-metro-chip';
    btn.textContent = s.name;
    btn.setAttribute('data-action', 'select-station');
    btn.setAttribute('data-station-id', s.id);
    wrap.appendChild(btn);
  });
  return wrap;
}

function buildPlanActionNode() {
  const wrap = document.createElement('div');
  const card = document.createElement('div');
  card.className = 'puja-ai-action-card';

  card.innerHTML = `
    <div style="font-size:14px;margin-bottom:4px;">🗺️ <strong>পুজো প্ল্যানার (Puja Planner)</strong></div>
    <div style="font-size:12px;color:#555;line-height:1.5;margin-bottom:10px;">
      আপনার পছন্দের প্যান্ডেল ও মেট্রো রুট দিয়ে দিনভিত্তিক নিজস্ব পুজো প্ল্যান তৈরি করুন।
    </div>
    <div style="display:flex;gap:6px;">
      <button class="puja-ai-action-button" style="flex:1;" data-action="planner">📋 প্ল্যানার খুলুন</button>
      <button class="puja-ai-action-button" style="flex:1;background:#20639b;" data-action="full-map">🗺️ ফুল ম্যাপ</button>
    </div>`;

  wrap.appendChild(card);
  return wrap;
}

function buildWhereToGoNode() {
  const suggestions = PUJA_AI_DATA.suggestions || [
    'দমদম যেতে চাই', 'দেশপ্রিয় পার্ক যেতে চাই',
    'কালিঘাট যেতে চাই', 'বাগবাজার যেতে চাই', 'দক্ষিণেশ্বর যেতে চাই'
  ];
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div style="font-size:13px;font-weight:700;color:#b0102a;margin-bottom:8px;">📍 কোথায় যাবেন?</div>
    <div style="font-size:12px;color:#555;margin-bottom:8px;">গন্তব্যের পথ দেখতে নিচের যেকোনো একটি বেছে নিন:</div>`;

  suggestions.slice(0, 6).forEach(sug => {
    const btn = document.createElement('button');
    btn.className = 'puja-ai-suggestion-chip';
    btn.textContent = sug;
    btn.setAttribute('data-action', 'select-suggestion');
    btn.setAttribute('data-suggestion', sug);
    btn.setAttribute('aria-label', sug);
    wrap.appendChild(btn);
  });
  return wrap;
}

function buildAITextNode(text) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'font-size:13px;line-height:1.6;color:inherit;';

  let structured = null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { structured = JSON.parse(trimmed); } catch {}
  }

  if (structured && structured.message) {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = structured.message;
    wrap.appendChild(msgDiv);

    if (structured.destination?.name) {
      const destNode = buildDestNode([{
        name: structured.destination.name,
        type: structured.destination.type || 'Destination',
        googleMapsQuery: `${structured.destination.name} Kolkata`
      }]);
      wrap.appendChild(destNode);
    }
    return wrap;
  }

  const safe = escapeHtml(text);
  const html = safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[•\-]\s+(.+)$/gm, '<div style="padding-left:8px;margin:2px 0;">• $1</div>')
    .replace(/\n/g, '<br>');
  wrap.innerHTML = html;
  return wrap;
}

function buildTypingNode() {
  const wrap = document.createElement('div');
  wrap.className = 'puja-ai-typing';
  wrap.setAttribute('aria-label', 'ভাবছি… 🪔');
  wrap.innerHTML = `<span style="font-size:12px;color:#888;margin-right:6px;font-weight:500;">ভাবছি… 🪔</span><span></span><span></span><span></span>`;
  return wrap;
}

function buildFallbackNode(msg) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'font-size:13px;line-height:1.55;color:#b0102a;padding:4px 0;';
  wrap.textContent = msg || 'দুঃখিত, এই মুহূর্তে AI উত্তর দিতে পারছে না। আপনি চাইলে পুজোর গাইড বা প্যান্ডেল/মেট্রো সার্চ ব্যবহার করতে পারেন।';
  return wrap;
}

// -------------------------------------------------
//  OpenRouter API call via serverless /api/chat proxy
// -------------------------------------------------
async function callAI(messagesForAI) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messagesForAI }),
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Invalid server response'); }
  if (!data.ok) {
    if (response.status === 429) {
      throw new Error('AI সার্ভারে এই মুহূর্তে কিছুটা চাপ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।');
    }
    throw new Error(data.error || 'AI error');
  }
  return data.message;
}

// -------------------------------------------------
//  Append message bubble to DOM
// -------------------------------------------------
function appendMessage(messagesEl, role, contentNodeOrText) {
  const wrapper = document.createElement('div');
  wrapper.className = `puja-ai-message ${role === 'user' ? 'user' : 'bot'}`;
  if (typeof contentNodeOrText === 'string') {
    wrapper.textContent = contentNodeOrText;
  } else {
    wrapper.appendChild(contentNodeOrText);
  }
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrapper;
}

// -------------------------------------------------
//  Hybrid query processor (Local-First Priority)
// -------------------------------------------------
async function processQuery(rawQuery) {
  const q = normalize(rawQuery);
  await loadAppData();

  // 1. Full guide intent
  if (/পুজোর গাইড|puja guide|guide দাও|গাইড দাও|full guide|দুর্গাপুজোর.*গাইড|পুজোর নিয়ম/.test(q)) {
    return { node: buildGuideAllNode(), isLocal: true };
  }

  // 2. Puja plan intent
  if (/পুজো প্ল্যান|puja plan|plan your puja|প্ল্যান দেখতে|প্ল্যান বানাও|পরিকল্পনা করো|আমার পুজো প্ল্যান/.test(q)) {
    return { node: buildPlanActionNode(), isLocal: true };
  }

  // 3. Popular / Featured pandals intent
  if (/জনপ্রিয় প্যান্ডেল|popular pandal|famous pandal|বিখ্যাত প্যান্ডেল|জনপ্রিয়/.test(q)) {
    return { node: buildFeaturedPandalsNode(), isLocal: true };
  }

  // 4. Resolve destination if mentioned
  const dest = resolveCanonicalDestination(rawQuery);
  const hasMetroInQuery = /মেট্রো|metro/i.test(q);
  const hasPandalInQuery = /প্যান্ডেল|pandal|পুজো|puja/i.test(q);
  const hasGoInQuery = /যেতে চাই|যাব|যাওয়ার পথ|যাবার পথ|কীভাবে যাব|কিভাবে যাব|নিয়ে চল|পথ দেখাও|go to|want to go|how to go|how to get|how do i get|take me to|where is|directions to/i.test(q);

  // 4A. Destination + Pandal intent (e.g. "দমদমের কাছে প্যান্ডেল দেখাও", "Show pandals near Baghbazar")
  if (dest && hasPandalInQuery) {
    const matched = findNearbyPandals(dest);
    if (matched && matched.length > 0) {
      return { node: buildPandalResultsNode(matched, dest.name), isLocal: true };
    }
    return { node: buildPandalListNode(), isLocal: true };
  }

  // 4B. Destination + Metro intent (e.g. "Dum Dum metro", "Kalighat metro", "Howrah metro", "Sector V metro")
  if (hasMetroInQuery) {
    if (dest && dest.type === 'Metro Station') {
      const s = (_stations || []).find(x => x.name.toLowerCase() === dest.name.toLowerCase() || x.id === dest.nearestMetro);
      if (s) return { node: buildMetroResultNode(s), isLocal: true };
    }
    if (dest && dest.nearestMetro && _stations) {
      const s = _stations.find(x => x.id === dest.nearestMetro);
      if (s) return { node: buildMetroResultNode(s), isLocal: true };
    }
    // Check if station directly in _stations
    if (_stations) {
      for (const s of _stations) {
        if (q.includes(normalize(s.name))) {
          return { node: buildMetroResultNode(s), isLocal: true };
        }
      }
    }
    // Generic metro list if no specific station
    return { node: buildMetroListNode(), isLocal: true };
  }

  // 4C. Destination intent (e.g. "দমদম যেতে চাই", "I want to go to Deshapriya Park", "Deshapriya Park যাব")
  if (dest && (hasGoInQuery || (!hasPandalInQuery && !hasMetroInQuery))) {
    return { node: buildDestNode([dest]), isLocal: true };
  }

  // 5. Generic pandal search intent without specific destination
  if (hasPandalInQuery && /খুঁজ|find|list|দেখ|দেখা|all/.test(q)) {
    return { node: buildPandalListNode(), isLocal: true };
  }

  // 6. Generic metro list keywords
  if (/কাছাকাছি মেট্রো|find metro|metro route|মেট্রো রুট|metro list|কাছের মেট্রো|মেট্রো দিয়ে পুজো/.test(q)) {
    return { node: buildMetroListNode(), isLocal: true };
  }

  // 7. Where to go / suggestions
  if (/কোথায় যাব|where to go|কোথায় যেত|destination list|জায়গায় যেতে|যেতে চাই/.test(q)) {
    return { node: buildWhereToGoNode(), isLocal: true };
  }

  // 8. Puja tradition match (মহালয়া, অষ্টমী, অঞ্জলি, সিঁদুর খেলা, etc.)
  const tradition = matchPujaTradition(rawQuery);
  if (tradition) {
    const wrap = document.createElement('div');
    const card = document.createElement('div');
    card.className = 'puja-ai-guide-card';
    card.innerHTML = `<h4>${escapeHtml(tradition.title || '')}</h4><p>${escapeHtml(tradition.content || '').replace(/\n/g, '<br>')}</p>`;
    wrap.appendChild(card);
    return { node: wrap, isLocal: true };
  }

  // 9. General guide section match
  const section = matchGuide(rawQuery);
  if (section) {
    const wrap = document.createElement('div');
    const card = document.createElement('div');
    card.className = 'puja-ai-guide-card';
    card.innerHTML = `<h4>${escapeHtml(section.title || '')}</h4><p>${escapeHtml(section.content || '').replace(/\n/g, '<br>')}</p>`;
    wrap.appendChild(card);
    return { node: wrap, isLocal: true };
  }

  // 10. Quick intent fallback
  const intent = detectQuickIntent(rawQuery);
  if (intent === 'puja-guide') return { node: buildGuideAllNode(), isLocal: true };
  if (intent === 'find-pandal') return { node: buildPandalListNode(), isLocal: true };
  if (intent === 'find-metro') return { node: buildMetroListNode(), isLocal: true };
  if (intent === 'go-somewhere') return { node: buildWhereToGoNode(), isLocal: true };
  if (intent === 'puja-plan') return { node: buildPlanActionNode(), isLocal: true };
  if (intent === 'popular-pandals') return { node: buildFeaturedPandalsNode(), isLocal: true };

  // 11. Offline fallback
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      node: buildFallbackNode('আপনি বর্তমানে অফলাইনে আছেন। ইন্টারনেট সংযোগ ছাড়া AI কাজ করবে না, তবে আপনি নিচের কুইক অ্যাকশন বা পুজো গাইড ব্যবহার করতে পারেন।'),
      isLocal: true
    };
  }

  // 12. Needs AI for general queries
  return { node: null, isLocal: false, needsAI: true };
}

// -------------------------------------------------
//  Restore persisted conversation
// -------------------------------------------------
function restoreHistory(messagesEl) {
  const history = loadHistory();
  history.forEach(item => {
    const wrapper = document.createElement('div');
    wrapper.className = `puja-ai-message ${item.role === 'user' ? 'user' : 'bot'}`;
    wrapper.textContent = item.content || item.text || '';
    messagesEl.appendChild(wrapper);
  });
  if (history.length > 0) messagesEl.scrollTop = messagesEl.scrollHeight;
  return history;
}

// -------------------------------------------------
//  Puja AI Brand SVG — Diya + Alpana + Lotus motif
// -------------------------------------------------
function getPujaAiBrandSVG() {
  return `<svg class="puja-ai-brand-icon" viewBox="0 -14 100 114" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="pujaFlameGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#daa520"/>
      <stop offset="40%" stop-color="#ffd700"/>
      <stop offset="85%" stop-color="#fff4c2"/>
      <stop offset="100%" stop-color="#fffbe6"/>
    </linearGradient>
    <linearGradient id="pujaDiyaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#daa520"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </linearGradient>
    <radialGradient id="pujaGlowGrad" cx="50%" cy="30%" r="45%">
      <stop offset="0%" stop-color="rgba(255,215,0,0.35)"/>
      <stop offset="100%" stop-color="rgba(255,215,0,0)"/>
    </radialGradient>
    <filter id="pujaNewGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- NEW badge -->
  <text x="50" y="-2" text-anchor="middle" font-family="'Segoe UI','Inter',sans-serif" font-size="9.5" font-weight="800" fill="#daa520" letter-spacing="3" filter="url(#pujaNewGlow)">
    NEW
    <animate attributeName="opacity" dur="3s" values="0.8;1;0.8" repeatCount="indefinite"/>
  </text>
  <!-- Soft golden glow -->
  <circle cx="50" cy="32" r="28" fill="url(#pujaGlowGrad)" opacity="0.7"/>
  <!-- Flame — Durga-inspired elegant teardrop -->
  <path d="M50 8 C50 8, 38 28, 38 38 C38 45, 43.5 50, 50 50 C56.5 50, 62 45, 62 38 C62 28, 50 8, 50 8Z" fill="url(#pujaFlameGrad)" opacity="0.95">
    <animate attributeName="d" dur="2.8s" repeatCount="indefinite" values="
      M50 8 C50 8, 38 28, 38 38 C38 45, 43.5 50, 50 50 C56.5 50, 62 45, 62 38 C62 28, 50 8, 50 8Z;
      M50 6 C50 6, 36 26, 37 37 C37 44, 43 50, 50 50 C57 50, 63 44, 63 37 C64 26, 50 6, 50 6Z;
      M50 8 C50 8, 38 28, 38 38 C38 45, 43.5 50, 50 50 C56.5 50, 62 45, 62 38 C62 28, 50 8, 50 8Z
    "/>
  </path>
  <!-- Inner flame core -->
  <path d="M50 22 C50 22, 44 34, 44 39 C44 43, 46.8 46, 50 46 C53.2 46, 56 43, 56 39 C56 34, 50 22, 50 22Z" fill="#fff8dc" opacity="0.75">
    <animate attributeName="d" dur="2.2s" repeatCount="indefinite" values="
      M50 22 C50 22, 44 34, 44 39 C44 43, 46.8 46, 50 46 C53.2 46, 56 43, 56 39 C56 34, 50 22, 50 22Z;
      M50 20 C50 20, 43 33, 43 38 C43 42, 46 46, 50 46 C54 46, 57 42, 57 38 C57 33, 50 20, 50 20Z;
      M50 22 C50 22, 44 34, 44 39 C44 43, 46.8 46, 50 46 C53.2 46, 56 43, 56 39 C56 34, 50 22, 50 22Z
    "/>
  </path>
  <!-- Diya (oil lamp) bowl -->
  <path d="M32 54 Q32 50, 50 50 Q68 50, 68 54 L64 62 Q62 66, 50 66 Q38 66, 36 62 Z" fill="url(#pujaDiyaGrad)" stroke="#a07010" stroke-width="0.6"/>
  <!-- Diya wick holder -->
  <ellipse cx="50" cy="50" rx="5" ry="2.2" fill="#c9a84c" opacity="0.9"/>
  <!-- Alpana base pattern — decorative arc motifs -->
  <g fill="none" stroke="#daa520" stroke-width="0.9" opacity="0.7">
    <path d="M28 68 Q38 62, 50 66 Q62 62, 72 68"/>
    <path d="M24 72 Q36 65, 50 70 Q64 65, 76 72"/>
  </g>
  <!-- Lotus petals flanking the base -->
  <g fill="#daa520" opacity="0.45">
    <path d="M22 74 Q28 66, 34 74 Q28 78, 22 74Z"/>
    <path d="M66 74 Q72 66, 78 74 Q72 78, 66 74Z"/>
    <path d="M30 78 Q37 72, 44 78 Q37 82, 30 78Z"/>
    <path d="M56 78 Q63 72, 70 78 Q63 82, 56 78Z"/>
  </g>
  <!-- Small center lotus under diya -->
  <ellipse cx="50" cy="76" rx="4" ry="2" fill="#daa520" opacity="0.5"/>
  <!-- Alpana dots -->
  <g fill="#daa520" opacity="0.55">
    <circle cx="20" cy="76" r="1.3"/>
    <circle cx="80" cy="76" r="1.3"/>
    <circle cx="50" cy="84" r="1.3"/>
    <circle cx="35" cy="84" r="1"/>
    <circle cx="65" cy="84" r="1"/>
  </g>
</svg>`;
}

// -------------------------------------------------
//  Build UI
// -------------------------------------------------
function buildUI() {
  const root = document.createElement('div');
  root.className = 'puja-ai-root';
  root.id = 'puja-ai-root';

  const fab = document.createElement('button');
  fab.className = 'puja-ai-fab';
  fab.id = 'puja-ai-fab';
  fab.setAttribute('aria-label', 'Puja AI সহায়ক খুলুন');
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('title', 'Puja AI');
  fab.innerHTML = getPujaAiBrandSVG();
  root.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'puja-ai-panel';
  panel.id = 'puja-ai-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Puja AI চ্যাট');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `
    <div class="puja-ai-header">
      <div class="puja-ai-header-main">
        <div class="puja-ai-header-icon" aria-hidden="true">${getPujaAiBrandSVG()}</div>
        <div>
          <p class="puja-ai-title">Puja AI</p>
          <p class="puja-ai-subtitle">আপনার পুজো সহায়ক • Your Puja Assistant</p>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button id="puja-ai-clear" class="puja-ai-close" title="কথোপকথন মুছুন" aria-label="কথোপকথন মুছুন" style="font-size:13px;">🗑️</button>
        <button id="puja-ai-close" class="puja-ai-close" title="বন্ধ করুন" aria-label="চ্যাট বন্ধ করুন">✕</button>
      </div>
    </div>
    <div class="puja-ai-quick" id="puja-ai-quick" role="toolbar" aria-label="দ্রুত কার্যক্রম">
      ${(PUJA_AI_DATA.quickActions || []).map(a =>
        `<button data-quick-id="${escapeHtml(a.id)}" data-quick-prompt="${escapeHtml(a.prompt || a.query || a.label)}" aria-label="${escapeHtml(a.label)}">${escapeHtml(a.icon || '')} ${escapeHtml(a.label || '')}</button>`
      ).join('')}
    </div>
    <div class="puja-ai-messages" id="puja-ai-messages" role="log" aria-live="polite" aria-label="চ্যাট বার্তা"></div>
    <div class="puja-ai-input-area">
      <label for="puja-ai-input" class="visually-hidden">আপনার প্রশ্ন লিখুন</label>
      <input id="puja-ai-input" class="puja-ai-input" type="text"
        placeholder="আপনার প্রশ্ন লিখুন…"
        autocomplete="off" autocorrect="off" spellcheck="false" maxlength="400"
        aria-label="চ্যাট ইনপুট" />
      <button id="puja-ai-send" class="puja-ai-send" title="পাঠান" aria-label="বার্তা পাঠান">➤</button>
    </div>`;

  document.body.appendChild(root);
  document.body.appendChild(panel);

  return {
    fab, panel,
    closeBtn: panel.querySelector('#puja-ai-close'),
    clearBtn: panel.querySelector('#puja-ai-clear'),
    quickBar: panel.querySelector('#puja-ai-quick'),
    messagesEl: panel.querySelector('#puja-ai-messages'),
    input: panel.querySelector('#puja-ai-input'),
    sendBtn: panel.querySelector('#puja-ai-send'),
  };
}

// -------------------------------------------------
//  Wire interactions with Single Delegated Action System
// -------------------------------------------------
function init() {
  if (document.getElementById('puja-ai-root')) return;

  const els = buildUI();
  const { fab, panel, closeBtn, clearBtn, quickBar, messagesEl, input, sendBtn } = els;

  let history = [];
  let isSending = false;

  function openPanel() {
    panel.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    setTimeout(() => input && input.focus(), 50);
    if (history.length === 0 && messagesEl.children.length === 0) {
      appendMessage(messagesEl, 'bot', buildWelcomeNode());
    }
  }

  function closePanel() {
    panel.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.classList.contains('is-open')) {
      closePanel();
    } else {
      if (history.length === 0 && messagesEl.children.length === 0) {
        history = restoreHistory(messagesEl);
      }
      openPanel();
    }
  });

  // Keep clicks inside panel from closing it
  panel.addEventListener('click', (e) => e.stopPropagation());
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
  document.addEventListener('click', () => { if (panel.classList.contains('is-open')) closePanel(); });

  if (clearBtn) clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('কথোপকথন মুছে ফেলবেন?')) return;
    clearHistory();
    history = [];
    messagesEl.innerHTML = '';
    appendMessage(messagesEl, 'bot', buildWelcomeNode());
  });

  quickBar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-quick-id]');
    if (!btn) return;
    handleSend(btn.dataset.quickPrompt || btn.dataset.quickId);
  });

  // Pre-load data in background
  loadAppData();

  // -------------------------------------------------
  //  SINGLE DELEGATED CLICK HANDLER FOR ALL CHAT ACTIONS
  // -------------------------------------------------
  panel.addEventListener('click', async (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    e.preventDefault();
    e.stopPropagation();

    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;

    // Instant synchronous actions
    if (action === 'save-pandal') {
      if (ds.pandalId) {
        const nowSaved = toggleSavePandal(ds.pandalId);
        actionEl.textContent = nowSaved ? '♥ Saved' : '♡ Save';
        actionEl.classList.toggle('saved', nowSaved);
        actionEl.style.background = nowSaved ? '#8f0d22' : '#eadadd';
        actionEl.style.color = nowSaved ? '#fff' : '#333';
      }
      return;
    }

    if (action === 'view-pandal') {
      if (ds.pandalId) {
        const url = getPageUrl('pandal', { id: ds.pandalId });
        window.open(url, '_blank', 'noopener');
      }
      return;
    }

    if (action === 'view-station') {
      if (ds.stationId) {
        const url = getPageUrl('metro-station', { id: ds.stationId });
        window.open(url, '_blank', 'noopener');
      }
      return;
    }

    if (action === 'planner') {
      window.location.href = getPageUrl('planner');
      return;
    }

    if (action === 'full-map') {
      window.location.href = getPageUrl('map');
      return;
    }

    if (action === 'explore') {
      window.location.href = getPageUrl('explore');
      return;
    }

    if (action === 'select-suggestion') {
      if (ds.suggestion) {
        handleSend(ds.suggestion);
      }
      return;
    }

    if (action === 'directions') {
      handleDirections({
        name: ds.destName,
        query: ds.query,
        lat: ds.lat ? parseFloat(ds.lat) : null,
        lng: ds.lng ? parseFloat(ds.lng) : null
      });
      return;
    }

    if (action === 'open-map') {
      handleOpenPlaceMap({
        name: ds.destName,
        query: ds.query
      });
      return;
    }

    // Actions requiring app data
    await loadAppData();

    switch (action) {
      case 'dest-metro': {
        let st = null;
        if (ds.stationId) {
          st = (_stations || []).find(s => s.id === ds.stationId);
        }
        if (!st && ds.destName) {
          const kw = normalize(ds.destName);
          st = (_stations || []).find(s => normalize(s.name).includes(kw) || kw.includes(normalize(s.name)));
        }
        if (st) {
          appendMessage(messagesEl, 'bot', buildMetroResultNode(st));
        } else {
          appendMessage(messagesEl, 'bot', buildMetroListNode());
        }
        break;
      }

      case 'dest-nearby-pandals': {
        const destObj = {
          name: ds.destName,
          keyword: ds.keyword,
          lat: ds.lat ? parseFloat(ds.lat) : null,
          lng: ds.lng ? parseFloat(ds.lng) : null
        };
        const matched = findNearbyPandals(destObj);
        if (matched && matched.length > 0) {
          appendMessage(messagesEl, 'bot', buildPandalResultsNode(matched, ds.destName));
        } else {
          appendMessage(messagesEl, 'bot', buildPandalListNode());
        }
        break;
      }

      case 'pandal-map': {
        const p = (_pandals || []).find(x => x.id === ds.pandalId);
        if (p) {
          handleOpenPlaceMap({ name: p.name, query: p.googleMapsQuery || `${p.name} Kolkata` });
        }
        break;
      }

      case 'pandal-directions': {
        const p = (_pandals || []).find(x => x.id === ds.pandalId);
        if (p) {
          handleDirections({
            name: p.name,
            query: p.googleMapsQuery || `${p.name} Kolkata`,
            lat: p.lat,
            lng: p.lng
          });
        }
        break;
      }

      case 'station-map': {
        const s = (_stations || []).find(x => x.id === ds.stationId);
        if (s) {
          handleOpenPlaceMap({ name: `${s.name} Metro Station`, query: `${s.name} Metro Station Kolkata` });
        }
        break;
      }

      case 'station-directions': {
        const s = (_stations || []).find(x => x.id === ds.stationId);
        if (s) {
          handleDirections({
            name: `${s.name} Metro Station`,
            query: `${s.name} Metro Station Kolkata`,
            lat: s.lat,
            lng: s.lng
          });
        }
        break;
      }

      case 'select-station': {
        const s = (_stations || []).find(x => x.id === ds.stationId);
        if (s) {
          appendMessage(messagesEl, 'bot', buildMetroResultNode(s));
        }
        break;
      }

      default:
        console.warn('[Puja AI] Unknown action:', action);
    }
  });

  async function handleSend(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || isSending) return;
    isSending = true;
    sendBtn.disabled = true;
    input.disabled = true;

    appendMessage(messagesEl, 'user', trimmed);
    history.push({ role: 'user', content: trimmed, timestamp: Date.now() });
    saveHistory(history);
    input.value = '';

    const typingWrapper = document.createElement('div');
    typingWrapper.className = 'puja-ai-message bot';
    typingWrapper.appendChild(buildTypingNode());
    messagesEl.appendChild(typingWrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    await new Promise(r => setTimeout(r, 200));

    let replyNode;
    let replyText = '';

    try {
      const result = await processQuery(trimmed);

      if (result.needsAI) {
        const historyForAI = history.slice(-API_WINDOW).map(m => ({ role: m.role, content: m.content }));
        try {
          const aiText = await callAI(historyForAI);
          replyNode = buildAITextNode(aiText);
          replyText = aiText;
        } catch (err) {
          const errMsg = err?.message && err.message.length > 5 ? err.message : null;
          replyNode = buildFallbackNode(errMsg);
          replyText = '[AI unavailable]';
        }
      } else {
        replyNode = result.node;
        replyText = replyNode.textContent?.trim() || '[rich response]';
      }
    } catch {
      replyNode = buildFallbackNode();
      replyText = '[error]';
    }

    typingWrapper.remove();
    appendMessage(messagesEl, 'bot', replyNode);
    history.push({ role: 'assistant', content: replyText, timestamp: Date.now() });
    saveHistory(history);

    isSending = false;
    input.disabled = false;
    sendBtn.disabled = input.value.trim().length === 0;
    input.focus();
  }

  sendBtn.addEventListener('click', () => handleSend(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input.value); }
  });
  input.addEventListener('input', () => {
    sendBtn.disabled = isSending || input.value.trim().length === 0;
  });
  sendBtn.disabled = true;

  history = restoreHistory(messagesEl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}