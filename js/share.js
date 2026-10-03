// The plan lives in the URL, so a plain link is the whole "backend".
export function parseUrl(search = location.search) {
  const q = new URLSearchParams(search);
  const stops = (q.get('stops') || '').split(',').map((x) => x.trim()).filter(Boolean);
  return { stops, start: q.get('start') || null };
}

export function buildUrl(stops, start) {
  const q = new URLSearchParams();
  if (stops.length) q.set('stops', stops.join(','));
  if (start) q.set('start', start);
  const qs = q.toString();
  return `${location.origin}${location.pathname}${qs ? `?${qs}` : ''}`;
}

export function syncUrl(stops, start) {
  const url = buildUrl(stops, stops.length ? start : null);
  if (url !== location.href) history.replaceState(null, '', url);
}

export const whatsappUrl = (text, url) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
