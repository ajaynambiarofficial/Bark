# Bark Phase 1.1 design system

## Direction

Bark is a calm, warm, highly organized internal operations workspace. The visual system favors
quiet surfaces, compact controls, readable typography, and restrained motion suitable for long
daily sessions. The recurring paw mark and green accent connect the product to Supertails without
turning the workspace into a consumer storefront.

## Brand source and status

The public Supertails website and company profiles consistently show a green-led identity and a
friendly pet-care personality. No authoritative public brand guide with exact color values was
found during implementation. The green values in `src/styles/index.css` are therefore explicitly
**provisional**, not official Supertails colors. Replace the `--brand-*` tokens when approved brand
assets become available; components require no color-level changes.

## Color architecture

All application colors are semantic CSS variables with independent light and dark values:

- Application, sidebar, header, card, elevated, subtle, and input surfaces
- Primary, secondary, muted, sidebar, and disabled text
- Borders, hover, active, disabled, and overlay states
- Brand primary, hover, strong, soft, deep, on-brand, and focus colors
- Success, warning, error, and information states

Dark mode uses charcoal and graphite surfaces rather than inversion or pure black. Brand green is
lifted in luminance for dark backgrounds. Soft off-white text reduces glare while retaining useful
contrast.

## Typography and spacing

The stack prefers Inter when installed and otherwise uses modern system fonts. The spacing rhythm
uses 4px increments. Controls use 8–10px radii, panels use 12–14px radii, and shadows remain subtle.

## Theme behavior

The first-visit preference is `system`. A pre-render script applies the resolved theme before React
loads to prevent a visible incorrect-theme flash. Preferences are stored under
`bark.appearance`; system mode listens for operating-system changes.

## Accessibility

The interface uses semantic landmarks and controls, visible focus rings, keyboard-operable menus,
text labels for status, minimum 40px primary controls, and reduced-motion handling. Exact contrast
ratios should be re-audited if approved brand tokens replace the provisional palette.
