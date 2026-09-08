/**
 * The OpenAPI description of everything Mailmark serves over HTTP.
 *
 * Two servers: the authenticated REST API on api.mailmark.dev (routed by
 * convex/http.ts) and the public tool endpoints on www.mailmark.dev (the
 * route handlers under app/api). Keep this in step with those two.
 */

export const OPENAPI_VERSION = "3.1.0";

/** Bumped when the description changes in a way clients could notice. */
export const API_VERSION = "1.0.0";

const ERROR_SCHEMA = {
  type: "object",
  description:
    "Every error body. `error` is the human-readable message and is also repeated as `message`; `code` is the stable identifier to branch on.",
  required: ["error", "code", "message"],
  properties: {
    error: { type: "string", example: "Unauthorized" },
    code: {
      type: "string",
      enum: [
        "invalid_request",
        "unauthorized",
        "forbidden",
        "not_found",
        "method_not_allowed",
        "not_acceptable",
        "conflict",
        "unprocessable_entity",
        "rate_limited",
        "internal_error",
        "service_unavailable",
        "upstream_error",
      ],
      example: "unauthorized",
    },
    message: { type: "string", example: "Unauthorized" },
    hint: {
      type: "string",
      description: "What the caller can do to resolve the error.",
      example:
        'Pass a valid API key as "Authorization: Bearer dm_live_...". Keys are created in Dashboard -> Developer.',
    },
    status: { type: "integer", example: 401 },
    documentation_url: {
      type: "string",
      format: "uri",
      example: "https://www.mailmark.dev/docs/api",
    },
  },
} as const;

function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
}

/** The error responses every authenticated endpoint can return. */
const AUTH_ERRORS = {
  "401": errorResponse("The API key is missing, invalid, or revoked."),
  "403": errorResponse("The API key is valid but not scoped for this operation."),
  "404": errorResponse("No such resource, or it belongs to another domain."),
  "500": errorResponse("Unexpected server error."),
};

function jsonBody(schemaRef: string, required = true) {
  return {
    required,
    content: { "application/json": { schema: { $ref: schemaRef } } },
  };
}

function jsonResponse(description: string, schema: Record<string, unknown>) {
  return { description, content: { "application/json": { schema } } };
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name: string) => ({ type: "array", items: ref(name) });

export const openApiSpec = {
  openapi: OPENAPI_VERSION,
  info: {
    title: "Mailmark API",
    version: API_VERSION,
    summary: "Email hosting, campaigns, and sending for your own domain.",
    description:
      "Mailmark hosts email on domains you own: mailboxes, campaigns, follow-up sequences, warmup, and transactional sending.\n\nThe authenticated REST API is served from https://api.mailmark.dev and needs an API key (`dm_live_...`) as a bearer token. Domain-scoped keys reach every endpoint for their own domain; org-wide keys can read the analytics endpoints across all domains but cannot write.\n\nThe endpoints under https://www.mailmark.dev/api/tools are the free public tools and need no key. They are rate limited per IP.",
    termsOfService: "https://www.mailmark.dev/terms",
    contact: {
      name: "Mailmark support",
      email: "support@mailmark.dev",
      url: "https://www.mailmark.dev/contact",
    },
  },
  externalDocs: {
    description: "Mailmark API reference",
    url: "https://www.mailmark.dev/docs/api",
  },
  servers: [
    { url: "https://api.mailmark.dev", description: "Authenticated REST API" },
    { url: "https://www.mailmark.dev", description: "Public tool endpoints (no API key)" },
  ],
  tags: [
    { name: "Mailboxes", description: "Email addresses on a verified domain." },
    { name: "Sender groups", description: "Groups of mailboxes and addresses to send as." },
    { name: "Send", description: "Transactional and campaign sending." },
    { name: "Emails", description: "Stored email in a mailbox." },
    { name: "Contacts", description: "The account's contact book." },
    { name: "Sequences", description: "Automated multi-step follow-ups." },
    { name: "Analytics", description: "Domain health, warmup, bounces, suppressions, campaign stats." },
    { name: "Tools", description: "Free public tools on www.mailmark.dev." },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/v1/mailboxes": {
      get: {
        tags: ["Mailboxes"],
        operationId: "listMailboxes",
        summary: "List mailboxes",
        description: "Returns every mailbox on the domain the API key is scoped to.",
        responses: {
          "200": jsonResponse("The domain's mailboxes.", arrayOf("Mailbox")),
          ...AUTH_ERRORS,
        },
      },
      post: {
        tags: ["Mailboxes"],
        operationId: "createMailbox",
        summary: "Create a mailbox",
        requestBody: jsonBody("#/components/schemas/CreateMailboxRequest"),
        responses: {
          "201": jsonResponse("The mailbox that was created.", ref("Mailbox")),
          "400": errorResponse("Missing or malformed address."),
          "409": errorResponse("A mailbox with that address already exists."),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/mailboxes/{address}": {
      delete: {
        tags: ["Mailboxes"],
        operationId: "deleteMailbox",
        summary: "Delete a mailbox",
        description:
          "Deletes the mailbox and every email stored in it. This cannot be undone.",
        parameters: [
          {
            name: "address",
            in: "path",
            required: true,
            description: "Local part or full address, e.g. `support` or `support@acme.com`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": jsonResponse("The mailbox was deleted.", {
            type: "object",
            properties: { deleted: { type: "boolean", const: true } },
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/sender-groups": {
      get: {
        tags: ["Sender groups"],
        operationId: "listSenderGroups",
        summary: "List sender groups",
        responses: {
          "200": jsonResponse("The domain's sender groups.", arrayOf("SenderGroup")),
          ...AUTH_ERRORS,
        },
      },
      post: {
        tags: ["Sender groups"],
        operationId: "createSenderGroup",
        summary: "Create a sender group",
        requestBody: jsonBody("#/components/schemas/CreateSenderGroupRequest"),
        responses: {
          "201": jsonResponse("The sender group that was created.", ref("SenderGroup")),
          "400": errorResponse("Missing name, or the group would have no mailboxes."),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/sender-groups/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      patch: {
        tags: ["Sender groups"],
        operationId: "updateSenderGroup",
        summary: "Update a sender group",
        requestBody: jsonBody("#/components/schemas/UpdateSenderGroupRequest"),
        responses: {
          "200": jsonResponse("The updated sender group.", ref("SenderGroup")),
          "400": errorResponse("Malformed body."),
          ...AUTH_ERRORS,
        },
      },
      delete: {
        tags: ["Sender groups"],
        operationId: "deleteSenderGroup",
        summary: "Delete a sender group",
        responses: {
          "200": jsonResponse("The group was deleted.", {
            type: "object",
            properties: { deleted: { type: "boolean", const: true } },
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/send": {
      post: {
        tags: ["Send"],
        operationId: "sendEmail",
        summary: "Send or schedule an email",
        description:
          "`type: \"transactional\"` sends one email addressed to every recipient. `type: \"campaign\"` sends an individual email per recipient and returns a shared `batchId`. Pass `scheduledAt` (future Unix milliseconds) to schedule instead of sending now.",
        requestBody: jsonBody("#/components/schemas/SendRequest"),
        responses: {
          "200": jsonResponse("The send was accepted.", ref("SendResult")),
          "400": errorResponse("Missing required fields, or scheduledAt is not in the future."),
          "422": {
            description:
              "Every recipient was refused by the send policy (suppressed, unsubscribed, or invalid). Permanent: do not retry unchanged.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    ref("Error"),
                    {
                      type: "object",
                      properties: { blocked: arrayOf("BlockedRecipient") },
                    },
                  ],
                },
              },
            },
          },
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/emails": {
      get: {
        tags: ["Emails"],
        operationId: "listEmails",
        summary: "List emails in a mailbox folder",
        parameters: [
          {
            name: "mailbox",
            in: "query",
            description: "Local part or full address. Defaults to the domain's first mailbox.",
            schema: { type: "string" },
          },
          {
            name: "folder",
            in: "query",
            schema: {
              type: "string",
              default: "inbox",
              enum: ["inbox", "sent", "outbox", "drafts", "trash"],
            },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, maximum: 100, minimum: 1 },
          },
        ],
        responses: {
          "200": jsonResponse("The emails in that folder.", arrayOf("EmailSummary")),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/emails/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["Emails"],
        operationId: "getEmail",
        summary: "Fetch one email",
        responses: {
          "200": jsonResponse("The email.", ref("Email")),
          ...AUTH_ERRORS,
        },
      },
      delete: {
        tags: ["Emails"],
        operationId: "deleteEmail",
        summary: "Trash or permanently delete an email",
        description:
          "Moves the email to trash. An email already in trash is deleted permanently.",
        responses: {
          "200": jsonResponse("The email was trashed or deleted.", {
            type: "object",
            properties: {
              deleted: { type: "boolean" },
              moved: { type: "string", example: "trash" },
            },
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/contacts": {
      get: {
        tags: ["Contacts"],
        operationId: "listContacts",
        summary: "List contacts",
        responses: {
          "200": jsonResponse("The account's contacts.", arrayOf("Contact")),
          ...AUTH_ERRORS,
        },
      },
      post: {
        tags: ["Contacts"],
        operationId: "createContact",
        summary: "Create or update a contact",
        requestBody: jsonBody("#/components/schemas/CreateContactRequest"),
        responses: {
          "201": jsonResponse("The contact.", ref("Contact")),
          "400": errorResponse("Missing email or name."),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/contacts/{id}": {
      delete: {
        tags: ["Contacts"],
        operationId: "deleteContact",
        summary: "Delete a contact",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": jsonResponse("The contact was deleted.", {
            type: "object",
            properties: { deleted: { type: "boolean", const: true } },
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/sequences": {
      get: {
        tags: ["Sequences"],
        operationId: "listSequences",
        summary: "List sequences with enrollment stats",
        responses: {
          "200": jsonResponse("The domain's sequences.", arrayOf("Sequence")),
          ...AUTH_ERRORS,
        },
      },
      post: {
        tags: ["Sequences"],
        operationId: "createSequence",
        summary: "Create a sequence",
        description: "The first step must be a `send_email` step.",
        requestBody: jsonBody("#/components/schemas/CreateSequenceRequest"),
        responses: {
          "201": jsonResponse("The sequence that was created.", ref("Sequence")),
          "400": errorResponse("Malformed steps, or the first step is not send_email."),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/sequences/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      patch: {
        tags: ["Sequences"],
        operationId: "updateSequenceStatus",
        summary: "Pause or resume a sequence",
        requestBody: jsonBody("#/components/schemas/UpdateSequenceRequest"),
        responses: {
          "200": jsonResponse("The new status.", {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string", enum: ["active", "paused"] },
            },
          }),
          "400": errorResponse('`status` must be "paused" or "active".'),
          ...AUTH_ERRORS,
        },
      },
      delete: {
        tags: ["Sequences"],
        operationId: "cancelSequence",
        summary: "Cancel a sequence",
        description: "Cancels the sequence and every active enrollment on it.",
        responses: {
          "200": jsonResponse("The sequence was cancelled.", {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string", example: "completed" },
              cancelledEnrollments: { type: "integer" },
            },
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/sequences/{id}/enroll": {
      post: {
        tags: ["Sequences"],
        operationId: "enrollContacts",
        summary: "Enroll contacts in a sequence",
        description: "Up to 100 contacts per request. The sequence must be active.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: jsonBody("#/components/schemas/EnrollRequest"),
        responses: {
          "200": jsonResponse("How many enrolled and how many were skipped.", {
            type: "object",
            properties: {
              enrolled: { type: "integer" },
              skipped: { type: "integer" },
              enrollmentIds: { type: "array", items: { type: "string" } },
            },
          }),
          "400": errorResponse("The sequence is not active, or the contacts array is empty or too large."),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/domain-health": {
      get: {
        tags: ["Analytics"],
        operationId: "getDomainHealth",
        summary: "Latest domain health check",
        description:
          "A domain-scoped key returns one object. An org-wide key returns one entry per domain.",
        parameters: [
          {
            name: "domain",
            in: "query",
            description: "Filter to one domain (org-wide keys).",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": jsonResponse("Domain health.", {
            oneOf: [ref("DomainHealth"), arrayOf("DomainHealth")],
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/warmup": {
      get: {
        tags: ["Analytics"],
        operationId: "getWarmupStatus",
        summary: "Warmup status per mailbox",
        parameters: [
          {
            name: "mailbox",
            in: "query",
            description: "Full address to filter to.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": jsonResponse("Warmup status.", arrayOf("WarmupStatus")),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/bounces": {
      get: {
        tags: ["Analytics"],
        operationId: "getBounceStats",
        summary: "Bounce and complaint rates",
        parameters: [
          {
            name: "days",
            in: "query",
            description: "Lookback window in days.",
            schema: { type: "integer", default: 30, minimum: 1, maximum: 90 },
          },
          { name: "domain", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonResponse("Bounce stats.", {
            oneOf: [ref("BounceStats"), arrayOf("BounceStats")],
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/suppressions": {
      get: {
        tags: ["Analytics"],
        operationId: "listSuppressions",
        summary: "Unsubscribes and suppressed addresses",
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 100, minimum: 1, maximum: 500 },
          },
          {
            name: "after",
            in: "query",
            description: "Unix millisecond timestamp to page from.",
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": jsonResponse("Suppression list.", {
            oneOf: [ref("SuppressionPage"), arrayOf("SuppressionPage")],
          }),
          ...AUTH_ERRORS,
        },
      },
    },
    "/v1/campaign-stats": {
      get: {
        tags: ["Analytics"],
        operationId: "getCampaignStats",
        summary: "Sequence and batch campaign stats",
        parameters: [
          {
            name: "type",
            in: "query",
            schema: { type: "string", default: "all", enum: ["all", "sequence", "batch"] },
          },
          { name: "sequenceId", in: "query", schema: { type: "string" } },
          { name: "batchId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonResponse("Campaign stats.", ref("CampaignStats")),
          ...AUTH_ERRORS,
        },
      },
    },

    // ── Public tools on www.mailmark.dev ────────────────────────────────────
    "/api/tools/check-deliverability": {
      post: {
        tags: ["Tools"],
        operationId: "checkDeliverability",
        summary: "Check a domain's SPF, DKIM, DMARC, MX and blacklist status",
        security: [],
        servers: [{ url: "https://www.mailmark.dev" }],
        requestBody: jsonBody("#/components/schemas/CheckDeliverabilityRequest"),
        responses: {
          "200": jsonResponse("The deliverability report.", { type: "object" }),
          "400": errorResponse("Missing or malformed domain."),
          "429": errorResponse("Per-IP rate limit exceeded."),
        },
      },
    },
    "/api/tools/validate-emails": {
      post: {
        tags: ["Tools"],
        operationId: "validateEmails",
        summary: "Validate up to 100 email addresses",
        security: [],
        servers: [{ url: "https://www.mailmark.dev" }],
        requestBody: jsonBody("#/components/schemas/ValidateEmailsRequest"),
        responses: {
          "200": jsonResponse("Per-address results and a summary.", {
            type: "object",
            properties: {
              results: arrayOf("EmailValidationResult"),
              summary: {
                type: "object",
                properties: {
                  total: { type: "integer" },
                  valid: { type: "integer" },
                  risky: { type: "integer" },
                  invalid: { type: "integer" },
                },
              },
            },
          }),
          "400": errorResponse("Empty list, or more than 100 addresses."),
        },
      },
    },
    "/api/tools/generate-subject-lines": {
      post: {
        tags: ["Tools"],
        operationId: "generateSubjectLines",
        summary: "Generate cold email subject lines",
        security: [],
        servers: [{ url: "https://www.mailmark.dev" }],
        requestBody: jsonBody("#/components/schemas/GenerateSubjectLinesRequest"),
        responses: {
          "200": jsonResponse("Eight subject lines with an explanation each.", {
            type: "object",
            properties: {
              subjectLines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    line: { type: "string" },
                    tip: { type: "string" },
                  },
                },
              },
              generationsRemaining: { type: "integer" },
            },
          }),
          "400": errorResponse("Missing industry, offer, or tone."),
          "429": errorResponse("Daily per-IP limit reached."),
          "503": errorResponse("Generation is not configured on the server."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "A Mailmark API key (`dm_live_...`), created in Dashboard -> Developer. Domain-scoped keys reach every endpoint for their domain; org-wide keys can read the analytics endpoints across all domains but cannot write.",
      },
    },
    schemas: {
      Error: ERROR_SCHEMA,
      BlockedRecipient: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          reason: { type: "string", example: "invalid_address" },
          message: { type: "string", example: "invalid address" },
          detail: { type: "string" },
        },
      },
      Mailbox: {
        type: "object",
        properties: {
          id: { type: "string" },
          address: { type: "string", example: "support" },
          fullAddress: { type: "string", example: "support@acme.com" },
          displayName: { type: ["string", "null"], example: "Support Team" },
        },
      },
      CreateMailboxRequest: {
        type: "object",
        required: ["address"],
        properties: {
          address: {
            type: "string",
            description: "Local part only; the domain is appended automatically.",
            example: "support",
          },
          displayName: { type: "string", example: "Support Team" },
        },
      },
      SenderGroup: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          mailboxIds: { type: "array", items: { type: "string" } },
          emails: { type: "array", items: { type: "string", format: "email" } },
        },
      },
      CreateSenderGroupRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          mailboxes: {
            description: '`"all"`, or the mailbox addresses to include.',
            oneOf: [
              { type: "string", const: "all" },
              { type: "array", items: { type: "string" } },
            ],
            default: "all",
          },
          emails: { type: "array", items: { type: "string", format: "email" } },
        },
      },
      UpdateSenderGroupRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          emails: { type: "array", items: { type: "string", format: "email" } },
          addEmails: { type: "array", items: { type: "string", format: "email" } },
          removeEmails: { type: "array", items: { type: "string", format: "email" } },
          mailboxes: {
            oneOf: [
              { type: "string", const: "all" },
              { type: "array", items: { type: "string" } },
            ],
          },
        },
      },
      SendRequest: {
        type: "object",
        required: ["from", "to", "subject"],
        description: "At least one of `html` or `text` is required.",
        properties: {
          from: {
            type: "string",
            format: "email",
            description: "A mailbox on the API key's domain.",
            example: "hello@acme.com",
          },
          to: {
            oneOf: [
              { type: "string", format: "email" },
              { type: "array", items: { type: "string", format: "email" } },
            ],
          },
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
          type: {
            type: "string",
            enum: ["transactional", "campaign"],
            default: "transactional",
          },
          scheduledAt: {
            type: "integer",
            description: "Future Unix millisecond timestamp.",
          },
        },
      },
      SendResult: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "Transactional sends." },
          messageIds: {
            type: "array",
            items: { type: "string" },
            description: "Campaign sends, one per recipient.",
          },
          batchId: { type: "string", description: "Campaign sends." },
          status: { type: "string", enum: ["queued", "scheduled"] },
          blocked: arrayOf("BlockedRecipient"),
        },
      },
      EmailSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          messageId: { type: "string" },
          from: { type: "string" },
          to: { type: "array", items: { type: "string" } },
          subject: { type: "string" },
          snippet: { type: "string" },
          folder: { type: "string" },
          date: { type: "integer" },
          read: { type: "boolean" },
          starred: { type: "boolean" },
          hasAttachments: { type: "boolean" },
          deliveryStatus: { type: ["string", "null"] },
          openedAt: { type: ["integer", "null"] },
          batchId: { type: ["string", "null"] },
        },
      },
      Email: {
        allOf: [
          ref("EmailSummary"),
          {
            type: "object",
            properties: {
              cc: { type: ["array", "null"], items: { type: "string" } },
              bcc: { type: ["array", "null"], items: { type: "string" } },
              s3Key: { type: "string" },
            },
          },
        ],
      },
      Contact: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
        },
      },
      CreateContactRequest: {
        type: "object",
        required: ["email", "name"],
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string" },
        },
      },
      SequenceStep: {
        oneOf: [
          {
            type: "object",
            required: ["type", "subject", "html"],
            properties: {
              type: { type: "string", const: "send_email" },
              subject: { type: "string", example: "Hey {{firstName}}" },
              html: { type: "string" },
            },
          },
          {
            type: "object",
            required: ["type", "delayMs"],
            properties: {
              type: { type: "string", const: "delay" },
              delayMs: { type: "integer", example: 86400000 },
            },
          },
        ],
      },
      Sequence: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          status: { type: "string", enum: ["active", "paused", "completed"] },
          steps: arrayOf("SequenceStep"),
          mailboxAddress: { type: ["string", "null"] },
          stats: { type: "object" },
          createdAt: { type: "integer" },
        },
      },
      CreateSequenceRequest: {
        type: "object",
        required: ["name", "from", "steps"],
        properties: {
          name: { type: "string" },
          from: { type: "string", format: "email" },
          steps: arrayOf("SequenceStep"),
        },
      },
      UpdateSequenceRequest: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: ["active", "paused"] } },
      },
      EnrollRequest: {
        type: "object",
        required: ["contacts"],
        properties: {
          contacts: {
            type: "array",
            maxItems: 100,
            items: {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string", format: "email" },
                mergeFields: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  example: { firstName: "Alice", company: "Acme Corp" },
                },
              },
            },
          },
        },
      },
      DomainHealth: {
        type: "object",
        properties: {
          domain: { type: ["string", "null"] },
          checkedAt: { type: ["integer", "null"] },
          overallScore: { type: ["integer", "null"] },
          reputationStatus: { type: ["string", "null"] },
          spf: { type: "object", properties: { valid: { type: ["boolean", "null"] } } },
          dkim: { type: "object", properties: { valid: { type: ["boolean", "null"] } } },
          dmarc: { type: "object", properties: { valid: { type: ["boolean", "null"] } } },
          blacklisted: { type: ["boolean", "null"] },
          blacklistEntries: { type: "array", items: { type: "string" } },
          bounceRate: { type: ["number", "null"] },
          complaintRate: { type: ["number", "null"] },
        },
      },
      WarmupStatus: {
        type: "object",
        properties: {
          mailbox: { type: "string" },
          status: { type: "string" },
          speed: { type: "string", enum: ["slow", "normal", "fast"] },
          currentDay: { type: "integer" },
          dailyLimit: { type: "integer" },
          sentToday: { type: "integer" },
          receivedToday: { type: "integer" },
          healthScore: { type: "number" },
          inboxRate: { type: "number" },
          startedAt: { type: "integer" },
          lastActivityAt: { type: ["integer", "null"] },
        },
      },
      BounceStats: {
        type: "object",
        properties: {
          domain: { type: ["string", "null"] },
          period: {
            type: "object",
            properties: {
              days: { type: "integer" },
              from: { type: "integer" },
              to: { type: "integer" },
            },
          },
          totalSent: { type: "integer" },
          delivered: { type: "integer" },
          bounced: { type: "integer" },
          failed: { type: "integer" },
          bounceRate: { type: "number" },
          complaintRate: { type: "number" },
        },
      },
      SuppressionPage: {
        type: "object",
        properties: {
          domain: { type: ["string", "null"] },
          total: { type: "integer" },
          hasMore: { type: "boolean" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email: { type: "string", format: "email" },
                unsubscribedAt: { type: "integer" },
                source: { type: "string", example: "one-click" },
              },
            },
          },
        },
      },
      CampaignStats: {
        type: "object",
        properties: {
          sequences: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                status: { type: "string" },
                stats: { type: "object" },
              },
            },
          },
          batches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                batchId: { type: "string" },
                sentAt: { type: "integer" },
                stats: { type: "object" },
              },
            },
          },
        },
      },
      CheckDeliverabilityRequest: {
        type: "object",
        required: ["domain"],
        properties: { domain: { type: "string", example: "acme.com" } },
      },
      ValidateEmailsRequest: {
        type: "object",
        required: ["emails"],
        properties: {
          emails: {
            type: "array",
            maxItems: 100,
            items: { type: "string", format: "email" },
          },
        },
      },
      EmailValidationResult: {
        type: "object",
        properties: {
          email: { type: "string" },
          status: { type: "string", enum: ["valid", "risky", "invalid"] },
          reason: { type: "string" },
          checks: { type: "object" },
        },
      },
      GenerateSubjectLinesRequest: {
        type: "object",
        required: ["industry", "offer", "tone"],
        properties: {
          industry: { type: "string", maxLength: 200, example: "SaaS" },
          offer: { type: "string", maxLength: 200, example: "a 15 minute demo" },
          tone: {
            type: "string",
            enum: ["casual", "professional", "direct", "friendly", "urgent"],
          },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
