import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { HOLD_RETRY_MS } from "./lib/sendPolicy";

function interpolate(template: string, fields: Record<string, string> | undefined): string {
  if (!fields) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => fields[key] ?? match);
}

export const processStep = internalAction({
  args: {
    enrollmentId: v.id("sequenceEnrollments"),
    stepIndex: v.number(),
  },
  handler: async (ctx, { enrollmentId, stepIndex }) => {
    const enrollment = await ctx.runQuery(internal.sequenceProcessing.getEnrollment, { enrollmentId });
    if (!enrollment || enrollment.status !== "active") return;

    const sequence = await ctx.runQuery(internal.sequenceProcessing.getSequence, { sequenceId: enrollment.sequenceId });
    if (!sequence || sequence.status !== "active") return;

    if (stepIndex >= sequence.steps.length) {
      await ctx.runMutation(internal.sequences.completeEnrollment, {
        enrollmentId,
        status: "completed",
      });
      return;
    }

    const step = sequence.steps[stepIndex];

    if (step.type === "delay") {
      const jobId = await ctx.scheduler.runAfter(
        step.delayMs,
        internal.sequenceProcessing.processStep,
        { enrollmentId, stepIndex: stepIndex + 1 }
      );
      await ctx.runMutation(internal.sequences.advanceEnrollment, {
        enrollmentId,
        nextStep: stepIndex + 1,
        scheduledJobId: String(jobId),
      });
      return;
    }

    if (step.type === "send_email") {
      const subject = interpolate(step.subject, enrollment.mergeFields as Record<string, string> | undefined);
      const html = interpolate(step.html, enrollment.mergeFields as Record<string, string> | undefined);

      try {
        const sent = await ctx.runAction(internal.ses.sendEmailViaApi, {
          mailboxId: sequence.mailboxId,
          to: [enrollment.contactEmail],
          subject,
          html,
          path: "sequence",
        });

        // The gate refused this recipient: suppressed, unsubscribed, or a bad
        // address. Advancing the enrollment would keep trying on every later
        // step, so the enrollment is cancelled here instead. The reason is
        // already recorded in sendBlocks.
        if (sent?.messageId === "blocked") {
          console.log(
            `[processStep] recipient blocked for enrollment ${enrollmentId}, cancelling`
          );
          await ctx.runMutation(internal.sequences.completeEnrollment, {
            enrollmentId,
            status: "cancelled",
          });
          return;
        }

        // Held rather than sent: the kill switch is on, or a verification is
        // still in flight. Retry this same step later rather than skipping it.
        if (sent?.messageId === "held") {
          await ctx.scheduler.runAfter(
            HOLD_RETRY_MS,
            internal.sequenceProcessing.processStep,
            { enrollmentId, stepIndex }
          );
          return;
        }
      } catch (error) {
        console.error(`Failed to send step ${stepIndex} for enrollment ${enrollmentId}:`, error);
        return;
      }

      const nextStepIndex = stepIndex + 1;

      if (nextStepIndex >= sequence.steps.length) {
        await ctx.runMutation(internal.sequences.completeEnrollment, {
          enrollmentId,
          status: "completed",
        });
        return;
      }

      const nextStep = sequence.steps[nextStepIndex];
      if (nextStep.type === "delay") {
        const jobId = await ctx.scheduler.runAfter(
          nextStep.delayMs,
          internal.sequenceProcessing.processStep,
          { enrollmentId, stepIndex: nextStepIndex + 1 }
        );
        await ctx.runMutation(internal.sequences.advanceEnrollment, {
          enrollmentId,
          nextStep: nextStepIndex + 1,
          scheduledJobId: String(jobId),
        });
      } else {
        const jobId = await ctx.scheduler.runAfter(
          0,
          internal.sequenceProcessing.processStep,
          { enrollmentId, stepIndex: nextStepIndex }
        );
        await ctx.runMutation(internal.sequences.advanceEnrollment, {
          enrollmentId,
          nextStep: nextStepIndex,
          scheduledJobId: String(jobId),
        });
      }
    }
  },
});

export const getEnrollment = internalQuery({
  args: { enrollmentId: v.id("sequenceEnrollments") },
  handler: async (ctx, { enrollmentId }) => {
    return await ctx.db.get(enrollmentId);
  },
});

export const getSequence = internalQuery({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    return await ctx.db.get(sequenceId);
  },
});
