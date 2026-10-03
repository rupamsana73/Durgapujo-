// One small store. Persisted keys survive reloads; the rest are per-visit UI state.
const KEY = 'pujo-planner:v1';
const PERSIST = ['lang', 'theme', 'favs', 'stops', 'start', 'mode'];

const defaults = {
  lang: 'bn', theme: null, favs: [], stops: [], start: 'me', mode: 'walking',
  q: '', area: 'all', type: 'all', favOnly: false, tab: 'explore', userLoc: null
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

let state = { ...defaults, ...load() };
const subs = new Set();

export const get = () => state;

export function set(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(PERSIST.map((k) => [k, state[k]]))));
  } catch { /* storage can be blocked; the app still works */ }
  subs.forEach((fn) => fn(state, patch));
}

export const subscribe = (fn) => { subs.add(fn); };
