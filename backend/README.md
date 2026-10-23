# TEKSHER HUB API

Spring Boot 3.5 / Java 21 backend, PostgreSQL, Flyway migrations and JWT authentication.

## Local start (Docker)

At the repository root:

1. Copy `.env.example` to `.env`.
2. Replace the sample database password, JWT secret and admin password.
3. Run `docker compose up --build`.
4. Check `http://localhost:8080/api/health`.
5. Log in using the bootstrap admin credentials from `.env`.

The initial admin is created only if `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` are provided and the username does not already exist. The bootstrap password must be at least 12 characters. Changing those variables later does not reset an existing account password.

## APIs

- `POST /api/auth/login` – issue a JWT token.
- `GET /api/auth/me` – current user.
- `GET/POST /api/documents`, `GET/PUT/DELETE /api/documents/{id}` – metadata, classification, keywords and related document links.
- `GET /api/documents/{id}/versions` – document history.
- `POST /api/documents/{id}/review` – record manual status/source review.
- `GET/POST /api/documents/{id}/files`, `GET /api/documents/{id}/files/{fileId}/download`.
- `GET/POST/PUT/DELETE /api/monitors`, `POST /api/monitors/{id}/check`.
- `GET/POST /api/users`, `PATCH /api/users/{id}/enabled` and `PUT /api/users/{id}/password` – administrator only.
- `GET /api/health`.

## AI summaries

- `POST /api/ai/summarize` – generate a draft card description from editor-entered text and/or an attached PDF, Word, Excel, CSV, TXT, PNG or JPG file.
- Requires an authenticated `ADMIN` or `EDITOR` account.
- Set `OPENAI_API_KEY` in the backend environment to enable generation. Set `OPENAI_MODEL` to change the default `gpt-5-mini` model.
- The key stays on the server. The API request uses the Responses API with response storage disabled; extracted document text is sent to the configured OpenAI model for summarization.
- The endpoint does not verify laws or official sources. A generated description is a draft and must be checked by an employee.
- OpenAI API usage is billed separately from a ChatGPT subscription. If no key is configured, the endpoint returns a clear configuration error.

## Roles

- `ADMIN`: manage users, documents, attachments, monitoring and deletion.
- `EDITOR`: create/update documents, upload/remove files and manage source monitors.
- `READER`: read documents, versions, attachments and monitor statuses.

## Source monitoring

The scheduler checks enabled monitors according to their interval. It stores a SHA-256 hash of the first 2 MiB of each successful response and flags a change when a later hash differs. It does not parse legal text, decide whether an amendment affects a document, or verify legal force. A detected difference is a signal for a human review, not a legal conclusion.

Outbound checks are restricted by `MONITOR_ALLOWED_HOSTS`; redirects are not followed; local/private resolved addresses are rejected; connection and request timeouts are enabled. Add domains to the allowlist only after confirming they are trusted official sites.

## Production requirements

- Set a new, high-entropy `JWT_SECRET` (at least 32 bytes).
- Use a managed PostgreSQL instance and durable private file storage with backups.
- Set `APP_CORS_ORIGINS` to the exact deployed frontend origin(s).
- Keep secrets in the hosting platform's secret/environment settings, never in Git.
- Use HTTPS, restrict admin access, monitor backups and test restore procedures.
- The local Docker Compose setup is an installation baseline, not an automatic production deployment.
