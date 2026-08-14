# GARNERS Bakery — design tokens

Derived from real storefront and packaging photos (not a generic bakery theme).

## Palette
- `--garners-green`      #1F3D2E   (deep forest green — logo badge, primary brand color)
- `--garners-green-dark` #142A1F   (shadows, hover states)
- `--garners-cream`      #F6F1E4   (walls, page background)
- `--garners-kraft`      #C9A063   (kraft paper packaging tone)
- `--garners-red`        #A13A2E   (awning stripe red, use sparingly — alerts/accents only)
- `--garners-wood`       #6B4A32   (counter wood, borders)
- `--garners-charcoal`   #2B2823   (primary text)
- `--garners-teal-wall`  #2E4A46   (interior accent wall — used for dashboard dark sections)
- `--garners-gold`       #B8923F   (metallic gold foil from gift-hamper packaging and jar lids — premium/gifting contexts only, not yet used by any shipped feature)

## Type
- Display / brand wordmark: serif, high-contrast (e.g. "Fraunces" or "Playfair Display") — mirrors the logo badge lettering
- Wordmark tagline ("Cakes & Breads"): italic display serif, mirroring the thin script used under "GARNERS" on real product labels — not plain body text
- Body / UI: clean grotesque sans (e.g. "Inter") for dashboard density
- Data / numbers: tabular sans for dashboard stats

## Signature element
The kraft-paper repeated wordmark pattern from packaging becomes a subtle background texture on receipts, order cards, and the customer app header — a stamp-like repeat of "GARNERS" at low opacity, echoing the real packaging.

## Layout notes
- Owner dashboard: cream background, forest green header bar, kraft-tone metric cards
- Customer app: warmer, more product-photo forward, red awning stripe as a thin top accent bar
- Avoid the generic AI-bakery cliché (#D97757 terracotta) — this brand's real accent is the deeper red-brown awning red and forest green, not clay/terracotta

## Packaging & sub-brand notes (from product photography)
- Physical clamshell packaging carries its own black-and-white lockup — bold black sans "GARNERS" over a thin italic/script "Cakes & Breads" tagline on a plain white sticker. This is packaging-specific, not a replacement for the green in-app header; the app wordmark keeps the same two-tier lockup (bold caps + italic tagline) but in cream-on-green to stay legible in the nav bar.
- A gifting/premium sub-line (hampers, jars — "GARNERS Cake Studio") uses black + metallic gold foil, plus festive red/gold ribbon and kraft "thank you" cards. Reserve `--garners-gold` for this context once a gifting feature exists; don't apply it to core dashboard/inventory/staff UI.
- Interior shop photos (arched doorway, vintage hanging scale) confirm the wood/kraft heritage feel, with warmer amber ambient light than the cool `--garners-teal-wall` token implies — keep teal-wall as a deliberate accent-wall color, not the general interior mood.
