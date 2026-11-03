# Design QA — expense payer and split controls

## Movement modal update · 2026-11-03

Verified with `node tests/finance-preview.mjs` and synthetic accounts in the in-app browser:

- At 390 × 844, the movement modal occupies exactly the viewport. Header and footer remain fixed; scrolling changes only `.movement-modal-body` (`scrollTop: 656`), with both dialog and modal at `scrollTop: 0`.
- At 390 × 460, the modal follows the reduced visible height and the footer ends at 460 px without horizontal overflow. VisualViewport resize/scroll listeners also fit the dialog around the on-screen keyboard; physical-device keyboard behavior still requires device testing.
- At 1280 × 720, the desktop modal remains centered at 760 px wide with a separate scrollable body.
- New and edited incomes omit city, establishment and geolocation controls. Expense forms retain those fields.
- The header history icon opens history directly; returning preserves the unsaved name. Creation and editing save successfully through the external fixed footer with native form submission.
- Validation: 125 tests, lint and production build pass. All browser writes use the local mock API.

Source visual truth: `/var/folders/ty/8gh55kg96pjfryzzvz56btfr0000gp/T/codex-clipboard-9e938bf1-c735-4919-a8fa-b34238b98efe.png`.

Implementation evidence: browser-rendered local preview captured in the Codex in-app browser (desktop 875 × 770 px and mobile 390 × 844 px; capture is ephemeral because the browser tool does not expose a filesystem screenshot path). The preview used the production `src/styles.css` and the same modal control markup/styles; the temporary preview file was removed after verification.

State: add-expense modal, two members selected, equal split, €30 total. The mobile capture was also checked at the responsive breakpoint.

## Comparison

- Full-view evidence: payer and payment method are now compact pill controls, while “Dividir” is a single mode selector followed by a compact member list with selected checks and right-aligned per-person amounts.
- Focused-region evidence: the payer control, payment-method control, split-mode selector, row separators, selection affordance, and right-aligned values were readable at both desktop and 390 px mobile width.
- Intentional product difference: Gastoteca keeps its existing light paper/green design tokens instead of Tricount’s dark theme; the requested interaction density and selection pattern are preserved.

## Required fidelity surfaces

- Fonts and typography: existing DM Sans/Fraunces system retained; labels, values, and helper text preserve the app hierarchy.
- Spacing and layout rhythm: two-column quick controls on desktop, stacked controls on mobile, 64 px member rows, rounded list container, and consistent modal gutters.
- Colors and visual tokens: existing Gastoteca paper, line, muted, green, and focus tokens reused; selected checks use the primary green state.
- Image quality and asset fidelity: no new raster assets; chevrons and checks use the existing Phosphor icon library.
- Copy and content: “Pagado por”, “Cuándo”, “Dividir”, “Igualmente”, member names, “Tú”, and payment method remain localized and actionable.

## Interaction checks

- Native payer selection still supports a specific member and “Entre todos” through one control.
- Participant rows derive from the existing `applies_to_all`/`participant_uids` model; toggling the last/first participant preserves the existing save validation.
- Equal, amount, and percentage modes remain connected to the existing `setShareMode` conversion and split validation.
- Lint, 39 application/domain tests, and production build pass.

## Comparison history

1. Initial implementation: replaced explanatory payer/apply cards with compact payer/date controls and a member split list.
2. Follow-up fix: preserved `name="draft-share_mode"` for existing accessibility/render tests after moving the mode control into the compact header.
3. Post-fix desktop and mobile captures showed no actionable P0/P1/P2 visual findings.
4. Follow-up adjustment removed the duplicate visible date field and put “Método de pago” beside “Pagado por”; the draft date remains internal/defaulted for API compatibility.

Final result: passed
