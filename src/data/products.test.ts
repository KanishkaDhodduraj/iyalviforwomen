import { describe, expect, it, beforeEach } from 'vitest';
import { products, filterProducts } from './products';
import { nextFestival, countdown } from './festivals';
import { usePrototype } from './store';

describe('IYALVI mock collection', () => {
  it('contains exactly 40 unique complete mock products', () => {
    expect(products).toHaveLength(40);
    expect(new Set(products.map(p => p.id)).size).toBe(40);
    expect(products.every(p => p.price > 0 && p.fabric && p.craftOrigin && p.colors.length && p.sizes.length && p.image)).toBe(true);
  });
  it('filters occasions and matching weave terms together', () => {
    const results = filterProducts('silk', 'Diwali');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(p => p.occasion === 'Diwali' && p.fabric.toLowerCase().includes('silk'))).toBe(true);
    expect(filterProducts('not-a-weave')).toHaveLength(0);
  });
});
describe('Upcoming festival countdown', () => {
  it('selects Diwali on November 8, 2026 before Pongal', () => {
    expect(nextFestival(new Date('2026-10-14T06:25:00Z'))).toEqual({name:'Diwali',date:'2026-11-08T00:00:00+05:30'});
  });
  it('moves to Pongal on January 15, 2027 once Diwali has passed', () => {
    expect(nextFestival(new Date('2026-11-09T00:00:00Z'))?.name).toBe('Pongal');
  });
  it('never displays a negative countdown', () => {
    expect(countdown('2026-11-08T00:00:00+05:30',new Date('2026-11-09T00:00:00Z'))).toEqual({days:0,hours:0,minutes:0,seconds:0});
  });
});
describe('Local prototype interactions', () => {
  beforeEach(() => usePrototype.setState({bag:[],wishlist:[],recent:[],subscribers:[]}));
  it('adds repeated items and removes zero-quantity items', () => {
    usePrototype.getState().addToBag('iy-001');
    usePrototype.getState().addToBag('iy-001');
    expect(usePrototype.getState().bag).toEqual([{id:'iy-001',quantity:2}]);
    usePrototype.getState().changeQuantity('iy-001',-2);
    expect(usePrototype.getState().bag).toEqual([]);
  });
  it('saves and unsaves wishlist items', () => {
    usePrototype.getState().toggleWish('iy-001');
    expect(usePrototype.getState().wishlist).toEqual(['iy-001']);
    usePrototype.getState().toggleWish('iy-001');
    expect(usePrototype.getState().wishlist).toEqual([]);
  });
  it('keeps at most five unique recent searches', () => {
    ['silk','teal','gold','rose','Diwali','Pongal','silk'].forEach(s => usePrototype.getState().rememberSearch(s));
    expect(usePrototype.getState().recent).toEqual(['silk','Pongal','Diwali','rose','gold']);
  });
});