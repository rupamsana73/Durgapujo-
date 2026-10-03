# Pujo Planner (পুজো প্ল্যানার)

A static, backend-free web app for Durga Puja pandal hopping in Kolkata.
Pick pandals, get them ordered by distance, see the nearest Kolkata Metro station for each,
and jump into **Google Maps** for navigation with one tap.

## Problem

During Puja, people struggle with three things: which pandals are close to each other, which metro
station to use, and when the crowds are manageable. This app answers all three in one page, and the
whole plan lives in a shareable URL.

## Features

- Interactive map (Leaflet + OpenStreetMap) with pandal and metro markers
- Every pandal and station links out to **Google Maps** (place, transit directions, route to nearest metro)
- Nearest metro station per pandal, computed once at load (haversine, ~1.3x walking detour)
- Filters (area, famous/offbeat, favourites) and search
- Plan builder: add, reorder, auto-order (nearest neighbour), per-leg transit links, full-route link
- "Near me": uses the Geolocation API, sorts by distance, shows the nearest station
- Shareable plans: `?stops=1,6,11&start=howrah`, plus WhatsApp share and copy link
- Puja countdown, day-by-day crowd guide (rule-of-thumb, driven by `data/config.json`)
- Bengali / English toggle, dark mode, favourites in `localStorage`
- PWA: app shell and data work offline (map tiles do not)

## Run it

ES modules and `fetch` need an HTTP server, so do not open `index.html` by double-clicking.

```bash
npm start          # or: python3 -m http.server 8080
npm test           # logic tests, no dependencies
```

## Project structure

```
index.html            page shell
manifest.json, sw.js  PWA manifest and service worker
css/style.css         design tokens, layout, components
data/
  pandals.json        pandal records (replace the sample data)
  metro.json          station records and line colours
  config.json         puja dates, crowd rules, start points, flags
js/
  main.js             controller: boot, events, render loop
  state.js            tiny store (persisted + UI state)
  data.js             loads and validates JSON
  geo.js              haversine and walking estimates (pure)
  metro.js            nearest-station logic (pure)
  route.js            ordering and Google Maps URL builders (pure)
  share.js            URL encode/decode, WhatsApp, clipboard
  timeline.js         countdown and crowd lookup (pure)
  i18n.js             Bengali/English strings
  map.js              the only module that knows Leaflet
  ui.js               HTML template functions (pure)
tests/logic.test.mjs  tests for the pure modules
```

## Architecture

```
 data/*.json --> data.js (validate) --> state.js <--> main.js --> ui.js  --> DOM
                       |                                  |
                  metro.js (cache nearest station)        +--> map.js --> Leaflet
                  route.js / geo.js / timeline.js (pure)  +--> share.js --> URL / WhatsApp
```

Data, logic, and presentation are separate. The logic modules are pure functions, which is why they
are testable without a browser.

## Decisions and trade-offs

| Decision | Why |
|---|---|
| Static site, no backend | Free hosting, no ops, fast. Everything needed (data, algorithms) fits in the client. |
| Leaflet + Google Maps deep links | No API key, no billing, no quota risk during peak traffic. Google still does the navigation. |
| Map isolated in `map.js` | Swapping to the Google Maps JS API later touches one file. |
| Plan stored in the URL | Sharing needs no server or accounts. |
| Nearest-neighbour ordering | Not optimal, but instant and good enough for 5-8 stops. |
| Transit only per leg | Google Maps URLs do not support waypoints in transit mode, so the full route offers walk/drive/cycle. Max 9 waypoints. |
| Network-first service worker, no tile caching | Data updates reach users; OSM tile policy discourages bulk caching. |

## Before you go live (important)

The bundled data is **sample data**. Coordinates are approximate and were not verified on the ground.

1. Replace `data/pandals.json` with real pandals. Get coordinates by right-clicking the spot in Google Maps and copying the lat/lng. Committees move locations between years.
2. Verify `data/metro.json` station coordinates and add any lines/stations that are open now (for example the Purple and Orange lines).
3. Verify puja dates in `data/config.json` against a panchang or official announcement.
4. Special puja metro timings change every year. This app deliberately does not hardcode them; link to the official notice instead.
5. Open 5-10 pandals on a phone and confirm each pin is in the right place.
6. Set `"sampleData": false` in `data/config.json` to remove the sample-data banner.

## Deploy

Netlify: drag the project folder onto https://app.netlify.com/drop. GitHub Pages: push and enable Pages on the main branch.
Both serve over HTTPS, which the Geolocation API and service worker require.

## Possible next steps

- `leaflet.markercluster` once you pass ~100 pandals
- PNG icons (192/512) for broader PWA install support
- Drag-and-drop reordering in the plan
- Pandal photos (add an `image` field and render it in `ui.js`)
- something is new
