# Fonts for the generated social cards

`app/blog/[slug]/opengraph-image.tsx` renders through Satori, which does not
read WOFF2 and does not apply variable-font axes. These are static TTF
instances of the same three faces the site loads through `next/font/google`,
flattened to the coordinates the CSS asks for:

| File                    | Face              | Instance                          | Used for |
| ----------------------- | ----------------- | --------------------------------- | -------- |
| `Fraunces-Display.ttf`  | Fraunces          | wght 600, SOFT 0, WONK 1, opsz 56 | the article headline (`.font-display`) |
| `Fraunces-Wordmark.ttf` | Fraunces          | wght 700, SOFT 0, WONK 1, opsz 39 | the "Mailmark" lockup (`.font-wordmark`) |
| `SchibstedGrotesk.ttf`  | Schibsted Grotesk | wght 400                          | the excerpt |
| `DMMono.ttf`            | DM Mono           | regular                           | the domain and category |

`Fraunces-Wordmark.ttf` is subset to the letters in "Mailmark", which is the
only string it ever sets.

All three families are licensed under the SIL Open Font License 1.1:

- Fraunces: https://github.com/undercasetype/Fraunces
- Schibsted Grotesk: https://github.com/schibsted/schibsted-grotesk
- DM Mono: https://github.com/googlefonts/dm-mono

To regenerate after a font update, instance the WOFF2 files that
`next/font/google` caches under `.next/static/media/` with fontTools
(`instancer.instantiateVariableFont`), clear the `fvar`/`gvar`/`STAT`/`avar`
tables and save with `flavor = None`.
