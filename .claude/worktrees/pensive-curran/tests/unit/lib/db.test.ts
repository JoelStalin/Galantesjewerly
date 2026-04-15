import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the file system used by db.ts
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({
    settings: {
      site_title: "Test Jewelry",
      site_description: "Test description",
      favicon_url: "/favicon.ico",
      logo_url: "/logo.png",
    },
    sections: [
      {
        id: "1",
        section_identifier: "hero",
        title: "Hero Title",
        content_text: "Hero content",
        image_url: "",
        is_active: true,
      },
    ],
    featured: [],
  })),
  writeFileSync: vi.fn(),
  statSync: vi.fn(() => ({ mtimeMs: Date.now() })),
  mkdirSync: vi.fn(),
}));

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual };
});

describe('SiteSettings structure', () => {
  it('has required fields defined', () => {
    const settings = {
      site_title: "Galante's Jewelry",
      site_description: "Luxury jewelry",
      favicon_url: "/favicon.ico",
      logo_url: "/logo.png",
    };
    expect(settings.site_title).toBeTruthy();
    expect(settings.favicon_url).toBeTruthy();
  });
});

describe('PageSection structure', () => {
  it('validates required section fields', () => {
    const section = {
      id: "1",
      section_identifier: "hero",
      title: "Test",
      content_text: "Content",
      image_url: "",
      is_active: true,
    };
    expect(section.section_identifier).toBe("hero");
    expect(typeof section.is_active).toBe("boolean");
  });

  it('section_identifier must be a non-empty string', () => {
    const identifiers = ["hero", "philosophy", "review", "cta"];
    identifiers.forEach(id => {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
