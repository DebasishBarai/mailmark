/**
 * Unsubscribe link tokens.
 *
 * The old token was `${messageId}-${base64url(recipient)}`, and nothing ever
 * looked at it: both HTTP handlers read the address and the domain straight
 * out of the query string and unsubscribed whoever they named. Anyone who
 * knew a sending domain could therefore opt any address out of it with a
 * single GET, which is a silent block on that sender's future mail to that
 * person. `unsubscribe.getByToken` existed but had no callers, and could not
 * have helped anyway: the token in the mail is minted at send time, while the
 * token on an `unsubscribes` row is minted when the row is inserted, so the
 * two were never the same value.
 *
 * A token now carries the recipient and the domain in signed form, and the
 * handlers take those from the token instead of from the request. Two shapes
 * are accepted:
 *
 *   signed (v1)  `v1.<messageId>.<b64u email>.<b64u domain>.<b64u HMAC>`
 *                Self-contained. The HMAC over everything before the last dot
 *                is what proves we issued it, so no read is needed.
 *
 *   legacy       `<messageId>-<b64u email>`
 *                What is sitting in every campaign already delivered, and what
 *                we still mint when UNSUBSCRIBE_SECRET is unset. Unforgeable
 *                on its own, so the caller verifies it against the sent
 *                message: see unsubscribe.resolveLegacyToken.
 *
 * Both runtimes have to build these: ses.ts is "use node", http.ts is the
 * Convex runtime. So this file sticks to WebCrypto and atob/btoa, and does not
 * reach for Buffer.
 */

const SIGNED_PREFIX = "v1";

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function encodeText(value: string): string {
  return encodeBase64Url(new TextEncoder().encode(value));
}

function decodeText(value: string): string | null {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Unset means "no signing key configured", which is a supported state: we
 *  fall back to legacy tokens, and those are verified against the sent
 *  message instead. Throwing here would take campaign sending down with it. */
function getSecret(): string | null {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return encodeBase64Url(new Uint8Array(signature));
}

/** Length-independent equality. Signature comparison is the one place in this
 *  file where an early return leaks something worth having. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The token to put in a message's unsubscribe links.
 *
 * `email` and `domain` are baked in, so the link needs no query string and the
 * recipient's address stops travelling in one (where it reaches referrers and
 * proxy logs). Falls back to the legacy shape when no secret is configured.
 */
export async function buildUnsubscribeToken(args: {
  messageId: string;
  email: string;
  domain: string;
}): Promise<string> {
  const secret = getSecret();
  const encodedEmail = encodeText(args.email.toLowerCase().trim());
  if (!secret) return `${args.messageId}-${encodedEmail}`;

  const payload = [
    SIGNED_PREFIX,
    args.messageId,
    encodedEmail,
    encodeText(args.domain.toLowerCase().trim()),
  ].join(".");
  return `${payload}.${await sign(secret, payload)}`;
}

export type ParsedUnsubscribeToken =
  | { kind: "signed"; messageId: string; email: string; domain: string }
  | { kind: "legacy"; messageId: string; email: string }
  | { kind: "invalid" };

/**
 * Read a token back. A "signed" result is trustworthy on its own; a "legacy"
 * one still has to be checked against the message it names.
 */
export async function parseUnsubscribeToken(
  token: string
): Promise<ParsedUnsubscribeToken> {
  const raw = token.trim().replace(/\/+$/, "");
  if (!raw) return { kind: "invalid" };

  if (raw.startsWith(`${SIGNED_PREFIX}.`)) {
    const parts = raw.split(".");
    if (parts.length !== 5) return { kind: "invalid" };

    // A v1 token that arrives after the secret is removed cannot be checked,
    // and an unverifiable token is not a token.
    const secret = getSecret();
    if (!secret) return { kind: "invalid" };

    const [, messageId, encodedEmail, encodedDomain, signature] = parts;
    const expected = await sign(secret, parts.slice(0, 4).join("."));
    if (!timingSafeEqual(signature, expected)) return { kind: "invalid" };

    const email = decodeText(encodedEmail);
    const domain = decodeText(encodedDomain);
    if (!email || !domain) return { kind: "invalid" };
    return { kind: "signed", messageId, email, domain };
  }

  // Legacy: `${Date.now()}-${random}-${base64url(email)}`. Split on the first
  // two hyphens rather than the last, because the encoded address can itself
  // contain one: base64url spells byte 62 as "-", and from printable ASCII
  // that turns up whenever the third byte of a triple is ">" or "~"
  // ("ab~@example.com" encodes to "YWJ-QGV4YW1wbGUuY29t"). Splitting at the
  // final hyphen decodes garbage for exactly those recipients, which is what
  // the old POST handler did.
  const parts = raw.split("-");
  if (parts.length < 3) return { kind: "invalid" };
  const messageId = `${parts[0]}-${parts[1]}`;
  const email = decodeText(parts.slice(2).join("-"));
  if (!email || !email.includes("@")) return { kind: "invalid" };
  return { kind: "legacy", messageId, email };
}
