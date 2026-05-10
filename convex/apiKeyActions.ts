"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHash, randomBytes } from "crypto";

export const create = action({
  args: {
    name: v.string(),
    domainId: v.optional(v.id("domains")),
    scope: v.optional(v.union(v.literal("domain"), v.literal("org"))),
  },
  handler: async (ctx, { name, domainId, scope }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUser, { subject: identity.subject });
    if (!user) throw new Error("User not found");

    if (domainId) {
      const domain = await ctx.runQuery(internal.domains.getByIdInternal, { domainId });
      if (!domain || domain.userId !== user._id) throw new Error("Domain not found");
      if (!domain.verified) throw new Error("Domain must be verified to create an API key");
    }

    const rawSecret = randomBytes(24).toString("hex"); // 48 hex chars
    const rawKey = `dm_live_${rawSecret}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 16); // "dm_live_" + 8 chars for display

    const effectiveScope = domainId ? (scope ?? "domain") : "org";

    await ctx.runMutation(internal.apiKeys.insert, {
      userId: user._id,
      domainId,
      name,
      keyHash,
      keyPrefix,
      scope: effectiveScope,
      createdAt: Date.now(),
    });

    // Return the raw key ONCE - it is never stored in plaintext
    return { key: rawKey, keyPrefix };
  },
});
