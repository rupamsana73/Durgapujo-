// One small store. Persisted keys survive reloads; the rest are per-visit UI state.
const KEY = 'pujo-planner:v1';
const FAVOURITES_KEY = 'pujoPlanner.favourites';
const PERSIST = ['lang', 'theme', 'favs', 'stops', 'start', 'mode'];

const defaults = {
  lang: 'bn', theme: null, favs: [], stops: [], start: 'me', mode: 'walking',
  q: '', area: 'all', type: 'all', favOnly: false, tab: 'explore', userLoc: null,
  mapRegion: null, mapMetro: null, detailId: null, wishlist: false
};

function load() {
  try {
    const legacy = JSON.parse(localStorage.getItem(KEY)) || {};
    const saved = JSON.parse(localStorage.getItem(FAVOURITES_KEY));
    if (Array.isArray(saved)) legacy.favs = saved.map(String);
    return legacy;
  } catch { return {}; }
}

let state = { ...defaults, ...load() };
const subs = new Set();

export const get = () => state;

export function set(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(PERSIST.map((k) => [k, state[k]]))));
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(state.favs.map(String)));
  } catch { /* storage can be blocked; the app still works */ }
  subs.forEach((fn) => fn(state, patch));
}

export const subscribe = (fn) => { subs.add(fn); };
