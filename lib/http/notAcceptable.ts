/**
 * The body of a 406.
 *
 * It lives apart from lib/markdown so the middleware, which is on the path of
 * every request, does not pull the whole Markdown corpus into its bundle.
 */

export function notAcceptableMarkdown(
  pathname: string,
  offers: readonly string[]
): string {
  return `# 406 - Not Acceptable

\`${pathname}\` cannot be served in any of the media types you asked for.

Available representations: ${offers.map((offer) => `\`${offer}\``).join(", ")}.

Send \`Accept: text/html\` for the page, or \`Accept: text/markdown\` for its Markdown variant.
`;
}
