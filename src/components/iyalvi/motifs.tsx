export function Kolam({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M40 5C49 21 59 31 75 40C59 49 49 59 40 75C31 59 21 49 5 40C21 31 31 21 40 5Z" stroke="currentColor" strokeWidth="1"/><path d="M40 16C58 16 64 22 64 40S58 64 40 64S16 58 16 40S22 16 40 16Z" stroke="currentColor"/><path d="M40 24L56 40L40 56L24 40Z" stroke="currentColor"/>{[[40,8],[8,40],[72,40],[40,72],[40,40],[20,20],[60,20],[20,60],[60,60]].map(([cx,cy], i) => <circle key={i} cx={cx} cy={cy} r="1.7" fill="currentColor"/>)}</svg>;
}
export function Diya({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true"><path d="M5 18H27C25 25 20 28 16 28C12 28 7 25 5 18Z" stroke="currentColor" strokeWidth="1.5"/><path d="M16 16C10 12 16 5 17 3C18 8 23 12 16 16Z" stroke="currentColor" strokeWidth="1.5"/><path d="M3 15L1 12M29 15L31 12M9 8L7 5M25 8L27 5" stroke="currentColor" strokeWidth="1.2"/></svg>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? 'brand-compact' : ''}`}><Kolam/><span>IYALVI</span>{!compact && <small>THREADS OF TRADITION</small>}</span>;
}