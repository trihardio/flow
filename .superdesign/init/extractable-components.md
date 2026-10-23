<!-- made by a script from src/App.jsx (the whole app is that one file): line numbers are as of the day it was made -->
# Extractable components

## SideNav
- Source: `src/App.jsx` lines 3163–3250
- Category: layout
- Description: the menu behind the three lines, sliding in from the left
- Key props: the marked row (`at`)
- Hardcoded: the rows' icons and names, the crocodile's line at the foot

## FoldCard
- Source: `src/App.jsx` lines 6641–6712
- Category: basic
- Description: a card with a coloured title tag, a line at its right, and a fold arrow
- Key props: title, sub
- Hardcoded: the tag's tint per card name

## HeroTile
- Source: `.hero-tile` in the stylesheet (line 15835)
- Category: basic
- Description: a label in small capitals, a figure, a note, with a 2px colour bar at its left
- Key props: label, value, note, colour

## DayTile
- Source: `src/App.jsx` from line 12791
- Category: basic
- Description: a calendar day: its date, what was spent against the daily limit, the difference, a bar rising behind
- Key props: day, spent, limit, state (under, near, over, no-spend, empty, today)
