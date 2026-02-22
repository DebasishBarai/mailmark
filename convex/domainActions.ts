"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from "@aws-sdk/client-sesv2";
import {
  SESClient,
  CreateReceiptRuleSetCommand,
  CreateReceiptRuleCommand,
  SetActiveReceiptRuleSetCommand,
  DescribeActiveReceiptRuleSetCommand,
} from "@aws-sdk/client-ses";
import dns from "node:dns";

function getSESv2Client() {
  return new SESv2Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function getSESClient() {
  return new SESClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// DNS resolution helpers
async function resolveCname(hostname: string): Promise<string[]> {
  try {
    return await dns.promises.resolveCname(hostname);
  } catch {
    return [];
  }
}

async function resolveMx(hostname: string): Promise<dns.MxRecord[]> {
  try {
    return await dns.promises.resolveMx(hostname);
  } catch {
    return [];
  }
}

async function resolveTxt(hostname: string): Promise<string[][]> {
  try {
    return await dns.promises.resolveTxt(hostname);
  } catch {
    return [];
  }
}

export const add = action({
  args: { domain: v.string() },
  handler: async (ctx, { domain }): Promise<{ domainId: string; dkimTokens: string[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.domains.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const existing = await ctx.runQuery(internal.domains.getDomainByName, {
      domain,
    });
    if (existing) throw new Error("Domain already exists");

    const sesv2 = getSESv2Client();
    const result = await sesv2.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        DkimSigningAttributes: {
          NextSigningKeyLength: "RSA_2048_BIT",
        },
      })
    );

    const dkimTokens = result.DkimAttributes?.Tokens ?? [];

    // Configure custom MAIL FROM domain for SPF/DMARC alignment
    await sesv2.send(
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

    const dkimTokens = domain.sesDkimTokens ?? [];
    const region = "ap-south-1";

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
    const sesv2 = getSESv2Client();

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
    const sesVerified = result.VerifiedForSendingStatus === true;

    const status = {
      domainId,
      verified: sesVerified && dkimVerified,
      mxVerified,
      spfVerified,
      dkimVerified,
      dmarcVerified,
      dkimRecordStatus,
      actualMxValue,
      actualSpfValue,
      actualDmarcValue,
      mailFromMxVerified,
      mailFromSpfVerified,
    };

    await ctx.runMutation(internal.domains.updateVerification, status);

    // If verified and receipt rule not yet created, create it
    if (sesVerified && !domain.sesReceiptRuleCreated) {
      try {
        await createReceiptRuleForDomain(domain.domain);
        await ctx.runMutation(internal.domains.markReceiptRuleCreated, {
          domainId,
        });
      } catch (error: unknown) {
        console.error("Failed to create receipt rule:", error);
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
      const sesv2 = getSESv2Client();
      await sesv2.send(
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

// Creates an SES receipt rule to save incoming emails to S3
async function createReceiptRuleForDomain(domain: string) {
  const ses = getSESClient();
  const ruleSetName = "devmail-receipt-rules";
  const bucket = process.env.AWS_S3_BUCKET!;

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

  try {
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
          ],
          ScanEnabled: true,
        },
      })
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === "AlreadyExistsException") {
      return;
    }
    throw error;
  }
}
