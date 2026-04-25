/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { buildCalendarEventSummary } from '@/lib/google-calendar';

describe('buildCalendarEventSummary', () => {
  it('concatenates inquiry type with customer name', () => {
    expect(buildCalendarEventSummary({
      inquiryType: 'Bridal & Engagement',
      name: 'Ana Marina',
    })).toBe('Bridal & Engagement - Ana Marina');
  });

  it('normalizes repeated spaces before composing the title', () => {
    expect(buildCalendarEventSummary({
      inquiryType: '  General   Inquiry  ',
      name: '  Joel   Galante ',
    })).toBe('General Inquiry - Joel Galante');
  });
});
