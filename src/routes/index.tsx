import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, ArrowLeft, Search, Heart, ShoppingBag, ChevronDown, Menu, X, Sparkles, Flower2, Home, Instagram, MoveDown, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Brand, Kolam, Diya } from '@/components/iyalvi/motifs';
import { LoomLoader, KolamCursor, PleatReveal } from '@/components/iyalvi/effects';
import { ProductCard, SearchDialog, ProductDialog, TrunkDialog } from '@/components/iyalvi/discovery';
import { usePrototype, type Locale } from '@/data/store';
import translations from '@/data/translations.json';
import { featuredProducts, occasions, type Product } from '@/data/products';
import { nextFestival, countdown } from '@/data/festivals';
import hero from '@/assets/iyalvi-hero.jpg';
import teal from '@/assets/teal-saree.jpg';
import gold from '@/assets/gold-saree.jpg';
import rose from '@/assets/rose-saree.jpg';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    {title: 'IYALVI — Woven in Heritage. Worn in Grace.'},
    {name: 'description', content: 'Discover the IYALVI heirloom edit: Indian silks, timeless sarees and stories of Kanchipuram, Banarasi, Chanderi and Ikat.'},
    {property: 'og:title', content: 'IYALVI — Threads of Tradition'},
    {property: 'og:description', content: 'Indian heritage, woven into silks for your every celebration. Discover your next heirloom.'},
    {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'},
  ] }),
  component: Index,
});

const occasionDetails = [
  {name:'Wedding', label:'For your forever', image:rose, tone:'rose', icon:'✧'},
  {name:'Pongal', label:'A golden beginning', image:gold, tone:'gold', icon:'☀'},
  {name:'Diwali', label:'Let your light shine', image:hero, tone:'maroon', icon:'✦'},
  {name:'Navratri', label:'Nine nights of colour', image:teal, tone:'teal', icon:'❋'},
  {name:'Office', label:'Quietly extraordinary', image:teal, tone:'indigo', icon:'◇'},
  {name:'Sangeet', label:'A little dance of joy', image:rose, tone:'rose', icon:'♪'},
  {name:'Pooja', label:'Wrapped in devotion', image:gold, tone:'gold', icon:'✧'},
  {name:'Casual', label:'Beautiful, every day', image:teal, tone:'teal', icon:'❋'},
];
const crafts = [
  {name:'Kanchipuram', state:'TAMIL NADU', image:hero, text:'Temple tales, told in silk.', body:'Rich mulberry silk, contrasting borders and intricate zari carry the architectural memory of Tamil Nadu. A Kanchipuram weave is a celebration of patience, skill and continuity.'},
  {name:'Banarasi', state:'UTTAR PRADESH', image:rose, text:'Poetry in every golden thread.', body:'From the lanes of Varanasi come silks scattered with floral buti and shimmering brocade. The Banarasi tradition draws together delicate patterns and generations of weaving knowledge.'},
  {name:'Chanderi', state:'MADHYA PRADESH', image:gold, text:'Light as a whispered memory.', body:'Airy silk-cotton, a gentle sheen and delicately woven motifs define Chanderi. These light, graceful fabrics make room for quiet beauty in everyday celebrations.'},
  {name:'Ikat', state:'TELANGANA', image:teal, text:'Colour with a rhythm of its own.', body:'In Ikat, yarns are carefully resist-dyed before they meet the loom. The resulting geometric patterns carry a distinctive softened edge, a signature of the craft and its precision.'},
];

function Index() {
  const state = usePrototype();
  const t = translations[state.locale];
  const [search, setSearch] = useState(false);
  const [searchCategory, setSearchCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchKey, setSearchKey] = useState(0);
  const [selected, setSelected] = useState<Product | null>(null);
  const [trunk, setTrunk] = useState<'bag' | 'wishlist' | null>(null);
  const [menu, setMenu] = useState(false);
  const [story, setStory] = useState<typeof crafts[number] | 'brand' | 'help' | null>(null);
  const [toast, setToast] = useState('');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const occasionRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({target: heroRef, offset:['start start','end start']});
  const parallax = useTransform(scrollYProgress,[0,1],[0,90]);
  const bagCount = state.bag.reduce((sum,p) => sum + p.quantity,0);
  const festival = now ? nextFestival(now) : null;
  const remaining = now && festival ? countdown(festival.date,now) : null;
  useEffect(() => { void usePrototype.persist.rehydrate(); setNow(new Date()); const timer=setInterval(() => setNow(new Date()),1000); return () => clearInterval(timer); }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark',state.theme === 'dusk'); document.documentElement.lang=state.locale; },[state.theme,state.locale]);
  useEffect(() => { const handler=(e:KeyboardEvent) => { if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){e.preventDefault();setSearchCategory('All');setSearchQuery('');setSearchKey(v=>v+1);setSearch(v=>!v);} };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler); },[]);
  useEffect(() => {if (!toast) return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer);},[toast]);
  const openCollection=(category='All',query='')=>{setSearchCategory(category);setSearchQuery(query);setSearchKey(v=>v+1);setSearch(true);setMenu(false);};
  const scrollTo=(id:string)=>{document.getElementById(id)?.scrollIntoView({behavior:reduced?'instant':'smooth'});setMenu(false);};
  return <div className="iyalvi-app">
    <LoomLoader/><KolamCursor/><PleatReveal value={`${state.locale}-${state.theme}`}/>
    <div className="announcement"><Kolam/><span>{t.announcement}</span><Kolam/><span className="announcement-right">Thoughtfully woven. Forever treasured.</span></div>
    <header className="site-header">
      <div className="header-main page-width"><div className="header-left"><Button className="mobile-menu" size="icon" variant="ghost" aria-label={menu?'Close menu':'Open menu'} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</Button><span className="header-origin">ROOTED IN INDIA.<br/>MADE FOR YOUR STORY.</span></div><Button variant="ghost" className="brand-home" aria-label="IYALVI home" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><Brand/></Button><div className="header-tools"><select aria-label="Language" value={state.locale} onChange={e=>state.setLocale(e.target.value as Locale)}><option value="en">EN</option><option value="ta">தமிழ்</option><option value="hi">हिन्दी</option></select><Button variant="ghost" size="icon" aria-label={`Switch to ${state.theme==='day'?'Dusk':'Day'} theme`} title={state.theme==='day'?'Dusk':'Day'} onClick={()=>state.setTheme(state.theme==='day'?'dusk':'day')}><Diya className="diya"/></Button><span className="tool-divider"/><Button variant="ghost" size="icon" aria-label="Search" onClick={()=>openCollection()}><Search/></Button><Button variant="ghost" size="icon" aria-label="Wishlist" onClick={()=>setTrunk('wishlist')}><Heart/>{state.wishlist.length>0&&<span className="icon-count">{state.wishlist.length}</span>}</Button><Button variant="ghost" size="icon" className="bag-icon" aria-label={`Shopping bag, ${bagCount} items`} onClick={()=>setTrunk('bag')}><ShoppingBag/><span className="icon-count">{bagCount}</span></Button></div></div>
      <nav className={`desktop-nav ${menu?'menu-is-open':''}`} aria-label="Main navigation"><Button variant="link" onClick={()=>openCollection()}>{t.new}<span className="new-dot"/></Button><Button variant="link" onClick={()=>openCollection('All','saree')}>{t.sarees}<ChevronDown/></Button><Button variant="link" onClick={()=>scrollTo('occasions')}>{t.occasion}<ChevronDown/></Button><Button variant="link" onClick={()=>scrollTo('craft')}>{t.craft}</Button><Button variant="link" onClick={()=>setStory('brand')}>{t.story}</Button><span className="nav-special"><Sparkles size={13}/> THE HEIRLOOM EDIT</span></nav>
    </header>
    <main>
      <section className="hero" ref={heroRef}><motion.img className="hero-photo" src={hero} width={1792} height={1024} alt="A woman in a maroon Kanchipuram silk saree with gold zari at a heritage temple" fetchPriority="high" style={reduced ? {} : {y:parallax}}/><div className="hero-shade"/><div className="hero-arch" aria-hidden="true"/><div className="hero-content page-width"><motion.div initial={reduced?false:{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.8,delay:.15}}><div className="hero-eyebrow"><span/>{t.eyebrow}</div><h1><span>{t.hero1}</span><em>{t.hero2}</em></h1><p>{t.description}</p><div className="hero-actions"><Button className="hero-cta magnetic" size="lg" onClick={()=>openCollection()}>{t.explore}<ArrowUpRight/></Button><Button className="hero-story" variant="link" onClick={()=>setStory('brand')}>{t.discover}<ArrowRight/></Button></div><div className="hero-footnote"><Kolam/><span>NOT JUST WORN. <b>REMEMBERED.</b></span></div></motion.div></div><span className="hero-side">A HERITAGE THAT LIVES ON</span><div className="hero-bottom"><Button variant="ghost" onClick={()=>scrollTo('occasions')} className="scroll-cue"><MoveDown/>A world of weaves awaits</Button><span className="hero-pagination"><b>01</b><span/><small>03</small></span><span className="hero-caption">THE KANCHIPURAM STORY <ArrowUpRight size={14}/></span></div></section>
      <div className="heritage-ribbon"><span>ROOTED IN HERITAGE</span><Kolam/><span>WOVEN WITH LOVE</span><Kolam/><span>MADE FOR GENERATIONS</span><Kolam/><span>CELEBRATE YOUR ROOTS</span><Kolam/><span>ROOTED IN HERITAGE</span></div>
      <section id="occasions" className="section page-width occasion-section"><div className="section-heading"><div><span className="eyebrow">LIFE IS AN OCCASION</span><h2>{t.occasionTitle}</h2><p>{t.occasionSub}</p></div><div className="carousel-arrows"><Button variant="outline" size="icon" aria-label="Previous occasions" onClick={()=>occasionRef.current?.scrollBy({left:-350,behavior:'smooth'})}><ArrowLeft/></Button><Button variant="outline" size="icon" aria-label="Next occasions" onClick={()=>occasionRef.current?.scrollBy({left:350,behavior:'smooth'})}><ArrowRight/></Button></div></div><div className="occasion-carousel" ref={occasionRef}>{occasionDetails.map((o,i)=><Button key={o.name} variant="ghost" className={`occasion-card occasion-${o.tone}`} onClick={()=>openCollection(o.name)} data-drape><div className="occasion-image"><img src={o.image} alt={`${o.name} saree inspiration`} width={768} height={1024} loading="lazy"/><span className="occasion-number">0{i+1}</span><span className="occasion-motif">{o.icon}</span></div><div className="occasion-text"><h3>{o.name}<ArrowUpRight/></h3><p>{o.label}</p></div></Button>)}</div></section>
      <section className="festival-banner"><div className="festival-inner page-width"><Kolam className="festival-kolam"/><div><span className="eyebrow">THE SEASON OF LIGHT, LOVE & LITTLE JOYS</span><h2>{festival ? `${festival.name} is in the air.` : 'A celebration is on its way.'}</h2><p>Dress for the memories you’re about to make.</p></div><div className="countdown">{(['days','hours','minutes'] as const).map(unit=><div key={unit}><strong>{remaining ? String(remaining[unit]).padStart(2,'0') : '—'}</strong><span>{unit}</span></div>)}</div><Button variant="outline" className="festival-cta" onClick={()=>openCollection(festival?.name ?? 'All')}>Find your festive glow<ArrowUpRight/></Button></div></section>
      <section className="section page-width favorites-section"><div className="section-heading"><div><span className="eyebrow">THE HEIRLOOM EDIT</span><h2>{t.pieces}</h2><p>Meet the weaves we can’t stop falling for.</p></div><Button variant="link" className="section-link" onClick={()=>openCollection()}>Discover all weaves<ArrowUpRight/></Button></div><div className="product-grid">{featuredProducts.map(p=><ProductCard key={p.id} product={p} onSelect={setSelected}/>)}</div></section>
      <div className="zari-divider"><span/><Kolam/><span/></div>
      <section id="craft" className="section page-width craft-section"><div className="craft-intro"><span className="eyebrow">THE HANDS BEHIND THE HERITAGE</span><h2>{t.craftTitle}</h2><p>Every weave has a hometown. Every thread, a story.<br/>Come a little closer to the crafts that make us.</p></div><div className="craft-grid">{crafts.map((c,i)=><Button variant="ghost" className={`craft-card craft-card-${i}`} key={c.name} onClick={()=>setStory(c)}><img src={c.image} alt={`${c.name} textile tradition`} width={768} height={1024} loading="lazy"/><div className="craft-shade"/><span className="craft-no">0{i+1} / THE WEAVE JOURNAL</span><div className="craft-card-text"><span>{c.state}</span><h3>{c.name}</h3><p>{c.text}</p><span className="craft-read">Unravel the story <ArrowUpRight/></span></div></Button>)}</div></section>
      <section className="community-section"><div className="page-width"><div className="section-heading"><div><span className="eyebrow">YOUR MOMENTS. OUR WEAVES.</span><h2>{t.community}</h2><p>The most beautiful part of IYALVI? You.</p></div><span className="community-hashtag"><Instagram size={18}/> #MyIyalviStory</span></div><div className="community-grid">{[teal,rose,gold,hero].map((image,i)=><Button variant="ghost" className="community-photo" key={image} onClick={()=>{setSelected(featuredProducts[i] ?? null);}} data-drape><img src={image} alt={`IYALVI styling inspiration ${i+1}`} width={768} height={1024} loading="lazy"/><span><Instagram size={17}/> @iyalvi.muse</span></Button>)}</div><p className="community-note">Campaign inspiration · your real stories will live here soon.</p></div></section>
      <section className="testimonials section page-width"><Kolam/><span className="eyebrow">LOVE, IN YOUR WORDS</span><blockquote>“It felt like wearing a piece of home.<br/>The silk, the colour, the little details — pure love.”</blockquote><div className="review-stars">✦ ✦ ✦ ✦ ✦</div><p>ANANYA R. <span>·</span> CHENNAI</p><small>A little imagined love for our prototype</small></section>
      <section className="newsletter"><div className="page-width newsletter-inner"><div><span className="eyebrow">LET’S KEEP A THREAD BETWEEN US</span><h2>{t.newsletter}</h2><p>New weaves, old stories, and little joys. Only the good things.</p></div><form onSubmit={e=>{e.preventDefault();state.subscribe(email);setSubscribed(true);setToast('A little thread between us. You’re on the list, on this device.');}}><div className="newsletter-input"><Input type="email" required value={email} onChange={e=>{setEmail(e.target.value);setSubscribed(false);}} placeholder={t.email} aria-label="Newsletter email"/><Button type="submit" variant="ghost">{subscribed?<><Check/>You’re on the list</>:<>{t.subscribe}<ArrowRight/></>}</Button></div><span>No noise. Just notes from the heart. Saved locally for this preview.</span></form><Kolam className="newsletter-motif"/></div></section>
    </main>
    <footer className="site-footer page-width"><div className="footer-main"><div className="footer-brand"><Brand/><p>Woven in Heritage. Worn in Grace.</p><span>From our roots, to your wardrobe.<br/>With love, from India.</span></div><div><h3>Discover</h3>{['New arrivals','Sarees','Occasion wear','The heirloom edit'].map((label,i)=><Button variant="link" key={label} onClick={()=>i===2?scrollTo('occasions'):openCollection()}>{label}</Button>)}</div><div><h3>A little closer</h3><Button variant="link" onClick={()=>setStory('brand')}>Our story</Button><Button variant="link" onClick={()=>scrollTo('craft')}>Our crafts</Button><Button variant="link" onClick={()=>scrollTo('occasions')}>Our celebrations</Button><Button variant="link" onClick={()=>setStory('help')}>Care for your weaves</Button></div><div className="footer-contact"><h3>We’re here for you</h3><Button variant="link" onClick={()=>setStory('help')}><Mail/>Let’s talk</Button><p>A little help, a little care.<br/>Always from the heart.</p><Kolam/></div></div><div className="footer-bottom"><span>© {now?.getFullYear() ?? 2026} IYALVI. All stories, lovingly woven.</span><span>ROOTED IN INDIA <Kolam/> REACHING YOUR HEART</span><span>Prototype · made with love</span></div></footer>
    <nav className="mobile-bottom" aria-label="Mobile navigation"><Button variant="ghost" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><Home/><span>Home</span></Button><Button variant="ghost" onClick={()=>openCollection()}><Search/><span>Discover</span></Button><Button variant="ghost" onClick={()=>setTrunk('wishlist')}><Heart/><span>Loved</span></Button><Button variant="ghost" onClick={()=>setTrunk('bag')}><ShoppingBag/><span>Trunk ({bagCount})</span></Button></nav>
    <SearchDialog key={searchKey} open={search} onOpenChange={setSearch} onSelect={setSelected} initialCategory={searchCategory} initialQuery={searchQuery}/><ProductDialog product={selected} onClose={()=>setSelected(null)} notify={setToast}/><TrunkDialog mode={trunk} onClose={()=>setTrunk(null)} onSelect={setSelected}/>
    <Dialog open={Boolean(story)} onOpenChange={v=>{if(!v)setStory(null);}}><DialogContent className="story-dialog"><Kolam/>{typeof story==='object' && story ? <><span className="eyebrow">{story.state} · THE WEAVE JOURNAL</span><DialogTitle className="font-display text-4xl">{story.name}</DialogTitle><img src={story.image} alt={story.name} width={768} height={1024}/><DialogDescription>{story.body}</DialogDescription><Button onClick={()=>{openCollection('All',story.name);setStory(null);}}>Discover this weave<ArrowUpRight/></Button></> : <><DialogTitle className="font-display text-4xl">{story==='help'?'A little care goes a long way.':'Our roots. Your story.'}</DialogTitle><DialogDescription>{story==='help'?'Give your silk room to breathe. Store folded in a soft cotton cloth, away from direct sunlight. Refold occasionally, and trust a specialist dry cleaner with your precious weaves. Customer support and ordering will arrive in a future chapter.':'IYALVI is an ode to the things we carry — the warmth of home, the joy of celebration, and the beauty of a craft passed from one generation to the next. We imagine a wardrobe where Indian heritage feels deeply personal, and every weave becomes part of your story.'}</DialogDescription><p className="story-tagline">Woven in Heritage. Worn in Grace.</p><small>Brand story and collection details are illustrative for this prototype.</small></>}</DialogContent></Dialog>
    {toast && <motion.div className="silk-toast" role="status" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}><Kolam/><span>{toast}</span><Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={()=>setToast('')}><X/></Button></motion.div>}
  </div>;
}
