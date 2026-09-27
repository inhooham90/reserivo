---
version: alpha
name: Morrri
description: >-
  Structure tokens (type scale, spacing, radii, control sizes, motion) are
  reverse-engineered from handled.nl/en (computed styles and :root custom
  properties, captured 2026-09-24 at a 1792px viewport). Colors come from
  the Morrri dashboard screenshot (3532x1814 PNG), sampled pixel by pixel.
  Values marked [derived] in the prose are in neither source.
colors:
  # --- sampled from the Morrri screenshot (flat fills, exact values) ---
  neutral: "#e9e8fc"        # pale light purple: page background
  secondary: "#fdfee9"      # pale yellow: story panel
  primary: "#12122a"        # navy: primary button
  surface: "#ffffff"        # white: form card, inputs, nav pill
  # --- v3 neutrals [derived]: tinted toward the navy hue so they sit with lavender and butter ---
  ink: "#15141f"            # headings, labels
  body: "#45445a"           # paragraphs
  muted: "#66657a"          # helper text, metadata
  border-strong: "#85849a"  # input and checkbox borders (3:1 on white)
  line: "rgba(18, 18, 42, 0.12)"  # dividers, card outlines
  surface-subtle: "#f8f8fc" # quiet panels on a white page
  surface-muted: "#f0f0f6"  # hover fills
  # --- role aliases ---
  on-primary: "#ffffff"
  on-surface: "#15141f"
  on-secondary: "#15141f"
  on-neutral: "#15141f"
  # --- [derived] ---
  error: "#b42318"
  scrim: "rgba(21, 20, 31, 0.4)"   # dialog backdrop
typography:
  headline-xl:
    fontFamily: PP Kyoto
    fontSize: 64px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: PP Kyoto
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.03em
  headline-md:
    fontFamily: PP Kyoto
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.03em
  headline-sm:
    fontFamily: PP Kyoto
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"cv09", "cv03", "cv04", "cv11"'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"cv09", "cv03", "cv04", "cv11"'
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  title-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  stat-value:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
rounded:
  xs: 4px
  sm: 8px
  md: 16px
  full: 100px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 40px
  3xl: 48px
  4xl: 64px
  gutter: 40px
  gutter-mobile: 24px
  container: 1200px
  control-height: 48px
components:
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-neutral}"
    typography: "{typography.body-lg}"
  nav-group:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.xxs}"
    height: "{spacing.control-height}"
  card-form:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "{spacing.4xl}"
  panel-story:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.4xl}"
  panel-body:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.body}"
    typography: "{typography.body-lg}"
  tagline-chip:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 32px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.lg}"
    height: "{spacing.control-height}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.lg}"
    height: "{spacing.control-height}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.lg}"
    height: "{spacing.control-height}"
  input-label:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
  helper-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
  error-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    typography: "{typography.body-sm}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  panel-quiet:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  row-hover:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
  input-border:
    backgroundColor: "{colors.border-strong}"
    height: 1px
  app-tab-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
  control-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  dialog-backdrop:
    backgroundColor: "{colors.scrim}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  dialog-nav-active:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
  settings-group:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.stat-value}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  appointment-block:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.xs}"
  appointment-walk-in:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.xs}"
  hero-headline:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    typography: "{typography.headline-xl}"
  table-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label-md}"
---

# Morrri

## Overview

A soft, calm appointment booking product for small businesses in the United States. (This file started as
the login surface; the App surfaces section below extends it to the
landing page, settings and calendar.) A pale
lavender page holds two quiet containers: a white form card and a pale
yellow story panel where Mona, the hand-drawn cat mascot, lives. One deep
navy is the only strong color on screen, so the eye lands on the primary
action. Editorial serif headlines and a clean grotesk body keep it
friendly and grown-up.

Provenance:

- **Colors:** the four surface colors are flat fills sampled from the
  Morrri screenshot. Pixel counts on the 3532x1814 image: pale purple
  #e9e8fc 2,655,396 px; white #ffffff 1,674,507 px; pale yellow #fdfee9
  1,609,489 px; navy #12122a 70,176 px.
- **Text colors, line color, structure:** from handled.nl/en. The
  screenshot's text renders within anti-aliasing of these values (darkest
  heading pixel #060504, body #403b37, muted #707070 to #737373). The line
  color composited on white gives exactly #d8d8d8, which is what the
  screenshot shows for dividers and the outline button.

## Colors

**v3 page rule.** The sign-in page keeps the lavender page with a white card
and a butter panel. Every other page sits on White, and lavender and butter
become accents only: active states, calendar blocks, empty states, feature
panels, and the panels Mona sits on.

**v3 neutrals [derived].** The Handled grays were warm stone; next to lavender
and butter they read muddy. The neutrals now lean toward the navy hue:
Ink #15141f (18.23:1 on white), Body #45445a (9.43:1), Muted #66657a (5.66:1 on
white, 4.70:1 on lavender, 5.54:1 on butter), Border-strong #85849a for input
edges (3.64:1), Line rgba(18, 18, 42, 0.12) for dividers, Surface-subtle
#f8f8fc and Surface-muted #f0f0f6 for quiet panels and hover.

- **Neutral, Pale Lavender (#e9e8fc):** Page background. Ink text on it
  reads 16.38:1.
- **Secondary, Pale Butter (#fdfee9):** The story panel behind Mona. Ink
  19.31:1, body 10.05:1.
- **Primary, Deep Navy (#12122a):** The primary button, and the selected
  state of pill toggles (nav pills, the salon tabs, the designer filter).
  White label on it reads 18.33:1.
- **Surface, White (#ffffff):** The form card, inputs, outline button and
  the nav pill.
- **Ink, Body, Muted, Line:** see the v3 neutrals above (the v1 values
  #0c0a09, #44403b, #737373 and rgba(13, 11, 10, 0.16) came from handled.nl
  and are retired).
- **Error (#b42318) [derived]:** Not a sampled fill; carried over from the
  v1 login this screenshot was built from. 6.57:1 on white.

The three surfaces are intentionally low-contrast against each other
(white vs lavender 1.21:1, butter vs lavender 1.18:1). Containers are
separated by tone, not by borders or shadows.

With the v3 Muted (#66657a), helper text passes AA on white, lavender and butter.

## Typography

- **PP Kyoto Medium (500):** Headings only. 48px on the panel headline,
  36px on the form title, tight tracking (-0.03em). PP Kyoto is a
  commercial Pangram Pangram face; the preview uses Newsreader as a
  stand-in with the same sizes.
- **Geist:** Everything functional. 18px body, 16px inputs, 14px/500 for
  labels, buttons and nav.
- **Wordmark:** the Morrri logo is an image asset, never set in type.

## Layout

- Centered 1200px container, 40px gutter (24px under 810px).
- Header: wordmark left, white nav pill right, 32px vertical padding.
- Body: a two-column grid with a 24px gap: form card left, story panel
  right, equal height. Both pad 64px (32px on mobile).
- The form column is 400px wide at most, centered inside the card.
- 4px-base spacing: 4, 8, 12, 16, 24, 32, 40, 48, 64.
- Under 810px the columns stack, form first.

## Elevation & Depth

Flat. No shadows. Depth comes from the three tonal surfaces (lavender
page, white card, butter panel). Motion: buttons scale to 1.04 on hover and
0.98 on press, with a 0.15s transition on transform, background and color.
All of it is off under `prefers-reduced-motion`.

## Shapes

- **Controls are pills:** buttons, inputs, the nav group and chips, all
  48px tall (chips 32px). Measured in the screenshot at 2x: buttons and the
  nav pill are 48px, matching handled.nl's .btn height.
- **Containers are soft rectangles:** 8px radius for the card and panel,
  4px for checkboxes.

## Components

- **Primary button:** navy pill, white 14px/500 label, full width, 48px
  tall. One per view.
- **Outline button:** white pill with a 1px Line ring and ink label.
- **Nav:** a white pill group on lavender with 4px inner padding; items are
  14px/500 ink text with 20px side padding.
- **Tagline chip:** 32px pill with a 1px rgba(0, 0, 0, 0.1) border, sits
  above the panel headline.
- **Inputs [derived]:** white pill, 48px tall, 1px Muted border so the edge
  meets WCAG 1.4.11 (4.74:1 on white); 16px Geist text. Focus: 2px navy
  outline with 2px offset. Error: border and message switch to Error, with
  an icon.
- **Labels** 8px above the field; **helper text** in Muted below it.
- **Mascot:** Mona has seven poses: baker, stylist, hair flip, magnifier,
  doctor, photographer, binoculars. Current placement: landing (hair stylist with scissors in the hero,
  straight on white with no panel; baker in the closing band), sign-in
  (magnifier, 252px wide), settings (hair flip beside Your salons, doctor in
  the Services empty state), calendar empty day (binoculars). Photographer is spare.

## App surfaces (extension)

Added when the system grew from one login screen to four pages. Every value
below is either an existing token or marked [derived].

- **headline-xl (64px):** the landing hero only. Value from handled.nl's
  h1 (64px, line-height 1.05, -0.03em), same source as the rest of the scale.
- **App shell:** top bar on lavender with the wordmark, a nav pill for
  global links, and the account cluster on the right. Under it, the salon
  header (name in headline-sm, booking link and time zone in body) and a
  second nav pill for Schedule, Customers, Messages, Settings. The active
  pill item is navy with white text (v4), the same pair as the primary
  button. Exception: the sign-in page header keeps its current item plain,
  as in the reference screenshot.
- **Selected state [derived]:** checked checkboxes and on-switches use Ink,
  never Navy, so Navy stays unique to the primary button.
- **Dialog:** white, 16px radius, 24px padding, over a Scrim
  (rgba(21, 20, 31, 0.4)) [derived]. Left rail navigation with a search
  field; active item is a lavender 8px block. Settings are grouped into
  white rows separated by Line dividers: label and description on the
  left, control on the right.
- **Stat tiles:** white, 8px radius, 24px padding. Label in label-md Ink,
  value in stat-value (Geist 600, 36px; never the serif), one line of
  context in body-sm Muted.
- **Calendar blocks:** booked appointments are lavender, walk-ins are
  butter, both 4px radius with Ink text. Cancelled appointments are
  hidden by default; when shown they are white with a dashed Line border
  and struck-through Body text. The current-time marker is a 2px Ink line
  with a dot.
- **Line tints [derived]:** the calendar uses the Line hue at other
  strengths: rgba(18, 18, 42, 0.06) for hour rules, rgba(18, 18, 42, 0.035)
  for the closed-hours hatch, and rgba(18, 18, 42, 0.32) for the cancelled
  dashed outline.
- **Wordmark size:** 18px tall (74px wide) on every page and every screen
  size, sign-in included. It never shrinks inside a flex row.
- **Tables:** header row in label-md Muted on white, rows separated by one
  Line divider, numbers right-aligned in tabular figures.

## User journey (prototype links)

- **Home (index.html):** logo stays on Home; How it works and Reminders
  scroll and light up their nav pill; Sign in and Get started go to
  Sign in.
- **Sign in (login.html):** logo and Product go Home; a valid sign-in
  redirects to the Schedule.
- **Schedule (calendar.html):** Settings (top bar and salon tab) and the
  time zone link open Settings on the Salon tab; Edit salon hours opens
  it on the Hours tab; Sign out goes to Sign in; logo goes Home.
- **Settings (settings.html, #salon, #team, #services, #hours, #salons):**
  the hash picks the tab; Open and My appointments go to the Schedule.
- **Not built yet:** Customers, Messages, Pricing, Create an account,
  Forgot password, legal pages and the public booking page are marked
  `aria-disabled` and do nothing.
- **Copy positioning:** marketing copy speaks to small businesses. Sample
  data (Mona Salone, its designers and services) stays as the example
  business.

## Do's and Don'ts

- Do keep navy for the primary button and selected pill toggles only.
- Do set all text in ink, body or muted; never set text in navy or the
  surface colors.
- Do keep White as the page on every screen except sign-in.
- Do separate containers by tone; don't add borders or shadows to them.
- Do show errors with color, an icon and words together.
- Mona art ships as transparent PNGs (lines and grey shading only), so the
  body takes whatever surface she sits on: white, lavender or butter. Never
  recolor the lines.
- One or two Mona images per page, no more (the handled.nl rhythm). Put her
  where there is room to breathe: the hero, a closing band, the sign-in
  panel, empty states. Never inside dense tables or the calendar grid.
- Don't use em dashes in interface copy.
- Don't set numbers in the serif; stat values and times are Geist.
- Don't change legal, consent or SMS opt-in copy when restyling a page.
