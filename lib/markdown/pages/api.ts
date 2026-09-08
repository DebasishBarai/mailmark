/**
 * Markdown body for /docs/api.
 *
 * The endpoint list mirrors convex/http.ts (the router that actually serves
 * api.mailmark.dev) and the OpenAPI description in lib/openapi/spec.ts.
 */

export const apiMarkdown = `The Mailmark API is an HTTP REST API. All endpoints are hosted at:

\`\`\`text
https://api.mailmark.dev
\`\`\`

- **Format**: JSON request and response bodies.
- **Auth**: Bearer token in the \`Authorization\` header.
- **Errors**: standard HTTP status codes with a structured JSON body.
- **SDK**: the \`mailmark-sdk\` npm package is a typed client.
- **Machine-readable description**: [OpenAPI 3.1 spec](https://www.mailmark.dev/openapi.json) (also at \`/api/openapi.yaml\`).

## Authentication

Every request needs an API key as a Bearer token:

\`\`\`text
Authorization: Bearer dm_live_your_api_key_here
\`\`\`

1. Go to the Developer section in your dashboard.
2. Click Create API Key, name it, and choose a scope: a specific domain (domain-scoped) or All domains (org-wide).
3. Copy the key immediately. It is shown only once and stored as a hash.
4. Domain-scoped keys can access every endpoint, but only for their domain. Org-wide keys can query the analytics endpoints (domain health, warmup, bounces, suppressions, campaign stats) across all your domains, and return 403 on write endpoints.

## Error responses

Errors return a JSON body. The \`error\` field is the human-readable message; \`code\` is the stable machine-readable identifier to branch on, and \`hint\` says how to resolve it.

\`\`\`json
HTTP 401
{
  "error": "Unauthorized",
  "code": "unauthorized",
  "message": "Unauthorized",
  "hint": "Pass a valid API key as \\"Authorization: Bearer dm_live_...\\". Keys are created in Dashboard -> Developer.",
  "status": 401,
  "documentation_url": "https://www.mailmark.dev/docs/api#authentication"
}
\`\`\`

Error codes: \`invalid_request\`, \`unauthorized\`, \`forbidden\`, \`not_found\`, \`method_not_allowed\`, \`conflict\`, \`unprocessable_entity\`, \`rate_limited\`, \`internal_error\`, \`service_unavailable\`, \`upstream_error\`.

A send refused for every recipient returns 422 and names them. This is a permanent outcome, not a transient failure, so it should not be retried:

\`\`\`json
HTTP 422
{
  "error": "No eligible recipients.",
  "code": "unprocessable_entity",
  "blocked": [
    {
      "email": "user@example.com",
      "reason": "invalid_address",
      "message": "invalid address"
    }
  ]
}
\`\`\`

## Mailboxes

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | /v1/mailboxes | List the mailboxes on the key's domain |
| POST | /v1/mailboxes | Create a mailbox (\`address\`, optional \`displayName\`) |
| DELETE | /v1/mailboxes/{address} | Delete a mailbox and its stored email |

\`\`\`bash
curl -X POST https://api.mailmark.dev/v1/mailboxes \\
  -H "Authorization: Bearer dm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"address":"hello","displayName":"Hello Team"}'
\`\`\`

## Sender groups

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | /v1/sender-groups | List sender groups |
| POST | /v1/sender-groups | Create a group (\`name\`, \`mailboxes\`: \`"all"\` or an array, \`emails\`) |
| PATCH | /v1/sender-groups/{id} | Update \`name\`, \`emails\`, \`addEmails\`, \`removeEmails\`, \`mailboxes\` |
| DELETE | /v1/sender-groups/{id} | Delete a group |

## Send email

\`POST /v1/send\`

| Field | Type | Notes |
| ----- | ---- | ----- |
| from | string | Must be a mailbox on the key's domain |
| to | string or string[] | One or many recipients |
| subject | string | Required |
| html | string | Required unless \`text\` is given |
| text | string | Plain-text alternative |
| type | "transactional" \\| "campaign" | Defaults to \`transactional\`; \`campaign\` sends one email per recipient and returns a \`batchId\` |
| scheduledAt | number | Future Unix millisecond timestamp |

\`\`\`bash
curl -X POST https://api.mailmark.dev/v1/send \\
  -H "Authorization: Bearer dm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from Mailmark!",
    "html": "<h1>It works!</h1>"
  }'
\`\`\`

Responses: \`{ "messageId": "...", "status": "queued" }\` for a transactional send, \`{ "messageIds": [...], "batchId": "...", "status": "queued" }\` for a campaign send, and \`status: "scheduled"\` when \`scheduledAt\` was set.

## Emails

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | /v1/emails | List emails (\`mailbox\`, \`folder\` default \`inbox\`, \`limit\` max 100) |
| GET | /v1/emails/{id} | Fetch one email |
| DELETE | /v1/emails/{id} | Move to trash, or delete permanently if already in trash |

## Contacts

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | /v1/contacts | List contacts on the account |
| POST | /v1/contacts | Create or update a contact (\`email\`, \`name\`) |
| DELETE | /v1/contacts/{id} | Delete a contact |

## Sequences

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | /v1/sequences | List sequences with enrollment stats |
| POST | /v1/sequences | Create a sequence (\`name\`, \`from\`, \`steps\`) |
| PATCH | /v1/sequences/{id} | Set \`status\` to \`paused\` or \`active\` |
| DELETE | /v1/sequences/{id} | Cancel the sequence and its active enrollments |
| POST | /v1/sequences/{id}/enroll | Enroll up to 100 contacts with merge fields |

\`\`\`json
{
  "name": "Welcome Series",
  "from": "hello@yourdomain.com",
  "steps": [
    { "type": "send_email", "subject": "Welcome {{firstName}}", "html": "<p>Hello!</p>" },
    { "type": "delay", "delayMs": 86400000 },
    { "type": "send_email", "subject": "Follow up", "html": "<p>Checking in</p>" }
  ]
}
\`\`\`

The first step must be \`send_email\`. See [Sequences](/docs/sequences) for the full model.

## Analytics

These accept domain-scoped and org-wide keys. With an org-wide key they return an array, one entry per domain.

| Method | Path | Query |
| ------ | ---- | ----- |
| GET | /v1/domain-health | \`domain\` |
| GET | /v1/warmup | \`mailbox\` |
| GET | /v1/bounces | \`days\` (1-90, default 30), \`domain\` |
| GET | /v1/suppressions | \`limit\` (1-500, default 100), \`after\`, \`domain\` |
| GET | /v1/campaign-stats | \`type\` (\`all\`/\`sequence\`/\`batch\`), \`sequenceId\`, \`batchId\` |

## Node.js SDK

\`\`\`bash
npm install mailmark-sdk
# or
bun add mailmark-sdk
\`\`\`

\`\`\`javascript
import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_key');

const mailboxes = await client.listMailboxes();

const result = await client.send({
  from: 'hello@yourdomain.com',
  to: ['user@example.com'],
  subject: 'Hello!',
  html: '<p>Sent via Mailmark.</p>',
});

const scheduled = await client.send({
  from: 'hello@yourdomain.com',
  to: ['user@example.com'],
  subject: 'Reminder',
  html: '<p>This is scheduled.</p>',
  scheduledAt: Date.now() + 60 * 60 * 1000,
});
\`\`\`

## Public tool endpoints

These run on \`https://www.mailmark.dev\` and need no API key. They are rate limited per IP and return the same structured JSON errors.

| Method | Path | Body |
| ------ | ---- | ---- |
| POST | /api/tools/check-deliverability | \`{ "domain": "acme.com" }\` |
| POST | /api/tools/validate-emails | \`{ "emails": ["a@acme.com"] }\` |
| POST | /api/tools/generate-subject-lines | \`{ "industry": "SaaS", "offer": "a demo", "tone": "direct" }\` |
`;
