"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const advanceAllSchedules = internalAction({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.runQuery(
      internal.warmingSchedules.listActiveSchedules,
      {}
    );

    let advanced = 0;
    for (const schedule of schedules) {
      await ctx.runMutation(internal.warmingSchedules.advanceDay, {
        scheduleId: schedule._id,
      });
      advanced++;
    }

    console.log(`[warming] Advanced ${advanced} schedule(s)`);
    return { advanced };
  },
});
