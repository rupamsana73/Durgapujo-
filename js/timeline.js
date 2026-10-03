export const PARTS = ['morning', 'afternoon', 'evening', 'night'];

export const partOf = (d) => {
  const h = d.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
};

export const parseDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const DAY = 864e5;

/** Where are we relative to the puja days in config.json? */
export function status(config, now = new Date()) {
  const days = config.days.map((d) => ({ ...d, at: parseDate(d.date) }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hit = days.find((d) => d.at.getTime() === today.getTime());
  if (hit) {
    const part = partOf(now);
    return { state: 'during', day: hit.key, part, crowd: config.crowd[hit.key]?.[part] ?? null };
  }
  if (today > days[days.length - 1].at) return { state: 'after' };
  const next = days.find((d) => d.at > today);
  return { state: 'before', target: next.key, days: Math.round((next.at - today) / DAY) };
}
