# Next Actions - Galantes Jewelry Implementation

## Immediate
1. **Promote the Odoo addon change**
   - Upgrade `galantes_jewelry` in the target Odoo 19 database
   - Confirm `galante.appointment/create_from_api` responds through JSON-2 with real credentials

2. **Run live integration validation**
   - Save the real Odoo API key and database values
   - Exercise `/api/contact` or `/api/v1/appointments` against live Odoo and Google
   - Verify `odooAppointmentId` is returned and visible in Odoo

3. **Tighten observability**
   - Expose Odoo sync details in admin views if needed
   - Decide whether Odoo sync failures should trigger alerts or retries
   - Review the production admin schedule values for booking window start/end, interval, and weekdays

## Short Term
1. Add retry/alert handling for failed Odoo syncs if the business wants stronger guarantees
2. Add admin filtering/reporting by `odooSyncStatus`
3. Add a dedicated regression case for a real Odoo 401/404 response once credentials are present

## Dependencies
- Google Calendar and email flow are already working
- Odoo 19 JSON-2 requires bearer/API-key auth and database selection
- Odoo credentials must be present before live sync can be enabled

## Priority Order
1. Odoo sync service
2. Appointment API integration
3. Functional tests
4. Odoo module-side transaction helper if needed
5. Documentation refresh
