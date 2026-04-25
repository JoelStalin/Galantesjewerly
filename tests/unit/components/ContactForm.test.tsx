import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '@/components/ContactForm';

describe('ContactForm', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the appointment conflict buffer caption from availability config', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        availableSlots: [],
        timezone: 'America/New_York',
        durationMinutes: 60,
        startTime: '09:00',
        endTime: '18:00',
        slotIntervalMinutes: 30,
        availableWeekdays: [1, 2, 3, 4, 5],
        conflictBufferMinutes: 5,
      }),
    });

    render(<ContactForm />);

    await waitFor(() => {
      expect(screen.getByText(/5-minute protection window/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/contact/availability', { cache: 'no-store' });
  });
});
