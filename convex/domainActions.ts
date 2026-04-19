"use node";

import { DOMParser } from "@xmldom/xmldom";
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
} from "@aws-sdk/client-sesv2";
import {
  CreateReceiptRuleSetCommand,
  CreateReceiptRuleCommand,
  DeleteReceiptRuleCommand,
  SetActiveReceiptRuleSetCommand,
  DescribeActiveReceiptRuleSetCommand,
} from "@aws-sdk/client-ses";
import {
  CreateTopicCommand,
  SubscribeCommand,
} from "@aws-sdk/client-sns";
import dns from "node:dns";
import {
  getPlatformAwsClients,
  getAwsClientsForAccount,
  type AwsClientBundle,
} from "./lib/awsClients";
import type { Doc } from "./_generated/dataModel";

// DNS resolution helpers - use Google's public DNS to avoid stale
// caches on Convex's internal system resolver
const dnsResolver = new dns.promises.Resolver();
dnsResolver.setServers(["8.8.8.8", "1.1.1.1"]);

async function resolveCname(hostname: string): Promise<string[]> {
  try {
    return await dnsResolver.resolveCname(hostname);
  } catch {
    return [];
  }
}

async function resolveMx(hostname: string): Promise<dns.MxRecord[]> {
  try {
    return await dnsResolver.resolveMx(hostname);
  } catch {
    return [];
  }
}

async function resolveTxt(hostname: string): Promise<string[][]> {
  try {
    return await dnsResolver.resolveTxt(hostname);
  } catch {
    return [];
  }
}

export const add = action({
  args: {
    domain: v.string(),
    // Optional: use a user-connected AWS account instead of the platform's.
    awsAccountId: v.optional(v.id("awsAccounts")),
  },
  handler: async (ctx, { domain, awsAccountId }): Promise<{ domainId: string; dkimTokens: string[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.domains.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    // Quota check
    const limits = await ctx.runQuery(internal.quotas.getUserLimits, {
      userId: user._id,
    });
    if (limits.domains !== null) {
      const userDomains = await ctx.runQuery(internal.domains.listForCurrentUserInternal, {
        userId: user._id,
      });
      if (userDomains.length >= limits.domains) {
        throw new Error(
          `Domain limit reached. Your plan allows ${limits.domains} domain(s). Please upgrade to add more.`
        );
      }
    }

    const existing = await ctx.runQuery(internal.domains.getDomainByName, {
      domain,
    });
    if (existing) throw new Error("Domain already exists");

    // Resolve which AWS account the domain should live in.
    let clients: AwsClientBundle;
    if (awsAccountId) {
      const account = await ctx.runQuery(internal.awsAccounts.getByIdInternal, {
        accountId: awsAccountId,
      });
      if (!account || account.userId !== user._id) {
        throw new Error("AWS account not found");
      }
      if (account.status !== "verified") {
        throw new Error(
          `AWS account "${account.alias}" is not verified. Please complete the CloudFormation stack setup and verify the role before adding a domain.`
        );
      }
      clients = await getAwsClientsForAccount(account);
    } else {
      clients = getPlatformAwsClients();
    }

    const result = await clients.sesv2.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        DkimSigningAttributes: {
          NextSigningKeyLength: "RSA_2048_BIT",
        },
      })
    );

    const dkimTokens = result.DkimAttributes?.Tokens ?? [];

    // Configure custom MAIL FROM domain for SPF/DMARC alignment
    await clients.sesv2.send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: domain,
        MailFromDomain: `mail.${domain}`,
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      })
    );

    const domainId = await ctx.runMutation(internal.domains.insertDomain, {
      userId: user._id,
      domain,
      sesDkimTokens: dkimTokens,
      awsAccountId,
    });

    return { domainId, dkimTokens };
  },
});

export const verifyDns = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }): Promise<{ verified: boolean; dkimVerified: boolean; mxVerified: boolean; spfVerified: boolean; dmarcVerified: boolean; dkimRecordStatus: boolean[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const domain = await ctx.runQuery(internal.domains.getByIdInternal, {
      domainId,
    });
    if (!domain) throw new Error("Domain not found");

    // Resolve AWS clients for this domain (platform or BYO).
    const awsAccount = await ctx.runQuery(
      internal.domains.getAwsAccountForDomain,
      { domainId }
    );
    const clients: AwsClientBundle = awsAccount
      ? await getAwsClientsForAccount(awsAccount)
      : getPlatformAwsClients();

    const dkimTokens = domain.sesDkimTokens ?? [];
    const region = clients.region;

    // Check each DKIM CNAME record individually via DNS
    const dkimRecordStatus = await Promise.all(
      dkimTokens.map(async (token) => {
        const hostname = `${token}._domainkey.${domain.domain}`;
        const expectedValue = `${token}.dkim.amazonses.com`;
        const cnames = await resolveCname(hostname);
        return cnames.some(
          (c) => c.toLowerCase().replace(/\.$/, "") === expectedValue
        );
      })
    );

    // Check MX record
    const mxRecords = await resolveMx(domain.domain);
    const expectedMx = `inbound-smtp.${region}.amazonaws.com`;
    const matchingMx = mxRecords.find(
      (mx) => mx.exchange.toLowerCase().replace(/\.$/, "") === expectedMx
    );
    const mxVerified = !!matchingMx;
    const actualMxValue = mxRecords.length > 0
      ? mxRecords.map((mx) => `${mx.priority} ${mx.exchange.replace(/\.$/, "")}`).join(", ")
      : undefined;

    // Check SPF TXT record
    const txtRecords = await resolveTxt(domain.domain);
    const spfRecord = txtRecords.find((parts) => {
      const joined = parts.join("");
      return joined.includes("v=spf1");
    });
    const spfVerified = spfRecord
      ? spfRecord.join("").includes("amazonses.com")
      : false;
    const actualSpfValue = spfRecord ? spfRecord.join("") : undefined;

    // Check custom MAIL FROM domain records (mail.{domain})
    const mailFromDomain = `mail.${domain.domain}`;
    const expectedMailFromMx = `feedback-smtp.${region}.amazonaws.com`;
    const mailFromMxRecords = await resolveMx(mailFromDomain);
    const mailFromMxVerified = mailFromMxRecords.some(
      (mx) => mx.exchange.toLowerCase().replace(/\.$/, "") === expectedMailFromMx
    );
    const mailFromTxtRecords = await resolveTxt(mailFromDomain);
    const mailFromSpfRecord = mailFromTxtRecords.find((parts) =>
      parts.join("").includes("v=spf1")
    );
    const mailFromSpfVerified = mailFromSpfRecord
      ? mailFromSpfRecord.join("").includes("amazonses.com")
      : false;

    // Check DMARC TXT record
    const dmarcRecords = await resolveTxt(`_dmarc.${domain.domain}`);
    const dmarcRecord = dmarcRecords.find((parts) => {
      const joined = parts.join("");
      return joined.includes("v=DMARC1");
    });
    const dmarcVerified = !!dmarcRecord;
    const actualDmarcValue = dmarcRecord ? dmarcRecord.join("") : undefined;

    // Check SES status for overall DKIM verification
    const sesv2 = clients.sesv2;

    // Ensure custom MAIL FROM is configured in SES (for domains added before this feature)
    try {
      await sesv2.send(
        new PutEmailIdentityMailFromAttributesCommand({
          EmailIdentity: domain.domain,
          MailFromDomain: mailFromDomain,
          BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
        })
      );
    } catch {
      // Non-fatal: domain may not exist in SES yet
    }

    const result = await sesv2.send(
      new GetEmailIdentityCommand({
        EmailIdentity: domain.domain,
      })
    );

    const dkimStatus = result.DkimAttributes?.Status;
    const dkimVerified = dkimStatus === "SUCCESS";
    // VerifiedForSendingStatus is the authoritative "can this domain send email" flag from SES.
    // It is more stable than DkimAttributes.Status which can transiently flap.
    const sesVerified = result.VerifiedForSendingStatus === true;

    // Sticky verification: once a record is verified, never flip it back to false
    // from a user-triggered check. DNS propagation and SES internal state are
    // eventually consistent - transient failures should not undo a prior success.
    const sticky = (fresh: boolean, existing: boolean) => fresh || existing;

    const status = {
      domainId,
      // Use sesVerified (VerifiedForSendingStatus) as the primary verified flag - it is
      // what SES actually uses to gate outgoing email, and it is stickied so a transient
      // SES response can't unexpectedly lock users out of their mailboxes.
      verified: sticky(sesVerified, domain.verified),
      mxVerified: sticky(mxVerified, domain.mxVerified),
      spfVerified: sticky(spfVerified, domain.spfVerified),
      dkimVerified: sticky(dkimVerified, domain.dkimVerified),
      dmarcVerified: sticky(dmarcVerified, domain.dmarcVerified),
      // Sticky per-DKIM-token: preserve any token that was verified before
      dkimRecordStatus: dkimRecordStatus.map((fresh, i) =>
        fresh || (domain.dkimRecordStatus?.[i] ?? false)
      ),
      // Only update actual DNS values when the record is not yet verified
      // (once verified we no longer need to show the "current DNS value" hint)
      actualMxValue: domain.mxVerified ? undefined : actualMxValue,
      actualSpfValue: domain.spfVerified ? undefined : actualSpfValue,
      actualDmarcValue: domain.dmarcVerified ? undefined : actualDmarcValue,
      mailFromMxVerified: sticky(mailFromMxVerified, domain.mailFromMxVerified ?? false),
      mailFromSpfVerified: sticky(mailFromSpfVerified, domain.mailFromSpfVerified ?? false),
    };

    await ctx.runMutation(internal.domains.updateVerification, status);

    // Create or recreate receipt rule with SNS notification.
    // Run whenever SES reports the domain is verified for sending (either
    // freshly verified this check, or was already verified before).
    if (status.verified) {
      try {
        await ensureReceiptRuleWithSns(domain.domain, clients);
        await ctx.runMutation(internal.domains.markReceiptRuleCreated, {
          domainId,
        });
      } catch (error: unknown) {
        console.error("Failed to create receipt rule:", error);
      }

      // Ensure the sending configuration set exists so that outgoing emails
      // receive Delivery and Bounce notifications via SNS.
      try {
        await ensureSendingConfigurationSet(clients);
      } catch (error: unknown) {
        console.error("Failed to create sending configuration set:", error);
      }
    }

    return {
      verified: sesVerified,
      dkimVerified,
      mxVerified,
      spfVerified,
      dmarcVerified,
      dkimRecordStatus,
    };
  },
});

export const remove = action({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.domains.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const domain = await ctx.runQuery(internal.domains.getByIdInternal, {
      domainId,
    });
    if (!domain || domain.userId !== user._id) {
      throw new Error("Not authorized");
    }

    try {
      const awsAccount = await ctx.runQuery(
        internal.domains.getAwsAccountForDomain,
        { domainId }
      );
      const clients = awsAccount
        ? await getAwsClientsForAccount(awsAccount)
        : getPlatformAwsClients();
      await clients.sesv2.send(
        new DeleteEmailIdentityCommand({
          EmailIdentity: domain.domain,
        })
      );
    } catch (error: unknown) {
      console.error("Failed to delete SES identity:", error);
    }

    await ctx.runMutation(internal.domains.deleteDomainCascade, { domainId });
  },
});

// Public action so already-verified domains can set up the sending
// configuration set without having to re-run DNS verification.
export const setupSendingNotifications = action({
  args: { awsAccountId: v.optional(v.id("awsAccounts")) },
  handler: async (ctx, { awsAccountId }): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let clients: AwsClientBundle;
    if (awsAccountId) {
      const account = await ctx.runQuery(internal.awsAccounts.getByIdInternal, {
        accountId: awsAccountId,
      });
      if (!account) throw new Error("AWS account not found");
      clients = await getAwsClientsForAccount(account);
    } else {
      clients = getPlatformAwsClients();
    }
    await ensureSendingConfigurationSet(clients);
  },
});

// Creates an SNS topic for the domain and subscribes the webhook endpoint
async function ensureSnsTopicForDomain(
  domain: string,
  clients: AwsClientBundle
): Promise<string> {
  const sns = clients.sns;
  const topicName = `devmail-${domain.replace(/\./g, "-")}`;

  // CreateTopic is idempotent - returns existing ARN if topic already exists
  const topicResult = await sns.send(
    new CreateTopicCommand({ Name: topicName })
  );
  const topicArn = topicResult.TopicArn!;

  // Subscribe the webhook endpoint (idempotent for same topic+protocol+endpoint)
  const webhookUrl = `${process.env.APP_URL}/api/ses-webhook`;
  console.log("[ensureSnsTopicForDomain] subscribing SNS topic to:", webhookUrl);
  const subResult = await sns.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "https",
      Endpoint: webhookUrl,
    })
  );
  console.log("[ensureSnsTopicForDomain] subscription ARN:", subResult.SubscriptionArn);

  return topicArn;
}

// Creates (idempotent) an SES v2 Configuration Set with an SNS event
// destination for Delivery and Bounce notifications. All emails sent with
// ConfigurationSetName="devmail-sending" will trigger these events.
export async function ensureSendingConfigurationSet(
  clients: AwsClientBundle
): Promise<void> {
  const sesv2 = clients.sesv2;
  const sns = clients.sns;
  const configSetName = "devmail-sending";
  const topicName = "devmail-sending-events";

  // Create configuration set - idempotent (no-op if already exists)
  try {
    await sesv2.send(
      new CreateConfigurationSetCommand({
        ConfigurationSetName: configSetName,
      })
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name !== "AlreadyExistsException") throw error;
  }

  // Create (or get) SNS topic for sending events
  const topicResult = await sns.send(
    new CreateTopicCommand({ Name: topicName })
  );
  const topicArn = topicResult.TopicArn!;

  // Subscribe the webhook endpoint to the topic (idempotent)
  const webhookUrl = `${process.env.APP_URL}/api/ses-webhook`;
  console.log("[ensureSendingConfigurationSet] subscribing SNS topic to:", webhookUrl);
  const subResult = await sns.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "https",
      Endpoint: webhookUrl,
    })
  );
  console.log("[ensureSendingConfigurationSet] subscription ARN:", subResult.SubscriptionArn);

  // Add SNS event destination for Delivery and Bounce events (idempotent)
  try {
    await sesv2.send(
      new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestinationName: "devmail-sending-sns",
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: ["DELIVERY", "BOUNCE", "COMPLAINT"],
          SnsDestination: { TopicArn: topicArn },
        },
      })
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name !== "AlreadyExistsException") throw error;
  }
}

// Deletes all unverified domains older than `olderThanDays` days from both
// Convex and AWS SES. Called by the daily cron job and by the manual trigger.
export const cleanupUnverifiedDomainsInternal = internalAction({
  args: { olderThanDays: v.number() },
  handler: async (ctx, { olderThanDays }): Promise<{ deleted: number }> => {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const domains = await ctx.runQuery(internal.domains.listUnverifiedOlderThan, {
      cutoffTime,
    });

    let deleted = 0;
    for (const domain of domains) {
      try {
        const awsAccount = domain.awsAccountId
          ? await ctx.runQuery(internal.awsAccounts.getByIdInternal, {
              accountId: domain.awsAccountId,
            })
          : null;
        const clients = awsAccount
          ? await getAwsClientsForAccount(awsAccount)
          : getPlatformAwsClients();
        await clients.sesv2.send(
          new DeleteEmailIdentityCommand({ EmailIdentity: domain.domain })
        );
      } catch (error: unknown) {
        console.error(
          `[cleanup] Failed to delete SES identity for ${domain.domain}:`,
          error
        );
      }
      await ctx.runMutation(internal.domains.deleteDomainCascade, {
        domainId: domain._id,
      });
      deleted++;
    }

    console.log(
      `[cleanup] Deleted ${deleted} unverified domain(s) older than ${olderThanDays} day(s)`
    );
    return { deleted };
  },
});

// Admin action - call from the Convex dashboard to manually trigger cleanup.
export const cleanupUnverifiedDomains = action({
  args: { olderThanDays: v.number() },
  handler: async (ctx, { olderThanDays }): Promise<{ deleted: number }> => {
    return await ctx.runAction(
      internal.domainActions.cleanupUnverifiedDomainsInternal,
      { olderThanDays }
    );
  },
});

// Ensures an SES receipt rule exists with both S3 and SNS actions.
// Deletes and recreates the rule to update existing rules that lack SNS.
async function ensureReceiptRuleWithSns(domain: string, clients: AwsClientBundle) {
  const ses = clients.ses;
  const ruleSetName = "devmail-receipt-rules";
  const bucket = clients.s3Bucket;

  // Ensure rule set exists and is active
  try {
    const activeRuleSet = await ses.send(
      new DescribeActiveReceiptRuleSetCommand({})
    );
    if (!activeRuleSet.Metadata?.Name) {
      await ses.send(
        new CreateReceiptRuleSetCommand({ RuleSetName: ruleSetName })
      );
      await ses.send(
        new SetActiveReceiptRuleSetCommand({ RuleSetName: ruleSetName })
      );
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === "AlreadyExistsException") {
      await ses.send(
        new SetActiveReceiptRuleSetCommand({ RuleSetName: ruleSetName })
      );
    } else {
      throw error;
    }
  }

  const activeSet = await ses.send(
    new DescribeActiveReceiptRuleSetCommand({})
  );
  const activeRuleSetName = activeSet.Metadata?.Name ?? ruleSetName;
  const ruleName = `devmail-${domain.replace(/\./g, "-")}`;

  // Create SNS topic and subscribe webhook
  const topicArn = await ensureSnsTopicForDomain(domain, clients);

  // Delete existing rule so we can recreate it with SNS action
  try {
    await ses.send(
      new DeleteReceiptRuleCommand({
        RuleSetName: activeRuleSetName,
        RuleName: ruleName,
      })
    );
  } catch {
    // Rule may not exist yet - that's fine
  }

  // Create rule with both S3 and SNS actions
  await ses.send(
    new CreateReceiptRuleCommand({
      RuleSetName: activeRuleSetName,
      Rule: {
        Name: ruleName,
        Enabled: true,
        Recipients: [domain],
        Actions: [
          {
            S3Action: {
              BucketName: bucket,
              ObjectKeyPrefix: `${domain}/incoming/`,
            },
          },
          {
            SNSAction: {
              TopicArn: topicArn,
              Encoding: "UTF-8",
            },
          },
        ],
        ScanEnabled: true,
      },
    })
  );
}
