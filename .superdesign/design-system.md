# Flow: design system

## Product
Flow is a private macOS app (Electron, one window, usually 1440x900 or larger, dark only) for one person and a few people he knows: a PnL-calendar spending tracker in Indonesian rupiah (amounts written 800Rb, 1,2jt; ringgit optional) and a trading journal for crypto, Indonesian stocks and forex. Spending is read like a trading account: each day is judged against a daily limit, a day under it is green, a day over it red, and the month and year add up the same way.

Jobs: stay under the daily limit; see where the money goes and save toward goals; size a trade fast; journal trades.

Key screens: finance year (12 month boxes), finance month (hero card with the month figure, a calendar of day tiles, the open day panel, then cards: Weekly expenses, Money flow, Goals), and the same year and month for each trading side.

## Branding and styling

Dark only. iOS-style "liquid glass" on a dark graphite gradient with faint blue, teal and violet glows.

**Colour tokens (`:root`)**

```css
--c-ink-hi: #f2f3f4;
--c-ink: #e8eaec;
--c-ink-1: #d5dade;
--c-ink-2: #c7cdd2;
--c-ink-3: #9aa3ab;
--c-mute-hi: #959da5;
--c-mute: #8e969e;
--c-mute-2: #8a9299;
--c-line: #33373b;
--c-green: #3ddc97;
--c-green-soft: #8fd7a4;
--c-green-pale: #a5efcd;
--c-red: #ff5d6c;
--c-red-soft: #ff8d97;
--c-red-pale: #ffb3bb;
--c-red-dim: #e2808c;
--c-gold: #e3cd77;
--c-orange: #f5a742;
```

**Colour roles (binding):** green = gain / under the limit / progress; red = loss / over the limit / risk; gold (#e3cd77) = reached / achieved, and the test tools; blue-grey (#8fa3b8) = information; white = the main figure. Never use colour outside those roles.

**Surfaces:** page #1b1f24 to #14171b gradient; glass card: rgba(30,33,38,0.62) under a top-lit gradient, backdrop blur 16px, inset 1px light edge (brightest top-left), two-part drop shadow; wells (typing boxes): darker than the card, 10px radius; no borders on cards.

**Type:** Inter (everything by default, tabular figures); Press Start 2P pixel font for screen titles ("October", "2026"), the month's big PnL figure (64px, capitals) and the score in its dial; an extended heavy face (PP Monument Extended, else SF Pro Expanded via font-stretch 150%) for the year's big figure and the "Left" tile; Material Symbols Outlined for icons. Labels: 10–11.5px, 700, letter-spacing 0.1–0.16em, capitals, #8e969e–#9aa3ab.

**Radii:** cards 20–22px, hero 22px, day tiles 14–16px, controls 9–12px, capsules 99px. Trading sides (`.term`): square, 4–6px.

**Spacing:** content column about 1216px in a 1440px window, 112px side margins; cards 24px apart; tile gap 10–12px.

**Motion:** transforms and opacity only; a month's parts come in over 0.62s, 50–300ms apart; counts 0.56–0.66s; nothing bounces hard.


## Layout
One centred content column (about 1216px in a 1440px window). A round glass menu button fixed top-left; the sidebar is shut by default. Cards are glass panels without borders, 24px apart. Inside a card: no cards inside cards; sections are separated by a hairline and a small capital label.

## Motion
Transforms and opacity only. Parts of a screen come in one after the other (about 0.6s each, 50 to 300ms apart); figures count up; nothing loops.

## Requirements that no design may break
- **The pixel-art type stays exactly as it is** (the owner made these by hand and said so in capitals): the month and year titles, the month figure, the dials figures and the side titles are Press Start 2P at their present size and place, with hard pixel edges. Never smooth them, restyle them, resize them or set them in another face. Design around them.
- Dark only, desktop only (no phone layout).
- Only the fonts named above: Inter, Press Start 2P for titles and the month figure, the extended heavy face for the year figure. No other face.
- Colour only in its role: green gain, red loss, gold reached, blue-grey information, white the main figure. Category colours are never red, green or gold.
- Money is written as the app writes it: 800Rb, 1,2jt, with a comma as the decimal sign.
- A screen has one focal point; small labels are capitals in the caption grey.
