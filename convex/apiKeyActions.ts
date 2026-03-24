"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHash, randomBytes } from "crypto";

export const create = action({
  args: {
    name: v.string(),
    domainId: v.id("domains"),
  },
  handler: async (ctx, { name, domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUser, { subject: identity.subject });
    if (!user) throw new Error("User not found");

    const domain = await ctx.runQuery(internal.domains.getByIdInternal, { domainId });
    if (!domain || domain.userId !== user._id) throw new Error("Domain not found");
    if (!domain.verified) throw new Error("Domain must be verified to create an API key");

    const rawSecret = randomBytes(24).toString("hex"); // 48 hex chars
    const rawKey = `dm_live_${rawSecret}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 16); // "dm_live_" + 8 chars for display

    await ctx.runMutation(internal.apiKeys.insert, {
      userId: user._id,
      domainId,
      name,
      keyHash,
      keyPrefix,
      createdAt: Date.now(),
    });

    // Return the raw key ONCE - it is never stored in plaintext
    return { key: rawKey, keyPrefix };
  },
});
