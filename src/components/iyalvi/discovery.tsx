import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Heart, Search, Minus, Plus, ShoppingBag, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { products, occasions, filterProducts, formatPrice, type Product } from '@/data/products';
import { usePrototype } from '@/data/store';
import { Kolam } from './motifs';

export function ProductCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const { wishlist, toggleWish } = usePrototype();
  const saved = wishlist.includes(product.id);
  return <article className="product-card"><div className="product-image-wrap"><Button variant="ghost" className="product-image-button" onClick={() => onSelect(product)} aria-label={`View ${product.name}`} data-drape><img src={product.image} width={768} height={1024} alt={product.name} loading="lazy"/></Button><Button variant="ghost" size="icon" className={`wish-button ${saved ? 'is-saved' : ''}`} aria-label={`${saved ? 'Remove' : 'Save'} ${product.name}`} aria-pressed={saved} onClick={() => toggleWish(product.id)}><motion.span animate={saved ? {scale:[1,1.4,1],rotate:[0,15,0]} : {scale:1}}><Heart fill={saved ? 'currentColor' : 'none'}/></motion.span></Button><span className="product-craft">{product.craft}</span></div><div className="product-meta"><span>{product.fabric}</span><h3><Button variant="link" onClick={() => onSelect(product)}>{product.name}</Button></h3><p>{formatPrice(product.price)}<span className={`color-dot color-${(product.colors[0]?.split(' ')[0] ?? 'heritage').toLowerCase()}`} aria-label={product.colors[0]}/></p></div></article>;
}

export function SearchDialog({ open, onOpenChange, onSelect, initialCategory = 'All', initialQuery = '' }: { open: boolean; onOpenChange: (v: boolean) => void; onSelect: (p: Product) => void; initialCategory?: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const { recent, rememberSearch } = usePrototype();
  const results = filterProducts(query, category);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="search-dialog"><DialogTitle className="font-display text-3xl">Find your kind of grace</DialogTitle><DialogDescription>A weave, a colour, a celebration.</DialogDescription><form onSubmit={e => {e.preventDefault(); rememberSearch(query);}} className="search-input-row"><Search/><Input autoFocus aria-label="Search products" placeholder="Try ‘silk’, ‘teal’ or ‘Diwali’…" value={query} onChange={e => setQuery(e.target.value)}/></form><div className="search-chips">{['All', ...occasions].map(o => <Button variant={category === o ? 'default' : 'outline'} key={o} onClick={() => setCategory(o)} aria-pressed={category === o}>{o}</Button>)}</div>{!query && recent.length > 0 && <div className="recent-searches"><Clock size={14}/><span>Recently loved</span>{recent.map(term => <Button variant="link" key={term} onClick={() => setQuery(term)}>{term}</Button>)}</div>}<div className="search-result-heading"><span>{results.length} pieces to discover</span><span>Made to be treasured</span></div><div className="search-results">{results.map(p => <Button variant="ghost" className="search-result" key={p.id} onClick={() => {rememberSearch(query || p.craft); onOpenChange(false); onSelect(p);}}><img src={p.image} alt={p.name} width={64} height={80}/><span><strong>{p.name}</strong><small>{p.fabric} · {p.occasion}</small><b>{formatPrice(p.price)}</b></span><ArrowUpRight/></Button>)}{results.length === 0 && <div className="empty-state"><Kolam/><h3>Another thread awaits.</h3><p>Try a different weave or celebration.</p><Button variant="outline" onClick={() => {setQuery('');setCategory('All');}}>Explore all pieces</Button></div>}</div></DialogContent></Dialog>;
}

export function ProductDialog({ product, onClose, notify }: { product: Product | null; onClose: () => void; notify: (v: string) => void }) {
  const { addToBag, toggleWish, wishlist } = usePrototype();
  const [adding, setAdding] = useState(false);
  const reduced = useReducedMotion();
  const add = () => {
    if (!product || adding) return;
    addToBag(product.id); setAdding(true);
    notify(`${product.name} is in your trunk.`);
    setTimeout(() => setAdding(false), 900);
  };
  return <Dialog open={Boolean(product)} onOpenChange={v => {if (!v) onClose();}}><DialogContent className="product-dialog">{product && <><div className="detail-image"><motion.img src={product.image} alt={product.name} width={768} height={1024} animate={adding && !reduced ? {scale:[1,.65,.85,1],rotateY:[0,65,0]} : {scale:1}} transition={{duration:.7}}/><AnimatePresence>{adding && <motion.span className="parcel-spark" initial={{scale:0}} animate={{scale:1,y:-30}} exit={{opacity:0}}><ShoppingBag/><Check/></motion.span>}</AnimatePresence></div><div className="detail-content"><span className="eyebrow">{product.craft} · THE HEIRLOOM EDIT</span><DialogTitle className="font-display text-4xl">{product.name}</DialogTitle><DialogDescription>Handwoven elegance, made to hold your most cherished moments.</DialogDescription><p className="detail-price">{formatPrice(product.price)}</p><dl><div><dt>Fabric</dt><dd>{product.fabric}</dd></div><div><dt>Woven in</dt><dd>{product.craftOrigin}</dd></div><div><dt>Colour</dt><dd>{product.colors.join(', ')}</dd></div><div><dt>Size</dt><dd>{product.sizes.join(', ')} · 5.5 m saree + blouse piece</dd></div><div><dt>Care</dt><dd>Dry clean with love</dd></div></dl><Button className="detail-add" size="lg" onClick={add} disabled={adding}><ShoppingBag/>{adding ? 'A little joy, added' : 'Add to your trunk'}<ArrowUpRight/></Button><Button variant="link" className="detail-wish" onClick={() => toggleWish(product.id)}><Heart fill={wishlist.includes(product.id) ? 'currentColor' : 'none'}/>{wishlist.includes(product.id) ? 'Saved close to your heart' : 'Save close to your heart'}</Button><p className="prototype-note">A preview of your next heirloom. Orders aren’t placed in this prototype.</p></div></>}</DialogContent></Dialog>;
}

export function TrunkDialog({ mode, onClose, onSelect }: { mode: 'bag' | 'wishlist' | null; onClose: () => void; onSelect: (p: Product) => void }) {
  const { bag, wishlist, changeQuantity } = usePrototype();
  const chosen = products.filter(p => mode === 'bag' ? bag.some(i => i.id === p.id) : wishlist.includes(p.id));
  const total = bag.reduce((sum, item) => sum + (products.find(p => p.id === item.id)?.price ?? 0) * item.quantity, 0);
  return <Dialog open={Boolean(mode)} onOpenChange={v => {if (!v) onClose();}}><DialogContent className="trunk-dialog"><DialogTitle className="font-display text-4xl">{mode === 'bag' ? 'Your little trunk of joy' : 'Close to your heart'}</DialogTitle><DialogDescription>{mode === 'bag' ? 'A few beautiful things, ready for your next chapter.' : 'The pieces you keep coming back to.'}</DialogDescription><div className="trunk-items">{chosen.map(p => <div className="trunk-item" key={p.id}><img src={p.image} alt={p.name} width={70} height={90}/><div><Button variant="link" onClick={() => {onClose();onSelect(p);}}>{p.name}</Button><p>{formatPrice(p.price)}</p>{mode === 'bag' && <div className="quantity"><Button variant="ghost" size="icon" aria-label={`Decrease ${p.name} quantity`} onClick={() => changeQuantity(p.id,-1)}><Minus/></Button><span>{bag.find(x => x.id === p.id)?.quantity}</span><Button variant="ghost" size="icon" aria-label={`Increase ${p.name} quantity`} onClick={() => changeQuantity(p.id,1)}><Plus/></Button></div>}</div></div>)}{chosen.length === 0 && <div className="empty-state"><Kolam/><h3>{mode === 'bag' ? 'Your trunk is waiting.' : 'Room for a little love.'}</h3><p>A beautiful weave is just around the corner.</p><Button variant="outline" onClick={onClose}>Keep discovering <ArrowUpRight/></Button></div>}</div>{mode === 'bag' && chosen.length > 0 && <div className="trunk-total"><span>Subtotal</span><strong>{formatPrice(total)}</strong><p>Your pieces are saved on this device. Checkout is coming in a future chapter.</p></div>}</DialogContent></Dialog>;
}