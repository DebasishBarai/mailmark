/**
 * SES sending quota probe.
 *
 * The account's real limits are the only ones that matter: AWS sets them per
 * account, and a BYO-AWS domain answers to its own account rather than the
 * platform's. `awsAccountActions.verifyAccount` already calls GetAccount but
 * keeps only `ProductionAccessEnabled`, so the two numbers that govern a
 * scheduled campaign (max send rate per second, max sends per 24h) are never
 * read anywhere.
 *
 * Run this from the Convex dashboard (Functions tab) to see them:
 *   no args        -> the platform AWS account
 *   { domain }     -> whichever account that domain sends through
 *   { burstSize }  -> how long a burst of that size takes at the account rate
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GetAccountCommand } from "@aws-sdk/client-sesv2";
import { getPlatformAwsClients, getAwsClientsForAccount } from "./lib/awsClients";

export const getSendQuota = internalAction({
  args: {
    domain: v.optional(v.string()),
    burstSize: v.optional(v.number()),
  },
  handler: async (ctx, { domain, burstSize }) => {
    const account = domain
      ? await ctx.runQuery(internal.domains.getAwsAccountByDomainName, { domain })
      : null;

    const aws = account
      ? await getAwsClientsForAccount(account)
      : getPlatformAwsClients();

    const info = await aws.sesv2.send(new GetAccountCommand({}));
    const quota = info.SendQuota;

    // Sandbox accounts report the sandbox ceilings here too, so no special case
    // is needed: production access is reported separately for context.
    const perSecond = quota?.MaxSendRate ?? null;
    const perDay = quota?.Max24HourSend ?? null;
    const sentLast24Hours = quota?.SentLast24Hours ?? null;

    // A burst all scheduled for the same instant does not go out at that
    // instant: SES rejects everything above the per-second rate, so the useful
    // number is how long the burst needs if it were paced perfectly.
    const burst =
      burstSize && perSecond
        ? {
            size: burstSize,
            secondsAtMaxRate: Math.ceil(burstSize / perSecond),
            fitsInDailyQuota:
              perDay === null ? null : burstSize + (sentLast24Hours ?? 0) <= perDay,
          }
        : undefined;

    return {
      account: account ? `${account.alias} (${account.awsAccountId ?? "byo"})` : "platform",
      region: aws.region,
      productionAccess: info.ProductionAccessEnabled ?? null,
      sendingEnabled: info.SendingEnabled ?? null,
      perSecond,
      perDay,
      sentLast24Hours,
      ...(burst ? { burst } : {}),
    };
  },
});
