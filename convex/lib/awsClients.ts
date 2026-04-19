/**
 * Per-domain AWS client resolver.
 *
 * Routes SES / S3 / SNS calls to either:
 *   (a) the platform's shared AWS account — legacy, unchanged behavior —
 *       when the domain has no `awsAccountId` set, or
 *   (b) the user's own AWS account — via STS AssumeRole using the role ARN
 *       + ExternalId stored on the `awsAccounts` row the domain references.
 *
 * This module is the ONLY place that knows which credentials belong to which
 * domain. Every SES/S3/SNS call in `domainActions.ts`, `ses.ts`,
 * `mailboxes.ts`, etc. should go through `getAwsClientsForDomain` so that
 * BYO-AWS is a single-entry-point change.
 */

import { SESv2Client } from "@aws-sdk/client-sesv2";
import { SESClient } from "@aws-sdk/client-ses";
import { SNSClient } from "@aws-sdk/client-sns";
import { S3Client } from "@aws-sdk/client-s3";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import type { Doc } from "../_generated/dataModel";

export type AwsClientBundle = {
  sesv2: SESv2Client;
  ses: SESClient;
  sns: SNSClient;
  s3: S3Client;
  region: string;
  s3Bucket: string;
  // Secret the Lambda + SNS subscriptions will send on `x-webhook-secret` so
  // we can authenticate incoming /ingestEmail and /api/ses-webhook calls.
  // For platform accounts this is SES_WEBHOOK_SECRET; for BYO accounts it's
  // the per-account secret baked into the CFN stack at connect time.
  webhookSecret: string;
  // undefined when using platform account; populated for BYO accounts.
  awsAccountRow?: Doc<"awsAccounts">;
};

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

// Cache assumed-role credentials per awsAccount so we don't call STS on every
// SES/S3 operation. Temp creds live up to 1h; we evict at 45m to be safe.
const CRED_TTL_MS = 45 * 60 * 1000;
const credCache = new Map<string, { creds: Credentials; expiresAt: number }>();

async function assumeRole(
  roleArn: string,
  externalId: string,
  region: string
): Promise<Credentials> {
  const cacheKey = `${roleArn}|${externalId}`;
  const cached = credCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.creds;
  }

  const sts = new STSClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const result = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `mailmark-${Date.now()}`,
      ExternalId: externalId,
      DurationSeconds: 3600,
    })
  );

  const c = result.Credentials;
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
    throw new Error("AssumeRole returned no credentials");
  }

  const creds: Credentials = {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
  };

  credCache.set(cacheKey, {
    creds,
    expiresAt: Date.now() + CRED_TTL_MS,
  });

  return creds;
}

function platformCredentials(): Credentials {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  };
}

function buildBundle(
  creds: Credentials,
  region: string,
  s3Bucket: string,
  webhookSecret: string,
  awsAccountRow?: Doc<"awsAccounts">
): AwsClientBundle {
  return {
    sesv2: new SESv2Client({ region, credentials: creds }),
    ses: new SESClient({ region, credentials: creds }),
    sns: new SNSClient({ region, credentials: creds }),
    s3: new S3Client({ region, credentials: creds }),
    region,
    s3Bucket,
    webhookSecret,
    awsAccountRow,
  };
}

export function getPlatformAwsClients(): AwsClientBundle {
  return buildBundle(
    platformCredentials(),
    process.env.AWS_REGION!,
    process.env.AWS_S3_BUCKET!,
    process.env.SES_WEBHOOK_SECRET ?? ""
  );
}

export async function getAwsClientsForAccount(
  account: Doc<"awsAccounts">
): Promise<AwsClientBundle> {
  const creds = await assumeRole(account.roleArn, account.externalId, account.region);
  return buildBundle(
    creds,
    account.region,
    account.s3Bucket,
    account.webhookSecret,
    account
  );
}

/**
 * Resolves the correct AWS client bundle for a domain row. The caller must
 * have already fetched the domain document (we accept it as an argument to
 * keep this module free of Convex ctx coupling — callers pass in the row).
 *
 * If the domain has no `awsAccountId`, returns the platform bundle (legacy).
 * Otherwise the caller must pass the matching `awsAccount` row; we do not
 * run a DB lookup here so that the caller remains in control of auth.
 */
export async function getAwsClientsForDomain(
  domain: { awsAccountId?: string | undefined },
  awsAccount: Doc<"awsAccounts"> | null
): Promise<AwsClientBundle> {
  if (!domain.awsAccountId) return getPlatformAwsClients();
  if (!awsAccount) {
    throw new Error(
      "Domain references an awsAccount but the account row was not provided"
    );
  }
  if (awsAccount.status !== "verified") {
    throw new Error(
      `AWS account "${awsAccount.alias}" is not verified (status=${awsAccount.status}). ` +
        `Please re-verify it before using this domain.`
    );
  }
  return getAwsClientsForAccount(awsAccount);
}
