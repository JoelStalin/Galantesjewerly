"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppointmentRecord } from '@/lib/appointments';

type NoticeState = {
  message: string;
  tone: 'error' | 'success';
};

function formatDateTime(date: string, time: string, timezone: string) {
  return `${date} ${time} ${timezone}`;
}

function statusClass(status: string) {
  if (status === 'email_sent') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'calendar_conflict') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (status.endsWith('_failed') || status === 'calendar_failed') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-zinc-200 bg-zinc-50 text-zinc-600';
}

function odooSyncClass(status: AppointmentRecord['odooSyncStatus']) {
  if (status === 'synced') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'failed') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (status === 'skipped') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-zinc-200 bg-zinc-50 text-zinc-600';
}

const ODOO_FILTER_OPTIONS: Array<{ value: 'all' | AppointmentRecord['odooSyncStatus']; label: string }> = [
  { value: 'all', label: 'All Odoo sync states' },
  { value: 'synced', label: 'Synced to Odoo' },
  { value: 'failed', label: 'Failed in Odoo' },
  { value: 'skipped', label: 'Skipped Odoo sync' },
  { value: 'not_attempted', label: 'Not attempted yet' },
];

export default function AppointmentsPanel() {
  const [records, setRecords] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [odooFilter, setOdooFilter] = useState<'all' | AppointmentRecord['odooSyncStatus']>('all');

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const params = new URLSearchParams({ limit: '150' });
      if (odooFilter !== 'all') {
        params.set('odooSyncStatus', odooFilter);
      }

      const response = await fetch(`/api/admin/appointments?${params.toString()}`, {
        cache: 'no-store',
      });

      if (response.status === 401) {
        window.location.replace('/admin/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'load_failed');
      }

      setRecords(data.records || []);
      setNotice({
        message: odooFilter === 'all'
          ? 'Appointments refreshed.'
          : `Showing appointments with Odoo sync "${odooFilter}".`,
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load appointments.';
      setNotice({ message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [odooFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const stats = useMemo(() => {
    return records.reduce(
      (accumulator, record) => {
        accumulator.total += 1;
        if (record.status === 'email_sent') {
          accumulator.confirmed += 1;
        }
        if (record.status === 'calendar_conflict') {
          accumulator.conflicts += 1;
        }
        if (record.status.endsWith('_failed') || record.status === 'calendar_failed') {
          accumulator.failed += 1;
        }
        if (record.odooSyncStatus === 'synced') {
          accumulator.odooSynced += 1;
        }
        if (record.odooSyncStatus === 'failed') {
          accumulator.odooFailed += 1;
        }
        return accumulator;
      },
      { total: 0, confirmed: 0, conflicts: 0, failed: 0, odooSynced: 0, odooFailed: 0 },
    );
  }, [records]);

  return (
    <div data-testid="appointments-panel" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-600">Appointments</p>
            <h2 className="mt-2 text-xl font-serif text-zinc-900">Calendar Requests</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Review booking status, email delivery, Google Calendar links, and Odoo sync evidence without exposing credentials.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <div>
              <label
                htmlFor="appointments-odoo-filter"
                className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500"
              >
                Odoo sync
              </label>
              <select
                id="appointments-odoo-filter"
                data-testid="appointments-odoo-filter"
                value={odooFilter}
                onChange={(event) => setOdooFilter(event.target.value as 'all' | AppointmentRecord['odooSyncStatus'])}
                className="mt-2 min-w-[14rem] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
              >
                {ODOO_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              data-testid="refresh-appointments"
              onClick={loadAppointments}
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {notice && (
          <div
            data-testid="appointments-notice"
            className={`mt-5 rounded-lg border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
          >
            {notice.message}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-6">
          {[
            ['Total', stats.total],
            ['Confirmed', stats.confirmed],
            ['Conflicts', stats.conflicts],
            ['Failed', stats.failed],
            ['Odoo synced', stats.odooSynced],
            ['Odoo failed', stats.odooFailed],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-serif text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {loading && records.length === 0 ? (
          <div className="p-8 text-sm text-zinc-500">Loading appointments...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-sm text-zinc-500">
            {odooFilter === 'all'
              ? 'No appointment requests have been recorded yet.'
              : `No appointments matched the Odoo sync filter "${odooFilter}".`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-left text-sm">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Inquiry</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Odoo</th>
                  <th className="px-4 py-3 font-semibold">Calendar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((record) => (
                  <tr key={record.id} data-testid={`appointment-row-${record.id}`} className="align-top">
                    <td className="px-4 py-4 text-zinc-700">
                      <div className="font-medium text-zinc-900">
                        {formatDateTime(record.appointmentDate, record.appointmentTime, record.timezone)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">{record.durationMinutes} min</div>
                      <div className="mt-1 text-xs text-zinc-400">{new Date(record.createdAt).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4 text-zinc-700">
                      <div className="font-medium text-zinc-900">{record.name}</div>
                      <a className="mt-1 block text-xs text-amber-700 hover:text-amber-800" href={`mailto:${record.email}`}>
                        {record.email}
                      </a>
                      {record.phone && <div className="mt-1 text-xs text-zinc-500">{record.phone}</div>}
                      <div className="mt-2 max-w-xs text-xs leading-5 text-zinc-500">{record.message}</div>
                    </td>
                    <td className="px-4 py-4 text-zinc-700">{record.inquiryType}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}>
                        {record.status}
                      </span>
                      {record.errorMessage && (
                        <div className="mt-2 max-w-xs text-xs leading-5 text-red-600">{record.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-zinc-600">{record.emailDeliveryStatus}</td>
                    <td className="px-4 py-4 text-xs">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${odooSyncClass(record.odooSyncStatus)}`}>
                        {record.odooSyncStatus}
                      </span>
                      {record.odooAppointmentId && (
                        <div className="mt-2 text-zinc-500">Appointment #{record.odooAppointmentId}</div>
                      )}
                      {record.odooPartnerId && (
                        <div className="mt-1 text-zinc-400">Partner #{record.odooPartnerId}</div>
                      )}
                      {record.odooErrorMessage && (
                        <div className="mt-2 max-w-xs text-xs leading-5 text-red-600">{record.odooErrorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {record.googleEventLink ? (
                        <a
                          href={record.googleEventLink}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-amber-700 hover:text-amber-800"
                        >
                          Open event
                        </a>
                      ) : (
                        <span className="text-zinc-400">No event</span>
                      )}
                      {record.googleEventId && <div className="mt-1 max-w-[12rem] truncate text-zinc-400">{record.googleEventId}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
