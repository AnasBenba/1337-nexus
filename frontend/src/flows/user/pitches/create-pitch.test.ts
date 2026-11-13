import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './CreatePitchPage';

describe('Pitch Creation Categories', () => {
  it('contains all 10 standard 1337 project categories', () => {
    expect(CATEGORIES.length).toBe(10);
    const categoryIds = CATEGORIES.map((cat) => cat.id);
    expect(categoryIds).toContain('Technology');
    expect(categoryIds).toContain('Education');
    expect(categoryIds).toContain('Social Impact');
    expect(categoryIds).toContain('Entertainment');
    expect(categoryIds).toContain('Business');
    expect(categoryIds).toContain('Environment');
    expect(categoryIds).toContain('Finance');
    expect(categoryIds).toContain('Health');
    expect(categoryIds).toContain('Food & Beverage');
    expect(categoryIds).toContain('Fashion & Design');
  });

  it('each category defines an icon, badge, and description', () => {
    for (const cat of CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.badge).toBeTruthy();
      expect(cat.description).toBeTruthy();
    }
  });
});
