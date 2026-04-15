# Active Risks

## High Priority Risks

### Odoo Integration Credentials
- **Risk**: Odoo API credentials are missing or invalid
- **Impact**: Appointments cannot be persisted in Odoo
- **Probability**: Medium
- **Mitigation**: Validate configuration before sync and keep Odoo behind `ODOO_ENABLED`
- **Owner**: DevOps

### Odoo API Key Rotation
- **Risk**: JSON-2 API keys expire or are not rotated on time
- **Impact**: Sync starts failing with 401 responses
- **Probability**: Medium
- **Mitigation**: Use a dedicated integration user and rotate keys on a schedule
- **Owner**: DevOps

### Google Calendar API Limits
- **Risk**: Quota exceeded during testing
- **Impact**: Cannot create events
- **Probability**: Low
- **Mitigation**: Keep rate limiting and error handling in place
- **Owner**: Backend

## Medium Priority Risks

### Odoo Transaction Split
- **Risk**: `res.partner` and `galante.appointment` are created in separate JSON-2 calls
- **Impact**: Partial sync can leave inconsistent records
- **Probability**: Medium
- **Mitigation**: Prefer a custom Odoo action method if transactional consistency becomes critical
- **Owner**: Backend

### CLI Provider Availability
- **Risk**: Claude/Codex/Gemini CLI not installed or authenticated
- **Impact**: Cannot use orchestration features
- **Probability**: Medium
- **Mitigation**: Graceful fallback and clear error messages
- **Owner**: DevOps

### Port Conflicts
- **Risk**: Ports 3000 or 8069 are already in use
- **Impact**: Cannot start services locally
- **Probability**: Low
- **Mitigation**: Check availability in setup bot and functional tests
- **Owner**: DevOps

## Low Priority Risks

### Email Delivery Failures
- **Risk**: SendGrid quota or authentication issues
- **Impact**: No email notifications, but appointment can still exist
- **Probability**: Low
- **Mitigation**: Preserve partial-success handling and logs
- **Owner**: Backend

### Timezone Handling
- **Risk**: DST transitions cause incorrect appointment times
- **Impact**: Wrong appointment scheduling
- **Probability**: Low
- **Mitigation**: Continue using UTC internally and validate timezone inputs
- **Owner**: Backend

## Last Updated
2026-04-14 19:45 UTC
