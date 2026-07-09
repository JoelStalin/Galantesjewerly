import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import type { FeaturedItem } from '@/lib/db';

const mockItems: FeaturedItem[] = [
  {
    id: 'f1',
    title: 'Destination Weddings',
    content_text: 'Bridal collections for coastal ceremonies.',
    image_url: 'https://example.com/img1.jpg',
    action_text: 'Discover Bridal',
    action_link: '/bridal',
    is_active: true,
    order_index: 0,
  },
  {
    id: 'f2',
    title: 'Nautical Gold',
    content_text: 'Ocean-inspired fine jewelry.',
    image_url: 'https://example.com/img2.jpg',
    action_text: 'View Collections',
    action_link: '/collections',
    is_active: true,
    order_index: 1,
  },
  {
    id: 'f3',
    title: 'Master Repair',
    content_text: 'Expert jewelry and watch restoration.',
    image_url: 'https://example.com/img3.jpg',
    action_text: 'Service Details',
    action_link: '/repairs',
    is_active: true,
    order_index: 2,
  },
];

describe('FeaturedCarousel', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<FeaturedCarousel items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders up to 3 visible items', () => {
    render(<FeaturedCarousel items={mockItems} />);
    expect(screen.getByText('Destination Weddings')).toBeInTheDocument();
    expect(screen.getByText('Nautical Gold')).toBeInTheDocument();
    expect(screen.getByText('Master Repair')).toBeInTheDocument();
  });

  it('renders action links for each item', () => {
    render(<FeaturedCarousel items={mockItems} />);
    expect(screen.getByText('Discover Bridal')).toBeInTheDocument();
    expect(screen.getByText('View Collections')).toBeInTheDocument();
  });

  it('does not render pagination dots when 3 or fewer items', () => {
    render(<FeaturedCarousel items={mockItems} />);
    // Dots only appear when items.length > 3
    const dots = screen.queryAllByRole('button', { name: /Ver colección/ });
    expect(dots).toHaveLength(0);
  });

  it('renders pagination dots when more than 3 items', () => {
    const extraItem: FeaturedItem = {
      id: 'f4',
      title: 'Extra Item',
      content_text: 'Extra.',
      image_url: '',
      action_text: 'View',
      action_link: '/',
      is_active: true,
      order_index: 3,
    };
    render(<FeaturedCarousel items={[...mockItems, extraItem]} />);
    const dots = screen.getAllByRole('button', { name: /Ver colección/ });
    expect(dots.length).toBe(4);
  });
});
