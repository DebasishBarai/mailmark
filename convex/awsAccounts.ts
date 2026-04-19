"use node";

/**
 * Connect, verify and manage user-provided AWS accounts for BYO
 * (bring-your-own) email infrastructure.
 *
 * Flow:
 *  1. Client calls `createDraft` → we generate an externalId + webhookSecret
 *     and store a `pending` awsAccounts row. We return the generated
 *     ExternalId + WebhookSecret + the CloudFormation launch URL so the
 *     client can open the AWS console.
 *  2. User deploys the Mailmark CloudFormation stack in their AWS account.
 *     The stack creates an IAM role whose trust policy requires our account
 *     ID + the ExternalId we gave them, plus an S3 bucket, Lambda, receipt
 *     rule set, configuration set, and SNS topics.
 *  3. User pastes the stack outputs (RoleArn, BucketName) back.
 *  4. Client calls `verify` → we AssumeRole, call STS GetCallerIdentity +
 *     SES GetAccount, and flip the row to `verified` on success.
 *
 * After verification, the account can be referenced by any number of
 * domains via `domains.awsAccountId`.
 */

import { v } from "convex/values";
import { action, internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { SESv2Client, GetAccountCommand } from "@aws-sdk/client-sesv2";
import { Id } from "./_generated/dataModel";

function randomHex(bytes: number): string {
  // 32-bit secure random is fine here; we only need per-account uniqueness,
  // not cryptographic secrecy beyond AWS's own ExternalId protections.
  const arr = new Uint8Array(bytes);
  // Web Crypto is available in Convex's Node runtime.
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const rows = await ctx.db
      .query("awsAccounts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Never return secrets to the client
    return rows.map((r) => ({
      _id: r._id,
      alias: r.alias,
      region: r.region,
      s3Bucket: r.s3Bucket,
      roleArn: r.roleArn,
      awsAccountId: r.awsAccountId,
      sesSandbox: r.sesSandbox,
      status: r.status,
      lastError: r.lastError,
      lastVerifiedAt: r.lastVerifiedAt,
      externalId: r.externalId,
      _creationTime: r._creationTime,
    }));
  },
});

export const getByIdInternal = internalQuery({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    return await ctx.db.get(accountId);
  },
});

export const getByWebhookSecretInternal = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    return await ctx.db
      .query("awsAccounts")
      .withIndex("by_webhook_secret", (q) => q.eq("webhookSecret", secret))
      .unique();
  },
});

export const listDomainsUsingAccount = internalQuery({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_aws_account", (q) => q.eq("awsAccountId", accountId))
      .collect();
  },
});

// ── Internal mutations ───────────────────────────────────────────────────────

export const insertDraft = internalMutation({
  args: {
    userId: v.id("users"),
    alias: v.string(),
    externalId: v.string(),
    webhookSecret: v.string(),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("awsAccounts", {
      userId: args.userId,
      alias: args.alias,
      externalId: args.externalId,
      webhookSecret: args.webhookSecret,
      region: args.region,
      roleArn: "",
      s3Bucket: "",
      status: "pending",
    });
  },
});

export const patchAccount = internalMutation({
  args: {
    accountId: v.id("awsAccounts"),
    alias: v.optional(v.string()),
    roleArn: v.optional(v.string()),
    s3Bucket: v.optional(v.string()),
    awsAccountId: v.optional(v.string()),
    region: v.optional(v.string()),
    sesSandbox: v.optional(v.boolean()),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("failed"))
    ),
    lastError: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, { accountId, ...patch }) => {
    await ctx.db.patch(accountId, patch);
  },
});

export const deleteAccount = internalMutation({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    await ctx.db.delete(accountId);
  },
});

// ── Public actions ───────────────────────────────────────────────────────────

/**
 * Allocate a new awsAccounts row in `pending` state. Returns the values the
 * client needs to launch the CloudFormation stack in the user's AWS console.
 *
 * The CFN template is served as a static asset from the Next.js `/public`
 * directory at `${APP_URL}/infra/byo-aws-cfn.yml`.
 */
export const createDraft = action({
  args: {
    alias: v.string(),
    region: v.string(),
  },
  handler: async (ctx, { alias, region }): Promise<{
    accountId: Id<"awsAccounts">;
    externalId: string;
    webhookSecret: string;
    mailmarkAwsAccountId: string;
    convexSiteUrl: string;
    appUrl: string;
    inboundWebhookUrl: string;
    sendingWebhookUrl: string;
    cfnTemplateUrl: string;
    launchStackUrl: string;
    region: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.domains.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const trimmedAlias = alias.trim();
    if (!trimmedAlias) throw new Error("Alias is required");

    const externalId = `mailmark-${randomHex(16)}`;
    const webhookSecret = randomHex(24);

    const accountId = await ctx.runMutation(internal.awsAccounts.insertDraft, {
      userId: user._id,
      alias: trimmedAlias,
      externalId,
      webhookSecret,
      region,
    });

    const appUrl = process.env.APP_URL ?? "";
    const convexSiteUrl =
      process.env.CONVEX_SITE_URL ??
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
      "";
    const mailmarkAwsAccountId = process.env.MAILMARK_AWS_ACCOUNT_ID ?? "";

    const cfnTemplateUrl = `${appUrl}/infra/byo-aws-cfn.yml`;
    const inboundWebhookUrl = `${convexSiteUrl}/ingestEmail`;
    const sendingWebhookUrl = `${appUrl}/api/ses-webhook`;

    // CloudFormation quick-create URL: opens the console with the template
    // pre-loaded and the Parameters fields pre-populated. User only needs to
    // tick the IAM acknowledgment and click "Create stack".
    const params = new URLSearchParams({
      templateURL: cfnTemplateUrl,
      stackName: `mailmark-byo-${accountId}`,
      param_ExternalId: externalId,
      param_MailmarkAwsAccountId: mailmarkAwsAccountId,
      param_WebhookSecret: webhookSecret,
      param_InboundWebhookUrl: inboundWebhookUrl,
      param_SendingWebhookUrl: sendingWebhookUrl,
    });
    const launchStackUrl = `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review?${params.toString()}`;

    return {
      accountId,
      externalId,
      webhookSecret,
      mailmarkAwsAccountId,
      convexSiteUrl,
      appUrl,
      inboundWebhookUrl,
      sendingWebhookUrl,
      cfnTemplateUrl,
      launchStackUrl,
      region,
    };
  },
});

/**
 * Verify the draft account by AssumeRoleing into the user's AWS account.
 * On success, stores RoleArn + BucketName + discovered AWS account ID and
 * flips status to "verified". On failure, stores the error + flips to
 * "failed" (the user can retry by calling verify again with corrected inputs).
 */
export const verify = action({
  args: {
    accountId: v.id("awsAccounts"),
    roleArn: v.string(),
    s3Bucket: v.string(),
  },
  handler: async (ctx, { accountId, roleArn, s3Bucket }): Promise<{
    verified: boolean;
    awsAccountId: string | null;
    sesSandbox: boolean | null;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.domains.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const account = await ctx.runQuery(internal.awsAccounts.getByIdInternal, {
      accountId,
    });
    if (!account || account.userId !== user._id) {
      throw new Error("AWS account not found");
    }

    const cleanRoleArn = roleArn.trim();
    const cleanBucket = s3Bucket.trim();
    if (!/^arn:aws:iam::\d{12}:role\/.+/.test(cleanRoleArn)) {
      return {
        verified: false,
        awsAccountId: null,
        sesSandbox: null,
        error: "RoleArn must look like arn:aws:iam::123456789012:role/...",
      };
    }
    if (!cleanBucket) {
      return {
        verified: false,
        awsAccountId: null,
        sesSandbox: null,
        error: "BucketName is required",
      };
    }

    // Step 1: assume the role.
    const sts = new STSClient({
      region: account.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    let tempCreds: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
    try {
      const res = await sts.send(
        new AssumeRoleCommand({
          RoleArn: cleanRoleArn,
          RoleSessionName: `mailmark-verify-${Date.now()}`,
          ExternalId: account.externalId,
          DurationSeconds: 900,
        })
      );
      const c = res.Credentials;
      if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
        throw new Error("AssumeRole returned no credentials");
      }
      tempCreds = {
        accessKeyId: c.AccessKeyId,
        secretAccessKey: c.SecretAccessKey,
        sessionToken: c.SessionToken,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.awsAccounts.patchAccount, {
        accountId,
        status: "failed",
        lastError: `AssumeRole failed: ${msg}`,
        roleArn: cleanRoleArn,
        s3Bucket: cleanBucket,
      });
      return {
        verified: false,
        awsAccountId: null,
        sesSandbox: null,
        error: `Could not assume role. Check that the trust policy allows ${process.env.MAILMARK_AWS_ACCOUNT_ID ?? "our AWS account"} and that the ExternalId matches. Details: ${msg}`,
      };
    }

    // Step 2: confirm identity.
    const stsAsUser = new STSClient({
      region: account.region,
      credentials: tempCreds,
    });
    let awsAccountId: string | null = null;
    try {
      const who = await stsAsUser.send(new GetCallerIdentityCommand({}));
      awsAccountId = who.Account ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.awsAccounts.patchAccount, {
        accountId,
        status: "failed",
        lastError: `GetCallerIdentity failed: ${msg}`,
      });
      return {
        verified: false,
        awsAccountId: null,
        sesSandbox: null,
        error: `Role assumed but GetCallerIdentity failed: ${msg}`,
      };
    }

    // Step 3: probe SES to surface sandbox state early (non-fatal if it fails).
    let sesSandbox: boolean | null = null;
    try {
      const sesv2 = new SESv2Client({
        region: account.region,
        credentials: tempCreds,
      });
      const accountInfo = await sesv2.send(new GetAccountCommand({}));
      // ProductionAccessEnabled === false means sandbox.
      sesSandbox = accountInfo.ProductionAccessEnabled === false;
    } catch {
      sesSandbox = null;
    }

    await ctx.runMutation(internal.awsAccounts.patchAccount, {
      accountId,
      status: "verified",
      roleArn: cleanRoleArn,
      s3Bucket: cleanBucket,
      awsAccountId: awsAccountId ?? undefined,
      sesSandbox: sesSandbox ?? undefined,
      lastError: undefined,
      lastVerifiedAt: Date.now(),
    });

    return {
      verified: true,
      awsAccountId,
      sesSandbox,
    };
  },
});

/**
 * Disconnect a user-provided AWS account. Refuses if any domain still
 * references it — user must first delete / reassign those domains.
 *
 * We only delete the Convex row; the user's own AWS resources (S3 bucket,
 * Lambda, SES rule set, etc.) stay in their account. They delete the CFN
 * stack themselves when they want the resources gone.
 */
export const remove = mutation({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const account = await ctx.db.get(accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("AWS account not found");
    }

    const domainsUsing = await ctx.db
      .query("domains")
      .withIndex("by_aws_account", (q) => q.eq("awsAccountId", accountId))
      .collect();
    if (domainsUsing.length > 0) {
      throw new Error(
        `Cannot disconnect: ${domainsUsing.length} domain(s) still use this AWS account. Delete or migrate them first.`
      );
    }

    await ctx.db.delete(accountId);
  },
});
