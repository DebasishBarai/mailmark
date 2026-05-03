# Mailmark -- Product Roadmap & Implementation Plan

Last updated: 2026-05-03 (Phase 2 completed, Phase 3 architecture revised)

This plan addresses 4 product gaps identified from a churned cold email agency user. The user paid for Starter, cancelled within an hour without setting up a domain. Root cause: Mailmark lacks the warmup and sequencing features cold emailers require.

---

## Table of Contents

1. [Phase 1: Social Proof & Trust Signals](#phase-1-social-proof--trust-signals) -- COMPLETED
2. [Phase 2: Sequences API](#phase-2-sequences-api) (2-3 weeks) -- COMPLETED
3. [Phase 3: Email Warmup Infrastructure](#phase-3-email-warmup-infrastructure) (4-6 weeks)
4. [Phase 4: GWS / Outlook SMTP Integration](#phase-4-gws--outlook-smtp-integration) (spike 1 week, full build 4-6 weeks)

---

## Phase 1: Social Proof & Trust Signals -- COMPLETED

**Impact: MEDIUM** | **Effort: 2-3 days** | **Status: DONE**

The churned user said: "some more proof that you're sending emails would be good"

### Current State

- `app/components/Testimonials.tsx` has 3 anonymous testimonials (real names commented out)
- No platform volume stats on landing page
- No founder visibility or team section
- No partner/technology logos

### 1a. Platform Stats on Landing Page (1 day)

**New file: `convex/platformStats.ts`**

Create a public query (no auth required) that returns aggregate platform numbers. No individual user data is exposed.

```
query getPlatformStats:
  - Count total rows in `emails` table (total emails processed)
  - Count total rows in `domains` table where verified = true
  - Count total rows in `mailboxes` table
  - Return: { totalEmails, totalDomains, totalMailboxes }
```

**Modify: `app/page.tsx`**

Add a "Numbers" section between the features section and the testimonials section. Display the 3 stats with animated count-up (use a simple requestAnimationFrame counter, no external lib). Show fallback static numbers if the query hasn't loaded yet.

Design: 3-column grid, each with a large number, a label, and a subtle icon. Use violet accent color to match the rest of the page.

### 1b. Founder Visibility on About Page (0.5 day)

**Modify: `app/about/page.tsx`**

Add a "Built by" or "Team" section with:
- Founder name and photo
- LinkedIn link
- 2-3 sentence bio
- Why Mailmark was built (mission statement)

### 1c. Testimonial Improvements (0.5 day)

**Modify: `app/components/Testimonials.tsx`**

- Uncomment real names if permission has been obtained from the beta users
- Or replace with real beta user quotes collected via email/Discord
- Add company name and role where available

### 1d. Partner / Technology Logos (0.5 day)

**Modify: `app/page.tsx`**

Add a "Powered by" or "Built with" section near the bottom with logos for:
- AWS (SES, S3)
- Clerk (authentication)
- Convex (real-time backend)

Use grayscale logos with hover color effect. Keep it subtle -- this is trust signaling, not advertising.

### Files Modified

| File | Change | Status |
|------|--------|--------|
| `convex/platformStats.ts` | New file -- public query for aggregate stats | Done |
| `app/components/PlatformStats.tsx` | New file -- animated count-up stats section | Done |
| `app/components/PoweredBy.tsx` | New file -- "Built with" partner logos section | Done |
| `app/page.tsx` | Added PlatformStats + PoweredBy sections | Done |
| `app/components/Testimonials.tsx` | Real names, companies, roles, avatar initials | Done |
| `app/about/page.tsx` | Founder section with bio, GitHub, Twitter/X links | Done |

### Verification

- [x] `bun run build` passes
- [x] Landing page renders stats section with animated numbers
- [x] Testimonials show names with avatar initials
- [x] "Built with" logos section renders below testimonials
- [x] About page shows founder section

---

## Phase 2: Sequences API -- COMPLETED

**Impact: HIGH** | **Effort: 2-3 weeks** | **Status: DONE**

The churned user said: "API first will attract most leveraged users with high volume"

Implemented as an integrated follow-up system within the mailbox compose flow, plus full API support.

### What Was Built

- Schema tables `sequences` and `sequenceEnrollments` in `convex/schema.ts`
- CRUD module `convex/sequences.ts` with all internal queries and mutations
- Step processing engine `convex/sequenceProcessing.ts` (sends emails, handles delays, completes enrollments)
- Public API functions `convex/sequenceActions.ts` (create, pause, resume, cancel, enroll, getByMailbox, createAndEnrollWithFirstSent)
- Reply detection in `convex/http.ts` (marks enrollment as "replied" when contact replies)
- Follow-up builder UI integrated into mailbox compose flow
- Follow-ups tab in mailbox folder list with stats, pause/resume/cancel controls
- API documentation added to `app/docs/api/page.tsx`
- Sequences section added to `public/llms.txt`

### Schema (already in `convex/schema.ts`)

```
sequences:
  userId: Id<"users">
  domainId: Id<"domains">
  mailboxId: Id<"mailboxes">
  name: string
  status: "active" | "paused" | "completed"
  steps: Array<
    { type: "send_email", subject: string, html: string } |
    { type: "delay", delayMs: number }
  >
  createdAt: number
  Indexes: by_user_id, by_domain_id

sequenceEnrollments:
  sequenceId: Id<"sequences">
  contactEmail: string
  mergeFields: optional any
  currentStep: number
  status: "active" | "completed" | "replied" | "cancelled" | "bounced"
  enrolledAt: number
  completedAt: optional number
  lastStepAt: optional number
  scheduledJobId: optional string
  Indexes: by_sequence_id, by_sequence_status, by_sequence_email
```

### 2a. Step Processing Engine (3-5 days)

**New file: `convex/sequenceActions.ts`**

This is the core engine that executes sequence steps using Convex's scheduler.

```
internalAction processStep(enrollmentId, stepIndex):
  1. Fetch enrollment from sequenceEnrollments
  2. Validate: enrollment exists, status === "active"
  3. Fetch sequence from sequences
  4. Validate: sequence exists, status === "active"
  5. Get the step at stepIndex from sequence.steps

  If step.type === "send_email":
    - Get the mailbox from sequence.mailboxId
    - Call internal.ses.sendEmailViaApi with:
      - mailboxId: sequence.mailboxId
      - to: [enrollment.contactEmail]
      - subject: step.subject (with merge field interpolation)
      - html: step.html (with merge field interpolation)
    - Call internal.sequences.advanceEnrollment with nextStep = stepIndex + 1
    - If stepIndex + 1 < sequence.steps.length:
      - Look at the NEXT step
      - If next step is "delay": schedule processStep(enrollmentId, stepIndex + 1) at Date.now() + next.delayMs
      - If next step is "send_email": schedule processStep(enrollmentId, stepIndex + 1) immediately (Date.now())
    - Else: call internal.sequences.completeEnrollment with status "completed"

  If step.type === "delay":
    - Schedule processStep(enrollmentId, stepIndex + 1) at Date.now() + step.delayMs
    - Update enrollment.scheduledJobId with the scheduled function ID

  On error (send fails, mailbox not found, quota exceeded):
    - Log the error
    - Do NOT complete the enrollment -- leave it active so it can be retried
    - Store error context on the enrollment (may need a lastError field)
```

**Merge field interpolation:**

Replace `{{fieldName}}` tokens in subject and html with values from `enrollment.mergeFields`. Example: `{{firstName}}` becomes the value of `mergeFields.firstName`. Unresolved tokens are left as-is (don't break the email).

```typescript
function interpolate(template: string, fields: Record<string, string> | undefined): string {
  if (!fields) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => fields[key] ?? match);
}
```

### 2b. Reply Detection (2-3 days)

When an inbound email arrives (processed in `convex/http.ts` email ingestion webhook), check if the sender email matches any active enrollment's `contactEmail`. If so, complete that enrollment with status `"replied"` and cancel any scheduled future steps.

**Modify: `convex/http.ts`** (inbound email processing section)

After the email is stored, add:

```
1. Query sequenceEnrollments by contactEmail where status === "active"
2. For each matching enrollment:
   - Check if the inbound email's "to" address matches the sequence's mailbox
   - If yes: call internal.sequences.completeEnrollment with status "replied"
   - Cancel the scheduled job if scheduledJobId exists (ctx.scheduler.cancel)
```

**Modify: `convex/sequences.ts`**

Add a new internal query:

```
getActiveEnrollmentsByEmail(contactEmail: string):
  - Query sequenceEnrollments where contactEmail matches and status === "active"
  - Return all matching enrollments with their sequence info
```

### 2c. Bounce Detection (1 day)

When a bounce notification arrives via the SES webhook (`convex/http.ts` SNS handler), check if the bounced recipient matches an active enrollment.

**Modify: `convex/http.ts`** (bounce handling section)

After recording the bounce on the email record:

```
1. Query active enrollments for the bounced email address
2. For each match: complete with status "bounced", cancel scheduled job
```

### 2d. HTTP API Endpoints (3-5 days)

**Modify: `convex/http.ts`**

All endpoints use the existing `authenticate()` function for Bearer token auth. All operations are scoped to the API key's domain.

#### `POST /v1/sequences`

Create a new sequence.

```
Request body:
{
  "name": "Welcome Series",
  "from": "hello@yourdomain.com",   // must match a mailbox on the API key's domain
  "steps": [
    { "type": "send_email", "subject": "Welcome {{firstName}}", "html": "<p>Hi {{firstName}}...</p>" },
    { "type": "delay", "delayMs": 86400000 },  // 1 day
    { "type": "send_email", "subject": "Quick follow-up", "html": "<p>Just checking in...</p>" },
    { "type": "delay", "delayMs": 259200000 },  // 3 days
    { "type": "send_email", "subject": "Last chance", "html": "<p>Final message...</p>" }
  ]
}

Validation:
  - steps array must not be empty
  - First step must be "send_email" (a sequence can't start with a delay)
  - delayMs must be >= 60000 (1 minute minimum) and <= 2592000000 (30 days max)
  - subject and html must be non-empty strings
  - "from" must be a mailbox on the API key's domain

Response 201:
{
  "id": "sequences:abc123",
  "name": "Welcome Series",
  "status": "active",
  "steps": [...],
  "createdAt": 1714600000000
}
```

#### `GET /v1/sequences`

List all sequences for the API key's domain.

```
Response 200:
{
  "sequences": [
    { "id": "...", "name": "...", "status": "active", "stepCount": 5, "createdAt": ... },
    ...
  ]
}
```

#### `GET /v1/sequences/:id`

Get a single sequence with enrollment stats.

```
Response 200:
{
  "id": "...",
  "name": "...",
  "status": "active",
  "steps": [...],
  "stats": { "total": 150, "active": 80, "completed": 50, "replied": 12, "bounced": 3, "cancelled": 5 },
  "createdAt": ...
}
```

#### `POST /v1/sequences/:id/enroll`

Enroll one or more contacts in a sequence. Starts step processing immediately.

```
Request body:
{
  "contacts": [
    { "email": "jane@example.com", "mergeFields": { "firstName": "Jane", "company": "Acme" } },
    { "email": "bob@example.com", "mergeFields": { "firstName": "Bob", "company": "Initech" } }
  ]
}

Validation:
  - Sequence must be "active"
  - Each email must be a valid email format
  - Skip contacts already enrolled (status "active") -- don't error, just skip
  - Max 100 contacts per request

Response 200:
{
  "enrolled": 2,
  "skipped": 0,
  "enrollmentIds": ["sequenceEnrollments:abc", "sequenceEnrollments:def"]
}

For each enrolled contact:
  1. Call internal.sequences.enroll to create enrollment record
  2. Schedule the first step immediately: ctx.scheduler.runAt(Date.now(), internal.sequenceActions.processStep, { enrollmentId, stepIndex: 0 })
```

#### `GET /v1/sequences/:id/enrollments`

List enrollments with pagination.

```
Query params: ?status=active&limit=50&cursor=xxx

Response 200:
{
  "enrollments": [
    { "id": "...", "contactEmail": "...", "status": "active", "currentStep": 2, "enrolledAt": ..., "lastStepAt": ... },
    ...
  ],
  "nextCursor": "xxx" | null
}
```

#### `PATCH /v1/sequences/:id`

Pause or resume a sequence. Pausing prevents new step executions (processStep checks sequence status).

```
Request body:
{ "status": "paused" }  or  { "status": "active" }

Response 200:
{ "id": "...", "status": "paused", ... }
```

#### `DELETE /v1/sequences/:id`

Cancel a sequence. Sets sequence to "completed" and all active enrollments to "cancelled".

```
Response 200:
{ "id": "...", "status": "completed", "cancelledEnrollments": 42 }
```

### 2e. API Documentation (1 day)

**Modify: `app/docs/api/page.tsx`**

Add a "Sequences" section to the existing API docs page documenting all 7 endpoints with request/response examples.

### Files to Create/Modify

| File | Change |
|------|--------|
| `convex/sequenceActions.ts` | **New** -- step processing engine |
| `convex/sequences.ts` | Add `getActiveEnrollmentsByEmail` query |
| `convex/http.ts` | Add 7 API endpoints + reply/bounce detection hooks |
| `app/docs/api/page.tsx` | Document sequence endpoints |

### Verification

Test the full flow via curl:

```bash
# 1. Create sequence
curl -X POST https://api.mailmark.dev/v1/sequences \
  -H "Authorization: Bearer mk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","from":"hello@yourdomain.com","steps":[{"type":"send_email","subject":"Hi {{firstName}}","html":"<p>Hello</p>"},{"type":"delay","delayMs":86400000},{"type":"send_email","subject":"Follow up","html":"<p>Checking in</p>"}]}'

# 2. Enroll contacts
curl -X POST https://api.mailmark.dev/v1/sequences/SEQ_ID/enroll \
  -H "Authorization: Bearer mk_..." \
  -d '{"contacts":[{"email":"test@example.com","mergeFields":{"firstName":"Test"}}]}'

# 3. Verify first email sent immediately
# 4. Verify second email scheduled for 24h later
# 5. Check enrollment stats
curl https://api.mailmark.dev/v1/sequences/SEQ_ID \
  -H "Authorization: Bearer mk_..."
```

### Verification

- [x] `bun run build` passes
- [x] Follow-up builder UI renders in compose (toggle, delay/subject/body inputs)
- [x] Sequences created on send when follow-ups are configured
- [x] Follow-ups tab shows active sequences with stats and controls
- [x] Reply detection marks enrollments as "replied" on inbound email
- [x] Step processing engine handles delays and sends follow-up emails
- [x] API docs page documents all sequence endpoints
- [x] llms.txt updated with Sequences feature and API documentation

### Files Created/Modified

| File | Change | Status |
|------|--------|--------|
| `convex/sequenceProcessing.ts` | Step processing engine (processStep, getEnrollment, getSequence) | Done |
| `convex/sequenceActions.ts` | Public API: create, pause, resume, cancel, enroll, getByMailbox, createAndEnrollWithFirstSent | Done |
| `convex/sequences.ts` | Internal CRUD + markRepliedByEmail mutation | Done |
| `convex/http.ts` | Reply detection hook in inbound email handler | Done |
| `app/(protected)/mailbox/[mailboxId]/page.tsx` | Follow-up state, UI builder, send handler integration, Follow-ups tab | Done |
| `app/docs/api/page.tsx` | Sequences API documentation (5 endpoints) | Done |
| `public/llms.txt` | Sequences feature + API docs section | Done |

---

## Phase 3: Email Warmup Infrastructure

**Impact: CRITICAL** | **Effort: 4-6 weeks** | **The #1 feature cold emailers need**

The churned user said: "warmup is the hardest piece, pure sending I can do easily myself"

### Current State

The existing warming system in `convex/warmingSchedules.ts` is volume-ramping only:
- Tracks `sentToday` vs `dailyLimit` over 28 days (5 to 250 emails/day)
- Gates user-initiated sends but does NOT actually send any warmup emails
- No warmup partners, no real engagement, no inbox/spam tracking
- UI at `app/(protected)/warming/page.tsx` shows schedule progress

### What Cold Emailers Expect

Real emails exchanged with real Gmail accounts, with real engagement signals:
- Emails sent from the user's Mailmark mailbox to platform-owned Gmail accounts
- Emails sent back from those Gmail accounts to the user's mailbox
- Real Gmail inbox/spam placement detection (not simulated)
- Automated opens, replies, and spam rescue via Gmail API
- Health score based on actual Gmail inbox placement rate
- Volume ramping (slow/normal/fast)

### Architecture Overview

The warmup system has 3 layers:

1. **Platform Warmup Accounts** -- Founder-owned Gmail accounts stored in the database, shared across all users. Scalable: add more rows to add more capacity.
2. **Email Exchange Engine** -- Cron-driven system that sends warmup emails between each user's Mailmark mailbox and the platform Gmail accounts, then uses the Gmail API for real engagement.
3. **Per-Mailbox Warmup Tracking** -- Each enrolled mailbox tracks its own progress (day, speed, health score, daily counts).

### Key Design Decision: Platform-Owned Gmail Accounts

Rather than a shared user-to-user pool, Mailmark maintains its own set of Gmail accounts that serve as warmup partners for all users. This means:

- Users do not need to connect their own Gmail accounts
- Warmup works on day 1 for any user, with zero setup beyond clicking "Start Warmup"
- Real Gmail inbox/spam placement detection is available to every user automatically
- Capacity scales by adding more Gmail accounts to the `platformWarmupAccounts` table -- no code changes needed

### 3a. Schema Additions

**Modify: `convex/schema.ts`**

```
platformWarmupAccounts: defineTable({
  email: string,                  // founder-owned Gmail account e.g. warmup1@gmail.com
  provider: "gmail",              // gmail only for now, future-proof for outlook
  accessToken: string,            // OAuth access token
  refreshToken: string,           // OAuth refresh token (long-lived)
  tokenExpiresAt: number,         // access token expiry timestamp
  status: "active" | "paused" | "token_expired",
  dailySentCount: number,         // emails sent today via this account
  dailyReceivedCount: number,     // emails received today by this account
  lastResetAt: number,            // when daily counts were last zeroed (reset at midnight)
})
  .index("by_status", ["status"])
  .index("by_email", ["email"])

// Per-mailbox warmup enrollment and progress tracking
warmupMailboxes: defineTable({
  userId: Id<"users">,
  mailboxId: Id<"mailboxes">,
  domainId: Id<"domains">,
  status: "active" | "paused",
  speed: "slow" | "normal" | "fast",
  dailyLimit: number,             // max warmup emails to send per day (set by speed + currentDay)
  sentToday: number,
  receivedToday: number,
  currentDay: number,             // days since warmup started
  healthScore: number,            // 0-100, weighted from inboxRate + openRate + replyRate
  inboxRate: number,              // % of warmup emails landing in Gmail inbox (real placement)
  startedAt: number,
  lastActivityAt: optional number,
})
  .index("by_user_id", ["userId"])
  .index("by_mailbox_id", ["mailboxId"])
  .index("by_status", ["status"])

warmupEmails: defineTable({
  warmupMailboxId: Id<"warmupMailboxes">,      // the user's enrolled mailbox
  platformAccountId: Id<"platformWarmupAccounts">,  // which platform Gmail was involved
  direction: "outbound" | "inbound",           // outbound = mailbox→gmail, inbound = gmail→mailbox
  fromAddress: string,
  toAddress: string,
  messageId: string,
  subject: string,
  sentAt: number,
  // Engagement (populated by Gmail API checks)
  openedAt: optional number,
  repliedAt: optional number,
  repliedMessageId: optional string,
  // Real placement from Gmail API
  placement: "inbox" | "spam" | "unknown",
  rescuedFromSpam: optional boolean,
  markedImportant: optional boolean,
})
  .index("by_warmup_mailbox", ["warmupMailboxId"])
  .index("by_platform_account", ["platformAccountId"])
  .index("by_message_id", ["messageId"])
  .index("by_sent_date", ["sentAt"])

warmupContentTemplates: defineTable({
  category: "business" | "personal" | "newsletter" | "notification",
  subjects: Array<string>,        // 10-20 subject variations per category
  bodies: Array<string>,          // 10-20 body variations per category
  replyBodies: Array<string>,     // 5-10 reply variations
})
```

### 3b. Warmup Content Generation

**New file: `convex/warmupContent.ts`**

Quality warmup requires diverse, natural-sounding email content. ESPs detect repetitive content patterns.

```
Approach:
  - Seed database with 50+ subject/body template pairs across 4 categories
  - Each template has merge slots: {{senderName}}, {{recipientName}}, {{topic}}
  - Subjects and bodies are randomly paired at send time (not always the same combo)
  - Reply bodies are separate templates, shorter and more casual
  - Different platform accounts receive different content variations to avoid patterns

Content categories:
  1. Business -- meeting requests, project updates, proposals
  2. Personal -- catching up, congratulations, recommendations
  3. Newsletter-style -- tips, articles, industry news
  4. Notification-style -- confirmations, reminders, status updates

Functions:
  - generateWarmupEmail(senderName, recipientName): { subject, html }
    Picks random category, random subject, random body, interpolates names
  - generateWarmupReply(originalSubject): { subject, html }
    Picks random reply body, prepends "Re: " to subject

Important: content must NOT contain marketing language, unsubscribe links,
or anything that looks like a campaign. ESPs penalize warmup content that
looks automated.
```

### 3c. Mailbox Enrollment Management

**New file: `convex/warmupPool.ts`**

```
--- Mutations (authenticated, called from UI) ---

startWarmup(mailboxId, speed):
  1. Verify user owns the mailbox
  2. Verify the domain's DNS is fully configured (SPF + DKIM + DMARC)
  3. Check no existing active warmupMailboxes entry for this mailbox
  4. Calculate initial dailyLimit based on speed:
     - slow:   start at 2/day, reach 20/day over 4+ weeks
     - normal: start at 5/day, reach 20/day over 2-3 weeks
     - fast:   start at 10/day, reach 20/day over 1-2 weeks
  5. Insert warmupMailboxes row with status "active", currentDay 1
  6. Return the entry

pauseWarmup(warmupMailboxId):
  1. Verify user owns the entry
  2. Set status to "paused"
  3. Does not delete -- preserves history and health score

resumeWarmup(warmupMailboxId):
  1. Verify user owns the entry
  2. Set status to "active"

updateSpeed(warmupMailboxId, speed):
  1. Verify user owns the entry
  2. Update speed and recalculate dailyLimit for current day

--- Queries (authenticated) ---

getWarmupStatus(mailboxId):
  Return current warmupMailboxes entry with stats for the mailbox

getWarmupHistory(warmupMailboxId, days):
  Return daily aggregates of emails sent/received, inbox rate, health score

--- Internal queries (called by cron) ---

listActiveWarmupMailboxes():
  Return all warmupMailboxes entries where status === "active"
```

### 3d. Platform Account Management

**New file: `convex/platformWarmupAccounts.ts`**

Admin-only functions for managing the platform Gmail accounts. These are called from a protected admin UI, not by regular users.

```
--- Mutations (admin only, no userId scoping) ---

addAccount(email, accessToken, refreshToken, tokenExpiresAt):
  Insert a new platformWarmupAccounts row with status "active", dailySentCount 0

pauseAccount(accountId):
  Set status to "paused" -- excludes this account from the next round

activateAccount(accountId):
  Set status to "active"

removeAccount(accountId):
  Delete the row -- only do this if the account is decommissioned

--- Queries (admin only) ---

listAllAccounts():
  Return all accounts with current dailySentCount, dailyReceivedCount, status

--- Internal ---

getAvailableAccounts():
  Return accounts where status === "active" AND dailySentCount < 450
  Sorted by dailySentCount ASC (least-used first for load balancing)

refreshTokenIfNeeded(accountId):
  If tokenExpiresAt < Date.now() + 5 minutes:
    POST to Google token endpoint with refreshToken
    Update accessToken and tokenExpiresAt
    Return fresh accessToken
  If refresh fails (token revoked):
    Set status = "token_expired"
    Throw error so the engine skips this account
```

### 3e. Gmail API Functions

**New file: `convex/warmupGmail.ts`**

All Gmail API interactions for the warmup system. Uses the platform accounts' OAuth tokens.

```
sendViaGmail(accountId, to, subject, html, inReplyToMessageId?):
  1. refreshTokenIfNeeded(accountId)
  2. Build RFC 2822 MIME message
     - Include In-Reply-To header if inReplyToMessageId is set
     - Include X-Warmup-Id header with the warmupEmails record ID
     - Do NOT include unsubscribe headers
  3. POST to Gmail API: /gmail/v1/users/me/messages/send
  4. Return messageId from response

checkPlacement(accountId, messageId):
  1. refreshTokenIfNeeded(accountId)
  2. GET /gmail/v1/users/me/messages?q=rfc822msgid:{messageId}
  3. Check labelIds on the result:
     - Contains "INBOX" → placement = "inbox"
     - Contains "SPAM" → placement = "spam"
     - Not found yet → placement = "unknown"
  4. Return { placement, isImportant: labelIds.includes("IMPORTANT") }

rescueFromSpam(accountId, messageId):
  1. refreshTokenIfNeeded(accountId)
  2. Find the Gmail message ID for the given RFC messageId
  3. POST /gmail/v1/users/me/messages/{id}/modify:
     { addLabelIds: ["INBOX", "IMPORTANT"], removeLabelIds: ["SPAM"] }

markImportant(accountId, messageId):
  1. refreshTokenIfNeeded(accountId)
  2. POST /gmail/v1/users/me/messages/{id}/modify:
     { addLabelIds: ["IMPORTANT"] }

replyViaGmail(accountId, originalMessageId, to, subject, html):
  Calls sendViaGmail with inReplyToMessageId = originalMessageId
```

### 3f. Email Exchange Engine (the core cron)

**New file: `convex/warmupEngine.ts`**

Cron job that runs every 30 minutes. For each active user mailbox, sends warmup emails to platform Gmail accounts and triggers engagement on previously received emails.

```
internalAction runWarmupRound():
  1. Fetch all active warmupMailboxes entries (listActiveWarmupMailboxes)
  2. Fetch available platform accounts (getAvailableAccounts -- sorted by dailySentCount ASC)
  3. If no platform accounts available → log "all platform accounts at daily capacity" and exit

  --- Outbound: user mailbox → platform Gmail accounts ---

  4. For each active warmupMailboxes entry where sentToday < dailyLimit:
     a. Pick 2-3 platform accounts from the available list
        - Rotate selection day-to-day (don't always pick the same accounts)
        - Pick accounts with lowest dailySentCount first (natural load balancing)
     b. For each selected platform account:
        - Generate warmup email content via warmupContent.generateWarmupEmail()
        - Send via SES from the user's mailbox (bypass quota checks and unsubscribe
          filtering -- warmup sends are internal platform traffic)
          * Include X-Warmup-Id header with warmupEmails record ID
          * Include tracking pixel
          * Do NOT include unsubscribe headers
        - Create warmupEmails record: direction="outbound", placement="unknown"
        - Increment warmupMailboxes.sentToday
        - Increment platformWarmupAccounts.dailyReceivedCount

  --- Inbound: platform Gmail accounts → user mailbox ---

  5. For each active warmupMailboxes entry where receivedToday < dailyLimit:
     a. Pick 1-2 platform accounts
     b. For each selected account:
        - Generate warmup email content
        - Send via Gmail API (sendViaGmail) to the user's mailbox address
        - Create warmupEmails record: direction="inbound", placement="unknown"
        - Increment warmupMailboxes.receivedToday
        - Increment platformWarmupAccounts.dailySentCount

  6. Log: sent X outbound, Y inbound warmup emails this round
```

### 3g. Engagement Simulation

**New file: `convex/warmupEngagement.ts`**

Cron job running every 30 minutes (offset 15 min from the exchange engine). Uses the Gmail API to perform real engagement actions on outbound warmup emails received by platform accounts.

```
internalAction runEngagementRound():
  1. Fetch outbound warmupEmails sent in the last 4 hours where openedAt is null
     (direction="outbound" -- these landed in platform Gmail accounts)
  2. For each email:

     a. Check placement via Gmail API (checkPlacement):
        - If "inbox": proceed to engagement
        - If "spam":  rescue first (rescueFromSpam), then engage
        - If "unknown": skip this round, check again next round
        - Update warmupEmails.placement

     b. Open simulation (85% of inbox emails):
        - HTTP GET to the tracking pixel URL embedded in the email
          (this fires the existing open tracking handler in convex/http.ts)
        - Set warmupEmails.openedAt = now + random(5-60 min) via scheduler
        - Random delay: schedule 5-60 minutes after sentAt to look human

     c. Mark as important (45% of opened emails):
        - Call markImportant(platformAccountId, messageId) via Gmail API
        - Set warmupEmails.markedImportant = true

     d. Reply simulation (25% of opened emails):
        - Generate reply content via warmupContent.generateWarmupReply()
        - Call replyViaGmail(platformAccountId, messageId, userMailboxAddress, ...)
        - Set warmupEmails.repliedAt, repliedMessageId
        - Random delay: 15-120 minutes after open time

  Randomization is critical:
    - 85% open rate (not 100% -- 15% of emails are "ignored")
    - 45% mark as important (of opened)
    - 25% reply rate (of opened)
    - All delays randomized -- never process all emails at the same second
    - Use Math.random() for all probabilistic decisions
```

### 3h. Placement Detection for Inbound Warmup Emails

When a platform Gmail account sends an email to a user's Mailmark mailbox (direction="inbound"), placement is detected via the existing SES inbound webhook -- if it arrives, it's inbox (SES mailboxes have no spam folder).

**Modify: `convex/http.ts`** (inbound email processing)

```
After storing the inbound email:
  1. Check X-Warmup-Id header or match warmupEmails by messageId
  2. If this is a warmup email:
     - Update warmupEmails.placement = "inbox"
     - Store the email with folder = "_warmup" (NOT "inbox")
     - Do NOT show in user's regular mailbox UI
```

### 3i. Health Score Calculation

**Add to `convex/warmupPool.ts`:**

```
internalMutation recalculateHealthScore(warmupMailboxId):
  1. Fetch outbound warmupEmails for this mailbox in the last 7 days
     (direction="outbound" -- these are the ones that landed in Gmail)
  2. Calculate:
     - inboxRate = emails where placement="inbox" / total * 100
     - openRate  = emails where openedAt is set / total * 100
     - replyRate = emails where repliedAt is set / total * 100
  3. healthScore = weighted average:
     - inboxRate * 0.6   (most important -- real Gmail placement signal)
     - openRate  * 0.2
     - replyRate * 0.2
  4. Update warmupMailboxes with healthScore and inboxRate

Run daily via cron after the day-advance job.
```

### 3j. Daily Advancement Cron

**Add to `convex/warmupEngine.ts`:**

```
internalAction advanceWarmupDay():
  1. For each active warmupMailboxes entry:
     a. Increment currentDay
     b. Recalculate dailyLimit based on speed and currentDay:
        Slow:   day 1-7: 2, day 8-14: 5, day 15-21: 10, day 22-28: 15, day 29+: 20
        Normal: day 1-3: 5, day 4-7: 10, day 8-14: 15, day 15-21: 20, day 22+: 20
        Fast:   day 1-3: 10, day 4-7: 15, day 8-14: 20, day 15+: 20
     c. Reset sentToday = 0, receivedToday = 0
     d. Recalculate health score (recalculateHealthScore)

  2. Reset daily counters on all platformWarmupAccounts:
     - dailySentCount = 0
     - dailyReceivedCount = 0
     - lastResetAt = Date.now()
```

### 3k. Cron Registration

**Modify: `convex/crons.ts`:**

```typescript
// Every 30 minutes: send warmup emails (mailbox <-> platform Gmail accounts)
crons.interval("warmup exchange", { minutes: 30 }, internal.warmupEngine.runWarmupRound, {});

// Every 30 minutes (offset 15 min): Gmail engagement on received warmup emails
crons.interval("warmup engagement", { minutes: 30 }, internal.warmupEngagement.runEngagementRound, {});

// Daily at 6:30 AM UTC: advance days, reset counters, recalculate health scores
crons.daily("advance warmup day", { hourUTC: 6, minuteUTC: 30 }, internal.warmupEngine.advanceWarmupDay, {});
```

### 3l. Admin UI for Platform Accounts

**New page: `app/(protected)/admin/warmup-accounts/page.tsx`**

A protected admin page (founder-only, gated by a hardcoded Clerk userId check) for managing platform Gmail accounts.

```
Platform Warmup Accounts

  email                     status          sent today   received today   [actions]
  warmup1@gmail.com         active          127          89               [Pause] [Remove]
  warmup2@gmail.com         active          134          102              [Pause] [Remove]
  warmup3@gmail.com         token_expired   0            0                [Reconnect] [Remove]

  Total capacity: ~900 outbound emails/day (3 active accounts × 450 limit)
  Active user mailboxes in warmup: 47

  [+ Connect Gmail Account]  -- triggers OAuth flow, creates row on callback
```

Adding a new account: click "Connect Gmail Account", authorize via Google OAuth, tokens stored in `platformWarmupAccounts`. The new account is immediately included in the next warmup round. No code changes needed to scale.

### 3m. Warming UI (User-Facing)

**Modify: `app/(protected)/warming/page.tsx`**

Replace the current basic warming schedule UI with a full warmup dashboard. No Gmail connection required from the user -- just click "Start Warmup".

```
Sections:

1. "Your Mailboxes in Warmup" -- list of enrolled mailboxes:
   - Health score badge (green >80, yellow 50-80, red <50)
   - Inbox rate % (real Gmail placement)
   - Current day / speed label
   - Sent today / Received today
   - Pause/Resume toggle
   - Speed selector (slow/normal/fast)

2. "Add Mailbox to Warmup" -- for mailboxes not yet enrolled:
   - Dropdown of eligible mailboxes (DNS verified, not already active)
   - Speed selection
   - "Start Warmup" button

3. "Warmup Activity" -- chart per mailbox, last 14 days:
   - Emails sent per day (outbound to Gmail)
   - Emails received per day (inbound from Gmail)
   - Inbox rate trend line
   - Health score trend line

4. "Recent Warmup Emails" -- table of last 20 warmup emails:
   - Direction, From, To, Subject, Sent, Opened, Replied, Placement
```

### 3n. Warmup Email Filtering

Warmup emails arriving at a user's Mailmark mailbox must not appear in the regular inbox.

**Modify: `convex/http.ts`** (inbound email processing)

```
When an inbound email has X-Warmup-Id header or matches a warmupEmails record by messageId:
  - Store with folder = "_warmup" instead of "inbox"
  - Existing inbox queries (filtered by folder "inbox") will never show these
  - The warming dashboard queries folder "_warmup" for the activity table
```

### Files to Create/Modify

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `platformWarmupAccounts`, `warmupMailboxes`, `warmupEmails`, `warmupContentTemplates` tables |
| `convex/platformWarmupAccounts.ts` | **New** -- admin CRUD + getAvailableAccounts + token refresh |
| `convex/warmupPool.ts` | **New** -- user mailbox enrollment mutations/queries + health score |
| `convex/warmupContent.ts` | **New** -- email content generation (50+ templates, 4 categories) |
| `convex/warmupGmail.ts` | **New** -- Gmail API: send, checkPlacement, rescueFromSpam, markImportant, reply |
| `convex/warmupEngine.ts` | **New** -- exchange cron (outbound + inbound sends) + advanceWarmupDay |
| `convex/warmupEngagement.ts` | **New** -- engagement cron: placement check, open pixel, mark important, reply |
| `convex/crons.ts` | Register 3 new cron jobs |
| `convex/http.ts` | Detect warmup emails in inbound handler, store in _warmup folder |
| `convex/warmingSchedules.ts` | Keep existing for backward compat (volume gating still useful) |
| `app/(protected)/warming/page.tsx` | Full warmup dashboard rewrite (no external account connection UI) |
| `app/(protected)/admin/warmup-accounts/page.tsx` | **New** -- admin page to manage platform Gmail accounts |

### External Dependencies

- **Google Cloud Console**: Create OAuth app, request `gmail.send`, `gmail.readonly`, `gmail.modify` scopes. Approval takes 2-4 weeks for sensitive scopes. Register early -- this runs in parallel with development.
- **Token security**: OAuth tokens stored in Convex. Consider encrypting at rest in a Convex action before storing (Convex has no native field-level encryption).

### Capacity Planning

Gmail's sending limit is 500 emails/day per account. The engine uses 450 as a safe buffer.

| Platform accounts | Daily outbound capacity | Comfortable for N user mailboxes |
|-------------------|------------------------|----------------------------------|
| 5 | 2,250 | ~225 mailboxes (10 emails/day each) |
| 10 | 4,500 | ~450 mailboxes |
| 20 | 9,000 | ~900 mailboxes |

Add accounts to the `platformWarmupAccounts` table as the user base grows. The engine picks them up immediately.

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Google flags platform accounts for high-volume automated patterns | Vary content (50+ templates), vary timing (random delays), vary engagement rates (not 100% open). Keep per-account daily volume well under Gmail limits. |
| OAuth token revoked or expired | refreshTokenIfNeeded runs before every API call. Token-expired accounts are skipped and flagged in admin UI for reconnection. |
| Warmup content detected as automated | Large template library. Subjects and bodies randomly paired. Different platform accounts receive different content. |
| Platform accounts at daily capacity (too many users) | Admin adds more accounts via admin UI. Capacity table in this doc makes the threshold visible. |
| Inbound warmup emails appear in user inbox | X-Warmup-Id header + messageId match routes them to _warmup folder in inbound webhook handler. |

### Verification

1. Add 2+ platform Gmail accounts via admin UI
2. Enroll a test mailbox in warmup (any speed)
3. Wait for `runWarmupRound` cron to fire (or trigger manually)
4. Verify outbound warmup emails appear in `warmupEmails` table with direction="outbound"
5. Verify inbound warmup emails arrive at the test mailbox in folder "_warmup" (not inbox)
6. Wait for `runEngagementRound` to fire
7. Verify Gmail API placement check updates `warmupEmails.placement` to "inbox" or "spam"
8. Verify opens tracked (openedAt set), replies sent (repliedAt set)
9. Verify health score updates daily
10. `bun run build` passes

---

## Phase 4: GWS / Outlook SMTP Integration (for sending campaigns)

**Impact: HIGH** | **Effort: Spike 1 week, full build 4-6 weeks** | **Defer until after Phase 3**

The churned user said: "connecting GWS/outlook on clients end would have client carry the risk"

This is separate from Phase 3's warmup infrastructure. Phase 3 uses platform-owned Gmail accounts to warm user mailboxes. Phase 4 lets users connect their own Gmail/Outlook accounts as the sending identity for campaigns and sequences.

### Why This Matters for Cold Emailers

Cold emailers buy domains on behalf of clients and set up mailboxes. If the domain gets burned (reputation tanks), they want the CLIENT's Google Workspace or Outlook account to carry the risk, not their own infrastructure. Sending through the client's own SMTP means:
- Domain reputation is tied to the client's account
- If the account gets suspended, it's the client's problem
- The agency can rotate accounts easily

### Current State

All sends go through `convex/ses.ts` using AWS SES `SendEmailCommand`. The entire pipeline (sending, S3 storage, delivery tracking via SNS webhooks) is tightly coupled to AWS.

### Architecture Change

Create a provider abstraction layer so the send pipeline can route through different backends:

```
SendProvider interface:
  send(from, to, subject, html, options): { messageId }
  getDeliveryStatus(messageId): "pending" | "delivered" | "bounced" | "failed"

Implementations:
  - SESProvider (existing, default)
  - GmailProvider (via OAuth + Gmail API)
  - OutlookProvider (via OAuth + Microsoft Graph)
  - SMTPProvider (generic, user provides host/port/credentials)
```

### Implementation Approach

#### Spike (1 week): Validate OAuth in Convex

Before committing to the full build, validate that:
1. OAuth flows work within Convex's action sandbox (HTTP redirects, token exchange)
2. Gmail API sending works from a Convex action (not just SMTP)
3. Microsoft Graph API sending works from a Convex action
4. Token refresh works reliably

If the spike succeeds, proceed with the full build.

#### Full Build (4-6 weeks)

**Phase 4a: Provider Abstraction (1 week)**

**New file: `convex/lib/sendProvider.ts`**

```
Abstract the send path:
  1. Look up the mailbox
  2. If mailbox has an externalMailAccountId -> use Gmail/Outlook provider
  3. If mailbox is a Mailmark SES mailbox -> use SES provider (existing path)
  4. If mailbox has custom SMTP config -> use SMTP provider

This replaces direct SES calls in:
  - convex/ses.ts (sendEmailViaApi, sendEmailForCompose)
  - convex/sequenceActions.ts (processStep)
```

**Phase 4b: Gmail Sending (1 week)**

Reuse the OAuth infrastructure from Phase 3 (`convex/externalMail.ts`).

```
GmailProvider.send(from, to, subject, html):
  1. Look up externalMailAccount for the from address
  2. Refresh access token if needed
  3. Build RFC 2822 MIME message
  4. Call Gmail API: POST /gmail/v1/users/me/messages/send
  5. Extract messageId from response
  6. Store in emails table like any other sent email

Delivery tracking:
  - Gmail doesn't have webhooks for delivery status
  - Poll via Gmail API for bounces (check for bounce notification emails)
  - Or: use the tracking pixel (already in all sent emails) for open detection
```

**Phase 4c: Outlook Sending (1 week)**

```
OutlookProvider.send(from, to, subject, html):
  1. Look up externalMailAccount for the from address
  2. Refresh access token if needed
  3. Call Microsoft Graph: POST /me/sendMail
  4. Store in emails table

Delivery tracking:
  - Similar to Gmail -- no native webhooks
  - Use tracking pixel for opens
  - Poll for bounce notifications
```

**Phase 4d: Generic SMTP (1 week)**

For users who have their own SMTP relay (not just Gmail/Outlook).

**Modify: `convex/schema.ts`:**

```
smtpConfigs: defineTable({
  userId: Id<"users">,
  mailboxId: Id<"mailboxes">,
  host: string,
  port: number,
  username: string,
  password: string,        // encrypted
  encryption: "tls" | "starttls" | "none",
  verified: boolean,       // set after successful test send
})
  .index("by_mailbox_id", ["mailboxId"])
```

```
SMTPProvider.send(from, to, subject, html):
  1. Look up smtpConfig for the mailbox
  2. Connect to SMTP server using nodemailer
  3. Send the email
  4. Store in emails table
```

**Phase 4e: UI -- Connect Sending Account (1 week)**

**Modify: `app/(protected)/domains/[domainId]/page.tsx` or similar**

Add a "Sending Method" section per mailbox:
- Default: Mailmark SES (no config needed)
- Gmail: Connect via OAuth
- Outlook: Connect via OAuth
- Custom SMTP: Enter host/port/credentials

### Files to Create/Modify

| File | Change |
|------|--------|
| `convex/lib/sendProvider.ts` | **New** -- provider abstraction layer |
| `convex/externalMail.ts` | **New** -- user-connected Gmail/Outlook OAuth + send (separate from Phase 3 platform accounts) |
| `convex/schema.ts` | Add `smtpConfigs` table |
| `convex/ses.ts` | Refactor to use provider abstraction |
| `convex/sequenceActions.ts` | Route sends through provider abstraction |
| Domain/mailbox settings UI | Add sending method configuration |

### External Blockers

- **Google OAuth app approval**: 2-4 weeks for sensitive scopes (`gmail.send`). Start this during Phase 3.
- **Microsoft app registration**: Similar timeline. Start early.
- **Security review**: Storing OAuth tokens and SMTP credentials requires encryption at rest. Convex doesn't have native field-level encryption -- may need to encrypt/decrypt in actions.

### Verification

1. Connect a Gmail account as sending method for a mailbox
2. Send a test email through the API -- verify it goes through Gmail SMTP
3. Verify the email appears in the Gmail "Sent" folder
4. Verify tracking pixel works (open detection)
5. Connect an Outlook account, repeat tests
6. Test custom SMTP with a known relay (e.g., Mailgun, SendGrid)
7. `bun run build` passes

---

## Implementation Timeline

| Week | Phase | Milestone |
|------|-------|-----------|
| 1 | Phase 1 | Social proof shipped (stats, founder, testimonials, logos) |
| 1-2 | Phase 2 | Sequence processing engine + HTTP endpoints |
| 3 | Phase 2 | Reply/bounce detection + API docs. Sequences API complete. |
| 3 | Phase 3 | Start Google OAuth app registration for platform accounts (runs in parallel) |
| 4-5 | Phase 3 | Schema, platform account management, exchange engine, content templates |
| 6-7 | Phase 3 | Gmail API engagement (placement, rescue, reply), health scores |
| 8 | Phase 3 | Warming UI, admin UI, warmup email filtering |
| 10 | Phase 4 | Spike: validate OAuth sending in Convex |
| 11-14 | Phase 4 | Provider abstraction, Gmail/Outlook/SMTP sending |

**Total: ~14 weeks to full feature parity with cold email platforms**

---

## Quick Reference: What's Already Built

| Component | Status |
|-----------|--------|
| `convex/schema.ts` -- sequences + enrollments tables | Done |
| `convex/sequences.ts` -- CRUD + enrollment mutations + reply detection | Done |
| `convex/sequenceActions.ts` -- public API (create, pause, resume, cancel, enroll, getByMailbox) | Done |
| `convex/sequenceProcessing.ts` -- step processing engine (delays, sends, completion) | Done |
| `convex/http.ts` -- /v1/send API, reply detection hook, quotas, warming enforcement | Done |
| `convex/ses.ts` -- SES sending with tracking, unsubscribe, quotas | Done |
| `convex/warmingSchedules.ts` -- volume ramping (gates sends) | Done (legacy, keep) |
| `convex/warmingActions.ts` -- daily schedule advancement | Done (legacy, keep) |
| `convex/crons.ts` -- domain cleanup, warming advance, health checks | Done |
| `app/(protected)/warming/page.tsx` -- basic warming UI | Done (will be rewritten in Phase 3k) |
| `convex/platformWarmupAccounts.ts` -- platform Gmail account management | Phase 3 |
| `convex/warmupPool.ts` -- mailbox enrollment + health score | Phase 3 |
| `convex/warmupContent.ts` -- warmup email templates | Phase 3 |
| `convex/warmupGmail.ts` -- Gmail API: send, placement, rescue, reply | Phase 3 |
| `convex/warmupEngine.ts` -- exchange cron + daily advance | Phase 3 |
| `convex/warmupEngagement.ts` -- engagement cron | Phase 3 |
| `app/(protected)/admin/warmup-accounts/page.tsx` -- admin Gmail account UI | Phase 3 |
| `app/(protected)/mailbox/[mailboxId]/page.tsx` -- follow-up builder + follow-ups tab | Done |
| `app/docs/api/page.tsx` -- API docs with sequences endpoints | Done |
| `public/llms.txt` -- sequences feature + API documentation | Done |
