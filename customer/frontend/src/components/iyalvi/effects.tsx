import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Brand } from './motifs';

export function LoomLoader() {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (sessionStorage.getItem('iyalvi-welcome') || reduced) return;
    sessionStorage.setItem('iyalvi-welcome', 'seen');
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [reduced]);
  return <AnimatePresence>{visible && <motion.div className="loom-loader" initial={{ opacity: 1 }} exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: .7 }}><div className="loom-threads">{Array.from({length: 14}, (_,i) => <span key={i}/>)}</div><motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:.5}}><Brand/><p>Everyday style, effortlessly yours.</p></motion.div><Button variant="ghost" onClick={() => setVisible(false)} className="loader-skip">Skip intro →</Button></motion.div>}</AnimatePresence>;
}

export function KolamCursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(pointer:fine) and (prefers-reduced-motion: no-preference)').matches) return;
    const handler = (event: MouseEvent) => {
      const cursor = ref.current;
      if (!cursor) return;
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      const target = event.target instanceof Element ? event.target : null;
      cursor.dataset['mode'] = target?.closest('[data-drape]') ? 'drape' : target?.closest('a,button') ? 'needle' : '';
      cursor.style.opacity = '1';
    };
    const hide = () => { if (ref.current) ref.current.style.opacity = '0'; };
    window.addEventListener('mousemove', handler);
    document.addEventListener('mouseleave', hide);
    return () => { window.removeEventListener('mousemove', handler); document.removeEventListener('mouseleave', hide); };
  }, []);
  return <div ref={ref} className="kolam-cursor" aria-hidden="true"><span/><small>Explore</small><i/><i/><i/></div>;
}

export function PleatReveal({ value }: { value: string }) {
  const initial = useRef(true);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    setShow(true);
    const timer = setTimeout(() => setShow(false), 650);
    return () => clearTimeout(timer);
  }, [value]);
  return <AnimatePresence>{show && <div className="pleat-transition" aria-hidden="true">{Array.from({length:8}, (_,i) => <motion.span key={i} initial={{scaleX:0}} animate={{scaleX:[0,1,0]}} transition={{duration:.6,delay:i*.025}}/>)}</div>}</AnimatePresence>;
}