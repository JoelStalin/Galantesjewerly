import { NextResponse } from 'next/server';
import { getAllSections, updateSection, getSettings, updateSettings, getFeaturedItems, addFeaturedItem, updateFeaturedItem, deleteFeaturedItem } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth';

async function requireAdminSession(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const unauthorizedResponse = await requireAdminSession(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const sections = await getAllSections();
    const settings = await getSettings();
    const featured = await getFeaturedItems();
    return NextResponse.json({ sections, settings, featured });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const unauthorizedResponse = await requireAdminSession(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { id, updates, type } = await request.json();

    if (type === 'settings' && updates) {
      const updatedSettings = await updateSettings(updates);
      // Fire and forget CMS sync to Odoo if ready
      import('@/lib/odoo-cms-sync').then(({ syncSettingsToOdoo }) => {
        syncSettingsToOdoo(updatedSettings).catch(err => console.error('CMS Odoo Sync failed:', err));
      });
      return NextResponse.json({ success: true, settings: updatedSettings });
    }

    if (type === 'featured_add' && updates) {
      const newItem = await addFeaturedItem(updates);
      return NextResponse.json({ success: true, featured: newItem });
    }

    if (type === 'featured_update' && id && updates) {
      const updated = await updateFeaturedItem(id, updates);
      if (!updated) return NextResponse.json({ error: 'Featured item not found' }, { status: 404 });
      return NextResponse.json({ success: true, featured: updated });
    }

    if (type === 'section' && id && updates) {
      const updated = await updateSection(id, updates);
      if (!updated) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      return NextResponse.json({ success: true, section: updated });
    }

    return NextResponse.json({ error: 'Invalid payload type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorizedResponse = await requireAdminSession(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { id, type } = await request.json();
    if (type === 'featured_delete' && id) {
      const success = await deleteFeaturedItem(id);
      if (!success) return NextResponse.json({ error: 'Featured item not found' }, { status: 404 });
      return NextResponse.json({ success });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
