import { internalQuery } from "./_generated/server";

const BUSINESS_SUBJECTS = [
  "Quick question about {{topic}}",
  "Following up on our conversation",
  "Thoughts on the {{topic}} proposal?",
  "Meeting reschedule -- {{topic}}",
  "Can you review this before Friday?",
  "Update on the {{topic}} project",
  "Need your input on something",
  "Re: Q3 planning for {{topic}}",
  "Quick sync on {{topic}}?",
  "FYI -- {{topic}} update",
  "Action items from today",
  "Sharing some notes on {{topic}}",
  "Heads up about {{topic}}",
  "Any availability this week?",
  "Draft for your review",
];

const BUSINESS_BODIES = [
  "<p>Hi {{recipientName}},</p><p>I wanted to follow up on the {{topic}} discussion from last week. Do you have a few minutes to chat about next steps?</p><p>Let me know what works for you.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Just checking in on the {{topic}} project. I had a couple of ideas I wanted to run by you before we finalize the plan.</p><p>Would tomorrow afternoon work for a quick call?</p><p>Thanks,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>I put together some notes on {{topic}} that I think you will find useful. Happy to walk through them whenever you are free.</p><p>Cheers,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>Wanted to share a quick update on the {{topic}} initiative. We made good progress this week and I think we are on track for the deadline.</p><p>Let me know if you have any questions.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Could you take a look at the {{topic}} document when you get a chance? I would love to get your feedback before we share it more broadly.</p><p>Thanks in advance,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>I was thinking about what you said regarding {{topic}} and I think there might be a simpler approach we haven't considered. Want to grab coffee and discuss?</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Just a quick heads up that the {{topic}} timeline has shifted slightly. Nothing major, but wanted to keep you in the loop.</p><p>Talk soon,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>Following up on the {{topic}} meeting. I have attached the action items we discussed. Let me know if I missed anything.</p><p>Regards,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Do you have 15 minutes this week? I wanted to get your perspective on the {{topic}} situation before moving forward.</p><p>Thanks,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Hope your week is going well. I have been working on {{topic}} and have a few questions for you. Nothing urgent, just want to make sure we are aligned.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>I reviewed the latest {{topic}} numbers and things are looking positive. I can share the details if you are interested.</p><p>Let me know,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>Quick note on {{topic}} -- I think we should revisit the approach we discussed. I ran some numbers and have a slightly different recommendation.</p><p>Happy to chat when you are free.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Circling back on {{topic}}. Did you get a chance to review the materials I sent over last week?</p><p>Thanks,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Wanted to loop you in on some {{topic}} developments. Nothing that needs immediate action, but good to be aware of.</p><p>Cheers,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>I came across some interesting data on {{topic}} that might be relevant to what you are working on. Want me to forward it over?</p><p>Best,<br/>{{senderName}}</p>",
];

const PERSONAL_SUBJECTS = [
  "Great seeing you last week!",
  "This made me think of you",
  "Congrats on the new role!",
  "Book recommendation",
  "Long time no chat",
  "Weekend plans?",
  "Saw this and thought of you",
  "Happy belated birthday!",
  "Coffee sometime?",
  "Hope you are doing well",
  "Remember that {{topic}} thing?",
  "Random question for you",
  "Checking in",
  "That article you mentioned",
  "Quick favor",
];

const PERSONAL_BODIES = [
  "<p>Hey {{recipientName}},</p><p>It was great catching up the other day. We should do that more often! Let me know when you are free again.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>I saw this article about {{topic}} and immediately thought of you. Thought you might find it interesting.</p><p>Hope all is well!</p><p>{{senderName}}</p>",
  "<p>{{recipientName}}!</p><p>Just heard about your new role -- that is amazing! Congratulations, you really deserve it.</p><p>We should celebrate sometime soon.</p><p>Cheers,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Have you read anything good lately? I just finished a great book on {{topic}} and would love to swap recommendations.</p><p>Talk soon,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>It has been a while since we caught up. How have things been? I have been meaning to reach out for weeks now.</p><p>Let me know if you want to grab lunch sometime.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Any fun plans this weekend? I was thinking about trying that new place downtown if you are interested.</p><p>Let me know!<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Remember when we were talking about {{topic}}? I finally got around to looking into it more and you were totally right.</p><p>Hope you are doing well,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>I know this is random, but do you still have that {{topic}} recommendation you mentioned a while back? I have been thinking about it lately.</p><p>Thanks!<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Just wanted to check in and see how things are going. It feels like forever since we last talked!</p><p>Hope all is well on your end.</p><p>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>I came across something related to {{topic}} that I think you would really enjoy. Want me to send it your way?</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>How is everything? I have been meaning to reach out. Let me know if you are free for coffee this week or next.</p><p>Cheers,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>You popped into my head today and I realized it has been way too long. How are you? What is new?</p><p>Would love to hear from you,<br/>{{senderName}}</p>",
];

const NEWSLETTER_SUBJECTS = [
  "3 things I learned about {{topic}} this week",
  "Worth reading: {{topic}} insights",
  "Interesting take on {{topic}}",
  "This week in {{topic}}",
  "{{topic}} -- what you need to know",
  "5 minute read on {{topic}}",
  "My notes on {{topic}}",
  "{{topic}} trends worth watching",
  "Quick summary: {{topic}} developments",
  "Thought-provoking piece on {{topic}}",
  "Weekly roundup: {{topic}}",
  "Did you see this? {{topic}} update",
];

const NEWSLETTER_BODIES = [
  "<p>Hi {{recipientName}},</p><p>I have been reading a lot about {{topic}} lately and wanted to share some takeaways. The three biggest things that stood out to me were the pace of change, the unexpected applications, and how much room there still is for innovation.</p><p>Thought you might find this useful given your interest in the space.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Came across some really interesting {{topic}} content this week. The main insight was about how the landscape is shifting faster than most people realize.</p><p>Happy to share more details if you are interested.</p><p>Cheers,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Quick note on {{topic}} -- there have been some notable developments recently that I think are worth paying attention to. Nothing earth-shattering, but the direction is clear.</p><p>Let me know if you want to discuss.</p><p>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>I put together a quick summary of {{topic}} trends from the past few weeks. The short version: things are moving in an interesting direction and there are some good opportunities emerging.</p><p>Happy to elaborate if helpful.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>I have been following {{topic}} developments closely and wanted to share my notes. A few things really stood out to me this week.</p><p>Would love to hear your take on it.</p><p>Talk soon,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Here is my quick take on the latest {{topic}} news: the fundamentals are strong, the execution is getting better, and the timing feels right for new approaches.</p><p>Curious what you think.</p><p>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Just sharing a few {{topic}} resources I found valuable this week. Nothing too dense -- mostly practical insights you can apply right away.</p><p>Hope you find them useful!</p><p>Best,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>Weekly {{topic}} update from my end: some promising signals, a few cautionary tales, and one really compelling case study I think you would appreciate.</p><p>Let me know if you want the full rundown.</p><p>Cheers,<br/>{{senderName}}</p>",
];

const NOTIFICATION_SUBJECTS = [
  "Reminder: {{topic}} due this week",
  "Your {{topic}} summary is ready",
  "Action needed: {{topic}}",
  "Confirmation: {{topic}} scheduled",
  "Update: {{topic}} status change",
  "Completed: {{topic}} review",
  "FYI: {{topic}} change",
  "Pending: {{topic}} approval",
  "New: {{topic}} available",
  "Alert: {{topic}} threshold reached",
  "Digest: {{topic}} activity",
  "Scheduled: {{topic}} for next week",
];

const NOTIFICATION_BODIES = [
  "<p>Hi {{recipientName}},</p><p>Just a friendly reminder that the {{topic}} deadline is coming up this week. Let me know if you need anything from my end to get it wrapped up.</p><p>Thanks,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Your {{topic}} summary is ready for review. I have included all the key details and action items in the document.</p><p>Let me know if anything looks off.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>Quick update on {{topic}} -- the status has changed and I wanted to make sure you are aware. No action needed from you right now, just keeping you informed.</p><p>Cheers,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>Confirming that {{topic}} has been scheduled as discussed. Everything is set up and ready to go.</p><p>Let me know if you have any questions.</p><p>Best,<br/>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>The {{topic}} review has been completed. Everything looks good on my end. I have noted a few minor suggestions but nothing blocking.</p><p>Thanks,<br/>{{senderName}}</p>",
  "<p>Hey {{recipientName}},</p><p>Heads up -- there has been a change to the {{topic}} configuration. I have updated everything on my end and wanted to make sure you are in the loop.</p><p>{{senderName}}</p>",
  "<p>Hi {{recipientName}},</p><p>The {{topic}} approval is still pending. Just wanted to check if you had a chance to look at it. No rush, but wanted to keep it on your radar.</p><p>Thanks,<br/>{{senderName}}</p>",
  "<p>{{recipientName}},</p><p>Here is your weekly {{topic}} activity digest. Nothing unusual to report -- things are running smoothly.</p><p>Let me know if you want more detail on any specific area.</p><p>Best,<br/>{{senderName}}</p>",
];

const REPLY_BODIES = [
  "<p>Thanks for the update, {{senderName}}! This is really helpful. I will take a look and get back to you.</p><p>Best,<br/>{{recipientName}}</p>",
  "<p>Got it, thanks {{senderName}}. I appreciate you keeping me in the loop on this.</p><p>{{recipientName}}</p>",
  "<p>Hey {{senderName}}, thanks for sending this over. I will review it and circle back with my thoughts.</p><p>Cheers,<br/>{{recipientName}}</p>",
  "<p>Great, thanks for the heads up {{senderName}}. Let me check on my end and I will let you know.</p><p>Best,<br/>{{recipientName}}</p>",
  "<p>Thanks {{senderName}}! This looks good to me. Happy to discuss further if needed.</p><p>{{recipientName}}</p>",
  "<p>Appreciate the update, {{senderName}}. I had been wondering about this. Will follow up soon.</p><p>Thanks,<br/>{{recipientName}}</p>",
  "<p>Hi {{senderName}}, received -- thanks! I will take a closer look later today and share my feedback.</p><p>Best,<br/>{{recipientName}}</p>",
  "<p>Thanks for sharing {{senderName}}. Really interesting points. I have a few thoughts I will share when I get a chance.</p><p>Cheers,<br/>{{recipientName}}</p>",
  "<p>Got it {{senderName}}, much appreciated. I think this is on the right track.</p><p>{{recipientName}}</p>",
  "<p>Thanks {{senderName}}, this is exactly what I was looking for. Will review and follow up shortly.</p><p>Best,<br/>{{recipientName}}</p>",
];

const TOPICS = [
  "product launch", "Q3 planning", "team expansion", "budget review",
  "customer feedback", "marketing strategy", "sales pipeline", "hiring plan",
  "performance review", "partnership opportunity", "content strategy",
  "technology stack", "user research", "competitive analysis", "growth metrics",
  "onboarding process", "pricing update", "workflow optimization",
  "data migration", "design system", "security audit", "API integration",
  "mobile strategy", "analytics dashboard", "brand guidelines",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => fields[key] ?? match);
}

type Category = "business" | "personal" | "newsletter" | "notification";

const SUBJECTS_BY_CATEGORY: Record<Category, string[]> = {
  business: BUSINESS_SUBJECTS,
  personal: PERSONAL_SUBJECTS,
  newsletter: NEWSLETTER_SUBJECTS,
  notification: NOTIFICATION_SUBJECTS,
};

const BODIES_BY_CATEGORY: Record<Category, string[]> = {
  business: BUSINESS_BODIES,
  personal: PERSONAL_BODIES,
  newsletter: NEWSLETTER_BODIES,
  notification: NOTIFICATION_BODIES,
};

const CATEGORIES: Category[] = ["business", "personal", "newsletter", "notification"];

export function generateWarmupEmail(
  senderName: string,
  recipientName: string
): { subject: string; html: string } {
  const category = pickRandom(CATEGORIES);
  const subject = pickRandom(SUBJECTS_BY_CATEGORY[category]);
  const body = pickRandom(BODIES_BY_CATEGORY[category]);
  const topic = pickRandom(TOPICS);

  const fields = { senderName, recipientName, topic };
  return {
    subject: interpolate(subject, fields),
    html: interpolate(body, fields),
  };
}

export function generateWarmupReply(
  originalSubject: string,
  senderName: string,
  recipientName: string
): { subject: string; html: string } {
  const replyBody = pickRandom(REPLY_BODIES);
  const fields = { senderName, recipientName };
  return {
    subject: originalSubject.startsWith("Re: ") ? originalSubject : `Re: ${originalSubject}`,
    html: interpolate(replyBody, fields),
  };
}

export const getTemplateStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("warmupContentTemplates").collect();
    return templates.map((t) => ({
      category: t.category,
      subjects: t.subjects.length,
      bodies: t.bodies.length,
      replyBodies: t.replyBodies.length,
    }));
  },
});
