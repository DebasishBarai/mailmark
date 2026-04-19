"use node";

/**
 * Node-runtime actions for BYO (bring-your-own) AWS accounts. Queries and
 * mutations for the same feature live in `awsAccounts.ts`.
 *
 * Flow:
 *  1. Client calls `createDraft` → we generate an externalId + webhookSecret
 *     and store a `pending` awsAccounts row. We return the generated
 *     ExternalId + WebhookSecret + the CloudFormation launch URL so the
 *     client can open the AWS console.
 *  2. User deploys the Mailmark CloudFormation stack in their AWS account.
 *  3. User pastes the stack outputs (RoleArn, BucketName) back.
 *  4. Client calls `verify` → we AssumeRole, call STS GetCallerIdentity +
 *     SES GetAccount, and flip the row to `verified` on success.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { SESv2Client, GetAccountCommand } from "@aws-sdk/client-sesv2";
import { Id } from "./_generated/dataModel";

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Allocate a new awsAccounts row in `pending` state. Returns the values the
 * client needs to launch the CloudFormation stack in the user's AWS console.
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
    const mailmarkAwsAccountId = process.env.AWS_ACCOUNT_ID ?? "";

    const cfnTemplateUrl = `${appUrl}/infra/byo-aws-cfn.yml`;
    const inboundWebhookUrl = `${convexSiteUrl}/ingestEmail`;
    const sendingWebhookUrl = `${appUrl}/api/ses-webhook`;

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
 * flips status to "verified".
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
        error: `Could not assume role. Check that the trust policy allows ${process.env.AWS_ACCOUNT_ID ?? "our AWS account"} and that the ExternalId matches. Details: ${msg}`,
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
