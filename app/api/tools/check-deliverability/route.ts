import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";

const dnsResolver = new dns.promises.Resolver();
dnsResolver.setServers(["8.8.8.8", "1.1.1.1"]);

const COMMON_DKIM_SELECTORS = [
  "google",
  "default",
  "selector1",
  "selector2",
  "k1",
  "k2",
  "s1",
  "s2",
  "dkim",
  "mail",
  "amazonses",
  "mandrill",
  "smtp",
  "cm",
  "mxvault",
];

const BLACKLISTS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "b.barracudacentral.org",
  "dnsbl.sorbs.net",
  "spam.dnsbl.sorbs.net",
];

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function cleanDomain(input: string): string | null {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.replace(/\/.*$/, "");
  domain = domain.replace(/:.*$/, "");
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainRegex.test(domain)) return null;
  return domain;
}

async function resolveTxt(hostname: string): Promise<string[][]> {
  try {
    return await dnsResolver.resolveTxt(hostname);
  } catch {
    return [];
  }
}

async function resolveCname(hostname: string): Promise<string[]> {
  try {
    return await dnsResolver.resolveCname(hostname);
  } catch {
    return [];
  }
}

async function resolveMx(
  hostname: string
): Promise<{ priority: number; exchange: string }[]> {
  try {
    return await dnsResolver.resolveMx(hostname);
  } catch {
    return [];
  }
}

async function resolve4(hostname: string): Promise<string[]> {
  try {
    return await dnsResolver.resolve4(hostname);
  } catch {
    return [];
  }
}

async function checkSpf(domain: string) {
  const txtRecords = await resolveTxt(domain);
  const allTxt = txtRecords.map((parts) => parts.join(""));
  const spfRecord = allTxt.find((r) => r.startsWith("v=spf1"));

  if (!spfRecord) {
    return {
      valid: false,
      record: null as string | null,
      details: "No SPF record found. Add a TXT record with your SPF policy.",
    };
  }

  return {
    valid: true,
    record: spfRecord,
    details: "SPF record found and configured.",
  };
}

async function checkDkim(domain: string) {
  const foundSelectors: string[] = [];

  const results = await Promise.all(
    COMMON_DKIM_SELECTORS.map(async (selector) => {
      const hostname = `${selector}._domainkey.${domain}`;
      const [txtRecords, cnameRecords] = await Promise.all([
        resolveTxt(hostname),
        resolveCname(hostname),
      ]);
      const hasTxt = txtRecords.some((parts) =>
        parts.join("").includes("v=DKIM1")
      );
      const hasCname = cnameRecords.length > 0;
      return { selector, found: hasTxt || hasCname };
    })
  );

  for (const r of results) {
    if (r.found) foundSelectors.push(r.selector);
  }

  if (foundSelectors.length === 0) {
    return {
      valid: false,
      selectors: [] as string[],
      details:
        "No DKIM selectors detected. Configure DKIM signing with your email provider.",
    };
  }

  return {
    valid: true,
    selectors: foundSelectors,
    details: `DKIM configured with selector(s): ${foundSelectors.join(", ")}`,
  };
}

async function checkDmarc(domain: string) {
  const txtRecords = await resolveTxt(`_dmarc.${domain}`);
  const allTxt = txtRecords.map((parts) => parts.join(""));
  const dmarcRecord = allTxt.find((r) => r.includes("v=DMARC1"));

  if (!dmarcRecord) {
    return {
      valid: false,
      record: null as string | null,
      policy: null as string | null,
      details:
        "No DMARC record found. Add a TXT record at _dmarc.yourdomain.com.",
    };
  }

  const policyMatch = dmarcRecord.match(/p=(\w+)/);
  const policy = policyMatch ? policyMatch[1] : null;

  return {
    valid: true,
    record: dmarcRecord,
    policy,
    details: `DMARC configured with policy: ${policy ?? "unknown"}`,
  };
}

async function checkMx(domain: string) {
  const mxRecords = await resolveMx(domain);
  const sorted = mxRecords.sort((a, b) => a.priority - b.priority);

  if (sorted.length === 0) {
    return {
      valid: false,
      records: [] as { priority: number; exchange: string }[],
      details: "No MX records found. This domain cannot receive email.",
    };
  }

  return {
    valid: true,
    records: sorted,
    details: `${sorted.length} MX record(s) found.`,
  };
}

async function checkBlacklist(domain: string) {
  const listed: string[] = [];

  const results = await Promise.all(
    BLACKLISTS.map(async (bl) => {
      const addrs = await resolve4(`${domain}.${bl}`);
      return { bl, isListed: addrs.length > 0 };
    })
  );

  for (const r of results) {
    if (r.isListed) listed.push(r.bl);
  }

  return {
    clean: listed.length === 0,
    listed,
    checked: BLACKLISTS,
    details:
      listed.length === 0
        ? `Clean on all ${BLACKLISTS.length} blacklists checked.`
        : `Listed on ${listed.length} blacklist(s): ${listed.join(", ")}`,
  };
}

function calculateScore(checks: {
  spf: { valid: boolean };
  dkim: { valid: boolean };
  dmarc: { valid: boolean; policy: string | null };
  mx: { valid: boolean };
  blacklist: { clean: boolean };
}) {
  let score = 100;
  if (!checks.spf.valid) score -= 25;
  if (!checks.dkim.valid) score -= 20;
  if (!checks.dmarc.valid) score -= 20;
  else if (checks.dmarc.policy === "none") score -= 5;
  if (!checks.blacklist.clean) score -= 30;
  if (!checks.mx.valid) score -= 10;
  return Math.max(0, score);
}

function getRecommendations(checks: {
  spf: { valid: boolean };
  dkim: { valid: boolean };
  dmarc: { valid: boolean; policy: string | null };
  mx: { valid: boolean };
  blacklist: { clean: boolean; listed: string[] };
}) {
  const recs: string[] = [];
  if (!checks.spf.valid) {
    recs.push(
      'Add an SPF record to your domain\'s DNS. Example: v=spf1 include:_spf.google.com ~all'
    );
  }
  if (!checks.dkim.valid) {
    recs.push(
      "Set up DKIM signing with your email provider. This adds a cryptographic signature to your emails."
    );
  }
  if (!checks.dmarc.valid) {
    recs.push(
      'Add a DMARC record at _dmarc.yourdomain.com. Start with: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com'
    );
  } else if (checks.dmarc.policy === "none") {
    recs.push(
      'Your DMARC policy is set to "none". Consider upgrading to "quarantine" or "reject" for stronger protection.'
    );
  }
  if (!checks.mx.valid) {
    recs.push(
      "No MX records found. Add MX records pointing to your mail server so your domain can receive email."
    );
  }
  if (!checks.blacklist.clean) {
    recs.push(
      `Your domain is listed on ${checks.blacklist.listed.join(", ")}. Request delisting and review your sending practices.`
    );
  }
  return recs;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  let body: { domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!body.domain) {
    return NextResponse.json(
      { error: "Domain is required." },
      { status: 400 }
    );
  }

  const domain = cleanDomain(body.domain);
  if (!domain) {
    return NextResponse.json(
      { error: "Invalid domain format." },
      { status: 400 }
    );
  }

  const [spf, dkim, dmarc, mx, blacklist] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain),
    checkDmarc(domain),
    checkMx(domain),
    checkBlacklist(domain),
  ]);

  const checks = { spf, dkim, dmarc, mx, blacklist };
  const score = calculateScore(checks);
  const reputationStatus: "healthy" | "warning" | "critical" =
    score >= 80 ? "healthy" : score >= 50 ? "warning" : "critical";
  const recommendations = getRecommendations(checks);

  return NextResponse.json({
    domain,
    score,
    reputationStatus,
    checks,
    recommendations,
    checkedAt: new Date().toISOString(),
  });
}
