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

## AI knowledge assistant

- `POST /api/ai/ask` – answer a question using retrieved TEKSHER HUB cards and extracted text from attachments, returning ranked source references and their review status.
- Available to authenticated `ADMIN`, `EDITOR` and `READER` roles. The question is limited to 2,000 characters.
- Retrieval ranks matching document metadata and contents, with an additional search over extracted attachment text. A maximum of six evidence cards and bounded context are sent to the configured Groq Responses API.
- The assistant is constrained to the supplied sources and should cite them as `[1]`, `[2]`. If retrieval finds no relevant source, the endpoint returns an explicit insufficient-evidence answer without calling the model.
- Relevant excerpts from the database are sent to Groq. Do not submit tax secrets, personal data or other restricted materials without organizational approval.
- Chat history is kept in the frontend component state only; it is not persisted on the server. Answers do not replace human/legal verification.

## AI summaries

- `POST /api/ai/summarize` – generate a draft card description from editor-entered text and/or an attached PDF, Word, Excel, CSV, TXT, PNG or JPG file.
- Requires an authenticated `ADMIN` or `EDITOR` account.
- Set `GROQ_API_KEY` in the backend environment to enable generation. Set `GROQ_MODEL` to change the default `openai/gpt-oss-20b` model.
- Requests use Groq's Responses API at `https://api.groq.com/openai/v1/responses`. The key remains on the backend and must never be put in frontend variables or committed to Git.
- Extracted document text is sent to Groq for summarization. Do not submit tax secrets, personal or other restricted data without organizational approval.
- Free-tier availability is subject to Groq's published model limits and may be throttled. Check current quotas in Groq Console. If no key is configured, the endpoint returns a configuration error.
- The endpoint does not verify laws or official sources. A generated description is a draft and must be checked by an employee.

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
