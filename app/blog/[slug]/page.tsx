import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

const categoryColors: Record<string, string> = {
  Guides: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Deliverability: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Campaigns: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Product Updates": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

interface ArticleContent {
  title: string;
  category: string;
  date: string;
  readTime: string;
  excerpt: string;
  sections: { heading: string; content: string[] }[];
}

const articles: Record<string, ArticleContent> = {
  "getting-started-with-custom-domain-emails": {
    title: "Getting Started with Custom Domain Emails",
    category: "Guides",
    date: "Jan 28, 2026",
    readTime: "6 min read",
    excerpt:
      "Learn how to set up your own branded email addresses in under 10 minutes. We walk through domain verification, MX record setup, and creating your first mailbox.",
    sections: [
      {
        heading: "Why use a custom domain for email?",
        content: [
          "Sending emails from yourname@gmail.com works fine for personal use, but it undermines trust when you're communicating on behalf of a business. A custom domain email like hello@yourcompany.com instantly signals professionalism and builds credibility with every message you send.",
          "Beyond branding, custom domain emails give you full control over your mailboxes. You can create addresses for different purposes - support@, sales@, billing@ - and route them to the right team members without sharing credentials.",
        ],
      },
      {
        heading: "Step 1: Add your domain to Mailmark",
        content: [
          "Log in to your Mailmark dashboard and navigate to Domains → Add domain. Enter the domain you own (e.g., yourcompany.com). Mailmark will immediately generate the DNS records you need to configure at your domain registrar.",
          "Don't have a domain yet? You can purchase one from registrars like Namecheap, Cloudflare, or Google Domains. Most domains cost between $10-$15 per year.",
        ],
      },
      {
        heading: "Step 2: Configure your DNS records",
        content: [
          "Mailmark requires three types of DNS records: MX records for receiving email, an SPF record for sender authentication, and a DKIM record for message signing. Head to your domain registrar's DNS settings and add the records exactly as shown in your Mailmark dashboard.",
          "MX records tell the internet where to deliver mail for your domain. SPF and DKIM records prove to receiving mail servers that your messages are legitimate. For a detailed walkthrough, check out our DNS Setup Guide.",
        ],
      },
      {
        heading: "Step 3: Verify your domain",
        content: [
          "Once you've added the DNS records, return to your Mailmark dashboard and click Verify domain. The system will check for all required records. DNS changes usually propagate within minutes, but can take up to 48 hours in some cases.",
          "You'll see a green checkmark next to each record type once it's verified. If a record fails verification, double-check the values at your registrar - a common mistake is adding extra spaces or missing the trailing dot in hostnames.",
        ],
      },
      {
        heading: "Step 4: Create your first mailbox",
        content: [
          "With your domain verified, go to Mailboxes → Create mailbox. Choose your email address (e.g., hello@yourcompany.com), set a display name, and you're ready to send and receive email.",
          "Mailmark lets you create unlimited mailboxes on any plan. You can assign them to team members, set forwarding rules, and even create shared mailboxes that multiple people can access.",
        ],
      },
      {
        heading: "What's next?",
        content: [
          "Now that you have your custom domain email set up, consider adding a DMARC record for extra protection against spoofing. You can also explore Mailmark's campaign features to send newsletters and marketing emails from your new professional address.",
        ],
      },
    ],
  },

  "understanding-spf-dkim-and-dmarc": {
    title: "Understanding SPF, DKIM, and DMARC",
    category: "Deliverability",
    date: "Jan 20, 2026",
    readTime: "8 min read",
    excerpt:
      "The three pillars of email authentication explained. Find out why these records matter and how Mailmark sets them up automatically for you.",
    sections: [
      {
        heading: "Why email authentication matters",
        content: [
          "Email was designed in an era when trust was assumed. The original SMTP protocol has no built-in way to verify that a sender is who they claim to be. This makes it trivially easy to spoof the From address on an email - which is exactly what spammers and phishers exploit every day.",
          "SPF, DKIM, and DMARC were developed to close this gap. Together, they form a layered authentication system that lets receiving mail servers verify your identity and protect your domain from abuse.",
        ],
      },
      {
        heading: "SPF: Who is allowed to send?",
        content: [
          "SPF (Sender Policy Framework) is a DNS TXT record that lists the servers authorized to send email on behalf of your domain. When a receiving server gets an email claiming to be from your domain, it checks your SPF record to see if the sending server's IP address is on the approved list.",
          "If the IP matches, the SPF check passes. If not, the receiving server knows something is off. Mailmark automatically generates the correct SPF record for your domain - you just need to add it to your DNS settings.",
          "A common pitfall is having multiple SPF records. Each domain can only have one SPF record. If you use multiple email services, combine them into a single record using the include: mechanism.",
        ],
      },
      {
        heading: "DKIM: Is the message authentic?",
        content: [
          "DKIM (DomainKeys Identified Mail) takes a different approach. Instead of checking where the message came from, it checks whether the message was altered in transit. The sending server signs each outgoing email with a private cryptographic key, and the corresponding public key is published as a DNS record.",
          "Receiving servers use the public key to verify the signature. If the message was tampered with after being signed, the verification fails. This protects against man-in-the-middle attacks and gives receiving servers confidence that the email is genuine.",
          "Mailmark generates a unique DKIM key pair for each domain you add. The private key stays on our servers; the public key goes into your DNS records.",
        ],
      },
      {
        heading: "DMARC: What happens when checks fail?",
        content: [
          "DMARC (Domain-based Message Authentication, Reporting and Conformance) ties SPF and DKIM together and adds a policy layer. It tells receiving servers what to do when an email fails authentication: deliver it anyway (none), quarantine it (quarantine), or reject it outright (reject).",
          "DMARC also introduces reporting. You can receive daily aggregate reports showing who is sending email using your domain - including unauthorized senders. This visibility is invaluable for catching abuse early.",
          "We recommend starting with a policy of p=none to monitor without affecting delivery. Once you're confident that all legitimate email passes authentication, you can move to p=quarantine and eventually p=reject for maximum protection.",
        ],
      },
      {
        heading: "How Mailmark handles this for you",
        content: [
          "When you add a domain to Mailmark, we generate all the records you need - SPF, DKIM, and a recommended DMARC record - and show them in your dashboard with copy-to-clipboard buttons. Just paste them into your DNS settings and verify.",
          "Our system continuously monitors the health of your DNS records and alerts you if anything changes or expires. You don't need to be a DNS expert to maintain great deliverability.",
        ],
      },
    ],
  },

  "email-campaign-best-practices-2026": {
    title: "10 Email Campaign Best Practices for 2026",
    category: "Campaigns",
    date: "Jan 14, 2026",
    readTime: "10 min read",
    excerpt:
      "From subject line testing to optimal send times, these field-tested tactics will boost your open rates and conversions.",
    sections: [
      {
        heading: "1. Write subject lines that earn the open",
        content: [
          "Your subject line is the single most important factor in whether your email gets opened. Keep it under 50 characters, use specific numbers when possible, and create genuine curiosity without resorting to clickbait.",
          "A/B test your subject lines with a small segment before sending to your full list. Even a 5% difference in open rate can translate to thousands of additional readers over the course of a campaign.",
        ],
      },
      {
        heading: "2. Segment your audience ruthlessly",
        content: [
          "Sending the same email to your entire list is the fastest way to tank your engagement metrics. Segment by behavior (opened last 3 emails vs. haven't opened in 90 days), by interest (product category, content topic), and by stage (new subscriber vs. long-time customer).",
          "Even basic segmentation - active vs. inactive subscribers - can improve your click-through rates by 50% or more. Mailmark's campaign tools make it easy to build segments based on engagement data.",
        ],
      },
      {
        heading: "3. Personalize beyond the first name",
        content: [
          "Everyone knows the {first_name} merge tag by now. True personalization means tailoring the content itself - recommending products based on past purchases, referencing their specific use case, or adjusting the send time based on their timezone.",
          "The goal is to make each recipient feel like the email was written specifically for them. This doesn't require AI magic; it requires thoughtful segmentation and well-designed templates.",
        ],
      },
      {
        heading: "4. Optimize your send times",
        content: [
          "There's no universally perfect send time. The best time to send depends on your audience, their timezone, and what you're asking them to do. B2B emails tend to perform best on Tuesday through Thursday mornings. B2C emails often see higher engagement on evenings and weekends.",
          "Use your campaign analytics to identify patterns. Mailmark's reporting shows open and click activity by hour, so you can find your audience's sweet spot.",
        ],
      },
      {
        heading: "5. Design for mobile first",
        content: [
          "Over 60% of emails are opened on mobile devices. If your email looks broken on a phone, most readers won't bother scrolling to the desktop version - they'll just delete it.",
          "Use a single-column layout, large tap targets (minimum 44x44 pixels for buttons), and keep your primary CTA above the fold. Test on actual devices, not just your desktop's responsive preview.",
        ],
      },
      {
        heading: "6. Nail your preview text",
        content: [
          "Preview text (the snippet that appears after the subject line in most email clients) is free real estate. Don't waste it with \"View in browser\" or let it default to your first paragraph.",
          "Use the preview text to complement your subject line - add context, create urgency, or tease the content inside. Think of subject line + preview text as a one-two punch.",
        ],
      },
      {
        heading: "7. Include one clear call to action",
        content: [
          "Every email should have one primary goal. Whether it's clicking a link, replying, or making a purchase, make that action obvious and easy. Multiple competing CTAs dilute your message and confuse readers.",
          "Place your primary CTA button early in the email, and optionally repeat it at the end for longer messages. Use action-oriented language: \"Start your free trial\" beats \"Learn more\" every time.",
        ],
      },
      {
        heading: "8. Clean your list regularly",
        content: [
          "A large list means nothing if half the addresses are inactive or invalid. Regularly remove hard bounces, unsubscribes, and consistently unengaged subscribers. A smaller, healthier list will outperform a bloated one.",
          "Sending to invalid addresses hurts your sender reputation, which affects deliverability for your entire domain. Set up automated list hygiene rules to keep your list clean without manual effort.",
        ],
      },
      {
        heading: "9. Authenticate your sending domain",
        content: [
          "If you haven't set up SPF, DKIM, and DMARC for your sending domain, do it before your next campaign. Authentication isn't optional in 2026 - major providers like Gmail and Yahoo now require it for bulk senders.",
          "Mailmark handles authentication setup automatically when you add your domain. Check out our guide on SPF, DKIM, and DMARC for the full details.",
        ],
      },
      {
        heading: "10. Measure what matters",
        content: [
          "Open rates and click rates are useful but don't tell the whole story. Track downstream metrics like replies, conversions, and revenue per email to understand true campaign performance.",
          "Set up clear goals before each campaign and review the results honestly. The best email marketers iterate constantly - every send is an experiment that informs the next one.",
        ],
      },
    ],
  },

  "improve-email-deliverability-rate": {
    title: "How to Improve Your Email Deliverability Rate",
    category: "Deliverability",
    date: "Jan 7, 2026",
    readTime: "7 min read",
    excerpt:
      "Deliverability starts long before you hit send. This guide covers sender reputation, list hygiene, bounce management, and more.",
    sections: [
      {
        heading: "What is email deliverability?",
        content: [
          "Email deliverability is the percentage of your emails that actually reach the recipient's inbox - not their spam folder, and not a bounce. It's different from delivery rate, which only measures whether the receiving server accepted the message at all.",
          "An email can be \"delivered\" but still land in spam. True deliverability means reaching the inbox, and it depends on a combination of technical setup, sender reputation, and content quality.",
        ],
      },
      {
        heading: "Build and protect your sender reputation",
        content: [
          "Mailbox providers like Gmail, Outlook, and Yahoo assign a reputation score to your sending domain and IP address. This score is based on your sending history: bounce rates, spam complaints, engagement levels, and authentication status.",
          "A new domain has no reputation, which is why you should warm it up gradually. Start by sending to your most engaged contacts - people who are certain to open and click. Over several weeks, slowly increase your volume as your reputation builds.",
          "Avoid sudden spikes in volume. Going from 100 emails per day to 10,000 overnight is a red flag that triggers spam filters. Consistent, gradual growth signals legitimacy.",
        ],
      },
      {
        heading: "Keep your list clean",
        content: [
          "List hygiene is one of the most impactful things you can do for deliverability. Remove invalid addresses immediately after a hard bounce. Set up automated rules to suppress addresses that haven't engaged in 90 or 180 days.",
          "Never purchase email lists. Bought lists contain spam traps - addresses specifically designed to catch unsolicited senders. Hitting even one spam trap can devastate your reputation.",
          "Use double opt-in for new subscribers when possible. It adds a small friction point, but it ensures that every address on your list belongs to someone who genuinely wants to hear from you.",
        ],
      },
      {
        heading: "Authenticate your domain",
        content: [
          "SPF, DKIM, and DMARC are non-negotiable in 2026. Google and Yahoo both require proper authentication for senders sending more than 5,000 emails per day, and other providers are following suit.",
          "Mailmark sets up authentication automatically when you add your domain. If you're using multiple sending services, make sure each one is included in your SPF record and has its own DKIM key configured.",
        ],
      },
      {
        heading: "Write content that avoids spam triggers",
        content: [
          "Spam filters analyze your email content for patterns associated with spam. Avoid ALL CAPS subject lines, excessive exclamation marks, and phrases like \"Act now!!!\" or \"Free money.\" These are obvious triggers, but subtler ones exist too.",
          "Maintain a healthy text-to-image ratio. Emails that are mostly images with little text often get flagged. Always include a plain-text version alongside your HTML email.",
          "Include a visible, working unsubscribe link. Not only is this legally required in most jurisdictions, but one-click unsubscribe is now mandatory for bulk senders under Google's guidelines.",
        ],
      },
      {
        heading: "Monitor your metrics",
        content: [
          "Watch your bounce rate (should be under 2%), spam complaint rate (should be under 0.1%), and engagement metrics closely. A sudden drop in open rates or a spike in complaints is an early warning sign.",
          "Mailmark's analytics dashboard tracks these metrics in real time. Set up alerts to notify you when any metric crosses a threshold so you can investigate before it impacts your reputation.",
        ],
      },
    ],
  },

  "mailmark-1-0-whats-new": {
    title: "Mailmark 1.0: What's New",
    category: "Product Updates",
    date: "Dec 20, 2025",
    readTime: "4 min read",
    excerpt:
      "We launched! Here's everything included in our first public release - domains, mailboxes, campaigns, analytics, and team collaboration.",
    sections: [
      {
        heading: "We're live",
        content: [
          "After months of building and testing with early users, Mailmark 1.0 is officially available to everyone. We set out to build the email hosting platform we wished existed - simple to set up, powerful under the hood, and priced fairly.",
          "Here's a look at everything included in this first release.",
        ],
      },
      {
        heading: "Custom domain email hosting",
        content: [
          "Add your own domain and create unlimited mailboxes. Mailmark handles all the technical complexity - DNS record generation, domain verification, SPF/DKIM/DMARC setup - so you can go from zero to sending in under 10 minutes.",
          "Every mailbox gets full send and receive capabilities, with no per-mailbox fees. Whether you need one address or a hundred, the pricing stays simple.",
        ],
      },
      {
        heading: "Email campaigns",
        content: [
          "Send newsletters, product updates, and marketing emails directly from Mailmark. Our campaign builder supports rich HTML templates, audience segmentation, and A/B testing for subject lines.",
          "Track opens, clicks, and engagement in real time with our built-in analytics. No need to integrate a separate marketing platform.",
        ],
      },
      {
        heading: "Analytics dashboard",
        content: [
          "See exactly how your emails are performing. The analytics dashboard shows delivery rates, open rates, click rates, bounce rates, and spam complaints - all in real time.",
          "Filter by domain, mailbox, or campaign to drill down into specific metrics. Export reports to CSV for deeper analysis or to share with your team.",
        ],
      },
      {
        heading: "Team collaboration",
        content: [
          "Invite team members to your Mailmark workspace. Assign mailboxes, set permissions, and collaborate without sharing passwords. Each team member gets their own login with role-based access controls.",
          "Shared mailboxes let multiple team members read and respond to the same address - perfect for support@ or sales@ inboxes.",
        ],
      },
      {
        heading: "What's coming next",
        content: [
          "This is just the beginning. We're already working on webhook integrations, an API for programmatic access, automated sequences, and contact management. We'll share more details in the coming weeks.",
          "Thank you to everyone who tested Mailmark during our beta. Your feedback shaped this release, and we're excited to keep building with you.",
        ],
      },
    ],
  },

  "managing-team-mailboxes-at-scale": {
    title: "Managing Team Mailboxes at Scale",
    category: "Guides",
    date: "Dec 12, 2025",
    readTime: "5 min read",
    excerpt:
      "Assign mailboxes to team members, set permissions, and collaborate without sharing passwords. A deep dive into Mailmark's team features.",
    sections: [
      {
        heading: "The problem with shared credentials",
        content: [
          "Many small teams start by sharing a single email account password among team members. This works until it doesn't - you can't track who sent what, you can't revoke access for one person without changing the password for everyone, and it's a security risk.",
          "Mailmark takes a different approach. Every team member gets their own login, and mailbox access is managed through permissions. No shared passwords, no ambiguity about who did what.",
        ],
      },
      {
        heading: "Setting up your team",
        content: [
          "Navigate to Settings → Team and invite members by email address. Each person receives an invitation to create their own Mailmark account. You can assign one of three roles: Admin (full access), Member (can use assigned mailboxes and campaigns), or Viewer (read-only access).",
          "Admins can add and remove domains, create mailboxes, manage billing, and invite other team members. Members can send and receive email from their assigned mailboxes and create campaigns. Viewers can see analytics and read emails but can't send.",
        ],
      },
      {
        heading: "Shared mailboxes vs. personal mailboxes",
        content: [
          "A personal mailbox is assigned to one person - their individual work email. A shared mailbox (like support@ or info@) can be accessed by multiple team members simultaneously.",
          "When multiple people are working in a shared mailbox, Mailmark shows real-time indicators of who is viewing or composing a reply to each conversation. This prevents the classic \"two people reply to the same email\" problem.",
        ],
      },
      {
        heading: "Organizing at scale",
        content: [
          "As your team grows, organization becomes critical. Use naming conventions for your mailboxes that make their purpose obvious. Group related addresses under the same domain. Use Mailmark's labels and filters to automatically categorize incoming messages.",
          "For larger organizations, consider creating separate domains for different functions - marketing.yourcompany.com for campaigns, support.yourcompany.com for customer service. Each domain can have its own set of mailboxes and team member assignments.",
        ],
      },
      {
        heading: "Audit trail and accountability",
        content: [
          "Every action in Mailmark is logged - who sent what, when, and from which mailbox. Admins can review the activity log to track email volume, response times, and team member activity.",
          "This audit trail is invaluable for compliance, quality control, and understanding your team's email workflow. Export logs at any time for your records.",
        ],
      },
    ],
  },

  "building-winning-email-campaign-strategy": {
    title: "Building a Winning Email Campaign Strategy",
    category: "Campaigns",
    date: "Dec 5, 2025",
    readTime: "9 min read",
    excerpt:
      "Cold outreach, newsletters, or onboarding sequences - your strategy should match your goal. Here's how to think about it.",
    sections: [
      {
        heading: "Start with the goal, not the tool",
        content: [
          "Before you write a single email, get crystal clear on what you're trying to achieve. Are you nurturing leads? Onboarding new users? Re-engaging churned customers? Each goal demands a fundamentally different approach.",
          "Too many teams jump straight into building templates and writing copy without this foundational step. The result is generic emails that try to do everything and accomplish nothing.",
        ],
      },
      {
        heading: "Newsletter campaigns",
        content: [
          "Newsletters build a long-term relationship with your audience. The key is consistency and genuine value. Send on a predictable schedule (weekly, biweekly, or monthly) and make every issue worth reading.",
          "The best newsletters have a clear editorial voice and a focused topic area. Don't try to cover everything your company does in every issue. Pick one theme, go deep, and make your readers smarter.",
          "Track your unsubscribe rate closely. If it spikes after a particular issue, that's direct feedback on what your audience doesn't want. Listen to it.",
        ],
      },
      {
        heading: "Onboarding sequences",
        content: [
          "Onboarding emails guide new users from signup to their first success moment. The goal isn't to dump all your features on them - it's to get them to the point where they see value as quickly as possible.",
          "Map out the critical path in your product. What does a user need to do to get their first win? Build your sequence around those actions. Each email should have exactly one call to action that moves them one step forward.",
          "Time your onboarding emails based on user behavior, not just calendar days. Send the next email when the user completes the previous step, or after a reasonable wait if they haven't.",
        ],
      },
      {
        heading: "Cold outreach",
        content: [
          "Cold outreach has the lowest response rates but can be highly effective when done right. The key is relevance - every recipient should feel like you wrote the email specifically for them.",
          "Research your prospects before reaching out. Reference something specific about their company, their recent work, or a problem you know they face. Generic templates sent to thousands of addresses will only hurt your reputation.",
          "Keep cold emails short - 3 to 5 sentences maximum. State who you are, why you're reaching out, and what you're asking for. Make it easy to say yes or no.",
        ],
      },
      {
        heading: "Re-engagement campaigns",
        content: [
          "Every list has subscribers who stop opening your emails. Before you remove them, try a re-engagement campaign. Send a simple, honest email: \"We noticed you haven't opened our emails recently. Would you like to keep hearing from us?\"",
          "Give them a clear choice - stay subscribed or unsubscribe with one click. People who choose to stay are now more engaged than before. People who leave improve your list health and deliverability.",
        ],
      },
      {
        heading: "Measuring campaign success",
        content: [
          "Define your success metrics before launching. For newsletters, track open rate and click rate. For onboarding, track activation rate (did the user complete the desired action?). For cold outreach, track reply rate and meeting rate.",
          "Review results after each send and document what you learned. Over time, you'll build a playbook of what works for your specific audience. This institutional knowledge is more valuable than any best-practice guide.",
        ],
      },
    ],
  },

  "why-emails-land-in-spam": {
    title: "Why Your Emails Land in Spam (And How to Fix It)",
    category: "Deliverability",
    date: "Nov 28, 2025",
    readTime: "11 min read",
    excerpt:
      "Spam filters are sophisticated. Learn the most common reasons emails get flagged and the concrete steps you can take to fix each one.",
    sections: [
      {
        heading: "How spam filters actually work",
        content: [
          "Modern spam filters use a combination of reputation signals, content analysis, and engagement data to decide where your email lands. It's not a single check - it's hundreds of signals weighted together into a score.",
          "The three biggest factors are: sender reputation (is your domain and IP known for sending good email?), authentication (do your SPF, DKIM, and DMARC records check out?), and recipient engagement (do people who receive your emails open and interact with them?).",
          "Understanding these categories helps you diagnose which area is causing problems when your emails start landing in spam.",
        ],
      },
      {
        heading: "Reason 1: Missing or broken authentication",
        content: [
          "If your domain doesn't have proper SPF, DKIM, and DMARC records, you're immediately at a disadvantage. Major providers like Gmail now flag unauthenticated emails as suspicious by default.",
          "The fix: Add all three authentication records to your DNS. Mailmark generates these automatically when you add your domain. Check your dashboard to confirm all records are verified and showing green checkmarks.",
        ],
      },
      {
        heading: "Reason 2: Poor sender reputation",
        content: [
          "Your sender reputation is like a credit score for email. If you've been sending to invalid addresses (high bounce rate), getting spam complaints, or sending to people who never engage, your reputation takes a hit.",
          "The fix: Clean your list aggressively. Remove hard bounces immediately. Suppress addresses that haven't engaged in 90 days. If your reputation is already damaged, consider warming up a new subdomain and building fresh.",
        ],
      },
      {
        heading: "Reason 3: Spammy content patterns",
        content: [
          "Spam filters look for patterns that correlate with unwanted email. Common triggers include: excessive use of capital letters, multiple exclamation marks, phrases like \"limited time offer\" or \"click here now,\" and emails that are mostly images with little text.",
          "The fix: Write like a human. Use a conversational tone, avoid marketing clichés, and keep a healthy balance of text and images. If you're not sure whether your email sounds spammy, read it aloud - if it sounds like a used-car ad, rewrite it.",
        ],
      },
      {
        heading: "Reason 4: Sending to unengaged recipients",
        content: [
          "Mailbox providers track how recipients interact with your emails. If most of your emails are ignored, deleted without reading, or moved to spam by recipients, the provider learns that your messages aren't wanted.",
          "The fix: Segment your list by engagement and send more frequently to people who open your emails. Reduce frequency or stop sending entirely to people who consistently ignore your messages. This feedback loop is one of the strongest signals spam filters use.",
        ],
      },
      {
        heading: "Reason 5: Sudden volume spikes",
        content: [
          "If you normally send 500 emails a day and suddenly send 50,000, spam filters treat this as suspicious behavior - because that's exactly what compromised accounts do. Volume spikes are a strong indicator of either a hacked account or a purchased list.",
          "The fix: Increase your sending volume gradually. If you need to send a large campaign, ramp up over several days. Start with your most engaged segment, then expand to broader lists as your volume increases.",
        ],
      },
      {
        heading: "Reason 6: No unsubscribe link",
        content: [
          "Legally required in most countries and now technically enforced by major providers, a missing unsubscribe link is both a compliance violation and a spam signal. Google requires one-click unsubscribe headers for senders sending more than 5,000 messages per day.",
          "The fix: Include a visible, working unsubscribe link in every marketing and bulk email. Mailmark adds the required List-Unsubscribe header and one-click unsubscribe link automatically to all campaign emails.",
        ],
      },
      {
        heading: "Reason 7: You're on a blocklist",
        content: [
          "IP and domain blocklists are maintained by organizations that track sources of spam. If your domain or sending IP appears on a major blocklist (Spamhaus, Barracuda, etc.), your deliverability will plummet.",
          "The fix: Check your domain and IP against major blocklists using free tools like MXToolbox. If you're listed, follow the blocklist's removal process - which usually requires demonstrating that you've fixed the underlying problem. Mailmark monitors blocklist status for your domains automatically.",
        ],
      },
      {
        heading: "A step-by-step recovery plan",
        content: [
          "If your emails are consistently landing in spam, follow this order: First, fix your authentication records. Second, clean your list. Third, review your content for spam triggers. Fourth, check blocklists. Fifth, start sending only to your most engaged recipients and gradually expand.",
          "Recovery takes time - usually 2 to 4 weeks of consistent good behavior before spam filters update their assessment of your domain. Be patient and consistent, and your inbox placement will improve.",
        ],
      },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(articles).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articles[slug];
  if (!article) return { title: "Article Not Found - Mailmark" };
  return {
    title: `${article.title} - Mailmark Blog`,
    description: article.excerpt,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles[slug];

  if (!article) {
    notFound();
  }

  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              {article.category}
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            {article.title}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            {article.excerpt}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[article.category]}`}
            >
              {article.category}
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-violet-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {article.readTime}
            </span>
            <span>{article.date}</span>
          </div>
        </div>
      </section>

      {/* Article content */}
      <section className="bg-white px-6 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          {article.sections.map((section, i) => (
            <div key={i} className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {section.heading}
              </h2>
              {section.content.map((paragraph, j) => (
                <p
                  key={j}
                  className="mt-4 leading-relaxed text-gray-600 dark:text-gray-300"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}

          {/* Back to blog */}
          <div className="border-t border-gray-100 pt-10 dark:border-gray-700">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
              Back to all articles
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
