require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const {
  handleCreateAppointment,
  handleGoogleAuthCallback,
  handleGoogleAuthStart,
  globalErrorHandler,
} = require('../controllers/appointmentController');

const app = express();
const port = Number(process.env.EXPRESS_PORT || process.env.PORT || 3001);

app.disable('x-powered-by');
app.use(bodyParser.json({ limit: '64kb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '64kb' }));

app.get('/api/v1/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/v1/google/oauth/start', handleGoogleAuthStart);
app.get('/api/v1/google/oauth/callback', handleGoogleAuthCallback);
app.get('/oauth2callback', handleGoogleAuthCallback);
app.post('/api/v1/appointments', handleCreateAppointment);

app.use(globalErrorHandler);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Appointments API listening on port ${port}`);
  });
}

module.exports = app;
