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
 * Convex runtime. So no Buffer, and no atob/btoa either: nothing under convex/
 * uses those today, and this is not the code path to find out on. base64url is
 * done by hand below. WebCrypto is already proven here, by the sha256Hex the
 * REST API authenticates every request with.
 */

const SIGNED_PREFIX = "v1";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Unpadded base64url. Padding is what "=" is for, and "=" has to be escaped
 *  in a URL, so tokens carry none and the decoder infers length from the
 *  bits it has. */
function encodeBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += ALPHABET[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += ALPHABET[b2 & 0b111111];
  }
  return out;
}

function decodeBase64Url(value: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let bitCount = 0;
  for (let i = 0; i < value.length; i++) {
    const index = ALPHABET.indexOf(value[i]);
    // Any character outside the alphabet means this is not a token we minted,
    // padding and whitespace included.
    if (index < 0) return null;
    bits = (bits << 6) | index;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      out.push((bits >> bitCount) & 0xff);
    }
  }
  return new Uint8Array(out);
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

/**
 * Signing keys, newest first. Empty means none configured, which is a
 * supported state: we fall back to legacy tokens, and those are verified
 * against the sent message instead. Throwing here would take campaign sending
 * down with it.
 *
 * UNSUBSCRIBE_SECRET_PREVIOUS exists so the key can be rotated without
 * breaking mail that is already delivered. Tokens are minted with the first
 * key and accepted against any, so a rotation is: move the old value to
 * PREVIOUS, set the new one, and drop PREVIOUS once nothing signed with it is
 * still in an inbox. Rotating without it invalidates the unsubscribe link in
 * every campaign already sent, and those links are not ours to break.
 */
function getSecrets(): string[] {
  return [
    process.env.UNSUBSCRIBE_SECRET,
    process.env.UNSUBSCRIBE_SECRET_PREVIOUS,
  ].filter((secret): secret is string => !!secret && secret.length > 0);
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
  // A To header can arrive as `Name <addr@example.com>`, and the address is
  // what has to end up on the unsubscribes row: sendGate looks the recipient
  // up by bare address, so a row keyed on the display form would never match
  // and the opt-out would quietly do nothing.
  const encodedEmail = encodeText(normalizeAddress(args.email));
  const legacy = `${args.messageId}-${encodedEmail}`;

  const secret = getSecrets()[0];
  if (!secret) return legacy;

  try {
    const payload = [
      SIGNED_PREFIX,
      args.messageId,
      encodedEmail,
      // Verbatim, not lowercased: domains are stored exactly as the user typed
      // them when adding one (nothing in domainActions or insertDomain folds
      // case) and domains.getDomainByName is an exact index lookup. Normalizing
      // here would miss every domain that was added with a capital in it.
      encodeText(args.domain),
    ].join(".");
    return `${payload}.${await sign(secret, payload)}`;
  } catch {
    // Signing is the only thing here that can fail, and it is not worth a
    // failed send: fall back to the legacy shape, which the handler still
    // accepts by checking it against the message it names.
    return legacy;
  }
}

/** The bare address, lowercased: `Name <a@b.com>` and `a@b.com` have to reach
 *  the unsubscribes table as the same value. */
export function normalizeAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).toLowerCase().trim();
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
  try {
    return await readToken(token);
  } catch {
    // An unverifiable token is not a token. Failing closed here costs one
    // unsubscribe link; failing open would reopen the hole this file exists
    // to close.
    return { kind: "invalid" };
  }
}

async function readToken(token: string): Promise<ParsedUnsubscribeToken> {
  const raw = token.trim().replace(/\/+$/, "");
  if (!raw) return { kind: "invalid" };

  if (raw.startsWith(`${SIGNED_PREFIX}.`)) {
    const parts = raw.split(".");
    if (parts.length !== 5) return { kind: "invalid" };

    const [, messageId, encodedEmail, encodedDomain, signature] = parts;
    const email = decodeText(encodedEmail);
    const domain = decodeText(encodedDomain);
    if (!email || !domain) return { kind: "invalid" };

    const payload = parts.slice(0, 4).join(".");
    const secrets = getSecrets();
    let checked = false;
    for (const secret of secrets) {
      let expected: string;
      try {
        expected = await sign(secret, payload);
      } catch {
        // HMAC is unavailable in this runtime. Minting happens in ses.ts under
        // "use node", where WebCrypto is a given, but verification runs here in
        // the Convex runtime, so the two can disagree: tokens get signed and
        // then nothing can check them. Left to itself that rejects every
        // unsubscribe link in every campaign sent after the secret was set.
        break;
      }
      checked = true;
      if (timingSafeEqual(signature, expected)) {
        return { kind: "signed", messageId, email, domain };
      }
    }

    // Every configured key was tried and none produced this signature, so the
    // token was tampered with. It does not reach the fallback below.
    if (checked) return { kind: "invalid" };

    // No secret configured, or no HMAC to check it with. The signature is
    // unreadable but the rest of the token is not, so fall back to proving it
    // against the message it names, which is what a legacy token does. The
    // domain is dropped: the message the recipient is found on decides it.
    return { kind: "legacy", messageId, email };
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
