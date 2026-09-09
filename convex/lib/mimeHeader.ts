// Recovering text that was decoded as Latin-1 when it was really UTF-8.
//
// The SES Lambda's old RFC 2047 decoder built a Q-encoded word's text with
// String.fromCharCode(byte), which reads each byte as one Latin-1 character.
// A UTF-8 en dash (E2 80 93) came out as "â" plus two control characters, so
// a subject like "Application – Nishant Verma" was stored as
// "Application â Nishant Verma" and rendered as a letter and two boxes.
//
// The damage is reversible: every original byte is still there, one per
// character, so reading the characters back as bytes and decoding them as
// UTF-8 gives back the text the sender wrote.

/**
 * The repaired text, or null when `text` is not a Latin-1 misreading of UTF-8
 * and must be left exactly as it is.
 *
 * Both conditions have to hold before a rewrite: every character fits in a
 * byte (nothing above U+00FF ever came out of the old decoder), and those
 * bytes are valid UTF-8 that decodes to something other than what is stored.
 * Text that was always correct is ASCII and decodes to itself; a genuinely
 * Latin-1 subject such as "Café" is not valid UTF-8 as bytes and fails the
 * check. Either way the original is kept.
 */
export function repairLatin1Mojibake(text: string): string | null {
  if (!text) return null;
  if (!/^[\u0000-\u00ff]*$/.test(text)) return null;

  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i);
  }

  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  return decoded === text ? null : decoded;
}

/**
 * The "Name <address>" form the emails table stores for a sender.
 *
 * mailparser's own `from.text` renders the display name quoted, as
 * `"Tamás Hám-Szabó" <tamas@example.com>`. That is a valid header, but it is
 * not the shape this app stores: the mailbox UI splits the stored value on the
 * angle brackets and quotes the reply header with it, and every row written
 * before now holds the unquoted form. Building the value from the parsed
 * address keeps the stored shape unchanged, so only the encoding is fixed.
 *
 * An address with no display name is returned bare, and the rare header
 * carrying several addresses keeps them comma separated, as the header had it.
 */
export function formatSender(
  addresses: Array<{ name?: string; address?: string }> | undefined
): string {
  if (!addresses) return "";

  const parts: string[] = [];
  for (const entry of addresses) {
    const address = entry.address?.trim();
    if (!address) continue;
    const name = entry.name?.trim();
    parts.push(name ? `${name} <${address}>` : address);
  }
  return parts.join(", ");
}
