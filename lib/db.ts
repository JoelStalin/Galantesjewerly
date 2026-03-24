import fs from 'fs/promises';
import path from 'path';

export interface PageSection {
  id: string;
  section_identifier: string;    
  title: string;
  subtitle?: string;
  content_text: string;
  image_url: string;
  action_link?: string;
  action_text?: string;
  is_active: boolean;
}

export interface SiteSettings {
  favicon_url: string;
  logo_url: string;
  site_title: string;
  site_description: string;
  instagram_url?: string;
  facebook_url?: string;
  whatsapp_number?: string;
}

export interface FeaturedItem {
  id: string;
  title: string;
  content_text: string;
  image_url: string;
  action_text: string;
  action_link: string;
  is_active: boolean;
  order_index: number;
}

interface DBData {
  settings: SiteSettings;
  sections: PageSection[];
  featured_items: FeaturedItem[];
}

const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'cms.json');

const INITIAL_DATA: DBData = {
  settings: {
    favicon_url: '/favicon.ico',
    logo_url: '/assets/branding/logo.png',
    site_title: "Galante's Jewelry by the Sea | Coastal Fine Jewelry",
    site_description: 'Luxury jewelry boutique in Islamorada focused on bridal pieces, nautical collections, repairs, and private consultations.',
    instagram_url: 'https://instagram.com/',
    facebook_url: 'https://facebook.com/',
    whatsapp_number: ''
  },
  sections: [
    {
      id: '1',
      section_identifier: 'hero',
      title: "Galante's Jewelry by the Sea",
      content_text: "The Coastal Concierge",
      image_url: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2844&auto=format&fit=crop",
      action_text: "Book Appointment",
      action_link: "/contact",
      is_active: true
    },
    {
      id: '2',
      section_identifier: 'philosophy',
      title: "Barefoot Luxury from Islamorada",
      content_text: "We curate and craft fine nautical jewelry designed to celebrate the spirit of the Florida Keys. Whether you are marking an anniversary, planning a destination wedding, or restoring an heirloom timepiece, our concierge service ensures every detail is attended to with master craftsmanship.",
      image_url: "",
      is_active: true
    },
    {
      id: '6',
      section_identifier: 'review',
      title: "Words from Our Patrons",
      content_text: "\"Galante's created the most breathtaking engagement ring for my fiancé. Their attention to detail and personal concierge service made our Islamorada trip truly unforgettable.\"",
      subtitle: "— Sarah & James, Florida",
      image_url: "",
      is_active: true
    },
    {
      id: '7',
      section_identifier: 'cta',
      title: "Begin Your Story",
      content_text: "Whether you are visiting the Florida Keys or are a local resident, we invite you to experience jewelry curation as it should be.",
      action_text: "Schedule Your Consultation",
      action_link: "/contact",
      image_url: "",
      is_active: true
    }
  ],
  featured_items: [
    {
      id: 'f1',
      title: "Destination Weddings",
      content_text: "Bespoke engagement rings and wedding bands designed to capture your moment by the sea.",
      image_url: "https://images.unsplash.com/photo-1599643478514-4a52023960c1?q=80&w=1471&auto=format&fit=crop",
      action_text: "Discover Bridal",
      action_link: "/bridal",
      is_active: true,
      order_index: 0
    },
    {
      id: 'f2',
      title: "Nautical Gold & Silver",
      content_text: "Signature pieces honoring our coastal heritage, from mariner links to compass pendants.",
      image_url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=1587&auto=format&fit=crop",
      action_text: "View Collections",
      action_link: "/collections",
      is_active: true,
      order_index: 1
    },
    {
      id: 'f3',
      title: "Master Repair",
      content_text: "Entrust your cherished watches and heirlooms to our master jewelers for restoration.",
      image_url: "https://images.unsplash.com/photo-1584811644165-4f367e1a3962?q=80&w=1626&auto=format&fit=crop",
      action_text: "Service Details",
      action_link: "/repairs",
      is_active: true,
      order_index: 2
    }
  ]
};

let memCache: DBData | null = null;
let initPromise: Promise<void> | null = null;

async function performInit() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {}
  
  try {
    const fileContent = await fs.readFile(dbFile, 'utf-8');
    const parsed = JSON.parse(fileContent) as any;
    
    // Migration logic moved here to run only once per process
    let needsUpdate = false;
    if (!parsed.featured_items) {
      parsed.featured_items = INITIAL_DATA.featured_items;
      parsed.sections = (parsed.sections || []).filter((s: any) => !s.section_identifier.startsWith('featured_'));
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await fs.writeFile(dbFile, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    memCache = parsed;
  } catch {
    await fs.writeFile(dbFile, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
    memCache = INITIAL_DATA;
  }
}

async function initDB() {
  if (!initPromise) {
    initPromise = performInit();
  }
  return initPromise;
}

async function readDB(): Promise<DBData> {
  await initDB();
  if (memCache) return memCache;
  const fileContent = await fs.readFile(dbFile, 'utf-8');
  return JSON.parse(fileContent);
}

async function writeDB(data: DBData) {
  memCache = data;
  await fs.writeFile(dbFile, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const data = await readDB();
    return data.settings || INITIAL_DATA.settings;
  } catch {
    return INITIAL_DATA.settings;
  }
}

export async function updateSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
  const data = await readDB();
  data.settings = { ...data.settings, ...updates };
  await writeDB(data);
  return data.settings;
}

export async function getAllSections(): Promise<PageSection[]> {
  try {
    const data = await readDB();
    return data.sections || INITIAL_DATA.sections;
  } catch {
    return INITIAL_DATA.sections;
  }
}

export async function updateSection(id: string, updates: Partial<PageSection>): Promise<PageSection | null> {
  const data = await readDB();
  const index = data.sections.findIndex(s => s.id === id);
  if (index === -1) return null;

  data.sections[index] = { ...data.sections[index], ...updates };
  await writeDB(data);
  return data.sections[index];
}

export async function getFeaturedItems(): Promise<FeaturedItem[]> {
  try {
    const data = await readDB();
    const items = data.featured_items || INITIAL_DATA.featured_items;
    return items.sort((a, b) => a.order_index - b.order_index);
  } catch {
    return INITIAL_DATA.featured_items;
  }
}

export async function addFeaturedItem(item: Omit<FeaturedItem, 'id'>): Promise<FeaturedItem> {
  const data = await readDB();
  const newItem = { ...item, id: 'f_' + Date.now().toString() };
  data.featured_items.push(newItem);
  await writeDB(data);
  return newItem;
}

export async function updateFeaturedItem(id: string, updates: Partial<FeaturedItem>): Promise<FeaturedItem | null> {
  const data = await readDB();
  const index = data.featured_items.findIndex(s => s.id === id);
  if (index === -1) return null;

  data.featured_items[index] = { ...data.featured_items[index], ...updates };
  await writeDB(data);
  return data.featured_items[index];
}

export async function deleteFeaturedItem(id: string): Promise<boolean> {
  const data = await readDB();
  const initialLength = data.featured_items.length;
  data.featured_items = data.featured_items.filter(s => s.id !== id);
  if (data.featured_items.length !== initialLength) {
    await writeDB(data);
    return true;
  }
  return false;
}
