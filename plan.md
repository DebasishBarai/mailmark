# Mailmark -- Product Roadmap & Implementation Plan

Last updated: 2026-05-02 (Phase 1 completed)

This plan addresses 4 product gaps identified from a churned cold email agency user. The user paid for Starter, cancelled within an hour without setting up a domain. Root cause: Mailmark lacks the warmup and sequencing features cold emailers require.

---

## Table of Contents

1. [Phase 1: Social Proof & Trust Signals](#phase-1-social-proof--trust-signals) -- COMPLETED
2. [Phase 2: Sequences API](#phase-2-sequences-api) (2-3 weeks) -- IN PROGRESS
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

## Phase 2: Sequences API

**Impact: HIGH** | **Effort: 2-3 weeks** | **API-first differentiator for power users**

The churned user said: "API first will attract most leveraged users with high volume"

This is an API-only v1 -- no UI. Users create and manage sequences entirely through the REST API using their API key.

### Current State (partially built)

- Schema tables `sequences` and `sequenceEnrollments` already added to `convex/schema.ts`
- CRUD module `convex/sequences.ts` already written with all internal queries and mutations
- Remaining: step processing engine (`convex/sequenceActions.ts`) and HTTP API endpoints (`convex/http.ts`)

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

- `bun run build` passes
- `bun run lint` clean

---

## Phase 3: Email Warmup Infrastructure

**Impact: CRITICAL** | **Effort: 4-6 weeks** | **The #1 feature cold emailers need**

The churned user said: "warmup is the hardest piece, pure sending I can do easily myself"

### Current State

The existing warming system in `convex/warmingSchedules.ts` is volume-ramping only:
- Tracks `sentToday` vs `dailyLimit` over 28 days (5 to 250 emails/day)
- Gates user-initiated sends but does NOT actually send any warmup emails
- No warmup pool, no simulated engagement, no inbox/spam tracking
- UI at `app/(protected)/warming/page.tsx` shows schedule progress

### What Cold Emailers Expect

A warmup pool where real emails are exchanged between pool members with automated engagement signals:
- Real emails sent between pool accounts
- Automated opens (load tracking pixel)
- Automated replies with natural-sounding content
- Spam rescue (move from spam to inbox, mark as important)
- Health score based on inbox placement rate
- Volume ramping (slow/normal/fast)

### Architecture Overview

The warmup system has 3 layers:

1. **Pool Management** -- Users opt mailboxes into the warmup pool
2. **Email Exchange Engine** -- Cron-driven system that pairs pool members and sends warmup emails
3. **Engagement Simulation** -- Automated opens, replies, and spam rescue on received warmup emails

### 3a. Schema Additions

**Modify: `convex/schema.ts`**

```
warmupPool: defineTable({
  userId: Id<"users">,
  mailboxId: Id<"mailboxes">,
  domainId: Id<"domains">,
  status: "active" | "paused",
  speed: "slow" | "normal" | "fast",
  dailyLimit: number,           // max warmup emails to SEND per day (determined by speed + day)
  sentToday: number,
  receivedToday: number,
  currentDay: number,           // days since joining pool
  healthScore: number,          // 0-100, based on inbox placement rate
  inboxRate: number,            // percentage of warmup emails landing in inbox (not spam)
  joinedAt: number,
  lastActivityAt: optional number,
})
  .index("by_user_id", ["userId"])
  .index("by_mailbox_id", ["mailboxId"])
  .index("by_status", ["status"])

warmupEmails: defineTable({
  fromPoolId: Id<"warmupPool">,
  toPoolId: Id<"warmupPool">,
  fromMailboxId: Id<"mailboxes">,
  toMailboxId: Id<"mailboxes">,
  messageId: string,
  subject: string,
  sentAt: number,
  // Engagement tracking
  openedAt: optional number,
  repliedAt: optional number,
  repliedMessageId: optional string,
  // Placement detection
  placement: optional "inbox" | "spam" | "unknown",
  rescuedFromSpam: optional boolean,
  markedImportant: optional boolean,
})
  .index("by_from_pool", ["fromPoolId"])
  .index("by_to_pool", ["toPoolId"])
  .index("by_message_id", ["messageId"])
  .index("by_sent_date", ["sentAt"])

warmupContentTemplates: defineTable({
  category: "business" | "personal" | "newsletter" | "notification",
  subjects: Array<string>,       // 10-20 subject variations per category
  bodies: Array<string>,         // 10-20 body variations per category
  replyBodies: Array<string>,    // 5-10 reply variations
})
```

### 3b. Warmup Content Generation

**New file: `convex/warmupContent.ts`**

Quality warmup requires diverse, natural-sounding email content. ESPs detect repetitive content patterns.

```
Approach:
  - Seed database with 50+ subject/body template pairs across 4 categories
  - Each template has merge slots: {{senderName}}, {{recipientName}}, {{company}}, {{topic}}
  - Subjects and bodies are randomly paired at send time (not always the same combo)
  - Reply bodies are separate templates, shorter and more casual

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

### 3c. Pool Management

**New file: `convex/warmupPool.ts`**

```
--- Mutations (authenticated, called from UI) ---

joinPool(mailboxId, speed):
  1. Verify user owns the mailbox
  2. Verify the domain's DNS is fully configured (SPF + DKIM + DMARC)
  3. Check no existing active pool entry for this mailbox
  4. Calculate initial dailyLimit based on speed:
     - slow: start at 2/day, reach 20/day over 4+ weeks
     - normal: start at 5/day, reach 20/day over 2-3 weeks
     - fast: start at 10/day, reach 20/day over 1-2 weeks
  5. Insert warmupPool row with status "active", currentDay 1
  6. Return the pool entry

leavePool(poolId):
  1. Verify user owns the pool entry
  2. Set status to "paused"
  3. Note: does not delete -- preserves history and health score

updateSpeed(poolId, speed):
  1. Verify user owns the pool entry
  2. Update speed and recalculate dailyLimit for current day

--- Queries (authenticated) ---

getPoolStatus(mailboxId):
  Return current pool entry with stats for the mailbox

getPoolHistory(poolId, days):
  Return daily aggregates of warmup emails sent/received, inbox rate, health score

--- Internal queries (called by cron) ---

listActivePoolEntries():
  Return all pool entries where status === "active"

getPoolEntryByMailboxId(mailboxId):
  Return pool entry for a given mailbox
```

### 3d. Email Exchange Engine (the core cron)

**New file: `convex/warmupEngine.ts`**

This is the heart of the warmup system. A cron job that runs every 30 minutes during business hours, pairs pool members, and sends warmup emails between them.

```
internalAction runWarmupRound():
  1. Fetch all active pool entries
  2. If fewer than 2 entries, log and exit (need at least 2 accounts to warm each other)
  3. For each pool entry that hasn't hit its dailyLimit:
     a. Pick a random OTHER pool entry as the recipient
        - Avoid sending to the same recipient consecutively
        - Avoid sending to mailboxes on the same domain
        - Prefer recipients who haven't received many warmup emails today
     b. Generate warmup email content via warmupContent.generateWarmupEmail()
     c. Send the email using SES (NOT via sendEmailViaApi -- warmup emails
        should bypass quota checks, unsubscribe filtering, and recipient
        verification since both sides are pool members)
        - Use the sender's mailbox SES credentials
        - Include a tracking pixel for open detection
        - Include a special X-Warmup-Id header with the warmupEmail record ID
        - Do NOT include unsubscribe headers (these are not campaigns)
     d. Create a warmupEmails record with sentAt = now, placement = "unknown"
     e. Increment sentToday on the sender's pool entry
     f. Increment receivedToday on the recipient's pool entry
  4. Log: sent X warmup emails this round

Pairing algorithm details:
  - Shuffle the active pool entries
  - For each entry with remaining capacity (sentToday < dailyLimit):
    - Filter candidates: different domain, different user, not the last recipient
    - Pick a random candidate from the filtered list
    - If no valid candidate exists, skip this entry for this round
  - This ensures variety: no two accounts warm each other exclusively
```

### 3e. Engagement Simulation

**New file: `convex/warmupEngagement.ts`**

After warmup emails are sent, simulate realistic engagement from the receiving side.

```
internalAction simulateEngagement():
  Runs every 30 minutes (offset from the send cron by 15 min)

  1. Fetch warmup emails sent in the last 2 hours where openedAt is null
  2. For each email (with probability to simulate realistic engagement):
     a. Open simulation (80-90% of emails):
        - HTTP GET to /track/open/{messageId}.gif
        - This triggers the existing open tracking pixel handler
        - Add random delay: schedule this 5-60 minutes after send time
        - Update warmupEmails.openedAt

     b. Reply simulation (20-30% of opened emails):
        - Generate reply content via warmupContent.generateWarmupReply()
        - Send reply from the RECIPIENT's mailbox back to the SENDER's mailbox
        - Use "Re: {originalSubject}" as subject
        - Include In-Reply-To header referencing original messageId
        - Update warmupEmails.repliedAt and repliedMessageId
        - Random delay: 10-120 minutes after open

     c. Mark as important (40-50% of opened emails):
        - This is tracked in warmupEmails.markedImportant
        - Note: we can't actually mark emails as important in the recipient's
          inbox from outside (no IMAP access to Mailmark mailboxes since they're
          SES-based). This field is for future use when we add Gmail/Outlook
          account support. For now, the open + reply signals are what matter.

  Randomization is critical:
    - Not every email should be opened (80-90%, not 100%)
    - Not every opened email should be replied to (20-30%)
    - Delays should vary (don't open all emails exactly 5 min after send)
    - Use Math.random() for all probabilistic decisions
```

### 3f. Placement Detection

When a warmup email arrives at a Mailmark mailbox (via the inbound email webhook), detect whether it landed in inbox or spam.

**Modify: `convex/http.ts`** (inbound email processing)

```
After storing the inbound email:
  1. Check X-Warmup-Id header or match against warmupEmails by messageId
  2. If this is a warmup email:
     - Mark placement as "inbox" (if it arrived, it's in the inbox)
     - Update the warmupEmails record
     - Do NOT show warmup emails in the user's mailbox UI
       (tag them with a folder like "_warmup" or filter them client-side)
```

For spam detection: since Mailmark mailboxes are SES-based and don't have a spam folder concept, placement detection is limited. The real signal comes when users add Gmail/Outlook accounts to the pool (Phase 4 integration). For now:
- Emails that arrive = "inbox"
- Emails that don't arrive within 30 min = "unknown" (could be spam, could be delayed)

### 3g. Health Score Calculation

**Add to `convex/warmupPool.ts`:**

```
internalMutation recalculateHealthScore(poolId):
  1. Fetch warmup emails received by this pool entry in the last 7 days
  2. Calculate:
     - inboxRate = (emails with placement "inbox") / (total received) * 100
     - replyRate = (emails with repliedAt set) / (total received) * 100
     - openRate = (emails with openedAt set) / (total received) * 100
  3. healthScore = weighted average:
     - inboxRate * 0.6 (most important signal)
     - openRate * 0.2
     - replyRate * 0.2
  4. Update pool entry with healthScore and inboxRate

Run daily via cron after the day-advance job.
```

### 3h. Daily Advancement Cron

**Modify: `convex/warmupEngine.ts`:**

```
internalAction advanceWarmupDay():
  For each active pool entry:
    1. Increment currentDay
    2. Recalculate dailyLimit based on speed and currentDay:
       Slow:   day 1-7: 2, day 8-14: 5, day 15-21: 10, day 22-28: 15, day 29+: 20
       Normal: day 1-3: 5, day 4-7: 10, day 8-14: 15, day 15-21: 20, day 22+: 20
       Fast:   day 1-3: 10, day 4-7: 15, day 8-14: 20, day 15+: 20
    3. Reset sentToday and receivedToday to 0
    4. Recalculate health score
```

### 3i. Cron Registration

**Modify: `convex/crons.ts`:**

```typescript
// Every 30 minutes: send warmup emails between pool members
crons.interval("warmup email exchange", { minutes: 30 }, internal.warmupEngine.runWarmupRound, {});

// Every 30 minutes (offset): simulate engagement on received warmup emails
crons.interval("warmup engagement", { minutes: 30 }, internal.warmupEngagement.simulateEngagement, {});

// Daily at 6:30 AM UTC: advance warmup pool days and recalculate scores
crons.daily("advance warmup pool", { hourUTC: 6, minuteUTC: 30 }, internal.warmupEngine.advanceWarmupDay, {});
```

### 3j. Gmail & Outlook Account Support (the differentiator)

This is what makes Mailmark's warmup work with accounts beyond its own SES-based mailboxes. Users can connect their Gmail and Outlook accounts to the warmup pool.

**Modify: `convex/schema.ts`:**

```
externalMailAccounts: defineTable({
  userId: Id<"users">,
  provider: "gmail" | "outlook",
  email: string,
  // OAuth tokens (encrypted at rest)
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: number,
  // IMAP/SMTP config (derived from provider, but stored for quick access)
  imapHost: string,
  imapPort: number,
  smtpHost: string,
  smtpPort: number,
  // Pool participation
  warmupPoolId: optional Id<"warmupPool">,
  status: "active" | "disconnected" | "token_expired",
  connectedAt: number,
  lastSyncAt: optional number,
})
  .index("by_user_id", ["userId"])
  .index("by_email", ["email"])
  .index("by_provider", ["provider"])
```

**OAuth Flow:**

For Gmail:
1. User clicks "Connect Gmail" in the warming UI
2. Redirect to Google OAuth consent screen
3. Request scopes: `gmail.send`, `gmail.readonly`, `gmail.modify` (for marking as important, moving from spam)
4. On callback, store access + refresh tokens in `externalMailAccounts`
5. Use tokens to send via Gmail SMTP and read via Gmail API/IMAP

For Outlook:
1. User clicks "Connect Outlook" in the warming UI
2. Redirect to Microsoft OAuth consent screen
3. Request scopes: `Mail.Send`, `Mail.ReadWrite`, `Mail.Read`
4. On callback, store tokens
5. Use tokens to send via Microsoft Graph API and read inbox

**New file: `convex/externalMail.ts`**

```
--- OAuth ---

getGmailAuthUrl(redirectUri): string
  Build Google OAuth URL with required scopes

handleGmailCallback(code, redirectUri):
  Exchange code for tokens, store in externalMailAccounts

getOutlookAuthUrl(redirectUri): string
  Build Microsoft OAuth URL with required scopes

handleOutlookCallback(code, redirectUri):
  Exchange code for tokens, store in externalMailAccounts

refreshAccessToken(accountId):
  If token is expired, use refresh token to get new access token

--- Sending ---

sendViaGmail(accountId, to, subject, html):
  1. Refresh token if needed
  2. Build RFC 2822 email
  3. Send via Gmail API (messages.send) or SMTP
  4. Return messageId

sendViaOutlook(accountId, to, subject, html):
  1. Refresh token if needed
  2. Send via Microsoft Graph API (sendMail)
  3. Return messageId

--- Reading (for placement detection) ---

checkGmailPlacement(accountId, messageId):
  1. Search Gmail for the message
  2. Check labels: INBOX, SPAM, IMPORTANT
  3. Return { placement: "inbox" | "spam", isImportant: boolean }

checkOutlookPlacement(accountId, messageId):
  1. Search Outlook for the message
  2. Check folder: Inbox, Junk Email
  3. Return { placement: "inbox" | "spam" }

--- Spam Rescue ---

rescueFromSpamGmail(accountId, messageId):
  1. Remove SPAM label
  2. Add INBOX label
  3. Optionally add IMPORTANT label

rescueFromSpamOutlook(accountId, messageId):
  1. Move message from Junk Email to Inbox
```

**Modify warmup engine to support external accounts:**

The `runWarmupRound` function needs to detect whether a pool entry's mailbox is a Mailmark SES mailbox or an external Gmail/Outlook account, and use the appropriate send method:

```
When sending a warmup email:
  - If sender is Mailmark mailbox: use SES SendEmailCommand (existing path)
  - If sender is external Gmail: use sendViaGmail
  - If sender is external Outlook: use sendViaOutlook

When checking placement (engagement simulation):
  - If recipient is Mailmark mailbox: check inbound email webhook arrival
  - If recipient is external Gmail: use checkGmailPlacement (true inbox/spam detection!)
  - If recipient is external Outlook: use checkOutlookPlacement

When rescuing from spam:
  - If recipient is Mailmark mailbox: not possible (SES has no spam folder)
  - If recipient is external Gmail: use rescueFromSpamGmail (move SPAM -> INBOX)
  - If recipient is external Outlook: use rescueFromSpamOutlook (move Junk -> Inbox)
```

This is the key differentiator: Gmail and Outlook accounts in the pool enable REAL placement detection and spam rescue, which SES-only mailboxes cannot do.

### 3k. Warming UI

**Modify: `app/(protected)/warming/page.tsx`**

Replace the current basic warming schedule UI with a full warmup dashboard:

```
Sections:
1. "Your Warmup Pool" -- list of mailboxes in the pool with:
   - Health score (color-coded: green > 80, yellow 50-80, red < 50)
   - Inbox rate percentage
   - Current day / speed
   - Daily sent/received counts
   - Pause/resume toggle
   - Speed selector (slow/normal/fast)

2. "Add to Pool" -- button to add a Mailmark mailbox
   - Dropdown of mailboxes not yet in the pool
   - Speed selection

3. "Connect External Account" -- buttons for Gmail and Outlook
   - Shows connected accounts with status
   - Disconnect option

4. "Warmup Activity" -- chart showing last 7-14 days:
   - Emails sent per day
   - Emails received per day
   - Inbox rate trend
   - Health score trend

5. "Recent Warmup Emails" -- table of last 20 warmup emails:
   - From, To, Subject, Sent At, Opened, Replied, Placement
```

### 3l. Warmup Email Filtering

Warmup emails should NOT appear in the user's regular mailbox inbox. They clutter the UI and confuse users.

**Modify: `convex/http.ts`** (inbound email processing)

```
When an inbound email has X-Warmup-Id header or matches a warmupEmails record:
  - Store the email with folder = "_warmup" instead of "inbox"
  - This way existing queries filtered by folder "inbox" won't show warmup emails
  - The warming UI can query emails with folder "_warmup" to show warmup activity
```

### Files to Create/Modify

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `warmupPool`, `warmupEmails`, `warmupContentTemplates`, `externalMailAccounts` tables |
| `convex/warmupPool.ts` | **New** -- pool management mutations/queries + health score |
| `convex/warmupContent.ts` | **New** -- email content generation |
| `convex/warmupEngine.ts` | **New** -- core cron: pair members, send warmup emails, advance days |
| `convex/warmupEngagement.ts` | **New** -- engagement simulation: opens, replies, spam rescue |
| `convex/externalMail.ts` | **New** -- Gmail/Outlook OAuth, send, read, spam rescue |
| `convex/crons.ts` | Register 3 new cron jobs |
| `convex/http.ts` | Warmup email detection in inbound handler, filter to _warmup folder |
| `convex/warmingSchedules.ts` | Keep existing for backward compat (volume gating still useful) |
| `app/(protected)/warming/page.tsx` | Full warmup dashboard rewrite |

### External Dependencies

- **Google Cloud Console**: Create OAuth app, request `gmail.send`, `gmail.readonly`, `gmail.modify` scopes. Approval takes 2-4 weeks for sensitive scopes.
- **Microsoft Azure AD**: Register app, request `Mail.Send`, `Mail.ReadWrite` permissions. Approval process varies.
- **Start OAuth app registration early** -- it runs in parallel with development.

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Small pool = accounts warming themselves (detectable by ESPs) | Minimum pool size of 5+ before enabling. Encourage early adoption with free warmup period. |
| Google/Microsoft revoke OAuth access | Token refresh on every use. Alert user if token expires. Graceful degradation. |
| Warmup content detected as automated | Large content library (50+ templates). Random pairing prevents repetitive patterns. |
| ESP rate limiting on warmup sends | Respect per-provider limits: Gmail 500/day, Outlook 300/day. Daily limits per pool entry. |
| Warmup emails landing in spam defeats the purpose | Spam rescue (Gmail/Outlook accounts). Start with very low volume. Health score monitoring. |

### Verification

1. Join 3+ test mailboxes to the pool (mix of Mailmark + Gmail)
2. Wait for cron to fire (or trigger manually)
3. Verify warmup emails appear in warmupEmails table
4. Verify engagement simulation fires (opens tracked)
5. Verify Gmail placement detection works (inbox vs spam)
6. Verify health scores update daily
7. Verify warmup emails don't appear in regular mailbox inbox
8. `bun run build` passes

---

## Phase 4: GWS / Outlook SMTP Integration (for sending campaigns)

**Impact: HIGH** | **Effort: Spike 1 week, full build 4-6 weeks** | **Defer until after Phase 3**

The churned user said: "connecting GWS/outlook on clients end would have client carry the risk"

This is separate from Phase 3's Gmail/Outlook warmup support. Phase 3 connects external accounts for warmup only. Phase 4 extends that to allow sending campaigns and sequences through those accounts.

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
| `convex/externalMail.ts` | Extend with sending capabilities (already created in Phase 3 for warmup) |
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
| 3 | Phase 3 | Start Google/Microsoft OAuth app registration (runs in parallel) |
| 4-5 | Phase 3 | Warmup pool core: schema, pool management, exchange engine, content |
| 6-7 | Phase 3 | Engagement simulation, health scores, warming UI |
| 8-9 | Phase 3 | Gmail/Outlook account connection for warmup pool |
| 10 | Phase 4 | Spike: validate OAuth sending in Convex |
| 11-14 | Phase 4 | Provider abstraction, Gmail/Outlook/SMTP sending |

**Total: ~14 weeks to full feature parity with cold email platforms**

---

## Quick Reference: What's Already Built

| Component | Status |
|-----------|--------|
| `convex/schema.ts` -- sequences + enrollments tables | Done |
| `convex/sequences.ts` -- CRUD + enrollment mutations | Done |
| `convex/warmingSchedules.ts` -- volume ramping (gates sends) | Done (legacy, keep) |
| `convex/warmingActions.ts` -- daily schedule advancement | Done (legacy, keep) |
| `convex/crons.ts` -- domain cleanup, warming advance, health checks | Done |
| `app/(protected)/warming/page.tsx` -- basic warming UI | Done (will be rewritten in Phase 3) |
| `convex/http.ts` -- /v1/send API with auth, quotas, warming enforcement | Done |
| `convex/ses.ts` -- SES sending with tracking, unsubscribe, quotas | Done |
