# Active Contracts

## API Contracts

### Appointment API
- **Endpoint**: POST /api/v1/appointments
- **Input Schema**:
  ```json
  {
    "name": "string (required)",
    "email": "string (required)",
    "date": "string (YYYY-MM-DD, required)",
    "time": "string (HH:MM, required)",
    "duration": "number (minutes, required)",
    "description": "string (optional)",
    "serviceType": "string (optional)",
    "notes": "string (optional)",
    "timezone": "string (optional)",
    "phone": "string (optional)",
    "metadata": "object (optional)"
  }
  ```
- **Response Schema**:
  ```json
  {
    "success": true,
    "appointmentId": "string",
    "googleEventId": "string",
    "odooAppointmentId": "string",
    "message": "string"
  }
  ```

### Google Calendar Integration
- **Scopes**: `https://www.googleapis.com/auth/calendar.events`
- **Calendar ID**: `primary`

### Odoo Integration
- **API**: JSON-2 API
- **Endpoint Shape**: `POST /json/2/<model>/<method>`
- **Authentication**: `Authorization: bearer <api_key>`
- **Database Header**: `X-Odoo-Database: <database>`
- **Models**: `res.partner`, `galante.appointment`
- **Sync Flow**: Next.js -> Odoo (one-way for Phase 1)

### Email Notifications
- **Provider**: SendGrid
- **Fallback**: Log error if email fails after calendar creation

## Data Mapping Contracts

### Appointment -> Google Calendar
```javascript
{
  summary: `Appointment: ${appointment.name}`,
  description: `Service: ${appointment.serviceType}\nNotes: ${appointment.notes}`,
  start: { dateTime: utcDateTime, timeZone: appointment.timezone },
  end: { dateTime: utcEndDateTime, timeZone: appointment.timezone },
  attendees: [{ email: appointment.email }],
  reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] }
}
```

### Appointment -> Odoo
```javascript
{
  url: '/json/2/galante.appointment/create',
  headers: {
    Authorization: 'bearer <api_key>',
    'X-Odoo-Database': 'galantes_db'
  },
  body: {
    name: appointment.name,
    email: appointment.email,
    phone: appointment.phone,
    appointment_date: utcDateTime,
    duration: appointment.duration,
    service_type: appointment.serviceType,
    notes: appointment.notes,
    status: 'confirmed'
  }
}
```

## Integration Points
- Next.js API routes
- Google Calendar API v3
- Odoo JSON-2 API
- SendGrid API

## Version
v1.1 - Odoo JSON-2 preparation
