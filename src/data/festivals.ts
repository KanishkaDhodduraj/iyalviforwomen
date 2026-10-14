// Dates follow the Indian festival calendar; local observances may vary.
const festivalCalendar = [
  { name: 'Diwali', date: '2026-11-08T00:00:00+05:30' },
  { name: 'Pongal', date: '2027-01-15T00:00:00+05:30' },
  { name: 'Navratri', date: '2027-09-30T00:00:00+05:30' },
  { name: 'Diwali', date: '2027-10-29T00:00:00+05:30' },
  { name: 'Pongal', date: '2028-01-15T00:00:00+05:30' },
];
export function nextFestival(now: Date) {
  return festivalCalendar.find(f => new Date(f.date).getTime() > now.getTime()) ?? null;
}
export function countdown(target: string, now: Date) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now.getTime()) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}