# Production operations: Teksher Hub

This runbook covers routine checks for the production frontend, API, PostgreSQL database, and user uploads.

## Production resources

- Frontend (Netlify): https://teksher-hub.netlify.app/
- Frontend (Cloudflare Workers): https://teksher-hub.islamzhakypbekov0.workers.dev/
- API: https://teksher-hub-api.onrender.com
- API health endpoint: https://teksher-hub-api.onrender.com/api/health
- Render API service: https://dashboard.render.com/web/srv-dbdi3ecs728c73c1vpqg
- Render PostgreSQL: https://dashboard.render.com/d/dpg-dbdi2ucs728c73c1ud80-a
- Netlify project: https://app.netlify.com/projects/teksher-hub

## Before and after a deployment

1. Confirm the GitHub Actions workflow passes for the intended commit.
2. Confirm the Render deployment is marked live and the application logs contain the Spring Boot started message.
3. Open the API health endpoint and verify a successful response.
4. Open the frontend and test login, navigation between major sections, and at least one read-only API-backed view.
5. If a deployment changes authentication, verify both a successful login and failed-login handling. Do not test by locking a real administrator account.
6. Check Render request logs for new 5xx responses after deployment.
7. Confirm the deployed frontend corresponds to the expected Git commit; Netlify and Cloudflare Workers deploy independently.

## PostgreSQL backups

Do not assume a database is backed up merely because its status is `Available`.

1. Open the PostgreSQL resource in Render and select its **Recovery** page.
2. Review the available point-in-time recovery window and note the most recent available time.
3. If the database plan supports logical exports, use **Create export** on the Recovery page.
4. Wait until the export completes, download the archive, and store it in durable storage outside the database service. Render's dashboard exports are retained for seven days, so download any export that must be retained longer.
5. Record the export date, database name, and storage location in the team's operational record. Never put database connection strings, passwords, or tokens in this repository.
6. Periodically validate a backup by restoring it to a separate, non-production database and checking expected tables and records.

Render documentation: https://render.com/docs/postgresql-backups

### Restore safety

- Prefer point-in-time recovery when recovering from accidental data changes and when it is available for the database plan.
- Point-in-time recovery creates a separate recovery instance. Validate its data before changing the API's database connection.
- Never run a restore with `--clean` against production unless the intended data loss has been reviewed and explicitly approved.
- Do not delete the original database until the recovered instance has been validated and all services are confirmed to use the intended database.
- Keep at least one downloaded backup outside Render for longer-term recovery.

## API and database incident checks

1. Check the Render API service status and recent deploy/event history.
2. Inspect application logs around the incident timestamp for startup errors, authentication errors, database connection failures, or migration errors.
3. Inspect request logs and metrics to determine whether 5xx responses continue after deployment finishes.
4. Confirm PostgreSQL status, connection count, and available storage.
5. Do not open the database IP allowlist to all addresses just to make an ad hoc query work. Prefer an approved trusted source IP or a controlled database access method.
6. Avoid running write queries or migrations during diagnosis unless their effect is understood and approved.

## Current login throttling limitation

The login failure counter currently lives in API process memory and is keyed by normalized username. It limits repeated failures but is reset by an application restart and is not shared across multiple API instances. Because the limit is username-based, an attacker could deliberately cause temporary lockout of another user's account. Treat this as a baseline safeguard, not a complete production rate-limiting system.

Before increasing the API instance count or treating authentication throttling as a robust control, replace this with a shared, bounded rate limiter that considers client/network abuse without allowing a single source to permanently lock out a legitimate account. Do not trust arbitrary client-supplied forwarding headers unless the proxy chain is configured and verified.

## Upload storage

The API uses a persistent Render disk mounted at `/app/uploads`. Verify this mount remains attached during service changes. Database backups do not automatically back up files on that disk; establish a separate backup/export process for uploaded files if they are business-critical.
