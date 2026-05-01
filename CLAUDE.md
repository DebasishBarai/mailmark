# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start Next.js dev server
bun run build        # Production build (use to verify changes compile)
bun run lint         # ESLint (next/core-web-vitals + next/typescript)
```

Always use `bun`, never `npm` or `npx`.

## Architecture

**Mailmark** is an email hosting and campaign platform for custom domains. This repo is the Next.js frontend (App Router, React 19, Tailwind CSS v4).

### Provider Stack (root layout)

`ThemeProvider` > `ClerkThemeProvider` > `ConvexClientProvider` wraps the entire app. All client components have access to Clerk auth and Convex queries.

### Route Groups

- **`app/(protected)/`** -- Authenticated app pages (dashboard, domains, mailbox, settings, billing, etc.). Protected by Clerk middleware in `proxy.ts` via `createRouteMatcher(["/dashboard(.*)", "/domains(.*)", "/mailbox(.*)"])`.
- **`app/tools/`** -- Public SEO tools (free, no auth required for most). Each tool has a `page.tsx` (server component with metadata + JSON-LD) and a client component.
- **`app/docs/`, `app/guides/`, `app/blog/`** -- Public content pages.
- **`app/api/tools/`** -- Next.js API routes for tool backends (DNS checks, email validation, etc.).

### Backend: Convex

- `convex/schema.ts` -- Database schema (users, domains, mailboxes, emails, campaigns, awsAccounts, etc.)
- `convex/http.ts` -- HTTP router for webhooks (email ingestion, tracking pixels, click tracking, SES sending events)
- Client-side data: `useQuery(api.xxx.yyy)` / `useMutation(api.xxx.yyy)` from `convex/react`
- Auth in Convex actions uses Clerk's `clerkId` mapped to a Convex `users` row

### Auth Pattern (Clerk + Convex)

- **Server-side (API routes):** `auth()` from `@clerk/nextjs/server` to get `userId`
- **Client-side conditional rendering:** `<Authenticated>` / `<Unauthenticated>` from `convex/react`
- **Sign-in modal:** `<SignInButton mode="modal" forceRedirectUrl="...">` from `@clerk/nextjs`

### API Routing (api.mailmark.dev)

`next.config.ts` rewrites all `api.mailmark.dev` traffic to the Convex site URL (`CONVEX_SITE_URL`). CORS headers are set for `https://www.mailmark.dev`. The middleware in `proxy.ts` handles CORS preflight.

### BYO-AWS

Users can deploy Mailmark infrastructure in their own AWS account via CloudFormation. Domains can reference an `awsAccountId` in the `domains` table. When set, SES/S3/SNS calls use the user's AWS credentials via `AssumeRole`.

### Tools Pattern

Each tool under `app/tools/[tool-name]/` follows:
1. `page.tsx` -- Server component exporting `metadata` (title, description, keywords) and a `jsonLd` FAQ schema. Renders `Header`, the tool client component, and `Footer`.
2. `ToolComponent.tsx` -- `"use client"` component with the tool UI, form inputs, results display, CTA banner, and FAQ section.
3. `app/api/tools/[endpoint]/route.ts` -- API route if the tool needs server-side logic (DNS lookups, AI calls, etc.).

When adding a new tool, also update: `app/tools/page.tsx` (tool card), `app/components/Footer.tsx` (footer link -- limited to 4 items), `app/sitemap.ts`, and `public/llms.txt`.

### Styling

- Tailwind CSS v4 with `@import "tailwindcss"` in `globals.css`
- Dark mode via `@variant dark (&:where(.dark, .dark *))` class strategy
- Violet as accent color throughout (`violet-600`, `violet-50`, etc.)
- Geist Sans + Geist Mono fonts

## Conventions

- Comment out old code instead of deleting it
- Never use em dash (--) in any text content
- Tool pages use `self-start` on icon containers to prevent flex stretch
- Footer Tools section is limited to a set number of links
- All domain URLs use `www.mailmark.dev` (not bare `mailmark.dev`)
