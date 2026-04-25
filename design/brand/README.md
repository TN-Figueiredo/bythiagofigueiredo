# Brand assets — Marginalia (Direction 1)

The wordmark is set in **Source Serif 4**. Make sure that font is loaded
on any surface that uses the `wordmark-*.svg` files — otherwise the SVG
will fall back to Georgia/system serif. The asterisk and monogram are
pure shapes and do not need any web font.

```html
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet">
```

## Files

| File | Use |
|---|---|
| `wordmark-light-bg.svg` | Full lockup on cream/white surfaces |
| `wordmark-dark-bg.svg` | Full lockup on `#14110B` and other dark surfaces |
| `wordmark-tagline-light-bg.svg` | Lockup + `escritos · vídeos · cartas` |
| `wordmark-tagline-dark-bg.svg` | Same, dark version |
| `symbol-deep.svg` | Asterisk alone (`#C14513` — light surfaces) |
| `symbol-warm.svg` | Asterisk alone (`#FF8240` — dark surfaces) |
| `monogram-light-bg.svg` | TF stamp for square avatars (light bg) |
| `monogram-dark-bg.svg` | TF stamp for square avatars (dark bg) |
| `favicon.svg` | 32×32 asterisk favicon |

## Color tokens

| Token | Hex | Where |
|---|---|---|
| Ink (dark) | `#1A140C` | Text on light surfaces |
| Ink (light) | `#EFE6D2` | Text on dark surfaces |
| Accent (warm) | `#FF8240` | Dark mode |
| Accent (deep) | `#C14513` | Light mode |

## Clearspace

Leave at least the height of the lowercase `b` of "by" on every side.
The asterisk should breathe — never crowd it with other graphics.
