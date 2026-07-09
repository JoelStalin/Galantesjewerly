# Appointments, Google Calendar, and Gmail Setup

## Runtime Model

The contact form creates real appointment records through the backend only:

1. Customer submits `/contact` with date and time.
2. `app/api/contact/route.ts` validates the payload server-side.
3. The backend checks Google Calendar free/busy for the requested interval.
4. If busy, the backend returns HTTP 409 and no event is created.
5. If free, the backend creates a Google Calendar event.
6. The backend sends a Gmail notification through SMTP.
7. A local audit record is written to `data/appointments.json`.

Secrets are stored encrypted in `data/integrations.json` and are edited from:

```text
https://galantesjewelry.com/admin/dashboard
Tab: Integrations & OAuth
Section: Google Calendar and Gmail
```

## Admin Fields

Configure these per environment:

| Field | Production value |
| --- | --- |
| Google Calendar enabled | On |
| Google Calendar ID | Calendar address from Google Calendar settings, or `primary` only when the service account owns that calendar |
| Google service account email | `name@project-id.iam.gserviceaccount.com` |
| Google private key | Private key from the service account JSON |
| Gmail notifications enabled | On |
| Gmail recipient inbox | `ceo@galantesjewelry.com` |
| Gmail sender | `joelstalin2105@gmail.com` |
| Gmail app password | 16-character Google app password for the sender account |
| Appointment duration minutes | `60` |
| Appointment timezone | `America/New_York` |

## Google Calendar Service Account

Recommended setup:

1. In Google Cloud, enable Google Calendar API.
2. Create a service account in the same project.
3. Create a JSON key for that service account.
4. Copy the service account `client_email` into the admin panel.
5. Copy the `private_key` into the admin panel.
6. In Google Calendar, create or choose the appointment calendar.
7. Open Calendar settings, then "Share with specific people or groups".
8. Add the service account email.
9. Grant "Make changes to events".
10. Copy the calendar ID from "Integrate calendar" into the admin panel.

For consumer Gmail calendars, sharing a dedicated calendar with the service account is the simplest secure model.

## Gmail SMTP

Recommended setup:

1. Use `joelstalin2105@gmail.com` as the sending account.
2. Enable 2-Step Verification on that Google account.
3. Create a Google App Password for Mail.
4. Put `joelstalin2105@gmail.com` in "Gmail sender".
5. Put the app password in "Gmail SMTP App Password".
6. Put `ceo@galantesjewelry.com` in "Gmail recipient inbox".
7. Use the "Test Calendar and Gmail" button in admin.

## Contact API Responses

| Response | Meaning |
| --- | --- |
| `200` | Calendar event created and Gmail notification sent |
| `400` | Invalid form payload |
| `409` | Requested time is already occupied |
| `429` | Too many submissions from the same IP |
| `500` | Calendar/configuration failure before a successful notification |
| `502` | Calendar event was created, but Gmail notification failed |

## Test Command

After `npm run build`, run:

```bash
npm run test:appointments
npm run e2e:appointments
```

The test command starts local Next.js servers with `APPOINTMENT_TEST_MODE` and covers:

- successful appointment
- occupied slot rejection
- Google Calendar failure
- Gmail delivery failure
- admin settings persistence
- secrets not serialized to the admin JSON response

`npm run e2e:appointments` also drives the public `/contact` page through Selenium with the same local Chrome profile strategy used by the rest of the repo. It starts a local production server in `APPOINTMENT_TEST_MODE=success`, saves Calendar/Gmail settings, submits the public form, and verifies `appointments.json` recorded the mock Calendar event and email delivery.

## Security Notes

- Never expose Google private keys or Gmail app passwords in client components.
- Keep `APPOINTMENT_ENCRYPTION_KEY` in production environment secrets only.
- Do not commit `data/integrations.json` or service account JSON files.
- Rotate the Gmail app password and service account key if pasted into chat, logs, screenshots, or Downloads.
- Logs must contain sanitized error messages only.

## Official References

- Google Calendar event creation: https://developers.google.com/workspace/calendar/api/guides/create-events
- Google Calendar free/busy API: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Google service accounts: https://cloud.google.com/iam/docs/service-account-overview
- Google app passwords: https://support.google.com/accounts/answer/185833
