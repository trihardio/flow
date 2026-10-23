<!-- made by a script from src/App.jsx (the whole app is that one file): line numbers are as of the day it was made -->
# Theme

## Part 1: compact token summary

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

## Part 2: raw stylesheet (src/App.jsx lines 13588–16838)

```css

        html { background: #101215; }
        html, body { scroll-behavior: smooth; margin: 0; }
        /* graphite backdrop for the yearly + monthly panels. It is the page's own background, so it travels with
           everything else when you scroll: a lighter grey at the top that deepens on the way down, plus a few soft
           glows set along the page (in px, so they stay at the same spots however long the page is).
           It is painted once into the page's tiles and scrolling only moves them, so it costs nothing per frame.
           One picture (PAGE_BG), so a change of the page's height doesn't draw it again either.
           !important because index.html and the boot code give body a plain inline colour, which would cover it. */
        body {
          min-height: 100vh;
          background: ${PAGE_BG} no-repeat 0 0 / 100% ${PAGE_BG_H}px #0f1114 !important;
        }
        :root {
          --ease: cubic-bezier(0.22, 1, 0.36, 1);
          --ease-soft: cubic-bezier(0.32, 0.72, 0.24, 1);
          --glass: rgba(43, 44, 46, 0.55);
          --glass-hi: rgba(255, 255, 255, 0.10);
          --glass-line: rgba(255, 255, 255, 0.09);
          /* liquid glass (12 October 2026): the lit edge as a ring, as inset lines, and the two-part shadow */
          --lg-rim: linear-gradient(150deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 14%, rgba(255,255,255,0.035) 34%,
                                    rgba(255,255,255,0) 52%, rgba(255,255,255,0.03) 74%, rgba(255,255,255,0.15) 100%);
          --lg-edge: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(255,255,255,0.035);
          --lg-drop: 0 1px 2px rgba(0,0,0,0.20), 0 10px 24px -10px rgba(0,0,0,0.42), 0 36px 84px -24px rgba(0,0,0,0.62);
          /* colour tokens (13 October 2026): the stylesheet's most used colours, named by their job. Same values as
             before, so nothing looks different. Text from brightest to faintest, then the roles (see Style in CLAUDE.md).
             Only for CSS: an SVG attribute, a canvas and any script that reads a colour still need the plain value. */
          --c-ink-hi: #f2f3f4; --c-ink: #e8eaec; --c-ink-1: #d5dade; --c-ink-2: #c7cdd2; --c-ink-3: #9aa3ab;
          --c-mute-hi: #959da5; --c-mute: #8e969e; --c-mute-2: #8a9299; --c-line: #33373b;
          --c-green: #3ddc97; --c-green-soft: #8fd7a4; --c-green-pale: #a5efcd;
          --c-red: #ff5d6c; --c-red-soft: #ff8d97; --c-red-pale: #ffb3bb; --c-red-dim: #e2808c;
          --c-gold: #e3cd77; --c-orange: #f5a742;
        }

        /* everything cascades in when a month is opened from the year panel */
        /* Two speeds (6 October 2026, his rule): cinematic moves (changing years, opening Wrapped, entering the wallet)
           may take 500–900ms; utility ones were cut to 150–300ms for a few hours, which he found way too quick.
           A month comes in over about 0.9s again, as it did before */
        /* Each part of the month carries data-mv (FoldCard puts it on itself), and the rules name it. They said
           "> *" until 9 October 2026: with a rule that can match anything, taking "enter" off again 1.1s after the
           month opened made the engine work out the style of everything in the month afresh (1558 elements, 17ms in
           one go, on every month opened). Named, it looks at the parts and the tiles only. :where() keeps the rules
           exactly as strong as they were. A new part of the month needs data-mv to come in with the others. */
        .month-view.enter > :where([data-mv]) { animation: mvIn .62s var(--ease) backwards; }
        .month-view.enter > :where([data-mv]):nth-child(1) { animation-delay: .00s; }
        .month-view.enter > :where([data-mv]):nth-child(2) { animation-delay: .05s; }
        .month-view.enter > :where([data-mv]):nth-child(3) { animation-delay: .09s; }
        .month-view.enter > :where([data-mv]):nth-child(4) { animation-delay: .13s; }
        .month-view.enter > :where([data-mv]):nth-child(5) { animation-delay: .17s; }
        .month-view.enter > :where([data-mv]):nth-child(6) { animation-delay: .20s; }
        .month-view.enter > :where([data-mv]):nth-child(7) { animation-delay: .23s; }
        .month-view.enter > :where([data-mv]):nth-child(8) { animation-delay: .26s; }
        .month-view.enter > :where([data-mv]):nth-child(n+9) { animation-delay: .30s; }
        @keyframes mvIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* the day tiles ride in a touch later, one after another */
        .month-view.enter .cell { animation: tileIn .5s var(--ease) backwards; }

        .cal-wrap {
          position: relative; border-radius: 20px; padding: 14px;
          margin: 0 -14px; overflow: hidden;
          background:
            linear-gradient(168deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 34%, rgba(255,255,255,0.006) 100%);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
        }
        .cal-wrap::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
          background:
            linear-gradient(112deg, transparent 18%, rgba(255,255,255,0.055) 34%, rgba(255,255,255,0.012) 44%, transparent 58%),
            radial-gradient(70% 50% at 8% -12%, rgba(255,255,255,0.09), transparent 62%);
        }
        .cal-wrap > * { position: relative; z-index: 1; }

        /* ---------- liquid glass surfaces ---------- */
        /* Liquid glass (12 October 2026, see the LIQUID GLASS block at the end): a see-through fill lighter at the
           top, an edge lit from the top-left, a shadow in two parts. Until then: var(--glass) flat, a 0.10 top line,
           one shadow; glass-soft rgba(36,40,45,0.44) with a 0.07 top line */
        .glass {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.025) 38%, rgba(255,255,255,0.012) 100%), rgba(30,33,38,0.62);
          backdrop-filter: blur(16px) saturate(135%);
          -webkit-backdrop-filter: blur(16px) saturate(135%);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: var(--lg-edge), var(--lg-drop);
          transition: box-shadow .45s var(--ease), border-color .45s var(--ease), transform .45s var(--ease);
        }
        /* the sheen across the top, the specular light that makes it read as glass. A fixed height (it was the whole
           box), so a card that folds never draws it again. Both lights have died away before the box's lower edge:
           the second was a slanted streak (linear-gradient(105deg, …)) as strong at the bottom as at the top, so on
           a card taller than the box it stopped in a straight line across the Weekly expenses chart (he sent a picture) */
        .glass::before {
          content: ""; position: absolute; inset: 0 0 auto 0; height: min(100%, 280px); border-radius: inherit; pointer-events: none;
          z-index: 0;
          background: radial-gradient(90% 100% at 0% 0%, rgba(255,255,255,0.075), transparent 62%),
                      radial-gradient(16% 100% at 38% 0%, rgba(255,255,255,0.035), transparent);
        }
        .glass > *, .cell > *, .ycell > * { position: relative; z-index: 1; }
        .glass:hover { border-color: rgba(255,255,255,0.10); box-shadow: inset 0 1px 0 rgba(255,255,255,0.19), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -1px 0 rgba(255,255,255,0.04), var(--lg-drop); }


        .glass-soft {
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018)), rgba(30,33,38,0.36);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.09), 0 6px 16px -10px rgba(0,0,0,0.5);
        }

        ::selection { background: rgba(61,220,151,0.28); color: #f2f6fa; }
        /* The thin bars are for what scrolls inside the page (a pop-up, a long list). The window's own bar is the
           Mac's (12 October 2026): drawn by these rules it had a lane of its own, 11px of flat dark down the right
           edge beside the lighter backdrop, and that lane stayed lit while a pop-up dimmed the rest (a fixed cover
           can't reach it). The Mac's lies over the page and shows only while scrolling. Naming neither html nor body
           is what leaves the window to it. Dark for whoever has the bars always on (a mouse); body is handed back
           the usual scheme and text colour, so nothing inside the page changes. */
        :not(html):not(body)::-webkit-scrollbar { width: 11px; height: 11px; }
        :not(html):not(body)::-webkit-scrollbar-track { background: transparent; }
        :not(html):not(body)::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.10); border-radius: 99px;
          border: 3px solid transparent; background-clip: content-box;
        }
        :not(html):not(body)::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); background-clip: content-box; }
        html { color-scheme: dark; }
        body { color-scheme: normal; color: canvastext; }

        /* inputs glow instead of jumping */
        input {
          transition: border-color .28s var(--ease), box-shadow .28s var(--ease), background .28s ease;
        }
        input:focus {
          box-shadow: 0 0 0 3px rgba(255,255,255,0.10);
          border-color: rgba(255,255,255,0.55) !important;
          outline: none !important;
        }
        .desc-field:focus { box-shadow: 0 0 0 3px rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.55) !important; }
        .amt-field.red:focus { box-shadow: 0 0 0 3px rgba(255,93,108,0.16); border-color: rgba(255,93,108,0.6) !important; }

        /* buttons feel physical */
        button { transition: transform .22s var(--ease), background .22s ease, border-color .22s ease, color .22s ease; }
        button:active { transform: scale(0.965); }
        /* a button reached with the keyboard is ringed in the same white as a box in use (the engine's own ring is
           the system's accent colour). :where() keeps it as weak as it can be, so a button that says outline: none
           further down still has none */
        :where(button, a, [role="button"], [tabindex]):focus-visible { outline: 2px solid rgba(255,255,255,0.7); outline-offset: 2px; }
        * { -webkit-font-smoothing: antialiased; }

        .stage-bg {
          position: fixed; inset: 0; z-index: 139; pointer-events: none;
          background: radial-gradient(circle at 50% 42%, #262b31 0%, #191d21 45%, #0d0f11 100%);
          opacity: 1; transition: opacity .43s ease;
        }
        .stage-bg.out { opacity: 0; }

        /* ---------- trading panel (work in progress) ---------- */
        /* trading tracker: the long / short switch on a trade (the same rising arrow, turned over for a short), and the
           round coin badge in the coins card */
        .side-chip { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px 0 8px; margin-left: 6px; flex-shrink: 0;
                     background: none; border: 1px solid rgba(255,255,255,0.10); border-radius: 9px; color: var(--c-ink-3); cursor: pointer;
                     font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
                     transition: border-color .18s ease, color .18s ease; }
        .side-chip:hover { border-color: var(--c-mute-2); color: var(--c-ink); }
        .side-chip .msym { font-size: 16px; transition: transform .3s var(--ease); }
        .side-chip.short .msym { transform: scaleY(-1); }
        .side-chip.big { height: 38px; min-width: 88px; justify-content: center; margin-left: 0; border-radius: 11px; background: rgba(255,255,255,0.04); }
        /* the hidden copy of what is typed pushes the grey text to its end, so it has to be as wide as the typed text:
           every box has even-width digits (tabular-nums), and without them here the copy was narrower by 2–3px for
           every "1" typed: "10x" and "1000CATUSDT.P" ran into each other (he sent a picture) */
        .pair-ghost { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; font-size: 14px; pointer-events: none; white-space: pre;
                      font-variant-numeric: tabular-nums; }
        .pair-tail { position: absolute; top: 0; height: 100%; display: flex; align-items: center; color: var(--c-mute); font-size: 12.5px; pointer-events: none;
                     white-space: nowrap; font-variant-numeric: tabular-nums; animation: fadeIn .2s ease backwards; }
        .pair-ghost i { visibility: hidden; font-style: normal; }
        .pair-ghost b { font-weight: 400; color: var(--c-mute); }
        /* trading journal (crypto day panel): a trade as a page of properties. The icons are tinted, muted on purpose;
           of the text only the result, the position, the time frame, the full TP, the risk and the R carry a colour */
        .jr-sheet, .jr-item { --tone: var(--c-green-soft); --tone-bg: rgba(61,220,151,0.10); --tone-bd: rgba(61,220,151,0.34); }
        .jr-sheet.loss, .jr-item.loss { --tone: var(--c-red-dim); --tone-bg: rgba(255,93,108,0.10); --tone-bd: rgba(255,93,108,0.34); }
        .jr-sheet.be, .jr-item.be { --tone: #d6c88f; --tone-bg: rgba(227,205,119,0.09); --tone-bd: rgba(227,205,119,0.30); }
        .jr-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .jr-res { display: inline-flex; gap: 3px; padding: 3px; border-radius: 12px; background: rgba(24,27,31,0.55); border: 1px solid rgba(255,255,255,0.08); }
        .jr-res-b { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 13px 0 10px; border-radius: 9px; border: 1px solid transparent;
                    background: none; color: var(--c-mute-2); font-size: 13px; font-weight: 600; cursor: pointer;
                    transition: color .18s ease, background .18s ease, border-color .18s ease; }
        .jr-res-b .msym { font-size: 17px; }
        .jr-res-b:hover { color: var(--c-ink); }
        .jr-res-b.on { color: var(--tone); background: var(--tone-bg); border-color: var(--tone-bd); }
        .jr-pnl { display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; width: 190px; height: 40px; padding: 0 13px; border-radius: 11px; cursor: text;
                  background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); color: var(--tone); font-size: 16px; font-weight: 700;
                  transition: border-color .25s ease, box-shadow .25s ease, opacity .25s ease; }
        .jr-pnl:focus-within { border-color: var(--tone-bd); box-shadow: 0 0 0 3px var(--tone-bg); }
        .jr-pnl input { flex: 1; min-width: 0; padding: 0; background: none; border: none; outline: none; color: inherit; font: inherit; font-variant-numeric: tabular-nums; }
        .jr-pnl input::placeholder, .jr-in::placeholder { color: #5b636b; }
        .jr-cols { display: flex; flex-wrap: wrap; column-gap: 28px; }
        .jr-col { flex: 1 1 300px; min-width: 0; }
        .jr-row { display: flex; align-items: center; gap: 8px; min-height: 40px; }
        .jr-row.top { align-items: flex-start; margin-top: 3px; }
        .jr-k { display: inline-flex; align-items: center; gap: 9px; width: 122px; height: 34px; flex-shrink: 0; color: var(--c-ink-3); font-size: 13.5px; }
        .jr-k .msym { font-size: 18px; transition: transform .3s var(--ease); }
        .jr-row.flip .jr-k .msym { transform: scaleY(-1); }
        .jr-v { flex: 1; min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
        .jr-v > span { flex: 1; }
        .jr-in { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 9px; border: 1px solid transparent; outline: none;
                 background: rgba(255,255,255,0.035); color: var(--c-ink); font-family: inherit; font-size: 14px;
                 transition: background .2s ease, border-color .2s ease; }
        .jr-in:hover { background: rgba(255,255,255,0.06); }
        .jr-in:focus { background: rgba(24,27,31,0.62); border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 3px rgba(255,255,255,0.10); }
        textarea.jr-in { display: block; min-height: 104px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
        /* a figure the form works out itself (the stocks buy and sell value): in a row like the boxes, without a box */
        .jr-calc { padding: 7px 10px; font-size: 14px; color: var(--c-ink-2); font-variant-numeric: tabular-nums; }
        /* what a worked-out figure will be made of, while there is none: words to be read, not a placeholder (they stood at 2.6 to 1) */
        .jr-calc i { font-style: normal; color: var(--c-mute); }
        .jr-chip { height: 28px; padding: 0 9px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.09); background: none; color: var(--c-mute-2);
                   font-size: 12px; font-weight: 600; cursor: pointer; transition: color .18s ease, background .18s ease, border-color .18s ease; }
        .jr-chip:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.22); }
        .jr-chip.on, .jr-tag { color: #a9c6ea; background: rgba(120,165,225,0.12); border-color: rgba(120,165,225,0.36); }
        .jr-chip.long.on, .jr-tag.long { color: var(--c-green-soft); background: rgba(61,220,151,0.10); border-color: rgba(61,220,151,0.34); }
        .jr-chip.short.on, .jr-tag.short { color: var(--c-red-dim); background: rgba(255,93,108,0.10); border-color: rgba(255,93,108,0.34); }
        /* each time frame in its own muted colour (--tf): faint while it is not the one chosen. The last box is typed in */
        .jr-chip.tf { color: color-mix(in srgb, var(--tf) 55%, var(--c-mute-2)); }
        .jr-chip.tf:hover { color: var(--tf); border-color: color-mix(in srgb, var(--tf) 40%, transparent); }
        .jr-chip.tf.on, .jr-tag.tf { color: var(--tf); background: color-mix(in srgb, var(--tf) 13%, transparent); border-color: color-mix(in srgb, var(--tf) 38%, transparent); }
        .jr-chip.own { width: 58px; box-sizing: border-box; padding: 0 4px; text-align: center; outline: none; cursor: text; font-family: inherit; }
        .jr-chip.own::placeholder { color: var(--c-mute); font-weight: 500; }
        .jr-chip.own:focus { border-color: rgba(255,255,255,0.55); }
        /* the form's choices: one quiet field per line, like the boxes that are typed in, with the choices as words in it and
           only the chosen one in a box of its colour. Each used to be a box with a border of its own (4 styles, 13 sectors,
           9 time frames), which he called button vomit */
        .jr-pick { display: flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 10px; background: rgba(255,255,255,0.035); }
        .jr-pick .jr-chip { padding: 0 10px; border-radius: 7px; border-color: transparent; }
        .jr-pick .jr-chip:hover { background: rgba(255,255,255,0.06); border-color: transparent; }
        .jr-pick .jr-chip.on { border-color: transparent; }
        .jr-pick .jr-chip.own:focus { border-color: rgba(255,255,255,0.55); background: rgba(24,27,31,0.62); }
        .jr-foot { display: flex; justify-content: flex-end; margin-top: 12px; }
        .jr-add { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px 0 11px; border-radius: 11px; cursor: pointer;
                  border: 1px solid var(--tone-bd); background: var(--tone-bg); color: var(--tone); font-size: 13.5px; font-weight: 700;
                  transition: box-shadow .2s ease, transform .18s ease, color .18s ease, background .18s ease, border-color .18s ease; }
        .jr-add .msym { font-size: 19px; }
        .jr-add:hover { box-shadow: 0 0 0 3px var(--tone-bg); }
        .jr-add:active { transform: scale(0.97); }
        .jr-item { border-radius: 12px; transition: border-color .2s ease; }
        .jr-item:hover, .jr-item.open { border-color: var(--tone-bd) !important; }
        .jr-sum { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 6px 7px 6px 9px; cursor: pointer; }
        .jr-badge { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px 0 7px; border-radius: 8px; flex-shrink: 0;
                    color: var(--tone); background: var(--tone-bg); font-size: 11.5px; font-weight: 700; }
        .jr-badge .msym { font-size: 15px; }
        .jr-name { flex-shrink: 0; color: var(--c-ink); font-size: 14px; font-weight: 700; }
        .jr-name i { margin-left: 4px; color: var(--c-mute); font-size: 12px; font-style: normal; font-weight: 400; }
        .jr-tag { display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 7px; flex-shrink: 0; font-size: 11px; font-weight: 700; }
        .jr-meta { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre; color: var(--c-mute-2); font-size: 12.5px; }
        .jr-amt { flex-shrink: 0; color: var(--tone); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .jr-chev { flex-shrink: 0; color: var(--c-mute); font-size: 20px; transition: transform .3s var(--ease); }
        .jr-item.open .jr-chev { transform: rotate(180deg); }
        .jr-fold { display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows .3s cubic-bezier(0.4,0,0.2,1), visibility 0s .3s; }
        .jr-item.open .jr-fold { grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows .3s cubic-bezier(0.4,0,0.2,1); }
        .jr-sheet.in-list { padding: 12px; border-top: 1px solid rgba(255,255,255,0.07); }
        /* pictures on a trade: small tiles in its sheet (a press opens one large), and how many on its line */
        .jr-pics { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; color: var(--c-mute); font-size: 12px; }
        .jr-pics .msym { font-size: 15px; }
        .jr-shots { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 8px; padding: 3px 0; }
        /* the setup's pictures: a button at the end of its box, the pictures under the box */
        .jr-pre { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .jr-pre-line { display: flex; align-items: center; gap: 6px; }
        .jr-pre-line .jr-in { flex: 1; min-width: 0; width: auto; }
        .jr-pre .jr-shots { flex: none; padding: 7px 0 3px; }
        .jr-pre-add { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; cursor: pointer;
                      color: var(--c-mute); border: 1px dashed rgba(255,255,255,0.16); transition: color .2s ease, border-color .2s ease, background .2s ease, opacity .2s ease; }
        .jr-pre-add:hover { color: var(--c-ink); border-color: rgba(200,210,220,0.42); background: rgba(255,255,255,0.05); }
        .jr-pre-add .msym { font-size: 18px; }
        .jr-pre-add.busy { opacity: 0.45; pointer-events: none; }
        .jr-shot { position: relative; width: 104px; height: 66px; border-radius: 9px; overflow: hidden; flex-shrink: 0; cursor: zoom-in;
                   background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.10); transition: border-color .2s ease, transform .2s var(--ease); }
        .jr-shot:hover { border-color: rgba(200,210,220,0.42); transform: translateY(-1px); }
        .jr-shot img, .jr-shot canvas { display: block; width: 100%; height: 100%; object-fit: cover; }
        .jr-shot-x { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; padding: 0; border: none; border-radius: 6px; cursor: pointer;
                     background: rgba(14,16,18,0.74); color: #c9cfd4; font-size: 13px; line-height: 18px; opacity: 0; transition: opacity .18s ease, color .18s ease; }
        .jr-shot:hover .jr-shot-x { opacity: 1; }
        .jr-shot-x:hover { color: var(--c-red-soft); }
        .jr-shot.add { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-style: dashed; color: var(--c-mute); transition: color .2s ease, border-color .2s ease, opacity .2s ease; }
        .jr-shot.add:hover { color: var(--c-ink); transform: none; }
        .jr-shot.add .msym { font-size: 22px; }
        .jr-shot.add.busy { opacity: 0.45; pointer-events: none; }
        .shot-view { position: fixed; inset: 0; z-index: 290; display: flex; align-items: center; justify-content: center; background: rgba(8,10,12,0.86);
                     cursor: zoom-out; animation: fadeIn .18s ease backwards; transition: opacity .17s ease; }
        .shot-view.out { opacity: 0; }
        .shot-view img, .shot-view canvas { display: block; max-width: 92vw; max-height: 88vh; border-radius: 12px; box-shadow: 0 30px 80px rgba(0,0,0,0.6);
                                             animation: shotIn .24s cubic-bezier(0.22,1,0.36,1) backwards; }
        .shot-view canvas { width: min(92vw, 960px); height: auto; }
        @keyframes shotIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
        /* deposits: one line under the day's trades, in the journal's neutral blue (green and red are for PnL) */
        .jr-dep { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07);
                  --tone: #a9c6ea; --tone-bg: rgba(120,165,225,0.10); --tone-bd: rgba(120,165,225,0.34); }
        .jr-pnl.dep { width: 150px; height: 32px; padding: 0 11px; border-radius: 9px; font-size: 14px; }
        .jr-v > .jr-dep-chip, .jr-v > .jr-dep-no { flex: none; }
        .jr-dep-no { color: var(--c-red-dim); font-size: 12.5px; animation: fadeIn .2s ease backwards; }
        .jr-dep-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 5px 0 10px; border-radius: 8px; color: var(--c-ink-3); font-size: 12.5px;
                       background: rgba(120,165,225,0.07); border: 1px solid rgba(120,165,225,0.22); animation: fadeDown .25s ease backwards; }
        .jr-dep-chip b { color: #a9c6ea; font-weight: 700; font-variant-numeric: tabular-nums; }
        .jr-dep-x { padding: 0 3px; background: none; border: none; color: var(--c-mute); font-size: 16px; line-height: 1; cursor: pointer; transition: color .18s ease; }
        .tok { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
               font-size: 11px; font-weight: 800; color: #14171a; }
        /* trading side: the PnL analysis card (time-frame tabs, the balance box, three line charts) */
        .an-bar { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; margin-top: 4px; }
        .an-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-left: -4px; }
        .an-tab { background: none; border: none; height: 32px; padding: 0 13px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 700;
                  color: var(--c-mute); cursor: pointer; white-space: nowrap; transition: color .2s ease, background .2s ease; }
        .an-tab:hover { color: var(--c-ink); }
        .an-tab.on { color: var(--c-orange); background: rgba(245,167,66,0.13); }
        /* the balance: one pill. At rest a figure with a pencil, pressed it is typed over; dashed while there is none */
        .an-bal { margin-left: auto; display: inline-flex; align-items: center; gap: 10px; box-sizing: border-box; height: 36px; padding: 0 7px 0 13px; border-radius: 11px;
                  background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); color: var(--c-mute-2); font-family: inherit; cursor: pointer;
                  transition: border-color .2s ease, box-shadow .2s ease; }
        .an-bal:hover { border-color: rgba(255,255,255,0.24); }
        .an-bal > span:first-child { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
        .an-bal b { color: #f2f5f8; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .an-bal i { margin-right: 3px; color: var(--c-mute-2); font-style: normal; font-size: 13px; font-weight: 600; }
        .an-bal .msym { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; font-size: 15px; color: var(--c-mute);
                        transition: color .2s ease, background .2s ease; }
        .an-bal:hover .msym { color: var(--c-ink); background: rgba(255,255,255,0.07); }
        .an-bal.none { border-style: dashed; border-color: rgba(245,167,66,0.42); color: #c99a55; }
        .an-bal.none b { color: var(--c-orange); font-size: 13px; font-weight: 600; }
        .an-bal.edit { padding-right: 13px; gap: 8px; cursor: text; border-color: var(--c-orange); box-shadow: 0 0 0 2px rgba(245,167,66,0.14); }
        .an-bal.edit i { margin-right: -4px; }
        .an-bal input { width: 118px; padding: 0; background: none; border: none; outline: none; color: #f2f5f8; font-family: inherit; font-size: 15px; font-weight: 700; }
        .an-bal input::placeholder { color: var(--c-mute); font-weight: 500; }
        .an-dates { display: flex; align-items: center; gap: 9px; margin-top: 10px; font-size: 12px; color: var(--c-mute); animation: fadeDown .22s ease backwards; }
        .an-date { color-scheme: dark; height: 32px; box-sizing: border-box; padding: 0 9px; border-radius: 10px; background: rgba(24,27,31,0.62);
                   border: 1px solid rgba(255,255,255,0.10); color: var(--c-ink); font: inherit; font-size: 13px; font-variant-numeric: tabular-nums;
                   outline: none; transition: border-color .25s ease, box-shadow .25s ease; }
        .an-date:focus { border-color: var(--c-orange) !important; box-shadow: 0 0 0 2px rgba(245,167,66,0.14); }
        .an-asof { margin: 9px 2px 0; font-size: 11.5px; color: var(--c-mute); font-variant-numeric: tabular-nums; }
        .an-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; gap: 20px 22px; margin-top: 16px; padding-bottom: 10px; }
        .an-grid > div { min-width: 0; }
        .an-wide { grid-column: 1 / -1; }
        .an-title { font-size: 15px; font-weight: 700; color: var(--c-ink); }
        .an-title span { font-weight: 400; color: var(--c-ink-3); }
        .an-val { min-height: 30px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px 16px; margin: 3px 0 9px; font-size: 20px; font-weight: 700;
                  font-variant-numeric: tabular-nums; }
        /* max drawdown, at the right end of the cumulative PnL's own line of figures */
        .an-dd { margin-left: auto; display: inline-flex; align-items: baseline; gap: 7px; font-size: 12.5px; font-weight: 500; color: var(--c-ink-3); white-space: nowrap; }
        .an-dd b { font-size: 16px; font-weight: 700; color: var(--c-red-soft); }
        .an-dd i { font-style: normal; font-size: 12px; color: var(--c-mute); }
        .an-key { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: var(--c-ink-2); white-space: nowrap; }
        .an-key i { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .an-key b { font-size: 16px; font-weight: 700; margin-left: 2px; }
        .an-box { border-radius: 14px; padding: 12px 12px 2px; }
        .an-plot { position: relative; }
        .an-plot svg { position: absolute; left: 0; top: 0; display: block; overflow: visible; }
        .an-line { stroke-dasharray: 1; animation: drawLine 1.05s var(--ease-soft) .1s backwards; }
        .an-note { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 13px; font-weight: 600; color: var(--c-mute); pointer-events: none;
                   animation: axisIn .35s ease backwards; }
        .an-ask { pointer-events: auto; background: rgba(245,167,66,0.10); border: 1px solid rgba(245,167,66,0.30); color: var(--c-orange); height: 32px; padding: 0 14px;
                  border-radius: 10px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
        .an-ask:hover { background: rgba(245,167,66,0.18); border-color: rgba(245,167,66,0.5); }
        /* trading side: the win / loss ring above the list of coins */
        .ring-wrap { padding: 4px 0 16px; margin-bottom: 8px; border-bottom: 1px solid var(--c-line); }
        .ring-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .ring-body { display: flex; align-items: flex-start; gap: 18px 44px; flex-wrap: wrap; margin-top: 14px; }
        .ring-fig { position: relative; width: 200px; height: 200px; flex-shrink: 0; }
        .ring-seg { cursor: pointer; transition: opacity .18s ease; animation: scoreDraw .75s cubic-bezier(0.3,0,0.2,1) backwards; }
        .ring-mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; pointer-events: none;
                    text-align: center; animation: axisIn .22s ease backwards; }
        .ring-mid span { font-size: 12px; color: var(--c-ink-3); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ring-mid b { font-size: 20px; font-weight: 800; color: #f2f5f8; font-variant-numeric: tabular-nums; }
        .ring-list { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 2px; padding-top: 6px; }
        .ring-row { display: grid; grid-template-columns: 9px minmax(0, 1fr) auto 66px; align-items: center; gap: 12px; padding: 6px 10px; margin: 0 -10px;
                    border-radius: 10px; transition: background .18s ease; }
        .ring-row.on { background: rgba(255,255,255,0.055); }
        .ring-row i { width: 9px; height: 9px; border-radius: 50%; }
        .ring-name { font-size: 14px; font-weight: 600; color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ring-name small { margin-left: 9px; font-size: 11.5px; font-weight: 500; color: var(--c-mute); }
        .ring-amt { font-size: 13.5px; font-weight: 700; color: var(--c-ink); font-variant-numeric: tabular-nums; }
        .ring-pct { font-size: 13px; color: var(--c-ink-3); text-align: right; font-variant-numeric: tabular-nums; }
        /* crypto tracker: the position calculator. Its button is the year arrows' twin and sits right above them on
           the yearly panel, in the corner on the monthly one (lifted over the footer logo where the window is narrow) */
        .calc-fab.glass {
          position: fixed; right: 26px; bottom: 26px; z-index: 30; width: 47px; height: 46px; padding: 0; border-radius: 16px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #cbd3db;
          background: rgba(255,255,255,0.055) !important; border: 1px solid rgba(255,255,255,0.16) !important;
          backdrop-filter: blur(22px) saturate(170%); -webkit-backdrop-filter: blur(22px) saturate(170%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.22) !important;
          transition: color .18s ease, transform .22s var(--ease-soft);
        }
        .calc-fab.glass.above { bottom: 112px; }
        .calc-fab.glass:hover { color: #ffffff; transform: translateY(-2px); }
        .calc-fab.glass:active { transform: scale(0.94); }
        .calc-fab .msym { font-size: 23px; }
        @media (max-width: 1420px) { .calc-fab.glass:not(.above) { bottom: 88px; } }
        .pc-modal { width: min(1080px, 95vw) !important; padding: 18px 22px 22px !important; }
        .glass > .pc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; z-index: 3; }
        .pc-cur2 { animation: fadeRight .3s ease backwards; }
        .pc-tools { margin-left: auto; display: flex; align-items: center; gap: 8px; position: relative; padding-left: 40px; }
        .pc-gear { display: inline-flex; align-items: center; justify-content: center; opacity: 0;
                   transition: opacity .2s ease, color .18s ease, border-color .18s ease, background .18s ease, transform .22s var(--ease); }
        /* the ✕ on every pop-up and panel, the calculators' gear, and the × on an income chip: they light up under the pointer */
        .x-btn:hover, .pc-gear:hover { color: var(--c-ink) !important; border-color: rgba(255,255,255,0.24) !important; background: rgba(255,255,255,0.10) !important; }
        .chip-x:hover { color: var(--c-red-soft) !important; }
        .pc-gear .msym { font-size: 16px; }
        .pc-tools:hover .pc-gear, .pc-gear:focus-visible, .pc-gear.on { opacity: 1; }
        .pc-pop { position: absolute; right: 0; top: calc(100% + 10px); z-index: 6; width: 286px; border-radius: 14px; padding: 13px 14px 12px;
                  background: #25292e; border: 1px solid rgba(255,255,255,0.13); box-shadow: 0 16px 36px rgba(0,0,0,0.5);
                  animation: fadeDown .18s ease backwards; }
        .pc-pop-row { display: grid; grid-template-columns: auto minmax(0, 1fr) 34px; align-items: center; gap: 9px; margin-top: 9px; font-size: 13px; color: var(--c-ink-3); }
        .pc-note { font-size: 11.5px; color: var(--c-mute); margin-top: 10px; line-height: 1.45; }
        .pc-body { display: grid; grid-template-columns: 322px minmax(0, 1fr); gap: 26px; align-items: start; }
        .pc-form { display: flex; flex-direction: column; gap: 9px; }
        .pc-line { display: grid; grid-template-columns: 66px minmax(0, 1fr); align-items: center; gap: 10px; }
        .pc-line.two { grid-template-columns: 66px minmax(0, 1fr) auto minmax(0, 1fr); }
        .pc-line.tp { grid-template-columns: 66px minmax(0, 1fr) 84px; position: relative; }
        .pc-line > label, .pc-lab { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-mute-2); white-space: nowrap; }
        .pc-in { width: 100%; min-width: 0; background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; color: var(--c-ink);
                 padding: 9px 12px; font-size: 14px; font-variant-numeric: tabular-nums; outline: none; transition: border-color .2s ease, box-shadow .2s ease; }
        .pc-in:focus { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 3px rgba(255,255,255,0.10); }
        .pc-in.bad { border-color: rgba(255,93,108,0.6); }
        .pc-in::placeholder { color: #50575e; }
        .pc-in.auto::placeholder { color: var(--c-mute-hi); }           /* a figure worked out for him, not a hint: it has to be read */
        /* the coin: always capitals, with /USDT.P written after it in grey */
        .pc-coin { position: relative; display: block; }
        .pc-coin .pc-in, .pc-ghost { font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
        .pc-ghost { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; padding: 0 13px; font-size: 14px; pointer-events: none; white-space: pre; }
        .pc-ghost i { visibility: hidden; font-style: normal; }
        .pc-ghost b { font-weight: 500; color: var(--c-mute); text-transform: none; }
        /* the latest price of what is typed, at the right end of its box: a press writes it into the entry */
        .pc-live { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); height: 26px; padding: 0 8px; border: none; border-radius: 7px;
                   display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.055); color: var(--c-ink-2); cursor: pointer;
                   font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap;
                   transition: background .15s ease, color .15s ease; animation: fadeIn .2s ease backwards; }
        .pc-live:hover { background: rgba(255,255,255,0.12); color: #ffffff; }
        .pc-live i { width: 6px; height: 6px; border-radius: 50%; background: var(--c-green); flex-shrink: 0; }
        .pc-live em { font-style: normal; font-size: 11.5px; color: var(--c-mute-2); }
        .pc-live em.up { color: #5ee3a9; }
        .pc-live em.dn { color: var(--c-red-soft); }
        .pc-live.old { color: var(--c-mute-2); }
        .pc-live.old i { background: #6d757d; }
        .pc-live.old em { color: var(--c-mute); }
        /* stock calculator: the lots, and what they come to in rupiah beside them */
        .pc-line.lots { grid-template-columns: 66px minmax(0, 0.62fr) minmax(0, 1fr); }
        .pc-conv { font-size: 14px; color: var(--c-mute); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-conv b { font-weight: 700; color: var(--c-ink); margin-left: 3px; }
        .pc-conv.off b { color: #50575e; font-weight: 600; }
        .pc-cap { margin: 2px 0 1px; color: var(--c-mute); letter-spacing: 0.08em; }
        .pc-held { font-size: 12.5px; color: var(--c-mute-2); font-variant-numeric: tabular-nums; }
        .pc-unit { position: relative; display: block; transition: opacity .2s ease; }
        .pc-unit .pc-in { padding-right: 26px; }
        .pc-unit.wide .pc-in:placeholder-shown { padding-right: 46px; }     /* room for "auto" at the end of the empty IM box */
        .pc-unit > span { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); color: var(--c-mute); font-size: 12.5px; pointer-events: none; }
        .pc-rest { font-size: 13px; color: var(--c-mute-2); text-align: right; padding-right: 11px; font-variant-numeric: tabular-nums; }
        .pc-unit.off { opacity: 0.38; }                        /* this target stands in for the full TP: its % is not used */
        /* long / short: pressed is locked by hand; the faint one is what the levels say */
        .pc-side { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pc-side-b { height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.10); background: rgba(24,27,31,0.62); color: var(--c-mute); cursor: pointer;
                     font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
                     display: inline-flex; align-items: center; justify-content: center; gap: 7px;
                     transition: color .18s ease, border-color .18s ease, background .18s ease; }
        .pc-side-b:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.24); }
        .pc-side-b i { font-style: normal; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; opacity: 0.9; animation: pcFade .2s ease backwards; }
        @keyframes pcFade { from { opacity: 0; } }
        .pc-side-b.long.auto { color: var(--c-green-soft); border-color: rgba(143,215,164,0.22); }
        .pc-side-b.short.auto { color: var(--c-red-dim); border-color: rgba(226,128,140,0.22); }
        .pc-side-b.long.on { color: var(--c-green-pale); border-color: rgba(61,220,151,0.55); background: rgba(61,220,151,0.12); }
        .pc-side-b.short.on { color: var(--c-red-pale); border-color: rgba(255,93,108,0.55); background: rgba(255,93,108,0.12); }
        .pc-rule { height: 1px; background: rgba(255,255,255,0.07); margin: 5px 0; }
        .pc-x { position: absolute; right: -20px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--c-mute); cursor: pointer;
                font-size: 17px; line-height: 1; padding: 2px; transition: color .15s ease; }
        .pc-x:hover { color: var(--c-red-soft); }
        .pc-add { align-self: flex-start; margin-left: 76px; background: none; border: 1px dashed rgba(255,255,255,0.17); color: var(--c-mute-2); border-radius: 9px;
                  padding: 5px 11px; font-size: 12px; cursor: pointer; transition: color .15s ease, border-color .15s ease; }
        .pc-add:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.34); }
        .pc-go-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
        .pc-clear { background: none; border: none; color: var(--c-mute); font-size: 12px; cursor: pointer; padding: 6px 2px; transition: color .15s ease; }
        .pc-clear:hover { color: var(--c-ink); }
        .pc-clear.test { color: #b9a862; }
        .pc-clear.test:hover { color: var(--c-gold); }
        /* undo / redo in both calculators: small, but in a box of their own so they are seen; greyed out with nothing to go back or forward to */
        .pc-undo { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: rgba(255,255,255,0.055); }
        .pc-undo button { width: 27px; height: 24px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: 7px;
                          background: none; color: #b4bbc2; cursor: pointer; transition: background .16s ease, color .16s ease, opacity .2s ease; }
        .pc-undo button .msym { font-size: 17px; }
        .pc-undo button:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .pc-undo button.off { opacity: 0.3; pointer-events: none; }
        /* the enter button: grey, blue under the pointer */
        .pc-go { width: 58px; height: 40px; border-radius: 11px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.08); color: var(--c-ink-3);
                 cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
                 transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s var(--ease-soft); }
        .pc-go:hover, .pc-go:focus-visible { background: #3f8ae0; border-color: #7fb6e0; color: #ffffff; outline: none; }
        .pc-go:active { transform: scale(0.95); }
        .pc-go .msym { font-size: 21px; }
        .pc-empty { animation: pcFade .25s ease backwards; min-height: 470px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center;
                    color: var(--c-mute); font-size: 13px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 16px; }
        .pc-empty .msym { font-size: 30px; color: #454b51; }
        /* levels that can't be right: what is wrong, one line each; a line takes you to its box */
        .pc-err { min-height: 470px; border: 1px solid rgba(255,93,108,0.22); background: rgba(255,93,108,0.045); border-radius: 16px; padding: 20px 22px;
                  animation: pcFade .2s ease backwards; }
        .pc-err-h { display: flex; align-items: center; gap: 9px; font-size: 19px; font-weight: 800; color: var(--c-red-soft); }
        .pc-err-h .msym { font-size: 23px; }
        .pc-err-sub { font-size: 12.5px; color: var(--c-mute-2); margin: 6px 0 14px; line-height: 1.5; }
        .pc-err-row { display: flex; align-items: baseline; gap: 11px; width: 100%; text-align: left; background: none; border: none; cursor: pointer;
                      border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 2px; color: var(--c-ink); font-size: 13.5px; line-height: 1.45;
                      transition: color .15s ease; }
        .pc-err-row:hover { color: var(--c-red-pale); }
        .pc-err-row span { flex-shrink: 0; width: 19px; height: 19px; border-radius: 50%; background: rgba(255,93,108,0.16); color: var(--c-red-soft);
                           font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
        .pc-why { font-size: 12.5px; color: var(--c-red-soft); margin-bottom: 10px; }
        /* stock calculator: quiet notes under the tiles, and the average-down tables' own columns */
        .pc-hint { font-size: 12px; color: #b9a862; line-height: 1.45; margin-top: 7px; }
        .pc-row.av { grid-template-columns: 0.8fr 1fr 0.7fr 1.5fr 1.2fr; }
        .pc-row.av3 { grid-template-columns: 1.7fr 1fr 1.2fr; }
        .pc-line.tp.buy .pc-unit .pc-in { padding-right: 34px; }
        .pc-res { min-height: 470px; }
        /* the lines come in one after another from the top (PC_LINE_CSS gives each its turn); transform and opacity
           only. Dimming for results that are waiting on a half-typed level is eased too. */
        .pc-res > * { animation: pcLine .2s var(--ease) backwards; transition: opacity .18s ease; }
        .pc-err > * { animation: pcLine .2s var(--ease) backwards; }
        ${PC_LINE_CSS}
        @keyframes pcLine { from { opacity: 0; transform: translateY(-8px); } }
        .pc-res.stale > :not(.pc-why) { opacity: 0.38; }
        /* a target or a buy added with the + button comes in the same way */
        .pc-line.more { animation: pcLine .2s var(--ease) backwards; }
        /* while the pop-up eases to a new height (useEaseHeight) the body is clipped; this leaves room for the glow
           round the box being typed in */
        .pc-body { overflow-clip-margin: 5px; }
        .pc-res-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .pc-sym { font-size: 17px; font-weight: 800; letter-spacing: 0.02em; }
        .pc-sym span { color: var(--c-mute); font-weight: 600; }
        .pc-dir { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; border: 1px solid; }
        .pc-dir.long { color: var(--c-green-soft); border-color: rgba(143,215,164,0.32); background: rgba(61,220,151,0.07); }
        .pc-dir.short { color: var(--c-red-dim); border-color: rgba(226,128,140,0.32); background: rgba(255,93,108,0.07); }
        .pc-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-bottom: 4px; }
        .pc-tile { border-radius: 13px; padding: 10px 13px 11px; min-width: 0; }
        .pc-tile-l { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-mute); }
        .pc-tile-v { font-size: 19px; font-weight: 800; margin-top: 4px; color: var(--c-ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-tile-v span { font-size: 12px; font-weight: 600; color: var(--c-mute-2); }
        .pc-tile.key .pc-tile-v { color: #ffffff; }
        .pc-title { font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-ink-3); margin: 16px 0 3px; }
        .pc-title span { color: var(--c-mute); letter-spacing: 0.04em; font-weight: 600; }
        .pc-row { display: grid; grid-template-columns: 1.15fr 0.8fr 0.8fr 2fr; align-items: baseline; gap: 8px; padding: 7px 2px;
                  border-bottom: 1px solid rgba(255,255,255,0.055); font-size: 13.5px; color: var(--c-ink-2); font-variant-numeric: tabular-nums; }
        .pc-row.rr { grid-template-columns: 1.15fr 2fr 0.8fr 0.8fr; }
        .pc-row > :nth-child(n+2) { text-align: right; }
        .pc-row.h { font-size: 10px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; color: var(--c-mute); padding: 4px 2px 6px; }
        .pc-row.t { border-bottom: none; font-weight: 700; color: var(--c-ink); }
        .pc-row .k { font-weight: 700; color: var(--c-ink); white-space: nowrap; }
        .pc-row .k i { font-style: normal; font-weight: 500; color: var(--c-mute-2); }
        .pc-pos { color: #5ee3a9; font-weight: 700; }
        .pc-neg { color: var(--c-red-soft); font-weight: 700; }
        .pc-2nd { color: var(--c-mute-hi); font-weight: 500; }
        .pc-rr { font-weight: 800; color: var(--c-ink); }

        /* ---------- greeting (card -> year) ---------- */
        .greet-veil {
          position: fixed; inset: 0; z-index: 160;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 1;
          transition: opacity .22s ease;
          pointer-events: none;
        }
        .greet-veil.out { opacity: 0; }
        .greet-title {
          font-size: clamp(34px, 5vw, 62px); font-weight: 700; letter-spacing: -0.02em; color: #94a2af;
          animation: greetRise .55s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes greetRise {
          from { opacity: 0; transform: translateY(34px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .greet-name {
          font-family: 'Ballet', cursive; font-weight: 400; color: #f4f7fa;
          font-size: clamp(86px, 12vw, 176px); line-height: 0.95; margin-top: -2px;
          animation: greetRise .6s cubic-bezier(0.22,1,0.36,1) .16s both;
        }

        /* ---------- year opening animation ---------- */
        .year-big-anim { animation: yearRise .65s cubic-bezier(0.22,1,0.36,1) both; display: inline-flex; align-items: flex-start; }
        /* header year: the pixel font of the FLOW wordmark (40px, so one font pixel = 5px; 48px until 13 October 2026), no shadow */
        .year-big .yb-cell { position: relative; display: inline-block; width: 1em; height: 1em; }
        .year-big .yb-px { display: block; height: 1em; }
        .year-big .yb-px, .year-big .yb-px span { font-family: 'Press Start 2P', 'Inter', sans-serif; -webkit-font-smoothing: none; }
        /* the same digit in the normal font, sized and placed so it sits exactly over the pixel digit (same height,
           same centre). Only in the page around the wallet → year intro. */
        .year-big .yb-n { position: absolute; left: 0; top: -0.1466em; width: 0.7241em; text-align: center; opacity: 0; pointer-events: none;
                          font-size: 1.2083em; font-weight: 800; line-height: 1.02; letter-spacing: 0; }   /* (in the year's own size: they were 58px, -8.5px and 42px, written for a 48px year) */
        /* a small sign that the year can be pressed (it opens the wrapped, and nothing said so): the wrapped's own
           sparkle at the year's top right, grey at rest and the wrapped's gold under the pointer */
        .year-big .yb-wr { margin-left: 9px; font-size: 18px; line-height: 1; color: var(--c-mute); transition: color .18s ease; }
        .year-big:hover .yb-wr { color: var(--c-gold); }
        /* flicker: normal → pixel → normal → pixel…, short cross-fades (opacity only), a different rhythm, start and
           length per digit, ending on pixel */
        .year-big.flick .yb-n, .year-big.flick .yb-px { animation-duration: var(--kt); animation-delay: var(--kd);
                                                        animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
        .year-big.flick .fk0 .yb-n { animation-name: ybN0; }  .year-big.flick .fk0 .yb-px { animation-name: ybP0; }
        .year-big.flick .fk1 .yb-n { animation-name: ybN1; }  .year-big.flick .fk1 .yb-px { animation-name: ybP1; }
        .year-big.flick .fk2 .yb-n { animation-name: ybN2; }  .year-big.flick .fk2 .yb-px { animation-name: ybP2; }
        @keyframes ybN0 { 0%, 12% { opacity: 1; } 19%, 30% { opacity: 0; } 37%, 52% { opacity: 1; } 60%, 100% { opacity: 0; } }
        @keyframes ybP0 { 0%, 12% { opacity: 0; } 19%, 30% { opacity: 1; } 37%, 52% { opacity: 0; } 60%, 100% { opacity: 1; } }
        @keyframes ybN1 { 0%, 6% { opacity: 1; } 12%, 18% { opacity: 0; } 24%, 40% { opacity: 1; } 47%, 58% { opacity: 0; } 64%, 72% { opacity: 1; } 80%, 100% { opacity: 0; } }
        @keyframes ybP1 { 0%, 6% { opacity: 0; } 12%, 18% { opacity: 1; } 24%, 40% { opacity: 0; } 47%, 58% { opacity: 1; } 64%, 72% { opacity: 0; } 80%, 100% { opacity: 1; } }
        @keyframes ybN2 { 0%, 20% { opacity: 1; } 27%, 34% { opacity: 0; } 40%, 46% { opacity: 1; } 51% { opacity: .35; } 56%, 68% { opacity: 1; } 77%, 100% { opacity: 0; } }
        @keyframes ybP2 { 0%, 20% { opacity: 0; } 27%, 34% { opacity: 1; } 40%, 46% { opacity: 0; } 51% { opacity: .65; } 56%, 68% { opacity: 0; } 77%, 100% { opacity: 1; } }
        @keyframes yearRise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        /* month title: the same cells and the same flicker at half the size (24px pixel font, so one font pixel = 3px).
           --nx nudges each normal-font letter so the word is evenly spaced (see monthTwinShift) */
        .month-big .yb-cell { position: relative; display: inline-block; width: 1em; height: 1em; }
        .month-big .yb-cell.tt { margin-left: -3px; }       /* "t" sits a font pixel to the right in its box: pull it back */
        .month-big .yb-px { display: block; height: 1em; font-family: 'Press Start 2P', 'Inter', sans-serif; -webkit-font-smoothing: none; }
        .month-big .yb-n { position: absolute; left: 0; top: -4.25px; width: 21px; text-align: center; opacity: 0; pointer-events: none;
                           font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
                           font-size: 29px; font-weight: 800; line-height: 1.02; letter-spacing: 0; white-space: nowrap;
                           display: flex; justify-content: center; translate: var(--nx, 0px) 0; }
        .month-big.flick .yb-n, .month-big.flick .yb-px { animation-duration: var(--kt); animation-delay: var(--kd);
                                                          animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
        .month-big.flick .fk0 .yb-n { animation-name: ybN0; }  .month-big.flick .fk0 .yb-px { animation-name: ybP0; }
        .month-big.flick .fk1 .yb-n { animation-name: ybN1; }  .month-big.flick .fk1 .yb-px { animation-name: ybP1; }
        .month-big.flick .fk2 .yb-n { animation-name: ybN2; }  .month-big.flick .fk2 .yb-px { animation-name: ybP2; }
        /* switching months: pixel font to pixel font. Each cell flickers between the old month's letter (.yb-old) and
           the new one several times before settling on the new one: the header year's own rhythms (ybN = the one that
           goes, ybP = the one that stays), opacity only, a little later for each letter to the right. */
        .month-big .yb-old { position: absolute; left: var(--ox, 0px); top: 0; opacity: 0; pointer-events: none;
                             font-family: 'Press Start 2P', 'Inter', sans-serif; -webkit-font-smoothing: none; }
        .month-big.swap .yb-old, .month-big.swap .yb-px { animation-duration: var(--kt); animation-delay: var(--kd);
                                                          animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
        .month-big.swap .fk0 .yb-old { animation-name: ybN0; }  .month-big.swap .fk0 .yb-px { animation-name: ybP0; }
        .month-big.swap .fk1 .yb-old { animation-name: ybN1; }  .month-big.swap .fk1 .yb-px { animation-name: ybP1; }
        .month-big.swap .fk2 .yb-old { animation-name: ybN2; }  .month-big.swap .fk2 .yb-px { animation-name: ybP2; }
        .year-intro {
          position: fixed; inset: 0; z-index: 155;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .year-intro-text {
          position: relative; display: flex; font-weight: 800; letter-spacing: -0.02em;
          font-size: 240px; line-height: 1.02;
          transform-origin: 0% 50%;
          transition: transform .4s cubic-bezier(0.5,0,0.15,1);
        }
        .yi-ch {
          display: inline-block;
          /* brushed metal, lit from the middle */
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, rgba(28,33,38,0.10) 1px 2px),
            linear-gradient(103deg,
              #79828b 0%, #626b74 18%, #aab3bb 34%, #e3eaf0 46%,
              #98a1a9 58%, #6b747d 76%, #58616a 100%);
          background-size: auto, 100% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: chIn .38s cubic-bezier(0.22,1,0.36,1) both;
          transition: -webkit-text-fill-color .32s ease, translate .4s cubic-bezier(0.5,0,0.15,1);
        }
        .yi-ch.settled { -webkit-text-fill-color: var(--c-ink); }
        @keyframes chIn {
          from { opacity: 0; transform: translateY(64px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* the intro takes the texture of whichever card was pulled out */
        .yi-palladium .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,246,214,0.14) 0 1px, rgba(60,46,16,0.14) 1px 2px),
            linear-gradient(103deg, #a98a49 0%, #7d6430 18%, #f0dcab 42%, #8d7139 62%, #dcc48a 84%, #9a7d40 100%);
        }
        .yi-platinum .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, rgba(60,66,72,0.12) 1px 2px),
            linear-gradient(103deg, #b6bdc4 0%, #79818a 18%, #f6f8fa 42%, #838b94 62%, #dfe4e9 84%, #939ba3 100%);
        }
        .yi-coutts .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, rgba(12,14,17,0.16) 1px 2px),
            linear-gradient(103deg, #6b7178 0%, #33383d 20%, #a8b0b8 44%, #2b2f34 66%, #7d848c 100%);
        }
        .yi-couttspurple .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(240,228,255,0.12) 0 1px, rgba(24,15,36,0.18) 1px 2px),
            linear-gradient(103deg, #7a5ea8 0%, #3a2856 20%, #d3bff0 44%, #33234c 66%, #8b6dbd 100%);
        }
        .yi-ivory .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(210,228,255,0.14) 0 1px, rgba(8,16,34,0.18) 1px 2px),
            linear-gradient(103deg, #3f6bb4 0%, #1a2c52 20%, #b8d0f4 44%, #16274a 66%, #4d7cc4 100%);
        }
        .yi-obsidian .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(206,238,222,0.14) 0 1px, rgba(6,24,18,0.18) 1px 2px),
            linear-gradient(103deg, #2f6b53 0%, #123326 20%, #a8dcc2 44%, #102c21 66%, #3a7d61 100%);
        }

        .year-nav {
          position: fixed; right: 26px; bottom: 26px; z-index: 30;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          border-radius: 16px; padding: 7px 6px;
          background: rgba(255,255,255,0.055) !important;
          border: 1px solid rgba(255,255,255,0.16) !important;
          backdrop-filter: blur(22px) saturate(170%); -webkit-backdrop-filter: blur(22px) saturate(170%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .year-nav .ynav-btn { color: #cbd3db; }
        .ynav-btn {
          background: none; border: none; color: var(--c-mute-2); cursor: pointer;
          padding: 6px 8px; border-radius: 9px; line-height: 0;
          /* opacity is in the list so an arrow fades to its greyed-out state at the first or last year, and back */
          transition: color .18s ease, background .18s ease, transform .18s var(--ease-soft), opacity .32s ease;
        }
        .ynav-btn svg { width: 17px; height: 17px; display: block; }
        .ynav-btn:hover:not(:disabled) { color: var(--c-ink); background: rgba(255,255,255,0.08); }
        .ynav-btn:active:not(:disabled) { transform: scale(0.92); }
        .ynav-btn:disabled { opacity: 0.25; cursor: default; }

        /* ---------- year stack ---------- */
        /* the stack fills the window between the header and the footer (258px is what those two take), but is never
           smaller than it used to be. --yb is the height of one year: the stack minus the peek at its neighbours. */
        .year-viewport { --yv: max(480px, calc(100vh - 296px)); --yb: calc(var(--yv) - ${YEAR_PEEK}px);
                         height: var(--yv); overflow: hidden; margin-top: 2px; }
        /* quick add (finance yearly panel): one small row between the header and the year stack, which gives up
           QADD_H px of its height for it */
        .year-viewport.with-qadd { --yv: max(480px, calc(100vh - 296px - ${QADD_H}px)); }
        /* the box is 46px tall and starts 8px up in the header's bottom margin; 10px stay clear under it (6 here and
           the stack's own 2px top margin, which no longer folds into the header's) */
        .qadd-row { display: flex; height: ${QADD_H + 6}px; margin-top: -8px; align-items: flex-start; }
        .qadd { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 5px; border-radius: 15px;
                transition: border-color .2s ease; }
        .qadd:focus-within { border-color: rgba(255,255,255,0.15); }
        .qadd input { height: 34px; padding: 0 12px !important; font-size: 13.5px !important; border-radius: 10px !important; }
        .qadd-amt { position: relative; display: inline-block; width: 124px; }
        .qadd-amt input { width: 100%; }
        .qadd-amt > span { font-size: 13.5px !important; }
        .qadd-desc { width: 214px; }
        .qadd-kind { display: inline-flex; align-items: center; gap: 7px; height: 34px; width: 98px; padding: 0 0 0 11px; flex-shrink: 0;
                     background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; color: var(--c-ink-2);
                     font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .qadd-kind:hover { border-color: var(--c-mute-2); color: var(--c-ink); }
        .qadd-kind i { width: 7px; height: 7px; border-radius: 99px; background: var(--c-red); transition: background .2s ease; }
        .qadd.inc .qadd-kind i { background: var(--c-green); }
        .qadd-descbox { position: relative; display: inline-block; }
        .qadd-ph { position: absolute; left: 13px; right: 13px; top: 0; height: 100%; display: flex; align-items: center; overflow: hidden;
                   font-size: 13.5px; color: #b0b8c0; pointer-events: none; }   /* it was a placeholder's grey (#757575), which through the row's 70% came to 2.4 to 1: the faintest text on the yearly panel. This is 4.7 to 1 there; no token is this strength */
        .qadd-go { position: relative; width: 38px; height: 34px; border-radius: 10px; flex-shrink: 0; padding: 0; border: none; background: none;
                   cursor: pointer; line-height: 1; color: #2b0d11; transition: color .26s ease; }
        .qadd.inc .qadd-go { color: #07291c; }
        .qadd-go i { position: absolute; inset: 0; border-radius: inherit; transition: opacity .26s ease; }
        .qadd-go .qg-red { background: linear-gradient(160deg,#ff7a86,#e0434f); box-shadow: 0 6px 18px rgba(255,93,108,0.26), inset 0 1px 0 rgba(255,255,255,0.32); }
        .qadd-go .qg-green { background: linear-gradient(160deg,#54e6a8,#2bbd80); box-shadow: 0 6px 18px rgba(61,220,151,0.28), inset 0 1px 0 rgba(255,255,255,0.35); opacity: 0; }
        .qadd.inc .qadd-go .qg-red { opacity: 0; }
        .qadd.inc .qadd-go .qg-green { opacity: 1; }
        .qadd-go svg { position: relative; }
        .qadd-go .qg-v { transform: scaleY(0); transition: transform .3s cubic-bezier(0.4,0,0.2,1); }
        .qadd.inc .qadd-go .qg-v { transform: scaleY(1); }
        /* RollWord: letters leave and arrive one after another */
        .rollw { position: relative; display: inline-block; white-space: pre; }
        .rollw-old { position: absolute; left: 0; top: 0; }
        .rw, .rw-in, .rw-out { display: inline-block; }
        .rw-in { animation: rwIn .34s cubic-bezier(0.22,1,0.36,1) backwards; }
        .rw-out { opacity: 0; animation: rwOut ${RW_OUT_MS}ms ease-in backwards; }
        @keyframes rwIn { from { opacity: 0; transform: translateY(var(--ry)); } }
        @keyframes rwOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(calc(var(--ry) * -1)); } }
        .qadd-done { position: absolute; left: 100%; top: 50%; margin: -11px 0 0 14px; height: 22px; display: inline-flex; align-items: center;
                     gap: 5px; white-space: nowrap; font-size: 12.5px; font-weight: 600; color: var(--c-red-soft); font-variant-numeric: tabular-nums;
                     pointer-events: none; opacity: 0; animation: qaddDone 2.5s ease backwards; }
        .qadd-done.inc { color: #5ee3a9; }
        .qadd-done .msym { font-size: 16px; }
        @keyframes qaddDone {
          0% { opacity: 0; transform: translateX(-8px); } 9% { opacity: 1; transform: translateX(0); }
          78% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(6px); }
        }
        .year-track {
          transition: transform .72s var(--ease-soft);
          will-change: transform;
        }
        .year-track.shifting { opacity: 0.92; }
        .year-block {
          height: var(--yb); padding-top: 4px;
          opacity: 0.13; transform: scale(0.965);
          transition: opacity .6s ease, transform .72s var(--ease-soft);
          cursor: pointer;
        }
        .year-block.active { opacity: 1; transform: scale(1); cursor: default; }
        .year-block-tag {
          font-size: 12px; font-weight: 700; color: var(--c-mute); letter-spacing: 0.12em;
          margin-bottom: 8px; opacity: 0; transition: opacity .4s ease;
        }
        .year-block:not(.active) .year-block-tag { opacity: 1; }

        /* ---------- launch screen ---------- */
        /* nothing on the stage is text to be marked: a second press right behind the first is a double click to the engine,
           which marked the word under the pointer, the engraved Rassam on a card, in the selection's green (he reported it) */
        /* (.th beside a :hover on the stage: the first launch's rehearsal has a pointer of its own making, which no
           :hover answers to: see stageTour. A new :hover on the stage needs its .th, or what it shows is first built
           under his pointer) */
        .launch-veil {
          position: fixed; inset: 0; z-index: 200; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          animation: veilIn .6s ease both;
          -webkit-user-select: none; user-select: none;
        }
        .launch-veil.out { animation: veilOut .6s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes veilIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes veilOut { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }

        .bg-dots {
          position: absolute; inset: -10%; pointer-events: none;
          background-image: radial-gradient(rgba(190,205,220,0.05) 1px, transparent 1.1px);
          background-size: 17px 17px;
        }
        .bg-dots.lit {
          background-image: radial-gradient(rgba(205,220,235,0.22) 1.1px, transparent 1.2px);
        }
        .bg-glow { position: absolute; left: 0; top: 0; width: 840px; height: 840px; pointer-events: none; will-change: transform;
                   background: radial-gradient(circle 420px at 50% 50%, rgba(190,205,220,0.07), transparent 70%); }
        .bg-lit-win { position: absolute; left: 0; top: 0; width: 680px; height: 680px; overflow: hidden; pointer-events: none; will-change: transform;
                      -webkit-mask-image: radial-gradient(circle 340px at 50% 50%, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%);
                      mask-image: radial-gradient(circle 340px at 50% 50%, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%); }
        .bg-lit-win .bg-dots.lit { inset: auto; left: -10vw; top: -10vh; width: 120vw; height: 120vh; will-change: transform; }

        .launch-wrap { position: static; }
        /* wallets panel: the way back to the selections panel. The whole top-left corner is the button;
           its arrow is invisible until the pointer is there (like .month-nav) */
        .pick-back {
          position: fixed; left: 0; top: 0; z-index: 6; width: 76px; height: 76px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; padding: 0; color: var(--c-ink-2); cursor: pointer;
          opacity: 0; pointer-events: none; transition: opacity .2s ease;
        }
        .pick-back .msym { font-size: 24px; transform: translateX(5px); transition: transform .28s var(--ease); }
        .pick-back.on { pointer-events: auto; }
        .pick-back.on:hover, .pick-back.on:focus-visible, .pick-back.on.th { opacity: 1; }
        .pick-back.on:hover .msym, .pick-back.on:focus-visible .msym, .pick-back.on.th .msym { transform: none; }
        .pick-back:active { color: var(--c-ink); }
        /* who is using the app, bottom right of every panel before an app is entered (8 October 2026: "a select user
           button", "hidden but visible enough for the naked eye to see"): the account's picture at a third of its
           strength, whole with its words under the pointer */
        .who-btn { position: fixed; right: 20px; bottom: 18px; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 6px;
                   background: none; border: none; color: var(--c-ink-2); font-size: 12px; font-weight: 500; letter-spacing: 0.01em; cursor: pointer;
                   opacity: 0; pointer-events: none; transition: opacity .25s ease; }
        .who-btn.on { opacity: 0.34; pointer-events: auto; }
        .who-btn.on:hover, .who-btn.on:focus-visible, .who-btn.on.th { opacity: 1; }
        .who-pic { display: block; width: 32px; height: 32px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(255,255,255,0.18), 0 6px 16px rgba(0,0,0,0.35); }
        .who-t { white-space: nowrap; opacity: 0; transform: translateX(6px); transition: opacity .2s ease, transform .28s var(--ease); }
        .who-btn.on:hover .who-t, .who-btn.on:focus-visible .who-t, .who-btn.on.th .who-t { opacity: 1; transform: none; }
        /* the side's title on the wallets panel and the trading panel: pixel letters with real thickness (copies of the
           word set back one behind the other, like the coin's edge), floating and leaning after the pointer.
           Three nested boxes as on the coin: .sw-tilt (pointer, written from JS), .sw-float (idle float), .sw-3d (resting
           pose). Opacity only on .side-word: on those three it would flatten the letters */
        .mk-cap { position: fixed; left: 0; right: 0; top: calc(50% + 232px); z-index: 5; height: 16px; pointer-events: none; opacity: 0; transition: opacity .25s ease; }
        .mk-cap.on { opacity: 1; transition: opacity .5s ease .4s; }
        .mk-cap span { position: absolute; left: 0; right: 0; text-align: center; font-size: 11.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-ink-3);
                       opacity: 0; transform: translateY(4px); transition: opacity .2s ease, transform .3s var(--ease); }
        .mk-cap span.at { opacity: 1; transform: none; transition-delay: .16s; }
        .side-word { position: fixed; left: 0; right: 0; top: 52px; z-index: 5; display: flex; justify-content: center; pointer-events: none;
                     font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 24px; line-height: 1; letter-spacing: 3px;
                     opacity: 0; transform: translateY(-10px); transition: opacity .2s ease, transform .3s var(--ease); }
        .side-word.on { opacity: 1; transform: none; transition: opacity .4s ease .22s, transform .55s var(--ease) .22s; }
        .sw-tilt { transform: perspective(700px); transform-style: preserve-3d; transition: transform .7s cubic-bezier(0.22,1,0.36,1); will-change: transform; }
        .sw-float { transform-style: preserve-3d; animation: swFloat 7s ease-in-out infinite; animation-play-state: paused; }
        .side-word.on .sw-float { animation-play-state: running; }
        @keyframes swFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotateY(-6deg) rotateX(2deg); }
          50%      { transform: translate3d(0, -7px, 0) rotateY(6deg) rotateX(-2deg); }
        }
        .sw-3d { position: relative; transform-style: preserve-3d; }
        .sw-l, .sw-face { font-family: 'Press Start 2P', 'Inter', sans-serif; font-weight: 400; -webkit-font-smoothing: none; }
        .sw-l { position: absolute; left: 0; top: 0; white-space: nowrap; }
        .sw-face { position: relative; display: block; white-space: nowrap; color: #f4f6f8; }
        @keyframes wrapIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }

        /* ---------- stage: wallet (phase 1) -> card (phase 2) ---------- */

        .wallet-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: 452px; height: 344px;
          transform: translate(-50%, -50%);
          cursor: pointer; perspective: 1500px;
          /* pre-rasterised layer: sliding/scaling is a pure GPU move, no repaint, no first-frame hitch */
          will-change: transform, opacity, filter;
          /* the blur is always there, of nothing unless the wallet is tucked away (as on the coin): gaining or losing a
             filter makes every layer of the wallet be drawn again, and the first time that happened in a launch (the
             first switch between wallet and coin) it froze a few frames. Now only the blur's strength changes */
          filter: blur(0px);
          /* --cp: how far its card is out (0 in the pocket, 1 out). The wallet drops away by that much */
          --cp: 0; translate: 0 calc(var(--cp) * (50vh + 76px));
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, --cp ${CARD_IN_MS}ms ${CARD_IN_EASE};
        }
        .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; }
        .wallet-unit.side-left  { transform: translate(-50%, -50%) translateX(-430px) scale(0.56); opacity: 0.65; z-index: 3; }
        .wallet-unit.side-right:hover, .wallet-unit.side-left:hover, .wallet-unit.side-right.th, .wallet-unit.side-left.th { opacity: 0.92; }
        /* two steps away: parked further out and out of reach until you step across */
        .wallet-unit.far.side-right { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; pointer-events: none; }
        .wallet-unit.far.side-left  { transform: translate(-50%, -50%) translateX(-760px) scale(0.42); opacity: 0; pointer-events: none; }
        /* The card leaves the wallet as one piece, in one move (he asked for no fade, for any change of asset to be
           invisible, and found the first version, which rose, stopped and set off again, janky and too slow).
           One number does all of it: --cp, 0 in the pocket and 1 out, eased once (CARD_OUT_MS out, CARD_IN_MS back).
           The wallet drops away by it; the pocket card cancels that drop, so on screen it only drifts to the middle
           and grows to the big card's size, the pocket's walls hiding it the way they really would; the big card
           makes exactly the same move on top, switched off. Once the card is clear of the pocket (--ct) the big one
           is shown in its place, in the middle of the move; since the two are the same picture on the same spot at
           every moment, when that happens can't be seen. Going back is the same number running down.
           Because everything hangs on that one number, a press in the middle just turns it round from where it is:
           there are no timers and nothing is locked. Stepping to another wallet while the card is still coming back
           hands it to the pocket card at once (.away), which then finishes inside its wallet as that moves aside.
           The number is written to "translate" and to the cards' own transforms, never to a property that has a
           transition of its own (the wallet's "transform" has one). */
        .phase2 .wallet-unit.active { --cp: 1; transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, --cp ${CARD_OUT_MS}ms ${CARD_OUT_EASE}; }
        .phase2 .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(660px) scale(0.45); opacity: 0; pointer-events: none; }
        .phase2 .wallet-unit.side-left  { transform: translate(-50%, -50%) translateX(-660px) scale(0.45); opacity: 0; pointer-events: none; }
        /* selections panel: a carousel of two, built like the wallets. The one in focus is in the middle; the other is
           tucked to the side, smaller, dimmer and a touch out of focus. The other years' wallets stay out of sight.
           The blur is switched, never animated: it comes on once the wallet is most of the way out, and goes
           the moment it starts back. */
        .pick-coin .wallet-unit.active, .markets .wallet-unit.active, .trade .wallet-unit.active {
          transform: translate(-50%, -50%) translateX(-430px) scale(0.56); opacity: 0.65; z-index: 3; filter: blur(2px);
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, filter 0s linear .26s;
        }
        .pick-coin .wallet-unit.active:hover, .pick-coin .wallet-unit.active.th { opacity: 0.92; }
        /* the coin was pressed: the wallet slips away, and the trading selection (coin and IDX globe) takes the stage */
        .markets .wallet-unit.active, .trade .wallet-unit.active { transform: translate(-50%, -50%) translateX(-700px) scale(0.45); opacity: 0; pointer-events: none; }
        .pick .wallet-unit.side-right, .markets .wallet-unit.side-right, .trade .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; pointer-events: none; }
        .pick .wallet-unit.side-left, .markets .wallet-unit.side-left, .trade .wallet-unit.side-left { transform: translate(-50%, -50%) translateX(-760px) scale(0.42); opacity: 0; pointer-events: none; }
        .wallet-3d {
          position: absolute; inset: 0; transform-style: preserve-3d;
          will-change: transform;            /* eased per-frame in JS, so no CSS transition on top */
        }

        .holder { position: absolute; inset: 0; }

        /* back wall + visible gusset edge */
        .hold-back {
          position: absolute; left: 0; right: 0; top: 48px; bottom: 0;
          border-radius: 16px;
          background: linear-gradient(180deg, #8d8172 0%, #6d6354 60%, #5d5445 100%);
          box-shadow: 0 30px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14);
        }
        .hold-back::after {
          content: ""; position: absolute; inset: 0; border-radius: 16px;
          border: 1px solid rgba(40,33,24,0.45);
          background:
            radial-gradient(rgba(255,255,255,0.10) 0.6px, transparent 0.7px) 0 0 / 4px 4px,
            radial-gradient(rgba(0,0,0,0.16) 0.6px, transparent 0.7px) 2px 2px / 5px 5px;
          opacity: 0.6;
        }

        /* cards inside the pocket */
        .slot-card {
          position: absolute; left: 34px; width: 384px; height: 242px;
          border-radius: calc(20px * var(--csx, 0.6857)) / calc(20px * var(--csy, 0.7118)); overflow: hidden; z-index: 2;
          box-shadow: 0 6px 14px rgba(0,0,0,0.4);
          will-change: transform, opacity;
          /* out of the pocket (--cp): it cancels the wallet's drop, drifts to the middle of the window (--ty),
             straightens (--rot) and grows to the big card's size */
          --cp: 0; transition: --cp ${CARD_IN_MS}ms ${CARD_IN_EASE};
          translate: 0 calc(var(--cp) * (-50vh - 76px));
          transform: translateY(calc(var(--cp) * var(--ty))) rotate(calc((1 - var(--cp)) * var(--rot)))
                     scale(calc(1 + var(--cp) * (1 / var(--csx, 0.6857) - 1)), calc(1 + var(--cp) * (1 / var(--csy, 0.7118) - 1)));
        }
        /* the face, laid out at the big card's size and scaled to the pocket card's */
        .slot-in { position: absolute; left: 0; top: 0; width: min(560px, 84vw); height: min(340px, 44vh); container-type: inline-size;
                   transform-origin: 0 0; transform: scale(var(--csx, 0.6857), var(--csy, 0.7118));
                   /* a surface of its own, drawn at full size and scaled like the big card's, so the two are the same picture */
                   will-change: transform; }
        /* back card: sits behind both pocket walls */
        .slot-card.gold { top: 10px; --ty: 41px; --rot: -0.6deg; z-index: 2; }
        /* front card: sits inside the front pocket, ahead of the rear wall */
        .slot-card.plat { top: 92px; --ty: -41px; --rot: 0.35deg; z-index: 4; }
        /* the pressed card goes out … */
        .phase2 .wallet-unit.active .slot-card.sel { --cp: 1; transition: --cp ${CARD_OUT_MS}ms ${CARD_OUT_EASE}; }
        /* … and is switched off once the big card stands in for it (a hair later than that one comes on, so there
           is never a frame with neither) */
        .wallet-unit.active .slot-card.sel { opacity: clamp(0, calc((var(--ct, 0.55) + 0.004 - var(--cp)) * 500), 1); }

        /* front pocket with the puzzle panels */
        .puzzle-front {
          position: absolute; left: 0; right: 0; top: 48px; bottom: 0; z-index: 5;
          border-radius: 16px; overflow: hidden;
        }
        /* leather pocket walls that sit IN FRONT of the cards */
        .wall {
          position: absolute; left: 0; right: 0; bottom: 0;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 -1px 0 rgba(255,255,255,0.10), 0 10px 26px rgba(0,0,0,0.4);
        }
        .wall-rear  { top: 118px; z-index: 3; }
        .puzzle-rear { border-radius: 14px; }
        .pz-skin {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.10), transparent 60%),
            linear-gradient(168deg, #8b7f6e 0%, #796d5d 45%, #6a5f50 100%);
        }
        .pz-skin::after {
          content: ""; position: absolute; inset: 0; opacity: 0.45; mix-blend-mode: overlay;
          background:
            radial-gradient(rgba(255,255,255,0.14) 0.6px, transparent 0.7px) 0 0 / 4px 4px,
            radial-gradient(rgba(0,0,0,0.18) 0.6px, transparent 0.7px) 2px 2px / 5px 5px;
        }
        .wall-front { top: 178px; z-index: 5; }
        .wall-lip {
          position: absolute; left: 0; right: 0; top: 0; height: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.20), transparent);
        }
        .wall-lip::after {
          content: ""; position: absolute; left: 12px; right: 12px; top: 7px; height: 0;
          border-top: 1.5px dashed rgba(216,222,228,0.34);
        }
        .lp { position: absolute; inset: 0; }
        .lp-main {
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.10), transparent 60%),
            linear-gradient(168deg, #8b7f6e 0%, #796d5d 42%, #6a5f50 78%, #5f5546 100%);
          clip-path: polygon(0 34%, 100% 8%, 100% 100%, 0 100%);
        }
        .lp-wedge {
          background:
            radial-gradient(120% 120% at 10% 90%, rgba(255,255,255,0.08), transparent 60%),
            linear-gradient(150deg, #7d7160 0%, #6b6051 100%);
          clip-path: polygon(0 34%, 0 100%, 72% 100%);
        }
        .lp-seam {
          position: absolute; left: -6%; width: 112%; top: 0; height: 0;
          border-top: 1.5px solid rgba(52,44,33,0.55);
          box-shadow: 0 1.5px 0 rgba(255,255,255,0.12);
          transform-origin: left center;
          top: 34%; transform: rotate(24.5deg);
        }
        .lp-seam::after {
          content: ""; position: absolute; left: 0; right: 0; top: 3px; height: 0;
          border-top: 1.5px dashed rgba(226,215,196,0.55);
        }
        /* stitched lip along the pocket opening */
        .lp-lip {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.16), transparent 14px);
          clip-path: polygon(0 34%, 100% 8%, 100% 11.5%, 0 37.5%);
        }
        .lp-lip::after {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(103deg,
            rgba(226,215,196,0.6) 0 5px, transparent 5px 11px);
          clip-path: polygon(0 38.5%, 100% 12.5%, 100% 14%, 0 40%);
        }
        /* perimeter stitching */
        .lp-stitch {
          position: absolute; inset: 8px; border-radius: 11px;
          border: 1.5px dashed rgba(226,215,196,0.5);
          clip-path: polygon(0 32%, 100% 6%, 100% 100%, 0 100%);
        }
        .anagram {
          position: absolute; right: 40px; bottom: 34px; width: 78px; height: 58px; opacity: 0.55;
          filter: drop-shadow(0 1px 0 rgba(255,255,255,0.18));
        }
        .anagram-dark { opacity: 0.42; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.14)); }
        .leather-shine { position: absolute; inset: 0; pointer-events: none; transition: opacity .45s ease; overflow: hidden; }
        /* the puzzle wallet's front is cut away at a slant, and the cards show through the part cut off: there the light
           keeps to the leather (.lp-main's own outline). As a plain box it also lit the cards, from the wallet's top line
           down: a straight line of light across the back card under the pointer (he sent a picture of it) */
        .puzzle-front .leather-shine { clip-path: polygon(0 34%, 100% 8%, 100% 100%, 0 100%); }
        /* light spot is pre-painted once and slid with transform (200%-size box centred on the cursor) */
        .shine-spot { position: absolute; left: -100%; top: -100%; width: 200%; height: 200%; will-change: transform;
                      transform: translate3d(25%, 25%, 0); }

        /* ---------- Arena lambskin holder ---------- */
        .arena .hold-back {
          background: linear-gradient(180deg, #5c6166 0%, #45494e 60%, #34383c 100%);
        }
        .arena-wall { border-radius: 14px; }
        .ar-base {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 80% at 30% 8%, rgba(255,255,255,0.20), transparent 58%),
            radial-gradient(90% 70% at 82% 96%, rgba(0,0,0,0.30), transparent 66%),
            linear-gradient(168deg, #676c72 0%, #545a60 38%, #43484e 72%, #383c41 100%);
        }
        /* crinkled grain: overlapping crackle lines */
        .ar-crinkle {
          position: absolute; inset: 0; opacity: 0.9; mix-blend-mode: overlay;
          background-image:
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='220' height='220' filter='url(%23n)' opacity='0.55'/></svg>"),
            repeating-linear-gradient(41deg, rgba(255,255,255,0.10) 0 0.8px, transparent 0.8px 17px),
            repeating-linear-gradient(-27deg, rgba(255,255,255,0.08) 0 0.8px, transparent 0.8px 26px),
            repeating-linear-gradient(83deg, rgba(0,0,0,0.12) 0 0.8px, transparent 0.8px 21px),
            repeating-linear-gradient(-66deg, rgba(0,0,0,0.10) 0 0.8px, transparent 0.8px 31px);
          background-size: 220px 220px, auto, auto, auto, auto;
        }
        /* soft creases and worn patches */
        .ar-crinkle::after {
          content: ""; position: absolute; inset: 0; opacity: 0.55;
          background:
            radial-gradient(46% 26% at 22% 34%, rgba(255,255,255,0.16), transparent 70%),
            radial-gradient(38% 22% at 74% 58%, rgba(255,255,255,0.12), transparent 72%),
            radial-gradient(52% 30% at 58% 86%, rgba(0,0,0,0.20), transparent 74%),
            radial-gradient(30% 40% at 8% 72%, rgba(0,0,0,0.16), transparent 76%);
        }
        .ar-gloss {
          position: absolute; inset: 0; pointer-events: none;
          background:
            linear-gradient(158deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 16%, transparent 30%),
            radial-gradient(70% 34% at 68% 90%, rgba(255,255,255,0.12), transparent 72%),
            linear-gradient(0deg, rgba(0,0,0,0.22) 0%, transparent 22%);
        }

        /* darker grey pockets sitting behind the cards */
        .arena .hold-back {
          background: linear-gradient(180deg, #3c4045 0%, #2e3236 60%, #24272b 100%);
        }
        /* the pocket behind the front card reads as a dark recess, like the back panel */
        .ar-pocket .ar-base {
          background:
            radial-gradient(120% 80% at 30% 8%, rgba(255,255,255,0.07), transparent 58%),
            linear-gradient(168deg, #3a3e43 0%, #2e3237 42%, #26292d 74%, #202327 100%);
        }
        .ar-pocket .ar-gloss { opacity: 0.3; }
        .ar-pocket .ar-crinkle { opacity: 0.55; }
        .ar-pocket::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(0,0,0,0.34), rgba(0,0,0,0.12) 26%, transparent 60%);
        }
        /* stitching toned to each panel, same U shape as the python holder */
        /* a single seam tracing the holder: down both sides, round the bottom.
           Drawn on top so it never doubles up where the panels overlap. */
        .seam-outline {
          position: absolute; left: 9px; right: 9px; top: 58px; bottom: 9px;
          border: 1.6px dashed; border-top: none; border-bottom: none; border-radius: 0;
          z-index: 4; pointer-events: none;
        }
        .seam-front {
          position: absolute; left: 9px; right: 9px; top: 0; bottom: 9px;
          border: 1.6px dashed; border-top: none; border-radius: 0 0 13px 13px;
          z-index: 7; pointer-events: none;
        }
        .seam-front-ar { border-color: rgba(24,27,31,0.92); }
        .seam-front-py { border-color: rgba(9,48,33,0.95); }
        .seam-arena  { border-color: rgba(24,27,31,0.9); }
        .seam-python { border-color: rgba(96,26,22,0.9); }
        /* the lower half of the python seam is sewn in dark green over the snakeskin */

        /* ---------- python holder ---------- */
        .py-wall { border-radius: 14px; }
        .python .hold-back {
          background:
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.16), transparent 58%),
            linear-gradient(168deg, #c14a41 0%, #a83b34 52%, #8e2f2a 100%);
        }
        .python .hold-back::after {
          background:
            radial-gradient(rgba(255,255,255,0.20) 0.7px, transparent 0.8px) 0 0 / 5px 5px,
            radial-gradient(rgba(0,0,0,0.22) 0.7px, transparent 0.8px) 2.5px 2.5px / 6px 6px;
          border: 1.5px dashed rgba(150,54,46,0.6);
          border-radius: 16px; opacity: 1;
        }
        .py-skin { position: absolute; inset: 0; }
        .py-green {
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.12), transparent 60%),
            linear-gradient(165deg, #2f7d5f 0%, #1d5a44 38%, #14402f 72%, #0e3325 100%);
        }
        .py-red {
          background:
            radial-gradient(rgba(255,255,255,0.18) 0.7px, transparent 0.8px) 0 0 / 5px 5px,
            radial-gradient(rgba(0,0,0,0.20) 0.7px, transparent 0.8px) 2.5px 2.5px / 6px 6px,
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.16), transparent 58%),
            linear-gradient(168deg, #c14a41 0%, #a83b34 52%, #8e2f2a 100%);
        }
        .py-scales {
          position: absolute; inset: 0; opacity: 0.85;
          background-image:
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(255,255,255,0.16) 60%, transparent 64%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(0,0,0,0.42) 66%, transparent 70%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(255,255,255,0.13) 60%, transparent 64%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(0,0,0,0.38) 66%, transparent 70%);
          background-size: 15px 11px, 15px 11px, 15px 11px, 15px 11px;
          background-position: 0 0, 1.2px 1.4px, 7.5px 5.5px, 8.7px 6.9px;
        }
        .py-scales::after {
          content: ""; position: absolute; inset: 0; mix-blend-mode: overlay; opacity: 0.5;
          background:
            radial-gradient(60% 42% at 26% 34%, rgba(255,255,255,0.22), transparent 70%),
            radial-gradient(52% 38% at 74% 76%, rgba(0,0,0,0.30), transparent 72%);
        }

        /* ================= card faces ================= */
        .cf-pattern { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
        .cf-sheen-fixed {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background:
            linear-gradient(118deg, rgba(255,255,255,0.18) 0%, transparent 26%),
            radial-gradient(80% 60% at 78% 92%, rgba(0,0,0,0.2), transparent 70%);
        }
        .cf-content { z-index: 3; }
        .cf-exp { display: inline-flex; align-items: center; gap: 6px; }
        .cf-exp-lbl { font-size: 0.62em; line-height: 1.05; letter-spacing: 0.1em; opacity: 0.75; text-align: right; }

        /* wallet 1 · engraved gold (back) */
        .palladium .cf-metal {
          background:
            radial-gradient(90% 70% at 22% 12%, rgba(255,248,214,0.5), transparent 60%),
            linear-gradient(142deg, #d9bd7d 0%, #a98a49 22%, #f0dcab 42%, #9c7d3f 62%, #e2c98f 82%, #ad8e4d 100%);
        }
        .palladium .cf-grain {
          opacity: 0.5;
          background:
            radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.6px) 0 0 / 3px 3px,
            repeating-linear-gradient(100deg, rgba(255,255,255,0.16) 0 0.6px, rgba(90,70,25,0.10) 1.4px 2px);
        }
        .palladium .cf-pattern { color: #4a3712; mix-blend-mode: multiply; opacity: 0.9; filter: drop-shadow(0 1px 0 rgba(255,246,214,0.5)); }
        .palladium .cf-script { color: rgba(96,72,26,0.9); text-shadow: 0 1.2px 0 rgba(255,246,214,0.75), 0 -1px 1px rgba(50,36,10,0.45); }
        .palladium .cf-name, .palladium .cf-exp { color: rgba(92,70,26,0.88); text-shadow: 0 1px 0 rgba(255,246,214,0.65); }

        /* wallet 1 · engraved silver (front) */
        .platinum .cf-metal {
          background:
            radial-gradient(90% 70% at 24% 10%, rgba(255,255,255,0.55), transparent 60%),
            linear-gradient(142deg, #e9edf1 0%, #b6bdc4 22%, #f6f8fa 42%, #a9b0b7 62%, #e2e6ea 82%, #b9c0c7 100%);
        }
        .platinum .cf-grain {
          opacity: 0.45;
          background: repeating-linear-gradient(100deg, rgba(255,255,255,0.35) 0 0.5px, rgba(110,120,130,0.12) 1.4px 2px);
        }
        .platinum .cf-pattern { color: #4c565f; mix-blend-mode: multiply; opacity: 0.72; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.65)); }
        .platinum .cf-script { color: rgba(96,105,115,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.9), 0 -1px 1px rgba(40,48,56,0.35); }
        .platinum .cf-name, .platinum .cf-exp { color: rgba(92,100,110,0.88); text-shadow: 0 1px 0 rgba(255,255,255,0.8); }

        /* wallet 2 · carbon weave (back) */
        .coutts .cf-metal {
          background: linear-gradient(146deg, #6b7278 0%, #3d4349 28%, #7d858c 50%, #363b41 76%, #616970 100%);
        }
        .coutts .cf-grain {
          opacity: 0.6;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 4px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.24) 0 2px, transparent 2px 4px);
        }
        .coutts .cf-script { color: rgba(214,222,230,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.18), 0 -1px 2px rgba(0,0,0,0.6); }
        .coutts .cf-name, .coutts .cf-exp { color: rgba(206,215,224,0.86); text-shadow: 0 1px 1px rgba(0,0,0,0.55); }

        /* wallet 2 · carbon weave, dark purple (front) */
        .couttspurple .cf-metal {
          background: linear-gradient(146deg, #7a5ea8 0%, #3a2856 28%, #8b6dbd 50%, #33234c 76%, #6b5296 100%);
        }
        .couttspurple .cf-grain {
          opacity: 0.6;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.13) 0 2px, transparent 2px 4px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.26) 0 2px, transparent 2px 4px);
        }
        .couttspurple .cf-script { color: rgba(232,220,250,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.16), 0 -1px 2px rgba(18,10,28,0.65); }
        .couttspurple .cf-name, .couttspurple .cf-exp { color: rgba(226,214,246,0.86); text-shadow: 0 1px 1px rgba(18,10,28,0.6); }

        /* wallet 3 · sapphire blue (front) */
        .ivory .cf-metal {
          background:
            radial-gradient(70% 55% at 84% 8%, rgba(240,226,178,0.5), transparent 56%),
            radial-gradient(80% 60% at 12% 96%, rgba(4,10,26,0.75), transparent 62%),
            linear-gradient(142deg, #3f6ec4 0%, #24447f 26%, #16294f 52%, #0c1730 74%, #1b3566 100%);
        }
        .ivory .cf-grain { opacity: 0.25; background: repeating-linear-gradient(100deg, rgba(255,255,255,0.2) 0 0.5px, rgba(0,0,0,0.16) 1.4px 2px); }
        .ivory .cf-pattern { color: #9fc0f0; mix-blend-mode: soft-light; opacity: 0.95; }
        .ivory .cf-script { color: rgba(126,166,224,0.92); text-shadow: 0 1.2px 0 rgba(190,214,248,0.3), 0 -1px 2px rgba(4,12,30,0.75); }
        .ivory .cf-name, .ivory .cf-exp { color: rgba(132,168,222,0.9); text-shadow: 0 1px 0 rgba(190,214,248,0.24), 0 -1px 1px rgba(4,12,30,0.65); }

        /* wallet 3 · deep green (back) */
        .obsidian .cf-metal {
          background:
            radial-gradient(70% 55% at 84% 8%, rgba(226,238,196,0.42), transparent 56%),
            radial-gradient(80% 60% at 12% 96%, rgba(3,16,11,0.75), transparent 62%),
            linear-gradient(142deg, #2f7458 0%, #1a4835 26%, #102c21 52%, #081a13 74%, #17402f 100%);
        }
        .obsidian .cf-grain { opacity: 0.25; background: repeating-linear-gradient(100deg, rgba(255,255,255,0.18) 0 0.5px, rgba(0,0,0,0.18) 1.4px 2px); }
        .obsidian .cf-pattern { color: #97cfb1; mix-blend-mode: soft-light; opacity: 0.95; }
        .obsidian .cf-script { color: rgba(112,180,146,0.92); text-shadow: 0 1.2px 0 rgba(180,224,202,0.28), 0 -1px 2px rgba(4,20,14,0.75); }
        .obsidian .cf-name, .obsidian .cf-exp { color: rgba(120,184,152,0.9); text-shadow: 0 1px 0 rgba(180,224,202,0.22), 0 -1px 1px rgba(4,20,14,0.65); }

        .anagram-py { opacity: 0.5; }


        /* the pulled-out card, centred on screen */
        .big-card {
          position: fixed; left: 50%; top: 50%; z-index: 12;
          width: min(560px, 84vw); height: min(340px, 44vh);
          cursor: pointer; perspective: 1300px;
          will-change: transform, opacity;
          /* the pocket card's own move, made on top of it: from its spot (--py: its middle against the window's), tilt
             and size to the middle of the window. Switched off until the card is clear of the pocket (--ct), but drawn
             all along (will-change keeps it ready, so taking over costs nothing) */
          --cp: 0; --cq: var(--cp); --py: 41px; --rot: 0.35deg;
          opacity: clamp(0, calc((var(--cp) - var(--ct, 0.55)) * 500), 1); pointer-events: none;
          transition: --cp ${CARD_IN_MS}ms ${CARD_IN_EASE};
          transform: translate(-50%, -50%) translateY(calc((1 - var(--cp)) * var(--py))) rotate(calc((1 - var(--cp)) * var(--rot)))
                     scale(calc(var(--csx, 0.6857) + var(--cp) * (1 - var(--csx, 0.6857))), calc(var(--csy, 0.7118) + var(--cp) * (1 - var(--csy, 0.7118))));
        }
        .big-card.from-back { --py: -41px; --rot: -0.6deg; }
        .phase2 .big-card { --cp: 1; pointer-events: auto; transition: --cp ${CARD_OUT_MS}ms ${CARD_OUT_EASE}; }
        /* its wallet is no longer the one in the middle: the pocket card has it */
        .big-card.away { opacity: 0; }
        /* its shadow: the pocket card's own where it takes over, the deep one once it is out (--cq is --cp handed down) */
        .card-shadow { position: absolute; inset: 0; border-radius: 20px; pointer-events: none; }
        .card-shadow.near { box-shadow: 0 calc(6px / var(--csy, 0.7118)) calc(14px / var(--csx, 0.6857)) rgba(0,0,0,0.4);
                            opacity: clamp(0, calc((1 - var(--cq)) / (1 - var(--ct, 0.55))), 1); }
        .card-shadow.far { box-shadow: 0 34px 80px rgba(0,0,0,0.55); transition: box-shadow .4s ease;
                           opacity: clamp(0, calc((var(--cq) - var(--ct, 0.55)) / (1 - var(--ct, 0.55))), 1); }
        .big-card:hover .card-shadow.far, .big-card.th .card-shadow.far { box-shadow: 0 46px 110px rgba(0,0,0,0.6); }
        /* the lights on the card come on only once it is out, and are gone before the pocket card takes over */
        .phase2 .card-sheen:not(.lit) { transition-delay: .25s; }
        .phase1 .card-gloss, .phase1 .card-sheen, .phase1 .card-edge { transition-duration: .1s; }
        .card-tilt { width: 100%; height: 100%; transform-style: preserve-3d; will-change: transform; }
        .big-card.out, .wallet-unit.out { animation: cardOut .55s cubic-bezier(0.5,0,0.75,0) both; }
        @keyframes cardOut { to { opacity: 0; transform: translate(-50%, -50%) translateY(-30px) scale(1.07); } }
        /* the idle float only runs once the card is out, from rest (so it adds nothing at the hand-over) */
        .launch-float { width: 100%; height: 100%; transform-style: preserve-3d; }
        .phase2 .launch-float { animation: floaty 7s ease-in-out ${CARD_OUT_MS}ms infinite; }
        .launch-float.still { animation-play-state: paused; }
        @keyframes floaty {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
          50%  { transform: translate3d(0, -12px, 0) rotate(0.4deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }

        /* ---------- selections panel: the trading coin ---------- */
        /* a unit like a wallet (placed, scaled and faded as one layer) with the 3D coin inside. In focus it sits in
           the middle; out of focus it is tucked to the right exactly like the next wallet would be */
        .coin-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: ${COIN_D}px; height: ${COIN_D}px; border-radius: 50%;     /* round, so only the coin itself answers the pointer */
          transform: translate(-50%, -50%);
          cursor: pointer;
          /* the blur is always there, of nothing while in focus: bringing the coin into focus then only changes its
             strength, instead of rebuilding how the whole 3D coin is drawn in the middle of the move */
          filter: blur(0px);
          will-change: transform, opacity, filter;
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, visibility 0s;
        }
        /* tucked away. The blur is switched, never animated (see the wallet above). Coming back from the wallets panel
           it waits a moment, so it never shows through the wallet that is leaving the same spot */
        .coin-unit.side { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; filter: blur(2px);
                          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease .12s, filter 0s linear .26s, visibility 0s; }
        .coin-unit.side:hover, .coin-unit.side.th { opacity: 0.92; }
        /* trading selection with the globe in focus: the coin is tucked to the left instead */
        .coin-unit.side.left { transform: translate(-50%, -50%) translateX(-430px) scale(0.56); }
        /* the other one was pressed: this one just fades where it is */
        .coin-unit.side.gone, .idx-unit.side.gone { opacity: 0; pointer-events: none; }
        /* three on the trading panel (coin, globe, forex coin): the one two places from the middle is out of sight
           beyond its neighbour, as a far wallet is, and the globe can be tucked to the left as well */
        .idx-unit.side.left { transform: translate(-50%, -50%) translateX(-430px) scale(0.56); }
        .coin-unit.side.far { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; pointer-events: none; }
        .coin-unit.side.left.far { transform: translate(-50%, -50%) translateX(-760px) scale(0.42); }
        /* the forex die waits off to the right. It is first drawn a moment after the trading panel has opened, out of
           sight, so it is not painted in the middle of that move; asked for sooner, it is there at once */
        .coin-unit.fx.away { transform: translate(-50%, -50%) translateX(760px) scale(0.42); }
        .coin-unit.fx.side.far { transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, filter 0s linear .26s, visibility 0s linear .9s; }
        /* the forex die: a cube turned corner on, so the top and two sides show (rotateX by the angle that makes the
           three alike, rotateY by 45). The light is painted on the faces once, for that pose: brightest on top, the
           left side in half shade, the right in shade. Each face is a layer of its own, painted at full size from the
           start. The core is a slightly smaller cube in the shade's colour: it fills the corners the faces' round
           corners leave open. While it floats it rocks a little about its upright; under the pointer and tucked away
           it holds still, like the float */
        .fx-die { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform-style: preserve-3d;
                  transform: rotateX(-35.26deg) rotateY(-45deg); animation: fxRock 9s ease-in-out infinite alternate; }
        .coin-float.still .fx-die { animation-play-state: paused; }
        @keyframes fxRock { from { transform: rotateX(-35.26deg) rotateY(-38deg); } to { transform: rotateX(-35.26deg) rotateY(-52deg); } }
        .fxd-f, .fxd-core { position: absolute; backface-visibility: hidden; }
        .fxd-f { --z: 92px; left: -92px; top: -92px; width: 184px; height: 184px; border-radius: 28px; will-change: transform;
                 display: flex; align-items: center; justify-content: center;
                 box-shadow: inset 0 0 0 2px rgba(255,255,255,0.5), inset 0 0 26px rgba(110,100,80,0.16); }
        .fxd-core { --z: 86px; left: -86px; top: -86px; width: 172px; height: 172px; background: #b9b5aa; }
        .fx-die .front { transform: translateZ(var(--z)); }
        .fx-die .back { transform: rotateY(180deg) translateZ(var(--z)); }
        .fx-die .right { transform: rotateY(90deg) translateZ(var(--z)); }
        .fx-die .left { transform: rotateY(-90deg) translateZ(var(--z)); }
        .fx-die .top { transform: rotateX(90deg) translateZ(var(--z)); }
        .fx-die .bottom { transform: rotateX(-90deg) translateZ(var(--z)); }
        .fxd-f.top, .fxd-f.bottom { background: linear-gradient(135deg, #ffffff, #efede6); }
        .fxd-f.front, .fxd-f.back { background: linear-gradient(160deg, #e9e6de, #d6d2c8); }
        .fxd-f.right, .fxd-f.left { background: linear-gradient(160deg, #cfcbc0, #b7b3a7); }
        /* the symbols: Inter at its heaviest, pressed in (a light lip below, a dark one above). The one on top is
           turned so that it stands upright in the diamond the top is seen as */
        .fxd-f b { display: block; font-size: 122px; font-weight: 800; line-height: 1; text-shadow: 0 2px 1px rgba(255,255,255,0.7), 0 -1px 1px rgba(0,0,0,0.3); }
        .fxd-f.top b, .fxd-f.bottom b { color: #17935f; transform: rotate(-45deg); }
        .fxd-f.front b, .fxd-f.back b { color: #2458c4; }
        .fxd-f.right b, .fxd-f.left b { color: #cf3447; }
        /* wallets panel: it drops back and is gone before the next wallet arrives in its place, then is switched off
           so it costs nothing there */
        .coin-unit.away { transform: translate(-50%, -50%) translateX(520px) scale(0.42); opacity: 0; visibility: hidden; pointer-events: none; filter: blur(2px);
                          transition: transform .5s cubic-bezier(0.22,1,0.36,1), opacity .18s ease, visibility 0s linear .5s; }
        .coin-shadow { position: absolute; inset: -16%; border-radius: 50%; pointer-events: none; transform: translate3d(6px, 36px, 0) scale(0.94, 1); will-change: transform;
                       background: radial-gradient(closest-side, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.16) 70%, transparent 100%); }
        /* three nested 3D boxes: the cursor tilt (written from JS), the idle float, and the coin in its resting pose */
        .coin-tilt, .coin-float, .coin-3d, .coin-s2, .coin-s3 { position: absolute; inset: 0; transform-style: preserve-3d; }
        .coin-tilt { pointer-events: none; will-change: transform; }
        /* the float runs only while the coin is in focus, and holds still under the pointer */
        .coin-float { animation: coinFloat 7s ease-in-out infinite; }
        .coin-float.still { animation-play-state: paused; }
        @keyframes coinFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotateY(0deg) rotateX(0deg); }
          50%      { transform: translate3d(0, -9px, 0) rotateY(7deg) rotateX(-2.5deg); }
        }
        .coin-3d { transform: rotateX(${COIN_REST.rx}deg) rotateY(${COIN_REST.ry}deg); transition: transform .7s cubic-bezier(0.22,1,0.36,1); }
        /* trading panel (coin and globe): the coin turns to face forward (he asked for it) */
        .markets .coin-3d, .trade .coin-3d { transform: rotateX(0deg) rotateY(0deg); }
        /* pressed: a coin toss, seen from the front: three whole turns, each about an axis of its own (7 October 2026:
           he meant a new random rotation for every spin of a toss, not one for the whole toss). Three boxes turn, one
           inside the other: .coin-3d makes the first turn, .coin-s2 the second, .coin-s3 the third. Each is a plain
           transform keyframe, so the graphics process runs them and a busy page can't make them stutter. A whole turn
           about any axis ends facing forward, so the next can set off another way from there, and the last one lands
           facing forward whatever was rolled (enterTrade).
           No seam between the turns: a turn does not stop before the next begins. Its last 55° or so run out while
           the next one's first 50° run in, both close to facing forward, where two small turns together are just a
           lean on a slant in between. Each turn's speed is a straight ramp there (down for the one, up for the
           other), so together they keep the speed of the toss: about 3.8 turns a second off the thumb, then 3.4, then
           3.3, slowing evenly to rest. The figures in the keyframes are that sum worked out; change the times and
           they have to be worked out again.
           Keep the overlap this short: two turns at rates of their own for the WHOLE toss is what once sent the coin
           through slanted poses, which he found very weird. The lean it had under the pointer is let go of at once. */
        .coin-unit.toss .coin-3d { animation: coinSpin1 .3s linear forwards, coinHop 1.1s linear; }
        .coin-unit.toss .coin-s2 { animation: coinSpin2 .38s linear .22s backwards; }
        .coin-unit.toss .coin-s3 { animation: coinSpin3 .6s linear .5s backwards; }
        @keyframes coinSpin1 {
          0%     { transform: rotate3d(var(--f1x, 1), var(--f1y, 0), var(--f1z, 0), 0deg); }
          73.33% { transform: rotate3d(var(--f1x, 1), var(--f1y, 0), var(--f1z, 0), calc(var(--f1d, 360deg) * 0.8462)); animation-timing-function: cubic-bezier(0.333, 0.667, 0.667, 1); }
          100%   { transform: rotate3d(var(--f1x, 1), var(--f1y, 0), var(--f1z, 0), var(--f1d, 360deg)); }
        }
        @keyframes coinSpin2 {
          0%     { transform: rotate3d(var(--f2x, 0), var(--f2y, 1), var(--f2z, 0), 0deg); animation-timing-function: cubic-bezier(0.333, 0, 0.667, 0.333); }
          21.05% { transform: rotate3d(var(--f2x, 0), var(--f2y, 1), var(--f2z, 0), calc(var(--f2d, 360deg) * 0.1379)); }
          73.68% { transform: rotate3d(var(--f2x, 0), var(--f2y, 1), var(--f2z, 0), calc(var(--f2d, 360deg) * 0.8276)); animation-timing-function: cubic-bezier(0.333, 0.667, 0.667, 1); }
          100%   { transform: rotate3d(var(--f2x, 0), var(--f2y, 1), var(--f2z, 0), var(--f2d, 360deg)); }
        }
        @keyframes coinSpin3 {
          0%     { transform: rotate3d(var(--f3x, 1), var(--f3y, 1), var(--f3z, 0), 0deg); animation-timing-function: cubic-bezier(0.333, 0, 0.667, 0.333); }
          16.67% { transform: rotate3d(var(--f3x, 1), var(--f3y, 1), var(--f3z, 0), calc(var(--f3d, 360deg) * 0.1667)); animation-timing-function: cubic-bezier(0.333, 0.667, 0.667, 1); }
          100%   { transform: rotate3d(var(--f3x, 1), var(--f3y, 1), var(--f3z, 0), var(--f3d, 360deg)); }
        }
        /* the toss's motion blur: directional, along the tumble, like a real one. CSS can only blur evenly, so three
           plain boxes sit round the coin: the middle one blurs, while the outer one squeezes it to a quarter along
           the turn's axis and the inner one stretches it back four times. The blur is therefore four times weaker
           along the axis than across it, the way the coin's face is moving. Both boxes are turned to the axis of the
           turn that is under way (--fa1, --fa2, --fa3), swinging from one to the next while the turns hand over, in
           step with each other, so that together they always come to nothing. Strongest while the coin is fastest,
           gone as it settles. The boxes do nothing outside the toss, and they are outside the 3D boxes (a filter
           there would flatten the coin); the innermost one carries the perspective. An SVG blur filter did this too,
           but made the toss stutter. */
        .coin-smear, .coin-smear > div, .coin-smear > div > div { position: absolute; inset: 0; pointer-events: none; }
        .coin-smear > div > div { perspective: 1300px; }
        .coin-unit.toss .coin-smear { transform: rotate(var(--fa3, 0deg)) scaleX(0.25); animation: coinSmearOut 1.1s linear backwards; }
        .coin-unit.toss .coin-smear > div { animation: coinBlur 1.1s linear backwards; }
        .coin-unit.toss .coin-smear > div > div { transform: scaleX(4) rotate(calc(-1 * var(--fa3, 0deg))); animation: coinSmearIn 1.1s linear backwards; }
        @keyframes coinBlur { 0% { filter: blur(0px); } 12% { filter: blur(11px); } 44% { filter: blur(8px); } 82%, 100% { filter: blur(0px); } }
        @keyframes coinSmearOut {
          0%, 20%     { transform: rotate(var(--fa1, 0deg)) scaleX(0.25); }
          27.3%, 45.5% { transform: rotate(var(--fa2, 0deg)) scaleX(0.25); }
          54.5%, 100% { transform: rotate(var(--fa3, 0deg)) scaleX(0.25); }
        }
        @keyframes coinSmearIn {
          0%, 20%     { transform: scaleX(4) rotate(calc(-1 * var(--fa1, 0deg))); }
          27.3%, 45.5% { transform: scaleX(4) rotate(calc(-1 * var(--fa2, 0deg))); }
          54.5%, 100% { transform: scaleX(4) rotate(calc(-1 * var(--fa3, 0deg))); }
        }
        @keyframes coinHop {
          0%   { translate: 0 0; animation-timing-function: cubic-bezier(0.2,0.7,0.4,1); }
          40%  { translate: 0 -46px; animation-timing-function: cubic-bezier(0.6,0,0.8,0.4); }
          100% { translate: 0 0; }
        }
        /* will-change on everything the coin is painted on (faces, their layers, the edge strips): they are then
           painted once at full size, even while the coin sits tucked away at half size. Without it they were painted
           small, and had to be painted again, big, the first time the coin grew into focus: a visible hitch. */
        .coin-face, .cn-layer, .cn-lustre, .cn-strip { will-change: transform; }
        .coin-face { position: absolute; inset: 0; border-radius: 50%; backface-visibility: hidden; }
        .coin-face.front { transform: translateZ(${COIN_T / 2}px); }
        .coin-face.back { transform: rotateY(180deg) translateZ(${COIN_T / 2}px); }
        .cn-layer { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        /* lustre: a soft sheen across the field, lighter along one diagonal and darker along the other. On the front
           it is turned from JS as the coin tilts */
        .cn-lustre { position: absolute; inset: 0; border-radius: 50%;
                     background: conic-gradient(from 315deg,
                       rgba(255,251,232,0.36) 0deg, rgba(255,251,232,0.10) 28deg, rgba(60,36,4,0) 52deg, rgba(60,36,4,0.16) 90deg,
                       rgba(60,36,4,0) 128deg, rgba(255,251,232,0.07) 154deg, rgba(255,251,232,0.24) 180deg, rgba(255,251,232,0.07) 206deg,
                       rgba(60,36,4,0) 232deg, rgba(60,36,4,0.16) 270deg, rgba(60,36,4,0) 308deg, rgba(255,251,232,0.10) 332deg,
                       rgba(255,251,232,0.36) 360deg); }
        /* trading panel: a light that follows the pointer over the front face (moved from JS), there only under the
           pointer. A plain pale gold glow, no blend mode; the round box cuts it off at the coin's rim */
        .cn-glare { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none;
                    opacity: 0; transition: opacity .4s ease; will-change: opacity; }
        .markets .coin-unit:not(.side):hover .cn-glare, .markets .coin-unit:not(.side).th .cn-glare { opacity: 1; }
        .cn-glare i { position: absolute; left: -50%; top: -50%; width: 200%; height: 200%; display: block; will-change: transform;
                      background: radial-gradient(closest-side, rgba(255,252,236,0.62) 0%, rgba(255,247,214,0.3) 16%, rgba(255,240,190,0.1) 38%, rgba(255,240,190,0) 62%); }
        /* one flat strip of the smooth edge. Its two shades (--a at one side, --b at the other) are worked out per
           strip in COIN_STRIPS; the edge also darkens a little towards the back of the coin */
        .cn-strip { position: absolute; left: 50%; top: 50%; display: block; backface-visibility: hidden;
                    width: ${COIN_STRIP_W}px; height: ${COIN_T}px; margin: ${-COIN_T / 2}px 0 0 ${-COIN_STRIP_W / 2}px;
                    background:
                      linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0) 42%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.16)),
                      linear-gradient(90deg, var(--a), var(--b)); }

        /* ---------- trading selection: the IDX globe (Indonesian stocks) ---------- */
        /* a unit like the coin: in the middle when in focus, tucked to the right when not, and out of sight (switched
           off) everywhere but the trading selection */
        .idx-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: 300px; height: 300px; border-radius: 50%;
          transform: translate(-50%, -50%);
          cursor: pointer;
          filter: blur(0px);                 /* always there, as on the coin and the wallet: only its strength changes */
          will-change: transform, opacity, filter;
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, visibility 0s;
        }
        .idx-unit.side { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; filter: blur(2px);
                         transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease .12s, filter 0s linear .26s, visibility 0s; }
        .idx-unit.side:hover, .idx-unit.side.th { opacity: 0.92; }
        .idx-unit.away { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; visibility: hidden; pointer-events: none; filter: blur(2px);
                         transition: transform .5s cubic-bezier(0.22,1,0.36,1), opacity .18s ease, visibility 0s linear .5s; }
        .idx-halo { position: absolute; inset: -16%; border-radius: 50%; pointer-events: none; transform: translate3d(6px, 36px, 0) scale(0.94, 1);
                    background: radial-gradient(closest-side, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.16) 70%, transparent 100%); }
        /* the globe and its wordmark, laid out as in the logo. Pressed, the whole thing lifts and shrinks a little so
           the wordmark has room under the globe, the globe spins once, and the wordmark comes up */
        .idx-lift { position: absolute; inset: 0; pointer-events: none; transition: transform .9s cubic-bezier(0.22,1,0.36,1); }
        .idx-unit.go { cursor: default; }
        .idx-unit.go .idx-lift { transform: translateY(-128px) scale(0.8); }
        .idx-unit.go .idx-halo { opacity: 0; transition: opacity .4s ease; }
        .idx-disc { position: absolute; inset: 0; border-radius: 50%;
                    background: linear-gradient(135deg, #d2261f 6%, #c0221f 30%, #a32422 55%, #85262a 78%, #6f2529 96%); }
        .idx-bands, .idx-word, .idx-gl { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; overflow: visible; }
        /* the idle float: it bobs gently while in focus (the slow turn to and fro that goes with it is drawn in
           stepGlobe), and holds still under the pointer */
        .idx-float { position: absolute; inset: 0; animation: idxFloat 7s ease-in-out infinite; }
        .idx-float.still { animation-play-state: paused; }
        @keyframes idxFloat { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -9px, 0); } }
        /* what makes the flat logo a ball: a soft light from the upper left and a darker limb on the far side */
        .idx-gloss { position: absolute; inset: 0; border-radius: 50%;
                     background: radial-gradient(60% 55% at 30% 24%, rgba(255,255,255,0.22), rgba(255,255,255,0) 62%),
                                 radial-gradient(90% 90% at 70% 78%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%); }
        .idx-ground { position: absolute; left: -2%; right: -2%; top: 99.2%; height: 5%; border-radius: 50%;
                      background: radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0)); }
        .idx-word { visibility: hidden; opacity: 0; transform: translateY(16px); }
        .idx-unit.go .idx-word { visibility: visible; opacity: 1; transform: none;
                                 transition: opacity .55s ease .38s, transform .8s cubic-bezier(0.22,1,0.36,1) .38s; }

        /* ---------- metal cards ---------- */
        .launch-card {
          container-type: inline-size;
          position: relative; width: 100%; height: 100%;
          border-radius: 20px; overflow: hidden; isolation: isolate;
        }

        .cardface { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
        .cf-metal { position: absolute; inset: 0; }
        /* very fine brushed grain — barely visible */
        .cf-grain {
          position: absolute; inset: 0; opacity: 0.28;
          background: repeating-linear-gradient(100deg,
            rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 0.5px,
            rgba(120,128,136,0.10) 1.5px, rgba(120,128,136,0.10) 2px);
        }
        .cf-content {
          position: absolute; inset: 0; padding: 8.5% 7%; z-index: 2;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .sim { width: 13%; min-width: 34px; height: auto; margin-top: 8.5%; }
        /* the crocodile, top-left like an issuer's mark, in its original colours; the card's sheen passes over it */
        .cf-logo { position: absolute; left: 7cqw; top: 5.4cqw; width: 7.6cqw; height: auto; pointer-events: none; user-select: none; }
        /* cut-in depth: light edge underneath, soft shadow on top — the same pressed-in look as the card text */
        .palladium .cf-logo    { filter: drop-shadow(0 0.22cqw 0 rgba(255,246,214,0.55)) drop-shadow(0 -0.16cqw 0.12cqw rgba(50,34,8,0.4)); }
        .platinum .cf-logo     { filter: drop-shadow(0 0.22cqw 0 rgba(255,255,255,0.75)) drop-shadow(0 -0.16cqw 0.12cqw rgba(40,48,56,0.32)); }
        .coutts .cf-logo       { filter: drop-shadow(0 0.2cqw 0 rgba(255,255,255,0.16)) drop-shadow(0 -0.16cqw 0.14cqw rgba(0,0,0,0.55)); }
        .couttspurple .cf-logo { filter: drop-shadow(0 0.2cqw 0 rgba(240,226,255,0.16)) drop-shadow(0 -0.16cqw 0.14cqw rgba(10,4,20,0.6)); }
        .ivory .cf-logo        { filter: drop-shadow(0 0.2cqw 0 rgba(190,214,248,0.2)) drop-shadow(0 -0.16cqw 0.14cqw rgba(2,6,16,0.6)); }
        .obsidian .cf-logo     { filter: drop-shadow(0 0.2cqw 0 rgba(180,224,202,0.18)) drop-shadow(0 -0.16cqw 0.14cqw rgba(2,10,6,0.6)); }
        .cf-script {
          position: absolute; right: 7%; top: 12%;
          font-family: 'Mrs Saint Delafield', cursive; font-size: calc(clamp(38px, 8.6cqw, 74px) * var(--fit, 1)); white-space: nowrap;
          color: rgba(58,63,69,0.78); line-height: 1;
          text-shadow: 0 1px 0 rgba(255,255,255,0.7), 0 -1px 1px rgba(0,0,0,0.18);
        }
        .cf-foot { display: flex; align-items: baseline; justify-content: space-between; }
        .cf-name {
          font-size: calc(clamp(9px, 2.6cqw, 15px) * var(--fit, 1)); white-space: nowrap; font-weight: 600; letter-spacing: 0.18em; color: rgba(62,68,75,0.8);
          text-shadow: 0 1px 0 rgba(255,255,255,0.65);
        }
        .cf-exp {
          font-size: clamp(7px, 2cqw, 11px); font-weight: 600; letter-spacing: 0.14em; color: rgba(78,84,91,0.75);
          text-shadow: 0 1px 0 rgba(255,255,255,0.6);
        }

        .card-gloss { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity .45s ease; z-index: 3; }
        .card-sheen {
          position: absolute; inset: -30%; pointer-events: none; mix-blend-mode: screen; z-index: 3;
          transition: opacity .45s ease;
          background: linear-gradient(100deg,
            transparent 32%, rgba(255,255,255,0.18) 44%, rgba(255,255,255,0.42) 50%,
            rgba(255,255,255,0.14) 56%, transparent 70%);
        }
        .card-edge {
          position: absolute; inset: 0; border-radius: 20px; padding: 1.4px; pointer-events: none; z-index: 4;
          transition: opacity .4s ease;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }
        .card-edge-blur.on { backdrop-filter: blur(7px) saturate(150%); -webkit-backdrop-filter: blur(7px) saturate(150%); animation: fadeIn .4s ease backwards; }
        .card-edge-blur {
          position: absolute; inset: 0; border-radius: 20px; padding: 7px; pointer-events: none; z-index: 4;
          transition: opacity .4s ease;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }

        /* ---------- leather card holder ---------- */


        .msym { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; direction: ltr; -webkit-font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; transition: font-variation-settings .3s ease, transform .3s ease; }
        .cat-swap { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; overflow: hidden; }
        .cat-swap .glyph { position: absolute; transition: transform .26s cubic-bezier(0.34,1.25,0.64,1), opacity .2s ease; }
        .cat-swap .g-base { transform: scale(1); opacity: 1; }
        .cat-swap .g-hover { transform: scale(0.72); opacity: 0; }
        .cat-swap.on .g-base { transform: scale(1.28); opacity: 0; }
        .cat-swap.on .g-hover { transform: scale(1.18); opacity: 1; font-variation-settings: 'FILL' 1; }
        .ham-btn { transition: border-color .18s ease, color .18s ease; }
        .ham-btn:hover { border-color: var(--c-mute-2) !important; color: var(--c-ink) !important; }
        .ham-btn svg rect { transform-box: fill-box; }
        .ham-btn:hover .l1 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) 0s both; }
        .ham-btn:hover .l2 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) .07s both; }
        .ham-btn:hover .l3 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) .14s both; }
        @keyframes hamSlide {
          0% { transform: translateX(0); }
          46% { transform: translateX(16px); }
          47% { transform: translateX(-16px); }
          100% { transform: translateX(0); }
        }
        .flow-wrap.down { animation: flowDown .34s cubic-bezier(0.4,0,0.2,1) both; }
        .flow-wrap.up { animation: flowUp .34s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes flowDown { from { opacity: 0; transform: translateY(-26px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes flowUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
        .dot-in { animation: dotIn .26s cubic-bezier(0.34,1.35,0.64,1) both; }
        .dot-out { animation: dotOut .22s ease both; }
        @keyframes dotIn { from { opacity: 0; transform: scale(0.2); } 70% { transform: scale(1.25); } to { opacity: 1; transform: scale(1); } }
        @keyframes dotOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.2); } }
        .bk-btn {
          background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.10);
          color: var(--c-mute-2); border-radius: 9px; padding: 4px 11px; font-size: 11.5px;
          font-weight: 600; letter-spacing: 0.04em; cursor: pointer;
          transition: color .18s ease, border-color .18s ease, background .18s ease;
        }
        .bk-btn:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.08); }
        /* recap */
        .recap-link { cursor: pointer; transition: opacity .18s ease, text-shadow .25s ease; }
        .recap-link:hover { opacity: .86; text-shadow: 0 0 22px rgba(255,255,255,0.18); }
        /* the scroll bar's room is always there (scrollbar-gutter) and comes out of the right padding, 22px in all as on the
           left. Before, a list opened under the tiles brought the bar in and every box was squeezed by its 11px */
        .wr-modal { border-radius: 24px; width: min(980px, 94vw); max-height: 90vh; overflow: auto; scrollbar-gutter: stable; padding: 20px 11px 22px 22px; transform-origin: center center;
                    background: radial-gradient(60% 50% at 0% 0%, rgba(61,220,151,0.10), transparent 70%),
                                radial-gradient(50% 60% at 100% 100%, rgba(127,182,224,0.10), transparent 70%), rgba(28,31,35,0.86) !important; }
        .wr-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(132px, auto); gap: 12px; margin-top: 8px; }
        .wr-tile { position: relative; overflow: hidden; border-radius: 18px; padding: 16px 18px;
                   background: radial-gradient(130% 120% at 0% 0%, color-mix(in srgb, var(--acc) 17%, transparent), transparent 62%), rgba(255,255,255,0.035);
                   border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
                   animation: wrIn .6s cubic-bezier(0.22,1,0.36,1) both; transition: transform .25s cubic-bezier(0.22,1,0.36,1), border-color .25s ease, box-shadow .25s ease; }
        .wr-tile:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--acc) 40%, rgba(255,255,255,0.08)); }
        .wr-tile.wr-hero { grid-column: span 2; grid-row: span 2; display: flex; flex-direction: column; padding: 20px 22px 16px;
                   background: radial-gradient(90% 80% at 0% 0%, color-mix(in srgb, var(--acc) 24%, transparent), transparent 65%),
                               radial-gradient(70% 70% at 100% 100%, rgba(127,182,224,0.14), transparent 70%), rgba(255,255,255,0.04); }
        .wr-tile.wr-wide { grid-column: span 2; }
        .wr-tile.wr-row { display: flex; align-items: center; gap: 14px; }
        .wr-ico { font-size: 15px !important; color: var(--acc); }
        @keyframes wrIn { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        .wr-bars { margin-top: auto; padding-top: 18px; display: flex; align-items: stretch; gap: 3px; height: 150px; }
        .wr-bar-col { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; padding-bottom: 16px; }
        .wr-bar-half { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
        .wr-bar-half.down { align-items: flex-start; border-top: 1px solid rgba(255,255,255,0.12); }
        .wr-bar { display: block; width: 100%; max-width: 22px; border-radius: 5px; animation: wrGrow .7s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-bar.up { background: linear-gradient(180deg, #7ef0bd, var(--c-green)); transform-origin: bottom; border-radius: 5px 5px 2px 2px; }
        .wr-bar.dn { background: linear-gradient(0deg, #ff97a0, var(--c-red)); transform-origin: top; border-radius: 2px 2px 5px 5px; }
        .wr-bar.none { height: 3px; background: rgba(255,255,255,0.10); animation: none; margin-top: -2px; }
        @keyframes wrGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .wr-bar-lbl { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--c-mute); }
        .wr-bars { position: relative; }
        .wr-bar-col { cursor: default; transition: opacity .2s ease; }
        .wr-bar-tip { position: absolute; top: 0; transform: translate(-50%, -60%); z-index: 3; pointer-events: none;
                      display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 11px; border-radius: 10px;
                      background: rgba(24,27,31,0.92); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 8px 22px rgba(0,0,0,0.4);
                      white-space: nowrap; animation: tipIn .16s ease both; transition: left .18s cubic-bezier(0.22,1,0.36,1); }
        @keyframes tipIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -60%); } }
        .wr-tile.clickable { cursor: pointer; }
        .wr-tile.active { border-color: color-mix(in srgb, var(--acc) 65%, transparent);
                          box-shadow: 0 0 0 1px color-mix(in srgb, var(--acc) 35%, transparent), 0 10px 30px color-mix(in srgb, var(--acc) 14%, transparent); }
        .wr-more { position: absolute; top: 14px; right: 14px; font-size: 16px !important; color: var(--c-mute); opacity: 0;
                   transform: translate(-4px, 4px); transition: opacity .2s ease, transform .25s cubic-bezier(0.22,1,0.36,1), color .2s ease; }
        .wr-tile.clickable:hover .wr-more, .wr-tile.active .wr-more { opacity: 1; transform: none; color: var(--acc); }
        .wr-stack-seg, .wr-leg { cursor: pointer; }
        .wr-leg { transition: color .15s ease; }
        .wr-leg:hover { color: var(--c-ink); }
        .wr-detail { border-radius: 18px; padding: 16px 18px 12px; border: 1px solid rgba(255,255,255,0.08);
                     background: radial-gradient(90% 140% at 0% 0%, color-mix(in srgb, var(--acc) 12%, transparent), transparent 60%), rgba(255,255,255,0.03); }
        .wr-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
        .wr-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 5px 10px; border-radius: 99px; cursor: pointer;
                   background: none; color: var(--c-mute-2); border: 1px solid rgba(255,255,255,0.1); transition: color .18s ease, background-color .18s ease, border-color .18s ease, box-shadow .18s ease; }
        .wr-chip:hover { color: var(--c-ink); }
        .wr-chip.on { color: var(--acc); border-color: color-mix(in srgb, var(--acc) 55%, transparent); background: color-mix(in srgb, var(--acc) 10%, transparent); }
        .wr-seg { display: inline-flex; padding: 2px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
        .wr-seg button { background: none; border: none; color: var(--c-mute-2); font-size: 12px; padding: 4px 10px; border-radius: 8px; cursor: pointer; transition: color .18s ease, background-color .18s ease, border-color .18s ease, box-shadow .18s ease; }
        .wr-seg button.on { background: rgba(255,255,255,0.1); color: var(--c-ink); }
        /* the same switch with a grey box that slides between the choices (SlideSeg) */
        .wr-seg.slide { position: relative; }
        .wr-seg.slide button { position: relative; z-index: 1; }
        .wr-seg.slide button.on { background: none; }
        .seg-box, .seg-fill { position: absolute; left: 0; width: 100%; border-radius: 8px; will-change: transform; }
        .seg-box { top: 2px; bottom: 2px; overflow: hidden; pointer-events: none; }
        .seg-fill { top: 0; bottom: 0; background: rgba(255,255,255,0.1); }
        .wr-seg.slide.go .seg-box, .wr-seg.slide.go .seg-fill { transition: transform .34s var(--ease-soft); }
        /* Wins / Losses on the ring (6 October 2026: two boxes with a border each, which he wanted better looking): one switch,
           its box sliding between the two and going from a green wash to a red one on the way. The two washes lie on each
           other and cross-fade (--loss, 0 or 1), so only transforms and opacity move */
        .wr-seg.ring-sw { padding: 3px; border-radius: 11px; background: rgba(255,255,255,0.035); border-color: rgba(255,255,255,0.07); }
        .ring-sw button { display: inline-flex; align-items: center; justify-content: center; padding: 5px 13px; color: var(--c-mute); border-radius: 8px; }
        .ring-sw button .msym { font-size: 18px; }
        .ring-sw button:hover { color: var(--c-ink-2); }
        .ring-sw button:first-of-type.on { color: #86e3ba; }
        .ring-sw button:last-of-type.on { color: #ff9ea7; }
        .ring-sw .seg-box { top: 3px; bottom: 3px; }
        /* the debts' I owe / Owed to me switch: the same sliding box, red under "I owe" and green under "Owed to me",
           one wash fading into the other while it slides */
        .debt-seg button { transition: color .3s ease; }
        .debt-seg button:first-of-type.on { color: var(--c-red-pale); }
        .debt-seg button:last-of-type.on { color: var(--c-green-pale); }
        .debt-seg .seg-fill { background: none; }
        .debt-seg .seg-fill::before, .debt-seg .seg-fill::after { content: ""; position: absolute; inset: 0; border-radius: 8px; transition: opacity .34s ease; }
        .debt-seg .seg-fill::before { background: rgba(255,93,108,0.17); opacity: var(--owe, 1); }
        .debt-seg .seg-fill::after { background: rgba(61,220,151,0.16); opacity: calc(1 - var(--owe, 1)); }
        .ring-sw .seg-fill { background: none; }
        .ring-sw .seg-fill::before, .ring-sw .seg-fill::after { content: ""; position: absolute; inset: 0; border-radius: 8px; transition: opacity .34s ease; }
        .ring-sw .seg-fill::before { background: rgba(61,220,151,0.15); opacity: calc(1 - var(--loss, 0)); }
        .ring-sw .seg-fill::after { background: rgba(255,93,108,0.15); opacity: var(--loss, 0); }
        .wr-list { display: flex; flex-direction: column; }
        .wr-li { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 8px 2px;
                 border-top: 1px solid rgba(255,255,255,0.05); animation: fadeRight .36s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-li:first-child { border-top: none; }
        .wr-li-rank { font-size: 12px; font-weight: 800; color: var(--c-mute); text-align: center; font-variant-numeric: tabular-nums; }
        .wr-li-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .wr-li-name { font-size: 13.5px; font-weight: 600; color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wr-li-track { height: 5px; border-radius: 99px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .wr-li-fill { display: block; height: 100%; border-radius: 99px; transform-origin: left; animation: wrGrowX .6s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-li-val { display: flex; flex-direction: column; align-items: flex-end; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .wr-li-sub { font-size: 11px; font-weight: 500; color: var(--c-mute); margin-top: 1px; }
        .wr-two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        @media (max-width: 760px) { .wr-two { grid-template-columns: 1fr; } }
        .wr-ring { animation: wrRing 1.1s cubic-bezier(0.22,1,0.36,1) .4s both; }
        @keyframes wrRing { from { stroke-dashoffset: var(--ring-c); } to { stroke-dashoffset: var(--ring-off); } }
        .wr-cat-ico { width: 46px; height: 46px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .wr-stack { display: flex; height: 10px; border-radius: 99px; overflow: hidden; margin-top: 14px; background: rgba(255,255,255,0.06); gap: 2px; }
        .wr-stack-seg { display: block; height: 100%; transform-origin: left; animation: wrGrowX .7s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes wrGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .wr-tile i { display: inline-block; width: 8px; height: 8px; border-radius: 3px; margin-right: 6px; }
        @media (max-width: 760px) {
          .wr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wr-tile.wr-hero, .wr-tile.wr-wide { grid-column: span 2; }
        }
        /* goals */
        .goal-row { display: grid; grid-template-columns: 60px minmax(0, 1fr); column-gap: 16px; align-items: center; }
        .goal-row > .goal-ring { grid-row: 1 / span 3; align-self: start; margin-top: 4px; }
        /* a debt's row has no ring: left in the goals' two columns, its name and amount were squeezed into the ring's
           60px and its bar took the place of the text */
        .goal-row.debt-row { display: block; }
        .goal-ring { position: relative; width: 60px; height: 60px; display: block; }
        .goal-lines { display: flex; flex-direction: column; gap: 3px; margin-top: 2px; padding-left: 2px; min-width: 0; }
        .goal-amt { font-size: 13.5px; font-weight: 600; color: var(--c-ink-1); font-variant-numeric: tabular-nums; }
        .goal-amt span { color: var(--c-mute); font-weight: 500; }
        .goal-pred { font-size: 12.5px; color: var(--c-mute-2); }
        .goal-pred b { color: var(--c-ink-2); font-weight: 600; }
        .goal-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
        .goal-arc { transition: stroke-dasharray .6s cubic-bezier(0.22,1,0.36,1); }
        .goal-ring-n { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800;
                       color: var(--c-ink); font-variant-numeric: tabular-nums; }
        .goal-row { padding: 11px 2px 11px; border-bottom: 1px solid rgba(255,255,255,0.06); animation: fadeDown .42s cubic-bezier(0.22,1,0.36,1) backwards; }
        .goal-row.leaving { animation: goalOut .26s ease both; }
        @keyframes goalOut { to { opacity: 0; transform: translateX(14px); } }
        .goal-track { flex: 1; height: 9px; border-radius: 99px; background: rgba(255,255,255,0.07); overflow: hidden;
                      box-shadow: inset 0 1px 2px rgba(0,0,0,0.35); }
        .goal-fill { width: 100%; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #4f8fd6 var(--gs, 0%), #7fb6e0);
                     box-shadow: 0 0 12px rgba(127,182,224,0.35); will-change: transform;
                     transition: transform .9s cubic-bezier(0.32,0.72,0.24,1), background .4s ease; }
        .goal-fill.done { background: linear-gradient(90deg, var(--c-green) var(--gs, 0%), #8ff0c4); box-shadow: 0 0 12px rgba(61,220,151,0.35); }
        .goal-icon-btn { background: none; border: none; color: #aab1b8; cursor: pointer; padding: 6px; line-height: 0;
                         border-radius: 8px; transition: color .15s ease, background .15s ease; }
        .goal-icon-btn:hover { color: var(--c-ink); background: rgba(255,255,255,0.07); }
        .goal-icon-btn.del:hover { color: var(--c-red-dim); }
        .goal-act.add { color: var(--c-green-soft); }
        .goal-new { display: inline-flex; align-items: center; gap: 6px; margin: 12px 0 4px; background: none;
                    border: 1px dashed rgba(255,255,255,0.16); color: var(--c-ink-3); border-radius: 10px; padding: 7px 12px;
                    font-size: 12.5px; cursor: pointer; transition: color .15s ease, border-color .15s ease, background .15s ease; }
        .goal-new:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); }
        /* month-end projection (money flow, above the insights) */
        .proj-box { margin-top: 14px; border-radius: 14px; background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07); padding: 2px 12px 12px;
                    animation: bdItemIn .4s cubic-bezier(0.4,0,0.2,1) .2s backwards; }
        /* the header of a section inside a card (SecHead): a symbol, the name, and at the right what it comes to. The
           Projection's and the Insights' own, now Debts' and Planned's too. The two boxes keep the room they had round
           it; Debts and Planned stand under a line of their own, so theirs has none on top */
        .sec-head { display: flex; align-items: center; gap: 8px; padding: 11px 0 9px; }
        .sec-head .msym { font-size: 18px; color: var(--c-ink-2); }
        .sec-t { font-size: 11.5px; font-weight: 700; color: var(--c-ink-3); text-transform: uppercase; letter-spacing: 0.14em; }
        .sec-r { margin-left: auto; font-size: 12px; color: var(--c-mute); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ins-box .sec-head { padding-bottom: 11px; }
        .debt-sec .sec-head { padding: 0 0 12px; }
        .wp .sec-head { padding: 0 0 9px; }
        .proj-main { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; padding: 0 2px; }
        .proj-num { font-size: 27px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.1; }
        .proj-cap { font-size: 13.5px; color: #aeb5bb; }
        .proj-range { font-size: 12.5px; color: var(--c-mute-2); font-variant-numeric: tabular-nums; }
        @keyframes projWipe { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .proj-legend { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 8px 2px 0;
                       font-size: 12.5px; color: var(--c-ink-3); font-variant-numeric: tabular-nums; }
        .proj-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .proj-legend i { width: 14px; height: 10px; border-radius: 3px; }
        .proj-legend i.done { height: 2px; border-radius: 2px; background: var(--c-ink); }
        .proj-legend i.todo { height: 2px; background: repeating-linear-gradient(90deg, var(--c-ink) 0 2px, transparent 2px 6px); }
        .proj-legend i.cone { opacity: 0.22; }
        .proj-legend i.bill { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--c-red-soft); box-sizing: border-box; }
        .proj-plot { margin: 10px 0 0; }
        .pj-wipe { transform-box: fill-box; transform-origin: left center; animation: flowWipe .8s cubic-bezier(0.45,0,0.15,1) 1s backwards; }
        .pj-now { animation: axisIn .3s ease .95s backwards; }
        .pj-end { animation: flowTagIn .4s cubic-bezier(0.22,1,0.36,1) 1.65s backwards; }
        .proj-rec { display: flex; align-items: center; gap: 7px; margin: 11px 2px 0; font-size: 12px; color: var(--c-mute-2); font-variant-numeric: tabular-nums; }
        .proj-rec .msym { font-size: 15px; color: var(--c-mute); }
        .proj-rec b { color: var(--c-ink-2); font-weight: 600; }
        .proj-legend b { color: var(--c-ink); font-weight: 600; }
        /* the projection's figures: a name over each, in a row under a hairline, as the trade view sets its own
           (.jv-grid gives the row, the hairline and the type). They come in one after the other as the tiles did. The
           name and the unit keep the greys they had here; a long note (the names of the bills) is cut off, its full
           text is in the tooltip */
        .proj-tile { max-width: 240px; animation: subBoxIn .38s cubic-bezier(0.34,1.15,0.64,1) backwards; }
        .proj-tile .jv-k { font-size: 10.5px; color: var(--c-mute); }
        .proj-tile .jv-s { font-size: 12px; font-weight: 600; color: var(--c-mute-2); }
        .proj-tile-note { font-size: 12px; color: var(--c-mute-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* insights drop-down */
        .ins-box { margin-top: 14px; border-radius: 14px; background: rgba(255,255,255,0.03);
                   border: 1px solid rgba(255,255,255,0.07); padding: 2px 12px; }
        .ins-more { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: none; border: none;
                    border-top: 1px solid rgba(255,255,255,0.05); cursor: pointer; padding: 10px 0; color: var(--c-ink-3); font: inherit;
                    font-size: 12.5px; font-weight: 600; transition: color .16s ease; }
        .ins-more:hover, .ins-more:hover .plain-arrow { color: var(--c-ink); }
        .ins-count { font-size: 11px; font-weight: 700; color: #1e2124; background: var(--c-ink-2); border-radius: 99px;
                     padding: 1px 7px; line-height: 16px; }
        .ins-row { display: flex; align-items: flex-start; gap: 11px; padding: 9px 0;
                   border-top: 1px solid rgba(255,255,255,0.05); animation: fadeRight .38s cubic-bezier(0.22,1,0.36,1) both; }
        .ins-ico { flex-shrink: 0; width: 28px; height: 28px; border-radius: 9px; display: inline-flex;
                   align-items: center; justify-content: center; }
        .goal-name-text { cursor: text; border-radius: 5px; padding: 1px 3px; margin: -1px -3px; position: relative;
                          transition: background .15s ease, color .2s ease; }
        .goal-name-text:hover { background: rgba(255,255,255,0.06); }
        /* completed: a thin strike that draws itself across the name */
        .goal-name-text.done, .debt-name.done { color: var(--c-ink-3); }
        .debt-name { position: relative; padding: 1px 3px; margin: -1px -3px; }
        /* debts: a section of the Goals card, under the goals */
        .debt-sec { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--c-line); }
        .debt-group { display: flex; align-items: center; gap: 8px; margin: 12px 2px 0; font-size: 11px; font-weight: 700; letter-spacing: .12em;
                      text-transform: uppercase; color: var(--c-mute-2); }
        .debt-group i { width: 7px; height: 7px; border-radius: 99px; }
        .goal-name-text.done::after, .debt-name.done::after { content: ""; position: absolute; left: 3px; right: 3px; top: 52%; height: 1.5px; border-radius: 1px;
                                      background: rgba(232,234,236,0.75); transform-origin: left; animation: strikeIn .5s cubic-bezier(0.22,1,0.36,1) .15s both; }
        @keyframes strikeIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .goal-name-input { font: inherit; color: var(--c-ink); background: rgba(255,255,255,0.06); border: 1px solid rgba(127,182,224,0.55);
                           border-radius: 7px; padding: 2px 7px; outline: none; min-width: 6ch; max-width: 320px;
                           box-shadow: 0 0 0 3px rgba(127,182,224,0.12); animation: fadeIn .15s ease; }
        .goal-done-box { margin-top: 10px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.025); padding: 0 12px; }
        .goal-done-head { width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer;
                          padding: 10px 0; color: var(--c-ink-3); font-size: 12.5px; font-weight: 600; }
        .goal-done-head:hover { color: var(--c-ink); }
        .goal-done-head:hover .plain-arrow { color: var(--c-ink); }
        .goal-done-count { font-size: 11px; font-weight: 700; color: #1e2124; background: var(--c-green-soft); border-radius: 99px; padding: 1px 7px; line-height: 16px; }
        .goal-done-box .goal-row:last-child { border-bottom: none; }
        .goal-sym-wrap { position: relative; display: inline-flex; }
        .goal-sym { background: none; border: none; padding: 0; margin: 0; cursor: pointer; line-height: 0; color: var(--c-ink-2);
                    transition: color .18s ease, transform .25s cubic-bezier(0.34,1.4,0.64,1); }
        .goal-sym:hover, .goal-sym.open { color: #ffffff; transform: scale(1.12); }
        .goal-sym-ico { font-size: 21px; animation: symIn .38s cubic-bezier(0.34,1.4,0.64,1) both; }
        @keyframes symIn { from { opacity: 0; transform: scale(.4) rotate(-20deg); } to { opacity: 1; transform: none; } }
        .goal-sym-pop { position: absolute; top: calc(100% + 8px); left: -8px; z-index: 30; width: 318px; padding: 8px; border-radius: 14px;
                        display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; animation: fadeDown .22s cubic-bezier(0.22,1,0.36,1) both;
                        box-shadow: 0 14px 34px rgba(0,0,0,0.45);
                        background: rgba(30,33,37,0.97) !important; border: 1px solid rgba(255,255,255,0.10); }
        .goal-sym-pop.up { top: auto; bottom: calc(100% + 8px); animation-name: fadeUpPop; }
        @keyframes fadeUpPop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .goal-sym-opt { height: 34px; border: none; border-radius: 9px; background: none; color: var(--c-ink-3); cursor: pointer;
                        display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s ease, color .15s ease; }
        .goal-sym-opt:hover { background: rgba(255,255,255,0.08); color: var(--c-ink); }
        .goal-sym-opt.on { background: rgba(127,182,224,0.16); color: #7fb6e0; }
        .goal-sym-opt.auto { grid-column: 1 / -1; justify-content: flex-start; padding: 0 10px; font-size: 12.5px; font-weight: 600; margin-bottom: 3px;
                             border-bottom: 1px solid rgba(255,255,255,0.06); border-radius: 9px 9px 0 0; }
        .goal-io, .goal-save { width: 38px; height: 38px; flex-shrink: 0; box-sizing: border-box; padding: 0; border-radius: 11px;
                    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                    transition: background .18s ease, border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
        .goal-io .msym { font-size: 20px; transition: transform .25s cubic-bezier(0.34,1.4,0.64,1); }
        .goal-io.in  { color: var(--c-green); background: rgba(61,220,151,0.10); border: 1px solid rgba(61,220,151,0.32); }
        .goal-io.out { color: var(--c-red); background: rgba(255,93,108,0.08); border: 1px solid rgba(255,93,108,0.30); }
        .goal-io.in:hover  { background: rgba(61,220,151,0.18); border-color: rgba(61,220,151,0.6); box-shadow: 0 0 16px rgba(61,220,151,0.22); }
        .goal-io.out:hover { background: rgba(255,93,108,0.15); border-color: rgba(255,93,108,0.55); box-shadow: 0 0 16px rgba(255,93,108,0.2); }
        .goal-io.in:hover .msym  { transform: translateY(2px); }
        .goal-io.out:hover .msym { transform: translateY(-2px); }
        .goal-io:active, .goal-save:active { transform: scale(0.94); }
        .goal-save { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center;
                     cursor: pointer; color: var(--c-green); background: rgba(61,220,151,0.10); border: 1px solid rgba(61,220,151,0.32);
                     box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                     transition: background .18s ease, border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
        .goal-save:hover { background: rgba(61,220,151,0.18); border-color: rgba(61,220,151,0.6); box-shadow: 0 0 16px rgba(61,220,151,0.25), inset 0 1px 0 rgba(255,255,255,0.1); }
        .goal-save:hover .msym { transform: scale(1.12); }
        .goal-save:active { transform: scale(0.94); }
        .nospend-tag { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--c-green-pale);
                       background: rgba(61,220,151,0.12); border: 1px solid rgba(61,220,151,0.25); border-radius: 99px; padding: 2px 8px; margin-top: 2px; }
        .nospend-row { background: rgba(61,220,151,0.06) !important; border-color: rgba(61,220,151,0.2) !important; gap: 10px; align-items: center; }
        .limit-label { background: none; border: none; padding: 4px 6px; margin: 0 -2px 0 0; border-radius: 7px; cursor: pointer;
                       user-select: none; transition: color .15s ease, background .15s ease; }
        .limit-label:hover { color: var(--c-ink) !important; background: rgba(255,255,255,0.05); }
        .limit-label:active { transform: scale(0.97); }
        .limit-flash { position: absolute; right: 0; bottom: calc(100% + 4px); font-size: 11.5px; font-weight: 600; color: var(--c-green-soft); white-space: nowrap;
                       animation: limitFlash 2.4s cubic-bezier(0.22,1,0.36,1) both; pointer-events: none; }
        @keyframes limitFlash { 0% { opacity: 0; transform: translateY(4px); } 12% { opacity: 1; transform: none; }
                                78% { opacity: 1; } 100% { opacity: 0; } }
        /* test-data settings pop-up */
        .tcfg-modal { border-radius: 24px; width: min(640px, 94vw); max-height: 90vh; overflow: auto; padding: 20px 22px 18px; transform-origin: center center;
                      background: radial-gradient(70% 50% at 0% 0%, rgba(227,205,119,0.08), transparent 70%), rgba(30,33,37,0.72) !important; }
        .tcfg-sub { font-size: 12.5px; color: var(--c-mute-2); margin: -2px 0 12px; line-height: 1.45; }
        .tcfg-sec { padding: 12px 0 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .tcfg-h { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; color: var(--c-ink-3); letter-spacing: .14em; text-transform: uppercase; margin-bottom: 8px; }
        .tcfg-h .msym { font-size: 16px; color: var(--c-ink-2); }
        .tcfg-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; flex-wrap: wrap; }
        .tcfg-lbl { font-size: 13.5px; color: var(--c-ink-2); }
        .tcfg-ctl { display: inline-flex; align-items: center; gap: 8px; }
        .tcfg-to { font-size: 12px; color: var(--c-mute); }
        .tcfg-err { font-size: 12px; color: var(--c-red-soft); margin: -2px 0 4px; text-align: right; }
        .tcfg-num { display: inline-flex; align-items: center; height: 34px; border-radius: 10px; background: rgba(24,27,31,0.6);
                    border: 1px solid rgba(255,255,255,0.10); overflow: hidden; transition: border-color .15s ease, box-shadow .15s ease; }
        .tcfg-num:focus-within { border-color: rgba(127,182,224,0.6); box-shadow: 0 0 0 3px rgba(127,182,224,0.12); }
        .tcfg-num.bad { border-color: rgba(255,93,108,0.6); }
        .tcfg-num button { width: 28px; height: 100%; background: none; border: none; color: var(--c-ink-3); cursor: pointer; font-size: 16px; transition: color .15s, background .15s; }
        .tcfg-num button:hover { color: var(--c-ink); background: rgba(255,255,255,0.06); }
        .tcfg-num.wide input { width: 58px; }
        .tcfg-num input { width: 42px; background: none; border: none; outline: none; color: var(--c-ink); font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .tcfg-unit { font-size: 12px; color: var(--c-mute-2); margin: 0 4px 0 3px; }
        .tcfg-seg { display: inline-flex; padding: 2px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
        .tcfg-seg button { background: none; border: none; color: var(--c-mute-2); font-size: 12.5px; padding: 6px 11px; border-radius: 9px; cursor: pointer; transition: color .18s ease, background-color .18s ease, border-color .18s ease, box-shadow .18s ease; white-space: nowrap; }
        .tcfg-seg button:hover { color: var(--c-ink); }
        .tcfg-seg button.on { background: rgba(255,255,255,0.12); color: #ffffff; box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.25); }
        .tcfg-styles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
        .tcfg-style { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; column-gap: 9px; row-gap: 2px; text-align: left;
                      padding: 10px 12px; border-radius: 13px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
                      color: inherit; transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s var(--ease-soft); }
        .tcfg-style:hover { background: rgba(255,255,255,0.06); transform: translateY(-1px); }
        .tcfg-style.on { border-color: rgba(227,205,119,0.6); background: rgba(227,205,119,0.08); box-shadow: 0 0 0 1px rgba(227,205,119,0.25); }
        .tcfg-style-ico { grid-row: 1 / span 3; font-size: 20px !important; color: var(--c-ink-3); margin-top: 1px; transition: color .18s ease; }
        .tcfg-style.on .tcfg-style-ico { color: var(--c-gold); }
        .tcfg-style-name { font-size: 13.5px; font-weight: 700; color: var(--c-ink); }
        .tcfg-style-desc { font-size: 11.5px; color: var(--c-mute-2); line-height: 1.35; }
        .tcfg-style-est { font-size: 11px; color: var(--c-red-soft); margin-top: 2px; font-variant-numeric: tabular-nums; }
        .tcfg-switch { width: 42px; height: 24px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); position: relative; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
        .tcfg-switch span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--c-ink-2); transition: transform .25s cubic-bezier(0.34,1.4,0.64,1), background .2s; }
        .tcfg-switch.on { background: rgba(61,220,151,0.35); border-color: rgba(61,220,151,0.55); }
        .tcfg-switch.on span { transform: translateX(18px); background: #ffffff; }
        /* the developer options: sections that fold, the day calendar, the small boxes */
        .tcfg-sec.fold { padding: 0; }
        .tcfg-fold { width: 100%; display: flex; align-items: center; gap: 9px; padding: 13px 2px; background: none; border: none; color: inherit; cursor: pointer; text-align: left; font-family: inherit; }
        .tcfg-fold > .msym { font-size: 18px; color: var(--c-ink-2); }
        .tcfg-fold-t { font-size: 14px; font-weight: 700; color: var(--c-ink); white-space: nowrap; }
        .tcfg-fold-s { flex: 1; min-width: 0; text-align: right; font-size: 12.5px; color: var(--c-mute-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                       font-variant-numeric: tabular-nums; transition: color .15s ease; }
        .tcfg-fold:hover .tcfg-fold-s, .tcfg-fold:hover .plain-arrow { color: var(--c-ink); }
        .tcfg-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s cubic-bezier(0.4,0,0.2,1); }
        .tcfg-body.open { grid-template-rows: 1fr; }
        .tcfg-body > div { min-height: 0; overflow-x: visible; overflow-y: clip; }
        .tcfg-pad { padding: 0 2px 12px; opacity: 0; transform: translateY(-8px); transition: opacity .2s ease, transform .28s cubic-bezier(0.4,0,0.2,1); }
        .tcfg-body.open .tcfg-pad { opacity: 1; transform: none; }
        .tcfg-note { display: block; font-size: 11.5px; color: var(--c-mute); margin-top: 1px; }
        .tcfg-num.sm { height: 30px; border-radius: 9px; }
        .tcfg-num.sm input { width: 44px; padding: 0 7px 0 4px; font-size: 13px; }
        .tcfg-num.sm .tcfg-unit { margin: 0 8px 0 -2px; white-space: nowrap; }
        .tcfg-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin: 6px 0 8px; }
        .tcfg-cal button, .tcfg-dows button, .tcfg-mini { height: 30px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: var(--c-mute-2);
                       font: 600 12.5px Inter, sans-serif; font-variant-numeric: tabular-nums; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .tcfg-cal button:hover, .tcfg-dows button:hover, .tcfg-mini:hover { color: var(--c-ink); background: rgba(255,255,255,0.08); }
        .tcfg-cal button.on, .tcfg-dows button.on { color: #1a1d20; background: var(--c-gold); border-color: rgba(255,255,255,0.3); }
        .tcfg-cal button.on:hover, .tcfg-dows button.on:hover { color: #1a1d20; background: #ecd98a; }
        .tcfg-dows { display: inline-flex; gap: 5px; }
        .tcfg-dows button { padding: 0 9px; }
        .tcfg-mini { height: 26px; padding: 0 10px; font-size: 12px; }
        .tcfg-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
        .tcfg-est { font-size: 12.5px; color: var(--c-ink-3); }
        .tcfg-go { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700;
                   color: #1a1d20; background: linear-gradient(180deg, #f0dc8e, var(--c-gold)); border: 1px solid rgba(255,255,255,0.3);
                   box-shadow: 0 6px 18px rgba(227,205,119,0.25), inset 0 1px 0 rgba(255,255,255,0.5); transition: transform .15s ease, filter .15s ease, opacity .15s; }
        .tcfg-go:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .tcfg-go:active { transform: scale(0.97); }
        .tcfg-go:disabled { opacity: .4; cursor: not-allowed; transform: none; }
        .bk-btn.test { color: var(--c-gold); border-color: rgba(227,205,119,0.3); }
        /* the footer's buttons are symbols: no border, the same highlight under the pointer */
        .bk-btn.ico { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0; border-color: transparent; background: none; }
        .bk-btn.ico:hover { border-color: transparent; background: rgba(255,255,255,0.08); }
        .bk-btn.ico .msym { font-size: 17px; }
        /* the note above a footer symbol: small, solid, and only moved and faded (it is always there) */
        .bk-btn.ico { position: relative; }
        .bk-tip { position: absolute; left: -5px; bottom: calc(100% + 8px); z-index: 30; padding: 6px 10px 7px; border-radius: 9px; white-space: nowrap; text-align: left; pointer-events: none;
                  font-size: 11px; font-weight: 500; letter-spacing: 0; line-height: 1.4; color: var(--c-ink-3); background: #1c1f23;
                  box-shadow: 0 10px 26px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.09);
                  opacity: 0; transform: translateY(4px); transition: opacity .14s ease, transform .2s var(--ease); }
        .bk-tip b { display: block; font-size: 11.5px; font-weight: 700; color: var(--c-ink-hi); }
        .bk-btn.ico:hover .bk-tip, .bk-btn.ico:focus-visible .bk-tip { opacity: 1; transform: translateY(0); transition-delay: .22s; }
        /* the note that offers Undo after a delete: the footer note's own solid fill, always there, only moved and
           faded (transitions, so a second delete half-way carries on from where it is) */
        .undo-note { position: fixed; left: 50%; bottom: 22px; z-index: 90; display: flex; align-items: center; gap: 12px; padding: 7px 7px 7px 15px; border-radius: 12px;
                     font-size: 12.5px; font-weight: 500; line-height: 1.4; white-space: nowrap; color: var(--c-ink-3); background: #1c1f23;
                     box-shadow: 0 12px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.09);
                     opacity: 0; transform: translate(-50%, 10px); pointer-events: none; transition: opacity .2s ease, transform .3s var(--ease); }
        .undo-note.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
        .undo-note b { display: inline-block; max-width: 240px; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; font-weight: 600; color: var(--c-ink-hi); }
        .undo-note .un-b { padding: 5px 12px; border: 0; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--c-ink-hi); background: rgba(255,255,255,0.09); cursor: pointer; transition: background .16s ease; }
        .undo-note .un-b:hover { background: rgba(255,255,255,0.16); }
        /* the names of the columns over the rows of the Coins / Stocks card */
        .bd-head span { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-mute); text-align: right; white-space: nowrap; }
        .bd-head span:first-child { text-align: left; }
        /* the settings pop-up: a line per setting, its name and a word on it on the left, what sets it on the right */
        .set-modal { border-radius: 20px; width: min(450px, 92vw); max-height: 88vh; overflow: auto; padding: 20px 22px 10px; transform-origin: center center; }
        .set-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 13px 0; border-top: 1px solid rgba(255,255,255,0.06); }
        .set-k { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .set-k b { font-size: 13.5px; font-weight: 600; color: var(--c-ink); }
        .set-k small { font-size: 11.5px; line-height: 1.4; color: var(--c-mute); }
        .set-v { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; font-size: 12.5px; color: var(--c-mute-2); }
        .set-v i { font-style: normal; min-width: 30px; }
        .set-in { width: 124px; text-align: right; }
        .set-modal .wr-seg { flex-shrink: 0; }
        /* split bill (BillSplit): the settings' pop-up, wider */
        .set-modal.sb { width: min(560px, 94vw); padding-bottom: 20px; }
        .sb-top { display: flex; gap: 10px; align-items: flex-end; margin-top: 6px; }
        .sb-f { display: flex; flex-direction: column; gap: 6px; }
        .sb-f.grow { flex: 1; min-width: 0; }
        .sb-f > span, .sb-cols span, .sb-tile span { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-mute); }
        .sb-head { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 10px; min-height: 28px;
                   font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-ink-3); }
        .sb-step { display: inline-flex; align-items: center; gap: 4px; }
        .sb-step button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border-radius: 9px; cursor: pointer;
                          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: var(--c-ink-2);
                          transition: background .18s ease, border-color .18s ease, color .18s ease, opacity .18s ease; }
        .sb-step button:hover:not(:disabled) { color: #ffffff; border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.10); }
        .sb-step button:disabled { opacity: 0.35; cursor: default; }
        .sb-step .msym { font-size: 17px; }
        .sb-step b { min-width: 28px; text-align: center; font-size: 14px; letter-spacing: 0; color: var(--c-ink); font-variant-numeric: tabular-nums; }
        .sb-cols, .sb-row { display: grid; grid-template-columns: minmax(0, 1fr) 150px 40px 124px; gap: 8px; align-items: center; }
        .sb-cols { margin-bottom: 6px; padding: 0 2px; }
        .sb-cols span:last-child, .sb-pay { text-align: right; }
        .sb-person { margin-bottom: 8px; animation: fadeDown .22s ease backwards; }
        .sb-pay { font-size: 14px; font-weight: 700; color: var(--c-ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; padding-right: 2px; }
        .sb-pay.me { color: #ffffff; }
        .sb-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }
        .sb-tile { border-radius: 13px; padding: 10px 13px 11px; min-width: 0; }
        .sb-tile b { display: block; margin-top: 4px; font-size: 19px; font-weight: 800; color: var(--c-ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-tile.key b { color: #ffffff; }
        .sb-note { margin-top: 12px; font-size: 12.5px; line-height: 1.45; color: var(--c-red-soft); }
        /* service and tax as a % or an amount, and what only some of them had (13 October 2026) */
        .sb-rate { width: 132px; flex-shrink: 0; }
        .sb-rate > span { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .sb-unit, .sb-how { flex-shrink: 0; }
        .sb-unit button { padding: 1px 7px; font-size: 10.5px; font-weight: 600; letter-spacing: 0; text-transform: none; }
        .sb-how button { padding: 5px 9px; font-size: 11.5px; white-space: nowrap; }
        .amt-field.auto::placeholder { color: var(--c-mute-hi); }           /* a figure worked out for him, not a hint: it has to be read */
        .sb-more, .sb-x { display: inline-flex; align-items: center; justify-content: center; height: 28px; padding: 0; border-radius: 9px; cursor: pointer;
                          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: var(--c-ink-2);
                          transition: background .18s ease, border-color .18s ease, color .18s ease, opacity .18s ease; }
        .sb-more { gap: 3px; padding: 0 11px 0 7px; font-size: 11.5px; font-weight: 600; letter-spacing: 0; text-transform: none; }
        .sb-x { width: 28px; }
        .sb-more:hover:not(:disabled), .sb-x:hover { color: #ffffff; border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.10); }
        .sb-more:disabled { opacity: 0.35; cursor: default; }
        .sb-more .msym, .sb-x .msym { font-size: 16px; }
        .sb-item { margin-bottom: 14px; padding-left: 11px; border-left: 2px solid rgba(255,255,255,0.12); animation: fadeDown .22s ease backwards; }
        .sb-irow { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto 28px; gap: 8px; align-items: center; }
        .sb-who { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 8px; }
        .sb-who > span { margin-right: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-mute); }
        .sb-chip { height: 26px; max-width: 150px; padding: 0 11px; border-radius: 13px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--c-mute);
                   background: none; border: 1px dashed rgba(255,255,255,0.16); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                   transition: background .16s ease, border-color .16s ease, color .16s ease; }
        .sb-chip:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.32); }
        .sb-chip.on { color: #ffffff; background: rgba(255,255,255,0.11); border: 1px solid rgba(255,255,255,0.24); }
        .sb-hand { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 9px; }
        .sb-hand label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .sb-hand label > span { font-size: 11px; color: var(--c-mute-hi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-inote { margin-top: 7px; font-size: 11.5px; line-height: 1.4; color: var(--c-mute-hi); font-variant-numeric: tabular-nums; }
        .sb-inote.bad { color: var(--c-red-soft); }
        .sb-exp { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .sb-cats { display: flex; padding: 3px; margin-bottom: 10px; border-radius: 11px; background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); }
        .sb-cat { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 30px; padding: 0 6px; border: none; border-radius: 8px;
                  background: none; color: var(--c-mute); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .18s ease, color .18s ease; }
        .sb-cat .msym { font-size: 16px; }
        .sb-cat:hover { color: var(--c-ink); }
        .sb-cat.auto { color: var(--c-ink-2); background: rgba(255,255,255,0.05); }
        .sb-cat.on { color: #ffffff; background: rgba(255,255,255,0.14); }
        /* "I paid": quieter than the button over it, which files his own share */
        .sb-owe { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; height: 34px; margin-top: 6px; border: 0; border-radius: 10px; background: none; cursor: pointer;
                  font-size: 12.5px; font-weight: 550; color: var(--c-ink-3); transition: background .18s ease, color .18s ease, opacity .18s ease; }
        .sb-owe .msym { font-size: 16px; }
        .sb-owe:hover:not(:disabled) { color: var(--c-ink-hi); background: rgba(255,255,255,0.06); }
        .sb-owe:disabled { opacity: 0.45; cursor: default; }
        .sb-owe.done { opacity: 1; color: var(--c-green-pale); }
        .sb-add { width: 100%; height: 40px; border-radius: 11px; cursor: pointer; font-size: 13.5px; font-weight: 650;
                  color: #ffc2c8; background: rgba(255,93,108,0.14); border: 1px solid rgba(255,93,108,0.38);
                  transition: background .18s ease, border-color .18s ease, color .18s ease, opacity .18s ease; }
        .sb-add:hover:not(:disabled) { color: #ffffff; background: rgba(255,93,108,0.26); border-color: rgba(255,93,108,0.6); }
        .sb-add:disabled { opacity: 0.45; cursor: default; }
        .sb-add.done { opacity: 1; color: var(--c-green-pale); background: rgba(61,220,151,0.10); border-color: rgba(61,220,151,0.34); }
        .bk-msg { color: #5ee3a9; font-size: 11.5px; animation: fadeRight .3s ease both; }
        /* ---------- open app panel ---------- */
        .open-panel { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; }
        /* the grey backdrop is its own layer, so the outro can fade it while the logo and letters stay solid */
        .open-panel-bg { position: absolute; inset: 0;
                         background: radial-gradient(circle at 50% 48%, #43484f 0%, #2a2e33 34%, #17191c 70%, #0e1012 100%); }
        /* replayed from the footer logo: the splash fades in over the app instead of cutting to it */
        .open-panel.again { animation: openPanelIn ${OPEN_COVER_MS}ms ease backwards; }
        @keyframes openPanelIn { from { opacity: 0; } }
        /* ---- outro ---- only the backdrop fades. It starts just after the fall does, takes its time, and is
           still gone before the pieces have left the screen */
        .open-panel.out { pointer-events: none; }
        .open-panel.out .open-panel-bg { animation: openBgOut ${OPEN_FADE_MS}ms ease-in-out ${OPEN_FADE_DELAY_MS}ms forwards; }
        @keyframes openBgOut { to { opacity: 0; } }
        /* the logo and each letter drop off the bottom, turning as they go. Delay, duration, distance, sideways drift
           and spin come from the --f* variables rolled in openFall. Transform only, so it runs on the GPU. */
        .open-panel.out .open-panel-logo, .open-panel.out .open-panel-word .opw-ch {
          animation: openFall var(--ft) ${OPEN_FALL_EASE} var(--fd) forwards; }
        @keyframes openFall { to { transform: translate3d(var(--fx), var(--fy), 0) rotate(var(--fr)); } }
        .open-panel-inner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 22px; }
        .open-panel-logo { width: 96px; height: auto; user-select: none; will-change: transform;
                           filter: drop-shadow(0 10px 22px rgba(0,0,0,0.45));
                           animation: openLogoIn 1.05s cubic-bezier(0.22,1,0.36,1) .06s backwards; }
        /* one continuous ease, no mid-way keyframe, so the logo settles without a kink */
        @keyframes openLogoIn {
          from { opacity: 0; transform: translateY(22px) scale(0.8); }
          to   { opacity: 1; transform: none; }
        }
        /* pixel wordmark: the font sits on an 8x8 grid, so at 48px one font pixel is 6px. White letters over a shadow
           that is offset by exactly one font pixel; the shadow's pastel-green gradient steps once per pixel row.
           One extra font pixel between letters keeps a clear gap between each shadow and the next letter. */
        .open-panel-word { display: flex; font-family: 'Press Start 2P', 'Inter', sans-serif; font-weight: 400; font-size: 48px; line-height: 1;
                           letter-spacing: 6px; margin-right: -6px; -webkit-font-smoothing: none; }
        .open-panel-word span { font-family: inherit; }   /* the global * rule would otherwise put Inter back on the letters */
        .open-panel-word .opw-ch { position: relative; display: inline-block; will-change: transform;
                                   animation: openCharIn .8s cubic-bezier(0.22,1,0.36,1) var(--d) backwards; }
        .open-panel-word .opw-sh { position: absolute; left: 6px; top: 6px; color: transparent; -webkit-background-clip: text; background-clip: text;
                                   background-image: linear-gradient(180deg, #a3d9a8 0 12.5%, #98d09e 12.5% 25%, #8dc794 25% 37.5%, #82be8a 37.5% 50%,
                                                                     #77b580 50% 62.5%, #6cac76 62.5% 75%, #61a36c 75% 100%); }
        .open-panel-word .opw-fg { position: relative; display: inline-block; color: #ffffff; }
        @keyframes openCharIn {
          from { opacity: 0; transform: translateY(24px) scale(0.88); }
          to   { opacity: 1; transform: none; }
        }
        /* app start: the pieces are in place but held back until what they are drawn with is ready. At 1% they can't
           be seen, yet they are already drawn, so their first moving frame has nothing left to prepare */
        .open-panel.wait .open-panel-logo, .open-panel.wait .open-panel-word .opw-ch { animation: none; opacity: 0.01; }
        /* first launch only (see warmPrime): a line of text and a bar that is moved in steps from script, nothing that could stutter.
           The held-back logo and letters stand for seconds here, not for a tenth of one: at 1% they showed as a ghost
           behind the text, so they are at the warm-up's own 0.4% until the text leaves */
        .open-panel.wait.prep .open-panel-logo, .open-panel.wait.prep .open-panel-word .opw-ch { opacity: 0.004; }
        .open-prep { position: absolute; left: 0; right: 0; top: 50%; margin-top: -14px; display: flex; flex-direction: column; align-items: center; gap: 12px;
                     color: var(--c-mute-hi); font-size: 12.5px; font-weight: 500; letter-spacing: 0.02em; transition: opacity ${PRIME_FADE_MS - 40}ms ease;
                     animation: openPrepIn .35s ease .45s backwards; }
        .open-prep.off { opacity: 0; animation: none; }
        .open-prep i { display: block; width: 168px; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.09); overflow: hidden; }
        .open-prep b { display: block; width: 100%; height: 100%; border-radius: 2px; background: var(--c-ink); transform: scaleX(0); transform-origin: 0 50%; }
        @keyframes openPrepIn { from { opacity: 0; } to { opacity: 1; } }
        /* ---------- warm-up (see the top of the file): filed screens drawn for a few frames, all but invisibly ---------- */
        .warm-host { position: fixed; inset: 0; overflow: hidden; contain: strict; opacity: 0.004; pointer-events: none; z-index: 2; }
        .warm-screen { position: absolute; left: 0; right: 0; top: 0; max-width: 1280px; min-height: 100vh; margin: 0 auto; padding: 30px 32px 52px; color: var(--c-ink); }
        /* everything in its resting state at once: no entrance animation to wait for, and the cards that only show
           once scrolled to are shown */
        .warm-screen:not(.live) *, .warm-screen:not(.live) *::before, .warm-screen:not(.live) *::after { animation: none !important; }
        .warm-screen *, .warm-screen *::before, .warm-screen *::after { transition: none !important; }
        /* first launch only (primeOne): every animation of the screen held still at the point --at of its run, so
           that what is only drawn while something moves is drawn too, one frame per point however long a frame takes */
        .warm-screen.live *, .warm-screen.live *::before, .warm-screen.live *::after {
          animation-duration: 1s !important; animation-delay: var(--at, 0s) !important; animation-play-state: paused !important; animation-iteration-count: 1 !important; }
        .warm-screen .flow-card { visibility: visible !important; opacity: 1 !important; transform: none !important; }
        .warm-screen .rv { visibility: visible !important; }
        /* the touch: every second element repaints (never all of them: a tile repainted whole is drawn afresh, and
           it is the redrawing of part of one that needs its own programs) */
        .warm-screen.touch *:nth-child(2n), .warm-screen.touch *:nth-child(2n)::before, .warm-screen.touch *:nth-child(2n)::after {
          outline: 1px solid rgba(0,0,0,0.02) !important; outline-offset: -1px !important; }
        .warm-screen.touch svg *:nth-child(2n) { stroke-opacity: 0.99; }
        /* the same touch a piece at a time (warmRest): on what was put in together, and on what is in it */
        .warm-screen .wt:nth-child(2n), .warm-screen .wt *:nth-child(2n), .warm-screen .wt *:nth-child(2n)::before, .warm-screen .wt *:nth-child(2n)::after {
          outline: 1px solid rgba(0,0,0,0.02) !important; outline-offset: -1px !important; }
        .warm-screen svg.wt *:nth-child(2n), .warm-screen .wt svg *:nth-child(2n) { stroke-opacity: 0.99; }
        /* first launch only (primeOne): the other half */
        .warm-screen.touch2 *:nth-child(2n+1), .warm-screen.touch2 *:nth-child(2n+1)::before, .warm-screen.touch2 *:nth-child(2n+1)::after {
          outline: 1px solid rgba(0,0,0,0.02) !important; outline-offset: -1px !important; }
        .warm-screen.touch2 svg *:nth-child(2n+1) { stroke-opacity: 0.99; }
        /* crocodile home button in the footer: just the logo, no tile or outline */
        .foot-logo { background: none; border: none; outline: none; padding: 0; margin: 0; cursor: pointer; line-height: 0; align-self: center;
                     -webkit-tap-highlight-color: transparent; }
        .foot-logo img { display: block; height: 24px; width: auto; user-select: none; }
        .plain-arrow { background: none; border: none; color: var(--c-mute); cursor: pointer; line-height: 0; padding: 2px 4px; transition: color .15s ease; }
        .plain-arrow:hover { color: var(--c-ink); }
        .chev svg { width: 15px; height: 15px; display: block; transform-origin: 50% 50%; }
        /* closed = 0deg (pointing down), open = 180deg; always turns clockwise */
        .chev svg { animation: chevDown .34s cubic-bezier(0.34,1.1,0.64,1) both; }
        .chev.up svg { animation: chevUp .34s cubic-bezier(0.34,1.1,0.64,1) both; }
        @keyframes chevUp   { from { transform: rotate(0deg); }   to { transform: rotate(180deg); } }
        @keyframes chevDown { from { transform: rotate(180deg); } to { transform: rotate(360deg); } }
        .flow-card { opacity: 0; visibility: hidden; transform: scale(0.94); }
        .flow-card > .card-aura { position: absolute; left: 0; top: 0; width: min(100%, 820px); height: 130px; max-height: 100%; z-index: 0; border-top-left-radius: inherit; pointer-events: none;
                                  background: radial-gradient(820px 130px at 0% 0%, color-mix(in srgb, var(--tint) 27%, transparent), transparent 74%); }
        .card-tag { display: inline-flex; align-items: center; gap: 7px; margin: -3px 0 6px -4px; padding: 5px 11px 5px 9px; border-radius: 99px;
                    font-size: 11px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase;
                    color: var(--tint); background: color-mix(in srgb, var(--tint) 12%, transparent); border: 1px solid color-mix(in srgb, var(--tint) 20%, transparent); }
        .card-tag i { width: 6px; height: 6px; border-radius: 99px; background: var(--tint); }
        .hero { position: relative; margin: 4px -14px 22px; padding: 18px 22px 18px; border-radius: 24px;
                border: 1px solid color-mix(in srgb, var(--hc) 24%, rgba(255,255,255,0.07));
                background: radial-gradient(900px 300px at 0% 0%, color-mix(in srgb, var(--hc) 24%, transparent), transparent 70%),
                            radial-gradient(640px 260px at 100% 100%, color-mix(in srgb, var(--hc) 9%, transparent), transparent 72%),
                            linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
                box-shadow: 0 18px 44px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.10); }
        .hero-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        /* the tag and, right of it, the information symbol with its note */
        .hero-lead { display: inline-flex; align-items: center; gap: 6px; }
        .info-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: none; border-radius: 50%;
                    background: none; cursor: help; color: var(--c-ink-3); outline: none; transition: color .18s ease, background .18s ease; }
        .info-btn > .msym { font-size: 18px; }
        .info-btn:hover, .info-btn:focus { color: #ffffff; background: rgba(255,255,255,0.09); }
        .info-tip { position: absolute; left: -6px; top: calc(100% + 9px); z-index: 20; width: 318px; padding: 13px 15px 13px; border-radius: 14px; text-align: left; cursor: default;
                    display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; font-weight: 450; line-height: 1.45; color: var(--c-ink-2); letter-spacing: 0; text-transform: none;
                    background: linear-gradient(180deg, #2b2f33 0%, #212428 100%);
                    box-shadow: 0 22px 50px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.07);
                    opacity: 0; transform: translateY(-6px); pointer-events: none; transition: opacity .2s ease, transform .26s var(--ease); }
        .info-btn:hover .info-tip, .info-btn:focus .info-tip { opacity: 1; transform: translateY(0); pointer-events: auto; }
        .info-tip > b { font-size: 13px; font-weight: 700; color: var(--c-ink-hi); }
        /* the same symbol on the score card, to the right of the trend tag. Its note is placed from the whole line
           (the symbol itself is not what it is measured from), under it and from its left end. The card is lifted
           over the parts under it, so the note is never covered by the projection */
        .score-card { position: relative; z-index: 3; }
        .score-row { position: relative; }
        .score-row .info-btn { position: static; margin-left: -3px; }
        .score-row .info-tip { left: 0; width: 352px; }
        .score-row .info-tip > span > b { font-weight: 700; color: var(--c-ink-hi); margin-right: 5px; }
        .info-tip > span { display: block; position: relative; }
        .info-tip > span > i { display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 99px; vertical-align: 1px; }
        .info-tip .info-foot { margin-top: 2px; padding-top: 8px; color: var(--c-ink-3); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }
        .term .info-tip { border-radius: 6px; }
        .hero-tag { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px 5px 9px; border-radius: 99px; font-size: 11px; font-weight: 700;
                    letter-spacing: 0.13em; text-transform: uppercase; color: var(--hc); background: color-mix(in srgb, var(--hc) 13%, transparent);
                    border: 1px solid color-mix(in srgb, var(--hc) 22%, transparent); }
        .hero-tag i { width: 6px; height: 6px; border-radius: 99px; background: var(--hc); }
        .hero-vs { font-size: 12.5px; color: #aab1b8; padding: 5px 12px; border-radius: 99px; background: rgba(255,255,255,0.055);
                   border: 1px solid rgba(255,255,255,0.07); white-space: pre; animation: fadeRight .4s ease backwards; }
        .hero-vs b { font-weight: 700; }
        .hero-num { font-size: 64px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.05; margin: 12px 0 14px; color: var(--hc);
                    font-variant-numeric: tabular-nums; text-shadow: 0 0 40px color-mix(in srgb, var(--hc) 34%, transparent); }
        /* the bar under the month's figure with its chart button, and under the bar what its two ends are, in the captions'
           grey. The button's row is higher than the bar, so the words are pulled up to sit 7px under it */
        .hero-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 10px; }
        .bar-ends { grid-column: 1; display: flex; justify-content: space-between; gap: 16px; margin-top: -3px; font-size: 11.5px; font-weight: 500;
                    line-height: 1.2; color: var(--c-mute-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .hero-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
        .hero-tile { position: relative; display: flex; flex-direction: column; gap: 3px; padding: 11px 14px 12px 22px; border-radius: 14px; min-width: 0;
                     background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.06); }
        .hero-tile::before { content: ""; position: absolute; left: 10px; top: 12px; bottom: 12px; width: 3px; border-radius: 3px; background: var(--tc); }
        .ht-cap { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-mute-2); white-space: nowrap; }
        .ht-val { font-size: 21px; font-weight: 800; color: #eef1f4; font-variant-numeric: tabular-nums; white-space: nowrap; letter-spacing: -0.01em; }
        .ht-val small { font-size: 12px; font-weight: 600; color: var(--c-mute-2); letter-spacing: 0; }
        .ht-sub { font-size: 12px; color: var(--c-mute-2); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* ---- personalities (6 October 2026): depth instead of borders, green as the brand, one dominant visual a screen ---- */
        .flow-card.glass { border-color: transparent; box-shadow: 0 34px 80px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.08); }
        .flow-card.glass:hover { border-color: transparent; box-shadow: 0 34px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.11); }
        .cal-wrap { border-color: transparent !important; box-shadow: 0 30px 70px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07); }
        /* the month's card: no border, a neon edge of its colour along the top, and a big soft glow of it spilling out behind */
        .hero { border-color: transparent; box-shadow: 0 34px 80px rgba(0,0,0,0.46), inset 0 1.5px 0 color-mix(in srgb, var(--hc) 62%, transparent), 0 -1px 26px color-mix(in srgb, var(--hc) 16%, transparent); }
        .hero::before { content: ""; position: absolute; left: -70px; top: -90px; width: 760px; height: 420px; z-index: -1; pointer-events: none;
                        background: radial-gradient(closest-side, color-mix(in srgb, var(--hc) 20%, transparent), transparent); }
        .hero-num { font-size: 92px; letter-spacing: -0.045em; margin: 14px 0 18px -4px; }
        .hero-tiles { grid-template-columns: 1.75fr 1fr 1fr 1fr; align-items: end; }
        .hero-tile { border-color: transparent; }
        .hero-tile:first-child { padding-top: 16px; padding-bottom: 17px; background: color-mix(in srgb, var(--tc) 9%, rgba(255,255,255,0.04)); }
        .hero-tile:first-child .ht-val { font-size: 32px; }
        /* the year as a poster */
        .poster { position: relative; }
        .poster::before { content: ""; position: absolute; left: -60px; top: -70px; width: 560px; height: 260px; z-index: -1; pointer-events: none;
                          background: radial-gradient(closest-side, color-mix(in srgb, var(--hc) 17%, transparent), transparent); }
        .poster-line { display: flex; align-items: flex-end; gap: 18px; margin: -18px 0 12px; }
        .poster-num { font-size: 76px; font-weight: 800; letter-spacing: -0.045em; line-height: 0.95; color: var(--hc); font-variant-numeric: tabular-nums;
                      text-shadow: 0 0 44px color-mix(in srgb, var(--hc) 32%, transparent); }
        .poster-cap { display: flex; flex-direction: column; gap: 3px; padding-bottom: 7px; font-size: 13px; color: var(--c-mute-2); font-variant-numeric: tabular-nums; }
        .poster-cap b { font-size: 15px; font-weight: 700; color: var(--c-ink); }
        .ycell > .spark { position: absolute; z-index: 0; left: 10px; bottom: 8px; width: calc(100% - 20px); height: 30%; opacity: 0.24; pointer-events: none; }
        /* a month box's figures say what they are: the word after the big one (left / short), and the note's line on
           the daily limit. A month still to come with nothing on it is a step fainter: by its fill, its edge and its
           light, never by the box's own opacity (its entrance ends on 1 and would jump back) */
        .yc-w { margin-left: 5px; font-size: 11px; font-weight: 500; letter-spacing: 0; color: var(--c-mute); }
        .yc-lim { font-size: 11px; color: var(--c-ink-3); text-align: center; }
        .yc-lim b { margin-left: 5px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .ycell.later { box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.16); }
        .ycell.later::before { opacity: 0.45; }
        /* a day's spending as a bar rising behind its figure, and the neon edge on today */
        /* The bar's box is the whole inside of the tile, cut to the tile's corners, and stands still; what rises is its
           ::after, as high as --h. Until 8 October 2026 the bar itself carried the round corners: a bar lower than a
           corner is deep can't have them (the corner is made smaller to fit), so on a day of little spending its
           nearly square ends showed outside the tile's corners, and while it rose its corners were squeezed with it. */
        .cell > .cbar { position: absolute; z-index: 0; inset: 0; border-radius: 13px; overflow: hidden; pointer-events: none; }
        .cell > .cbar::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: var(--h, 0%);
                               background: linear-gradient(to top, color-mix(in srgb, currentColor 30%, transparent), transparent); }
        .cell.today { box-shadow: 0 0 0 1px rgba(127,182,224,0.5), 0 0 22px rgba(127,182,224,0.28); }
        /* the score: the dial is the picture, the three boxes sit beside it, stepped */
        .score-dial::before { content: ""; position: absolute; inset: -34px; border-radius: 50%; pointer-events: none;
                              background: radial-gradient(closest-side, color-mix(in srgb, var(--gc) 22%, transparent), transparent 78%); }
        .score-orbit { display: flex !important; flex-direction: column; width: 290px !important; flex-shrink: 0; margin: 0 !important; gap: 10px !important; }
        .score-orbit > :nth-child(2) { margin-left: -28px; margin-right: 28px; }
        .score-orbit > .sub-box { border-color: transparent; }
        /* goals: softer and warmer than the rest */
        .flow-card[data-card="goals"] { border-radius: 30px !important; }
        .flow-card[data-card="goals"] > .card-aura { width: 100%; height: 220px;
            background: radial-gradient(900px 220px at 18% 0%, color-mix(in srgb, var(--tint) 20%, transparent), transparent 74%); }
        .flow-card[data-card="goals"] .goal-row { border-bottom-color: transparent; padding: 14px 2px; }
        /* trading: sharper, technical, terminal-like. Square corners, a fine grid, figures in the system's own face at its
           widest and heavy (SF Pro Expanded: system-ui with font-stretch, nothing loaded). It was the fixed-width face
           until 6 October 2026, which he really didn't like: he asked for bold and extended */
        .term .hero, .term .flow-card, .term .cal-wrap { border-radius: 8px !important; }
        .term .hero { background: repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 26px),
                                  repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 26px),
                                  radial-gradient(900px 300px at 0% 0%, color-mix(in srgb, var(--hc) 20%, transparent), transparent 70%), rgba(18,21,24,0.72); }
        .term .hero-num, .term .ht-val, .term .ht-sub, .term .hero-vs b { font-family: system-ui, -apple-system, 'Inter', sans-serif; font-stretch: 125%; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        /* The big PnL figures are Monument Extended on both sides (6 October 2026, his choice; he said Montserrat first by
           mistake): the month's figure on finance and trading, and the year's on the finance poster. Nothing else is to
           change. It is a foundry face that is not in the project: it is used from the Mac's own fonts once it is installed
           there, under either of the names it has gone by, and until then the system's widest heavy face stands in (SF Pro
           Expanded, which font-stretch asks for and which is close to it). Much wider than Inter, so the sizes came down */
        .poster-num, .hero-tile:first-child .ht-val { font-family: 'PP Monument Extended', 'Monument Extended', system-ui, -apple-system, 'Inter', sans-serif;
                                                      font-weight: 800; font-stretch: 150%; letter-spacing: -0.03em; }
        .poster-num { font-size: 62px; line-height: 1; }
        /* 11 October 2026: he had the two swapped. The month's PnL figure is the pixel font on both sides (64px: a font
           pixel is 8px, and its capitals are as high as the 78px Monument figure was), in capitals as the Left figure was;
           the finance Left figure took the bold extended face in its place (further down). The year's poster is as it was */
        .hero-num, .term .hero-num { font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 64px; font-weight: 400; font-stretch: normal; letter-spacing: 0;
                                     line-height: 1; text-transform: uppercase; -webkit-font-smoothing: none; margin: 20px 0 20px; }
        /* its comma and decimal point (pxSeps): 0.125em is one font pixel. The point is drawn one column further in than
           the comma. Each piece has to take the face and the hard edges of the figure: the page-wide rules on * give it Inter, smoothed */
        .hero-num .pxs { font-family: inherit; -webkit-font-smoothing: inherit; margin: 0 -0.375em 0 -0.25em; }
        .hero-num .pxs.c { margin-left: -0.125em; }
        .term .ht-val { font-stretch: 150%; }
        /* the day tiles and month boxes stay in Inter: the page-wide rule on * beats any face a tile hands down, so only this spacing reaches their text */
        .term .cell, .term .ycell { letter-spacing: -0.05em; }
        .term .hero-tile, .term .sub-box, .term .cell, .term .ycell { border-radius: 5px !important; }
        .term .hero-tag, .term .card-tag { border-radius: 4px; }
        .term .hero-tag i, .term .card-tag i { width: 6px; height: 11px; border-radius: 1px; }
        .term .hero-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .term .hero-tile:first-child .ht-val { font-size: 21px; }
        .term .hero-tile:first-child { padding: 11px 14px 12px 22px; background: rgba(255,255,255,0.045); }
        /* ---- 6 October 2026, second brief: pixel type used sparingly, the data moving, one focal point a screen,
           and colour roles: green = gain / progress, red = loss / risk, gold = reached / achieved, blue-grey = information ---- */
        .px-word { font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 16px; line-height: 1; letter-spacing: 1px; color: #e6c877; -webkit-font-smoothing: none; }
        .hero-tile:first-child .ht-val { font-size: 28px; padding: 3px 0 2px; }
        .term .hero-tile:first-child .ht-val { font-family: system-ui, -apple-system, 'Inter', sans-serif; font-weight: 800; font-size: 21px; text-transform: none; padding: 0; letter-spacing: -0.01em; }
        /* one hero, the rest quieter: the three small tiles step back, and so does quick add until it is used */
        .hero-tile:not(:first-child) { background: transparent; }
        .hero-tile:not(:first-child) .ht-val { font-size: 18px; color: var(--c-ink-2); }
        .term .hero-tile:not(:first-child) { background: rgba(255,255,255,0.045); }
        .qadd { opacity: 0.7; transition: opacity .2s ease; }
        .qadd:hover, .qadd:focus-within { opacity: 1; }
        .cell > .cbar::after { transform-origin: 50% 100%; animation: cbarUp .55s var(--ease) var(--bd, 0ms) backwards; }
        @keyframes cbarUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        /* the trading sides have these too (8 October 2026): a day's result as the bar, a red day as the ring, in their square corners */
        .term .cell > .cbar { border-radius: 4px; }
        .term .qadd { border-radius: 8px; }
        .term .qadd input, .term .qadd-kind, .term .qadd-go { border-radius: 5px !important; }
        .ql-kind.be { color: var(--c-gold); background: rgba(227,205,119,0.1); }
        .ql-kind.be i { background: var(--c-gold); }
        .cell.over::after { content: ""; position: absolute; inset: -1px; border-radius: inherit; border: 1.5px solid var(--c-red); opacity: 0; pointer-events: none;
                            animation: overPulse .7s ease-out .4s backwards; }
        @keyframes overPulse { 0% { opacity: 0; transform: scale(1); } 28% { opacity: 0.9; } 100% { opacity: 0; transform: scale(1.09); } }
        .goal-done-count { background: #e6c877 !important; }
        .glass-tip-sub { display: block; margin-top: 3px; font-size: 11px; font-weight: 500; color: var(--c-ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
        /* the journal's row: R first and strongest after the PnL, the rest small capitals, the setup last and cut short */
        .jr-meta { display: flex; align-items: baseline; gap: 14px; white-space: nowrap; font-size: 11px; letter-spacing: 0.07em; }
        .jr-meta > * { flex-shrink: 0; font-style: normal; }
        .jr-meta b { font-size: 13.5px; font-weight: 800; letter-spacing: 0; color: var(--tone); font-variant-numeric: tabular-nums; }
        .jr-meta em { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0; font-size: 12.5px; color: var(--c-mute); }
        .jr-amt { font-size: 15px; font-weight: 800; }
        /* the ••• menu is one box. At rest it is the dots' own; opened, it draws out to the left over Edit, Duplicate and
           Delete and uncovers them; shut, it draws back to the dots (6 October 2026, his words: extend from the three dots,
           scale horizontally to the left, return to its original scale). One number does it, --mo (0 shut, 1 open), eased
           on the row, so a press half-way turns it round from where it is:
           - the box is a fill sliding inside a clip as wide as the open box, so its left end keeps its round corners and
             nothing is resized (at rest the two are the dots' size and the slide comes to nothing);
           - the buttons stand still behind a clip of their own that moves with that end;
           - what stands left of them in the row (pictures, amount, arrow) was moved over at once by the layout when the
             buttons were put there, so it is slid from where it was: --aw, the buttons' width (jrActsW).
           The buttons stay until the box has drawn back (JR_MENU_MS), then go, and the row is laid out as before */
        @property --mo { syntax: "<number>"; inherits: true; initial-value: 0; }
        .jr-sum { transition: --mo .32s var(--ease); }
        .jr-sum.menu { --mo: 1; transition-duration: .42s; }
        .jr-sum.acts .jr-pics, .jr-sum.acts .jr-amt, .jr-sum.acts .jr-chev { translate: calc(var(--aw, 0px) * (1 - var(--mo))) 0; }
        .jr-more { position: relative; display: inline-flex; align-items: center; height: 28px; flex-shrink: 0; }
        .jr-box { position: absolute; inset: 0; border-radius: 9px; overflow: hidden; pointer-events: none; }
        .jr-box i { position: absolute; inset: 0; border-radius: 9px; background: rgba(255,255,255,0.08); opacity: 0; transition: opacity .16s ease;
                    transform: translateX(calc((100% - 28px) * (1 - var(--mo)))); }
        .jr-more:hover .jr-box i, .jr-sum.acts .jr-box i { opacity: 1; }
        .jr-dots { position: relative; z-index: 1; width: 28px; height: 28px; border-radius: 9px; border: none; background: none; color: var(--c-mute); cursor: pointer; display: inline-flex;
                   align-items: center; justify-content: center; transition: color .16s ease; }
        .jr-dots .msym { font-size: 19px; }
        .jr-dots:hover, .jr-dots.on { color: var(--c-ink); }
        .jr-acts { display: inline-flex; height: 28px; overflow: hidden; pointer-events: none; transform: translateX(calc(100% * (1 - var(--mo)))); }
        .jr-acts-in { display: inline-flex; align-items: center; gap: 2px; padding: 0 1px 0 3px; opacity: var(--mo); transform: translateX(calc(-100% * (1 - var(--mo)))); }
        .jr-acts button { pointer-events: auto; height: 22px; border: none; background: none; color: var(--c-ink-2); font: inherit; font-size: 12px; font-weight: 600; padding: 0 9px; border-radius: 6px;
                          cursor: pointer; white-space: nowrap; transition: background .14s ease, color .14s ease; }
        .jr-sum:not(.menu) .jr-acts button { pointer-events: none; }
        .jr-acts button:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .jr-acts button.del:hover { background: rgba(255,93,108,0.16); color: var(--c-red-soft); }
        /* a trade looked at */
        .jv { padding: 6px 14px 16px; }
        .jv-top { display: flex; align-items: baseline; gap: 16px; }
        .jv-pnl { font-size: 38px; font-weight: 800; letter-spacing: -0.03em; color: var(--tone); font-variant-numeric: tabular-nums; line-height: 1.1; }
        .jv-r { font-size: 22px; font-weight: 800; color: #ecd3a4; font-variant-numeric: tabular-nums; }
        .jv-btn { display: inline-flex; align-items: center; gap: 6px; align-self: center; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--c-ink-2);
                  font: inherit; font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 10px; cursor: pointer; transition: background .16s ease, color .16s ease; }
        .jv-btn .msym { font-size: 16px; }
        .jv-btn.ico { width: 32px; height: 32px; padding: 0; justify-content: center; }
        .jv-btn.ico .msym { font-size: 17px; }
        .jv-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        /* a trade looked at is a short summary, not another card (6 October 2026, a review he passed on): under the PnL one
           line that says what kind of trade it was (Swing · 1D · 20 lot · 8D · Bank), then its figures in a row with a name
           over each and a hairline above. No boxes: as tiles, each one in a box, most of the view was empty */
        .jv-sum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 9px; margin-top: 7px; font-size: 13px; }
        .jv-sum b { font-weight: 600; color: var(--c-ink-2); font-variant-numeric: tabular-nums; }
        .jv-sum i { font-style: normal; color: #4f565d; }
        .jv-grid { display: flex; flex-wrap: wrap; gap: 12px 34px; margin-top: 13px; padding-top: 13px; border-top: 1px solid rgba(255,255,255,0.06); }
        .jv-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .jv-line { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
        .jv-line > * { min-width: 0; }
        .jv-k { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-mute); }
        .jv-v { font-size: 17px; font-weight: 800; color: var(--c-ink); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jv-s { font-size: 11px; color: var(--c-mute); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jv-note { margin-top: 14px; }
        .jv-note p { margin: 5px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--c-ink-1); white-space: pre-wrap; max-width: 760px; }
        .jv-bar { display: flex; align-items: center; justify-content: space-between; padding: 4px 14px 8px; font-size: 12px; color: var(--c-mute); }
        /* cash flow: under the journal, apart from it */
        .jr-cash { margin-top: 22px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .jr-cash-head { width: 100%; display: flex; align-items: center; gap: 8px; border: none; background: none; cursor: pointer; padding: 6px 2px; color: var(--c-ink-3);
                        font: inherit; font-size: 12.5px; font-weight: 600; transition: color .16s ease; }
        .jr-cash-head:hover { color: var(--c-ink); }
        .jr-cash-head .msym { font-size: 17px; }
        .jr-cash-head i { font-style: normal; font-weight: 500; color: var(--c-mute); margin-left: 4px; flex: 1; text-align: left; font-variant-numeric: tabular-nums; }
        .jr-cash-chev { transition: transform .2s ease; }
        .jr-cash-chev.up { transform: rotate(180deg); }
        .jr-cash .jr-dep { margin-top: 6px; padding-top: 0; border-top: none; }
        .jr-name.tk { display: inline-flex; flex-direction: column; gap: 2px; line-height: 1.1; padding: 3px 0; min-width: 0; }
        .jr-name.tk small { font-size: 11px; font-weight: 500; color: #a3abb3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .jr-tag.st { color: #d6c9a2; background: rgba(214,201,162,0.12); }
        .bk-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 22px 34px; padding-bottom: 8px; }
        .bk-l { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .bk-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 12px; row-gap: 2px; align-items: center; padding: 9px 0 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .bk-name { font-size: 14.5px; font-weight: 700; color: var(--c-ink); }
        .bk-pnl { font-size: 14.5px; font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; }
        .bk-meta { font-size: 12px; color: var(--c-mute-2); font-variant-numeric: tabular-nums; }
        .bk-track { grid-column: 1 / -1; height: 3px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 4px; }
        .bk-track i { display: block; height: 100%; border-radius: 3px; opacity: 0.75; }
        .bk-none { font-size: 13px; color: var(--c-mute); padding: 10px 0; }
        .tag-pill { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; padding: 3px 8px; border-radius: 99px; white-space: nowrap;
                    color: var(--tc); background: color-mix(in srgb, var(--tc) 14%, transparent); }
        /* each card, and what folds in it, is a surface of its own for good: when a card folds, the cards under it and
           its own content are only moved and cut off, never drawn again */
        .flow-card, .fold-in { will-change: transform; }
        /* a part of a card that waits to be scrolled to (Reveal) */
        .rv:not(.seen) { visibility: hidden; }
        .rv:not(.seen) * { animation: none !important; }
        .rv.seen { animation: rvIn .3s ease-out backwards; }
        @keyframes rvIn { from { opacity: 0; } }
        /* "backwards" + explicit end state: the animation lets go when it finishes. A held (both/forwards)
           animation blocks backdrop blur for anything inside the card, e.g. the glass chart tooltip. */
        .flow-card.shown { visibility: visible; opacity: 1; transform: none; animation: flowPopIn .5s cubic-bezier(0.22,1,0.36,1) backwards; }
        @keyframes flowPopIn {
          0%   { opacity: 0; transform: scale(0.94); }
          60%  { opacity: 1; transform: scale(1.012); }
          100% { opacity: 1; transform: scale(1); }
        }
        .flow-label { transition: background .16s ease; }
        .flow-label:hover { background: var(--c-line); }
        .score-hit { pointer-events: auto; cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 9px 14px; border-radius: 16px; transition: background .16s ease; }
        .score-hit:hover { background: rgba(255,255,255,0.07); }
        .score-arc { animation: scoreDraw 1s cubic-bezier(0.3,0,0.2,1) both; transform-origin: center; }
        @keyframes scoreDraw { from { stroke-dasharray: 0 9999; } }
        .bd-title { animation: bdTitleIn .3s cubic-bezier(0.34,1.15,0.64,1) both; }
        @keyframes bdTitleIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bd-icon { display: inline-block; animation: bdIconRoll .4s cubic-bezier(0.55,0,0.35,1) both; }
        @keyframes bdIconRoll {
          0% { transform: translateY(0); filter: blur(0px); }
          42% { transform: translateY(-24px); filter: blur(2.5px); }
          43% { transform: translateY(24px); filter: blur(2.5px); }
          100% { transform: translateY(0); filter: blur(0px); }
        }
        .score-card { animation: bdItemIn .4s cubic-bezier(0.4,0,0.2,1) .12s both; }
        .sub-box { background-image: linear-gradient(150deg, color-mix(in srgb, var(--tc, transparent) 17%, transparent), transparent 64%);
                   border-color: color-mix(in srgb, var(--tc, #fff) 16%, rgba(255,255,255,0.05)); }
        .sub-box { animation: subBoxIn .38s cubic-bezier(0.34,1.15,0.64,1) both; }
        @keyframes subBoxIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .bd-item { animation: bdItemIn .34s cubic-bezier(0.4,0,0.2,1) backwards; }
        @keyframes bdItemIn { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }
        .bd-fill { display: block; height: 100%; border-radius: 99px; animation: bdGrow .55s cubic-bezier(0.4,0,0.2,1) both; transform-origin: left center; }
        @keyframes bdGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        /* Money flow opening (timings: FLOW_* near the top of the file). The income bar fills from the top; each
           ribbon is uncovered from the left by its own sweep, fading up as it sets off; each expense bar grows out of
           its middle as the ribbon's front arrives; the labels slide in. Transforms and opacity only. */
        .flow-src { transform-box: fill-box; transform-origin: center top;
                    animation: flowSrcIn ${FLOW_SRC_MS}ms cubic-bezier(0.33,1,0.68,1) ${FLOW_START_MS}ms backwards; }
        @keyframes flowSrcIn { from { transform: scaleY(0); } }
        .flow-wipe-rect { transform-box: fill-box; transform-origin: left center; animation: flowWipe ${FLOW_RIB_MS}ms cubic-bezier(0.45,0,0.15,1) backwards; }
        @keyframes flowWipe { from { transform: scaleX(0); } }
        .flow-rib { animation: flowRibIn ${Math.round(FLOW_RIB_MS * 0.45)}ms ease-out backwards; }
        @keyframes flowRibIn { from { opacity: 0; } }
        .flow-bar { transform-box: fill-box; transform-origin: center center; animation: flowBarIn .36s cubic-bezier(0.34,1.45,0.64,1) backwards; }
        @keyframes flowBarIn { from { opacity: 0; transform: scaleY(0.15); } }
        .flow-tag { animation: flowTagIn .38s cubic-bezier(0.22,1,0.36,1) backwards; }
        .flow-tag.src { animation-delay: ${FLOW_START_MS + 120}ms; }
        @keyframes flowTagIn { from { opacity: 0; transform: translateX(-9px); } }
        .mode-btn:hover {
          border-color: rgba(255,255,255,0.28) !important; color: var(--c-ink) !important;
          background: rgba(255,255,255,0.06) !important; transform: translateY(-1px);
        }
        .cat-btn-glow { box-shadow: 0 0 0 3px rgba(255,255,255,0.05); }
        .wk-tip { animation: wkTipIn .18s cubic-bezier(0.34,1.2,0.64,1) both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes wkTipIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        .cat-pop { animation: popUpIn .2s cubic-bezier(0.34,1.15,0.64,1) both; }
        .cat-pop.closing { animation: popDownOut .18s ease both; }
        @keyframes popUpIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popDownOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
        .cat-opt { transition: background .15s ease, color .15s ease; }
        .cat-opt:hover { background: var(--c-line) !important; color: var(--c-ink) !important; }
        .icon-opt { transition: background .15s ease, color .15s ease; }
        .icon-opt:hover, .icon-opt.on { background: var(--c-line) !important; color: #f5d34b !important; }
        * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
        input { font-variant-numeric: tabular-nums; }
        .cell, .ycell {
          position: relative; overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 14px rgba(0,0,0,0.26);
          transition: transform .24s var(--ease-soft), border-color .2s ease, box-shadow .24s ease;
          will-change: transform;
        }
        /* day tiles must not clip: their hover tooltip sits outside the tile (a month box's too, since 13 October 2026) */
        .cell, .ycell { overflow: visible; }
        .cell:hover, .ycell:hover { z-index: 6; }
        .cell.tip-below .cell-tip, .ycell.tip-below .cell-tip { bottom: auto; top: calc(100% + 8px); }
        /* painted glass: a specular corner + a soft inner glow, no compositing cost */
        /* --lit goes 0 → 1 under the pointer and the sheen is worked out from it, so the brighter corner eases in
           with the lift (a gradient can't be transitioned, a registered number can). At 0 and at 1 these are exactly
           the two gradients that used to be switched. */
        @property --lit { syntax: "<number>"; inherits: false; initial-value: 0; }
        /* how far a card is out of its wallet; --cq hands it down to the big card's shadows */
        @property --cp { syntax: "<number>"; inherits: false; initial-value: 0; }
        @property --cq { syntax: "<number>"; inherits: true; initial-value: 0; }
        .cell::before, .ycell::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          background:
            linear-gradient(157deg, rgba(255,255,255,calc(0.13 + 0.07 * var(--lit))) 0%, rgba(255,255,255,calc(0.04 + 0.02 * var(--lit))) calc(22% + 2% * var(--lit)), transparent calc(46% + 4% * var(--lit))),
            radial-gradient(120% 80% at 84% 108%, rgba(0,0,0,calc(0.20 - 0.02 * var(--lit))), transparent 62%);
          transition: --lit .24s ease;
        }
        .cell:hover::before, .ycell:hover::before { --lit: 1; }
        .cell:hover, .ycell:hover {
          border-color: rgba(255,255,255,0.22) !important;
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 22px rgba(0,0,0,0.3);
        }
        .cell:active, .ycell:active { transform: translateY(0) scale(0.99); }
        .month-btn { color: var(--c-ink); transition: color .18s ease, text-shadow .25s ease, transform .22s var(--ease); }
        .month-btn:hover { color: #ffffff; text-shadow: 0 0 18px rgba(255,255,255,0.28); }
        .cur-btn:hover { border-color: #6a7178 !important; color: var(--c-ink) !important; }
        .cur-opt:hover { background: var(--c-line) !important; }
        /* compare: the ghost line, and its borderless button at the bottom right of the chart pop-up */
        .ch-morph { transition: d ${CMP_MS}ms var(--ease-soft), y ${CMP_MS}ms var(--ease-soft), height ${CMP_MS}ms var(--ease-soft), cy ${CMP_MS}ms var(--ease-soft); }
        .ch-slide { transition: transform ${CMP_MS}ms var(--ease-soft); }
        .cmp-line { stroke-opacity: 0.55; transition: d ${CMP_MS}ms var(--ease-soft), stroke-opacity ${CMP_MS}ms ease; }
        .cmp-line.line-sweep { animation-duration: 1.1s; animation-delay: .04s; }
        .cmp-line.gone { stroke-opacity: 0; }
        /* the weekly chart's axis text: 11px on screen at any width of the card, the projection chart's size (--wk is a
           pixel in the drawing's units, see WeekBox; without it the text is as big as it was). Each stands on the middle
           of its line; a day's name hangs under its place by half its own height, so its top keeps clear of today's ring */
        .wk-ax { font-size: calc(11px * var(--wk, 1)); dominant-baseline: central; }
        .wk-ad { translate: 0 calc(6px * var(--wk, 1)); }
        .wk-cmp { position: absolute; display: inline-flex; padding: 0; background: none; border: none; color: var(--c-mute); cursor: pointer; line-height: 0;
                  transition: color .18s ease; }
        .wk-cmp .msym { font-size: 18px; animation: wkCmpIn .3s var(--ease-soft) backwards; }
        .wk-cmp:hover { color: var(--c-ink); }
        .wk-cmp.on { color: #a9bccd; }
        .wk-cmp:disabled { opacity: 0.4; cursor: default; color: var(--c-mute); }
        @keyframes wkCmpIn { from { opacity: 0; transform: scale(0.6) rotate(-45deg); } }
        .cmp-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; background: none; border: none; padding: 2px 0;
                   font-size: 12px; font-weight: 600; color: var(--c-mute); cursor: pointer; transition: color .18s ease; }
        .cmp-btn i { width: 14px; height: 2.4px; border-radius: 2px; background: ${CMP_INK}; opacity: 0.5; transition: opacity .18s ease; }
        .cmp-btn:hover { color: var(--c-ink); }
        .cmp-btn.on { color: #a9bccd; }
        .cmp-btn.on i, .cmp-btn:hover i { opacity: 1; }
        .cmp-btn:disabled { opacity: 0.45; cursor: default; color: var(--c-mute); }
        .cmp-btn:disabled i { opacity: 0.5; }
        .chart-btn { transition: border-color .18s ease, color .18s ease; }
        .chart-btn:hover { border-color: var(--c-mute-2) !important; color: var(--c-ink) !important; }
        .chart-btn svg rect { transform-box: fill-box; transform-origin: center bottom; }
        .chart-btn:hover .cb1 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) both; }
        .chart-btn:hover .cb2 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) .07s both; }
        .chart-btn:hover .cb3 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) .14s both; }
        @keyframes riseBar { from { transform: scaleY(0.2); } to { transform: scaleY(1); } }
        .collapse-btn { transition: border-color .18s ease, color .18s ease, transform .15s ease; }
        .collapse-btn:hover { border-color: var(--c-mute-2) !important; color: #ffffff !important; }
        .nav-arrow { background: none; border: none; color: var(--c-ink-3); font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1; transition: color .15s; }
        .nav-arrow:hover { color: var(--c-ink); }
        /* month switcher: the arrows fade in only while the pointer is on it (or an arrow has keyboard focus) */
        /* ---- navigation (7 October 2026): the sidebar, then the month header's way back and its arrows ---- */
        /* 64px free on each side: the left for the three lines, the right so that the page stays in the middle (and
           clear of the buttons fixed in that corner: the year arrows, the calculator) */
        body.has-side { padding-left: 64px; padding-right: 64px; }
        .snav-root { position: fixed; left: 0; top: 0; z-index: 25; transition: opacity .4s ease; }
        .snav-root.off { opacity: 0; pointer-events: none; }
        /* the three lines: each one a bar that slides to the middle and turns, so they become the cross and come back */
        .snav-burger { position: fixed; left: 18px; top: 18px; width: 40px; height: 40px; padding: 0; border: none; border-radius: 12px; cursor: pointer;
                       background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07); transition: background .2s ease;
                       animation: sideIn .6s var(--ease) backwards; }
        .snav-burger:hover { background: rgba(255,255,255,0.13); }
        .snav-burger i { position: absolute; left: 11px; top: 19px; width: 18px; height: 2px; border-radius: 2px; background: var(--c-ink);
                         transition: transform .5s var(--ease), opacity .3s ease; }
        .snav-burger i:nth-child(1) { transform: translateY(-6px); }
        .snav-burger i:nth-child(3) { transform: translateY(6px); }
        .snav-root.open .snav-burger i:nth-child(1) { transform: translateY(0) rotate(45deg); }
        .snav-root.open .snav-burger i:nth-child(2) { opacity: 0; transform: scaleX(0.3); }
        .snav-root.open .snav-burger i:nth-child(3) { transform: translateY(0) rotate(-45deg); }
        @keyframes sideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        /* behind the panel the page dims a little; a press there shuts it */
        .snav-scrim { position: fixed; inset: 0; background: rgba(8,10,12,0.34); opacity: 0; pointer-events: none; transition: opacity .34s ease; }
        .snav-root.open .snav-scrim { opacity: 1; pointer-events: auto; transition-duration: .5s; }
        /* the panel: parked off the left edge while shut, slid in as one piece. No blur behind it and nothing see-through:
           the page passes under it */
        .snav { position: fixed; left: 10px; top: 10px; bottom: 10px; width: 228px; display: flex; flex-direction: column; gap: 2px; padding: 62px 12px 12px;
                border-radius: 20px; background: linear-gradient(180deg, #25282c 0%, #1c1f22 100%);
                box-shadow: 0 30px 70px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.075), inset 0 1px 0 rgba(255,255,255,0.06);
                user-select: none; -webkit-user-select: none; will-change: transform; pointer-events: none;
                transform: translateX(-118%); transition: transform .38s cubic-bezier(0.4, 0, 0.2, 1); }
        .snav-root.open .snav { transform: translateX(0); pointer-events: auto; transition: transform .54s var(--ease); }
        /* its lines: in one after the other as the panel arrives, out together as it leaves */
        .sd-in { flex-shrink: 0; opacity: 0; transform: translateX(-14px); transition: opacity .2s ease, transform .3s ease; }
        .snav-root.open .sd-in { opacity: 1; transform: translateX(0); transition: opacity .46s ease, transform .56s var(--ease); transition-delay: calc(90ms + var(--i) * 22ms); }
        .snav-name { position: absolute; left: 64px; top: 25px; font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 11px; letter-spacing: 2px; color: var(--c-ink);
                     -webkit-font-smoothing: none; }
        .sd-act, .sd-row { display: flex; align-items: center; gap: 10px; width: 100%; border: none; cursor: pointer; text-align: left; position: relative; flex-shrink: 0; }
        .sd-act { height: 38px; padding: 0 11px; margin-bottom: 8px; border-radius: 11px; font-size: 13.5px; font-weight: 650; color: #eef0f2;
                  background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); transition: background .15s ease, transform .2s var(--ease); }
        .sd-act:hover { background: rgba(255,255,255,0.15); }
        .sd-act:active { transform: scale(0.98); }
        .sd-act .msym { font-size: 19px; }
        .sd-act kbd { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--c-ink-3); }
        .sd-head { margin: 16px 11px 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #8b939a;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
        .sd-row { height: 34px; padding: 0 11px; border-radius: 9px; background: none; font-size: 13.5px; font-weight: 550; color: #b3bac0; transition: color .15s ease, background .15s ease; }
        .sd-row .msym { font-size: 18px; color: #858d95; transition: color .15s ease; }
        .sd-row i { margin-left: auto; font-style: normal; font-size: 12px; font-weight: 500; color: #8b939a; font-variant-numeric: tabular-nums; }
        .sd-row:hover { color: #ffffff; background: rgba(255,255,255,0.055); }
        .sd-row:hover .msym { color: var(--c-ink-1); }
        .sd-row.on { color: #ffffff; background: rgba(255,255,255,0.10); }
        .sd-row.on .msym, .sd-row.at .msym { color: var(--c-ink); }
        .sd-row.sub { height: 32px; font-size: 13px; }
        .sd-row.at { color: #ffffff; }
        .sd-row::before { content: ""; position: absolute; left: 1px; top: 9px; bottom: 9px; width: 3px; border-radius: 2px; background: var(--c-ink); opacity: 0;
                          transform: scaleY(0.4); transition: opacity .2s ease, transform .25s var(--ease); }
        .sd-row.at::before { opacity: 1; transform: scaleY(1); }
        .sd-gap { flex: 1; }
        .sd-foot { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: none; border-radius: 11px; background: none; cursor: pointer; text-align: left;
                   flex-shrink: 0; transition: background .15s ease; }
        .sd-foot:hover { background: rgba(255,255,255,0.055); }
        .sd-croc { position: relative; flex-shrink: 0; width: 26px; height: 26px; line-height: 0; display: inline-flex; align-items: center; justify-content: center; }
        .sd-croc img { display: block; height: 24px; width: auto; user-select: none; }
        .sd-drop { position: absolute; right: -2px; top: 0; width: 6px; height: 8px; border-radius: 50% 50% 50% 50% / 64% 64% 36% 36%; background: #8fd0ff;
                   animation: sdDrop .6s var(--ease) backwards; }
        .sd-ok { position: absolute; right: -3px; bottom: -1px; width: 9px; height: 9px; border-radius: 99px; background: var(--c-green); box-shadow: 0 0 0 2px #1c1f22;
                 animation: sdPop .45s var(--ease) backwards; }
        @keyframes sdDrop { from { opacity: 0; transform: translateY(-5px) scale(0.6); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes sdPop { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        .sd-say { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
        .sd-say b { font-size: 12.5px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
        .sd-say small { font-size: 11px; font-weight: 500; color: var(--c-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
        /* a goal's bin shows when the pointer is on its row (the review: a red-bordered bin on every row was the loudest
           thing in the card). A debt's bin is in its edit line and always there */
        .goal-row:not(.debt-row) .trash-btn { opacity: 0; transition: opacity .18s ease, background .18s ease, border-color .18s ease, color .18s ease; }
        .goal-row:not(.debt-row):hover .trash-btn, .goal-row:not(.debt-row) .trash-btn:focus-visible { opacity: 1; }
        .cal-wrap, .flow-card, .debt-sec { scroll-margin-top: 22px; }
        .goal-icon-btn.on { color: var(--c-ink); }
        /* ---- accounts: the login screen and the select acc panel. One cover on the opening screen's own backdrop;
           every piece comes in on a transition (its turn is --i), so nothing can be caught half-way ---- */
        .av { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .sd-pic { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; box-shadow: 0 0 0 1px rgba(255,255,255,0.14); }
        /* the Dev account (a test tool, there only with the developer options on): the test tools' yellow round its
           picture wherever the picture stands: the select acc panel, the account button on the panels, the sidebar */
        .sd-pic.dev { box-shadow: 0 0 0 2px var(--c-gold); }
        .who-btn.dev .who-pic { box-shadow: 0 0 0 2px var(--c-gold), 0 6px 16px rgba(0,0,0,0.35); }
        .acc-tile.dev .acc-face { outline: 2px solid var(--c-gold); outline-offset: 4px; }
        .acc-pick.manage .acc-tile.dev { opacity: 0.35; pointer-events: none; }
        .acc { position: fixed; inset: 0; z-index: 250; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto;
               user-select: none; -webkit-user-select: none; transition: opacity .56s ease; }
        .acc.out { opacity: 0; pointer-events: none; }
        .acc-bg { position: fixed; inset: 0; background: radial-gradient(circle at 50% 48%, #43484f 0%, #2a2e33 34%, #17191c 70%, #0e1012 100%); }
        .acc-up { opacity: 0; transform: translateY(16px); transition: opacity .3s ease, transform .3s ease; }
        .acc.in .acc-up { opacity: 1; transform: translateY(0); transition: opacity .6s ease, transform .7s var(--ease); transition-delay: calc(140ms + var(--i) * 70ms); }
        .acc-pick, .acc-card { position: relative; transition: opacity .2s ease, transform .2s ease; }
        .acc-pick.fade, .acc-card.fade { opacity: 0; transform: scale(0.985); }
        .acc-card { animation: accSwap .46s var(--ease) backwards; }
        @keyframes accSwap { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        /* the select acc panel */
        .acc-pick { display: flex; flex-direction: column; align-items: center; animation: accSwap .46s var(--ease) backwards; }
        .acc-title { margin: 0 0 44px; font-size: 40px; font-weight: 650; letter-spacing: -0.02em; color: var(--c-ink-hi); }
        .acc-tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: 30px; max-width: 1060px; }
        .acc-tile { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 144px; padding: 0; border: none; background: none; cursor: pointer; outline: none; }
        .acc-face { position: relative; display: flex; align-items: center; justify-content: center; width: 144px; height: 144px; border-radius: 50%;
                    box-shadow: 0 0 0 0 rgba(255,255,255,0), 0 22px 44px rgba(0,0,0,0.42); transition: transform .34s var(--ease), box-shadow .3s ease; }
        .acc-face i { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 36px; font-style: normal; color: #ffffff;
                      background: rgba(10,11,13,0.62); opacity: 0; transition: opacity .28s ease; }
        .acc-name { font-size: 16px; font-weight: 550; color: var(--c-ink-3); transition: color .25s ease; white-space: nowrap; }
        .acc-tile:hover .acc-face, .acc-tile:focus-visible .acc-face { transform: translateY(-5px) scale(1.04); box-shadow: 0 0 0 3px var(--c-ink-hi), 0 30px 56px rgba(0,0,0,0.5); }
        .acc-tile:hover .acc-name, .acc-tile:focus-visible .acc-name { color: #ffffff; }
        .acc-tile.add .acc-face { background: linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.045));
                                  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1px rgba(255,255,255,0.08), 0 22px 44px rgba(0,0,0,0.34); }
        .acc-tile.add .acc-face .msym { font-size: 54px; color: var(--c-ink-2); transition: color .25s ease, transform .34s var(--ease); }
        .acc-tile.add:hover .acc-face, .acc-tile.add:focus-visible .acc-face { box-shadow: inset 0 1px 0 rgba(255,255,255,0.26), 0 0 0 3px var(--c-ink-hi), 0 30px 56px rgba(0,0,0,0.46); }
        .acc-tile.add:hover .acc-face .msym { color: #ffffff; transform: rotate(90deg); }
        .acc-pick.manage .acc-tile:not(.add) .acc-face i { opacity: 1; }
        .acc-pick.manage .acc-tile.add { opacity: 0.3; pointer-events: none; }
        .acc-pick.chosen .acc-tile { pointer-events: none; }
        .acc-pick.chosen .acc-tile:not(.me), .acc-pick.chosen .acc-title, .acc-pick.chosen .acc-manage { opacity: 0.2 !important; transition: opacity .3s ease !important; }
        .acc-pick.chosen .acc-tile.me .acc-face { transform: scale(1.1); box-shadow: 0 0 0 3px var(--c-ink-hi), 0 34px 60px rgba(0,0,0,0.5); }
        .acc-manage { margin-top: 62px; height: 40px; padding: 0 24px; border-radius: 4px; cursor: pointer; background: none; border: 1px solid var(--c-mute); color: var(--c-ink-3);
                      font-size: 13px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; }
        .acc.in .acc-manage:hover { color: #ffffff; border-color: #ffffff; }
        /* the login, and adding or editing an account: a card of the app's glass */
        .acc-card { width: min(520px, 94vw); padding: 30px 32px 26px; border-radius: 28px; display: flex; flex-direction: column;
                    background: linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.035) 100%);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.07), 0 44px 100px rgba(0,0,0,0.5); }
        .acc-me { position: relative; align-self: center; width: 96px; height: 96px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
                  box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 18px 40px rgba(0,0,0,0.45); }
        .acc-me.own { cursor: grab; touch-action: none; }
        .acc-me.own:active { cursor: grabbing; }
        .acc-own { position: absolute; left: 50%; top: 50%; max-width: none; pointer-events: none; }
        .acc-hello { margin: 18px 0 6px; text-align: center; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; color: var(--c-ink-hi);
                     white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acc-sub { margin: 0 0 20px; text-align: center; font-size: 14px; color: var(--c-ink-3); line-height: 1.45; }
        .acc-label, .acc-field > span { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--c-ink-3); }
        /* 48px across: three screen points to a square of the 16 x 16 grid, so the squares come out even */
        .acc-pics { display: grid; grid-template-columns: repeat(8, 48px); justify-content: space-between; row-gap: 10px; margin: 10px 0 16px; }
        .acc-me .av { position: relative; }
        /* the choices of background (.acc-bgc: .acc-back is the Back button) */
        .acc-bgs { display: flex; flex-wrap: wrap; gap: 10px 11px; margin: 10px 0 18px; }
        .acc-bgc { width: 36px; height: 36px; padding: 0; border: none; border-radius: 50%; background: none; cursor: pointer; overflow: hidden; opacity: 0.7; flex-shrink: 0;
                   display: flex; align-items: center; justify-content: center; transition: opacity .2s ease, transform .3s var(--ease), box-shadow .2s ease; }
        .acc-bgc > .av { width: 36px; height: 36px; flex-shrink: 0; }
        .acc-bgc:hover { opacity: 1; transform: scale(1.08); }
        .acc-bgc.on { opacity: 1; transform: scale(1.08); box-shadow: 0 0 0 2.5px var(--c-ink-hi); }
        .acc-bgc.mine { box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); }
        .acc-bgc.mine .msym { font-size: 18px; color: var(--c-ink); }
        .acc-bgc.mine.on { box-shadow: 0 0 0 2.5px var(--c-ink-hi); }
        .acc-pic.mine { display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); }
        .acc-pic.mine .msym { font-size: 22px; color: var(--c-ink); }
        .acc-pic.mine.on { box-shadow: 0 0 0 2.5px var(--c-ink-hi); }
        .acc-zoom { display: flex; align-items: center; gap: 10px; margin: -6px 0 18px; animation: fadeIn .3s ease backwards; }
        .acc-zoom .msym { font-size: 18px; color: var(--c-ink-3); }
        .acc-zoom input { flex: 1; min-width: 0; height: 18px; margin: 0; background: none; cursor: pointer; -webkit-appearance: none; appearance: none; outline: none; }
        .acc-zoom input::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.16); }
        .acc-zoom input::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%; background: var(--c-ink-hi); box-shadow: 0 2px 8px rgba(0,0,0,0.45); }
        .acc-other { height: 30px; padding: 0 12px; margin-left: 4px; border: none; border-radius: 9px; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--c-ink-2);
                     background: rgba(255,255,255,0.08); transition: background .2s ease, color .2s ease; }
        .acc-other:hover { background: rgba(255,255,255,0.15); color: #ffffff; }
        .acc-pic { position: relative; width: 48px; height: 48px; padding: 0; border: none; border-radius: 50%; background: none; cursor: pointer; opacity: 0.62;
                   transition: opacity .2s ease, transform .3s var(--ease), box-shadow .2s ease; }
        .acc-pic:hover { opacity: 1; transform: scale(1.08); }
        .acc-pic.on { opacity: 1; transform: scale(1.08); box-shadow: 0 0 0 2.5px var(--c-ink-hi); }
        .acc-field { position: relative; display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
        .acc-in { height: 46px; padding: 0 58px 0 14px; border-radius: 13px; font-size: 16px; font-weight: 550; color: var(--c-ink-hi); outline: none; user-select: text; -webkit-user-select: text;
                  background: rgba(16,18,21,0.55); border: 1px solid rgba(255,255,255,0.11); transition: border-color .2s ease, background .2s ease; }
        .acc-in::placeholder { color: #6d757d; font-weight: 450; }
        .acc-in:focus { border-color: rgba(255,255,255,0.55); background: rgba(16,18,21,0.72); }
        .acc-field em { position: absolute; right: 14px; bottom: 15px; font-style: normal; font-size: 11.5px; color: var(--c-mute); font-variant-numeric: tabular-nums; pointer-events: none; }
        .acc-acts { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
        .acc-go { margin-left: auto; height: 46px; padding: 0 30px; border: none; border-radius: 13px; cursor: pointer; font-size: 15px; font-weight: 700; color: #111315;
                  background: linear-gradient(180deg, #ffffff, #dfe2e5); box-shadow: 0 10px 26px rgba(0,0,0,0.35), inset 0 1px 0 #ffffff;
                  transition: opacity .25s ease, transform .2s var(--ease); }
        .acc-go:hover:not(:disabled) { transform: translateY(-1px); }
        .acc-go:active:not(:disabled) { transform: scale(0.98); }
        .acc-go:disabled { opacity: 0.32; cursor: default; }
        .acc-back, .acc-del { height: 46px; padding: 0 16px; border: none; border-radius: 13px; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--c-ink-2); background: rgba(255,255,255,0.07);
                              transition: background .2s ease, color .2s ease; }
        .acc-back:hover { background: rgba(255,255,255,0.13); color: #ffffff; }
        /* the introduction: its cards side by side on a track that slides (a transition: a press half-way turns it
           round), each as high as the highest, so the card never changes size */
        .acc-intro { padding-top: 34px; }
        .in-view { overflow: hidden; margin: 0 -32px; }
        .in-track { display: flex; transition: transform .62s var(--ease); will-change: transform; }
        .in-slide { flex: 0 0 100%; box-sizing: border-box; padding: 0 32px; display: flex; flex-direction: column; align-items: center; opacity: 0; transition: opacity .3s ease; }
        .in-slide.on { opacity: 1; transition: opacity .5s ease .1s; }
        .in-mark { display: flex; align-items: center; justify-content: center; width: 88px; height: 88px; border-radius: 50%; flex-shrink: 0; color: var(--tc);
                   background: radial-gradient(circle at 50% 36%, color-mix(in srgb, var(--tc) 28%, transparent), color-mix(in srgb, var(--tc) 9%, transparent));
                   box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 40px rgba(0,0,0,0.34); }
        .in-mark .msym { font-size: 42px; }
        .in-mark.logo { background: none; box-shadow: none; }
        .in-mark.logo img { display: block; height: 80px; width: auto; }
        .in-slide .acc-hello { align-self: stretch; }
        .in-slide .acc-sub { margin-bottom: 18px; max-width: 410px; }
        .in-list { list-style: none; margin: 0; padding: 0; align-self: stretch; display: flex; flex-direction: column; gap: 8px; }
        .in-list li { display: flex; align-items: center; gap: 13px; min-height: 46px; box-sizing: border-box; padding: 9px 14px; border-radius: 13px; background: rgba(16,18,21,0.42);
                      font-size: 14px; line-height: 1.4; color: #dfe3e6; }
        .in-list .msym { font-size: 20px; color: var(--tc); flex-shrink: 0; }
        .in-dots { display: flex; justify-content: center; gap: 8px; margin: 22px 0 16px; }
        .in-dots button { width: 7px; height: 7px; padding: 0; border: none; border-radius: 99px; cursor: pointer; background: #ffffff; opacity: 0.22;
                          transition: opacity .3s ease, transform .4s var(--ease); }
        .in-dots button.on { opacity: 1; transform: scale(1.3); }
        .acc-intro .acc-acts { margin-top: 0; }
        .acc-intro .acc-go { margin-left: 0; min-width: 104px; }
        .in-skip { margin-right: auto; height: 46px; padding: 0 6px; border: none; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--c-mute); transition: color .2s ease; }
        .in-skip:hover { color: #ffffff; }
        .in-back { transition: opacity .25s ease, background .2s ease, color .2s ease; }
        .in-back.off { opacity: 0; pointer-events: none; }
        .acc-del { color: var(--c-red-soft); background: rgba(255,93,108,0.08); }
        .acc-del:hover, .acc-del.sure { background: rgba(255,93,108,0.2); color: var(--c-red-pale); }
        /* ---- quick log (the ⌘N box): one line read as it is typed, the things logged most often under it ---- */
        .ql { width: min(620px, 92vw); margin-top: 17vh; border-radius: 18px; padding: 14px 16px 12px; animation: qlIn .26s var(--ease) backwards; }
        /* the backdrop behind it already blurs the page: a second blur on top of it is not drawn, the glass tint stands in
           for what it showed (the glass colour over the darkened, blurred page, worked out) */
        .ql.glass { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(34,35,37,0.94); }
        .ql.out { opacity: 0; transform: translateY(-8px) scale(0.985); transition: opacity .18s ease, transform .18s ease; }
        @keyframes qlIn { from { opacity: 0; transform: translateY(-12px) scale(0.975); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ql-line { display: flex; align-items: center; gap: 10px; }
        .ql-kind { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: 9px; border: none; cursor: pointer; flex-shrink: 0;
                   font-size: 12.5px; font-weight: 650; color: var(--c-red-pale); background: rgba(255,93,108,0.12); }
        .ql-kind i { width: 7px; height: 7px; border-radius: 99px; background: var(--c-red); }
        .ql-kind.inc { color: var(--c-green-pale); background: rgba(61,220,151,0.12); }
        .ql-kind.inc i { background: var(--c-green); }
        .ql-in { flex: 1; min-width: 0; height: 44px; background: none; border: none; outline: none; color: #ffffff; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }
        .ql-in::placeholder { color: var(--c-mute); font-weight: 500; }
        .ql-read { display: flex; align-items: center; gap: 8px; min-height: 30px; margin-top: 2px; padding: 0 2px 10px; font-size: 13.5px; color: var(--c-ink-3);
                   border-bottom: 1px solid rgba(255,255,255,0.07); }
        .ql-read b { color: var(--c-ink); font-weight: 650; }
        .ql-read i { font-style: normal; color: #5d656d; }
        .ql-read kbd { margin-left: auto; font-size: 11px; font-weight: 650; color: var(--c-ink-2); padding: 3px 7px; border-radius: 6px; background: rgba(255,255,255,0.09); }
        .ql-cat { display: inline-flex; align-items: center; gap: 5px; color: var(--c-ink-2); }
        .ql-cat .msym { font-size: 16px; }
        .ql-often { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 11px 2px 2px; }
        .ql-often > span { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #8b939a; margin-right: 3px; }
        .ql-chip { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: 99px; border: none; cursor: pointer; font-size: 13px; font-weight: 550;
                   color: var(--c-ink-1); background: rgba(255,255,255,0.07); transition: background .15s ease, transform .2s var(--ease); }
        .ql-chip b { font-weight: 600; color: var(--c-ink-3); font-variant-numeric: tabular-nums; }
        .ql-chip:hover { background: rgba(255,255,255,0.14); }
        .ql-chip:active { transform: scale(0.96); }
        .ql-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 2px 0; font-size: 12.5px; color: var(--c-ink-3); }
        .ql-foot b { color: var(--c-ink-1); font-weight: 600; font-variant-numeric: tabular-nums; }
        .ql-hint { color: var(--c-mute); }
        .ql-done { display: inline-flex; align-items: center; gap: 5px; color: var(--c-red-pale); font-weight: 600; animation: qlDone .3s var(--ease) backwards; }
        .ql-done.inc { color: var(--c-green-pale); }
        .ql-done .msym { font-size: 16px; }
        @keyframes qlDone { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .month-nav { display: inline-flex; align-items: center; gap: 8px; }
        .month-nav .nav-arrow { transition: opacity .3s ease, color .15s ease, transform .22s var(--ease); }
        /* at the first January or the last December of the year list there is nowhere further to go */
        .month-nav .nav-arrow:disabled { cursor: default; color: var(--c-ink-3); opacity: .25; }
        /* chart pop-up: the same hidden arrows, sitting right after the title */
        .chart-nav { display: inline-flex; align-items: center; gap: 6px; }
        .chart-per { display: inline-block; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .chart-lbl { display: inline-block; }
        .chart-lbl.next { animation: chartLblNext .26s var(--ease) backwards; }
        .chart-lbl.prev { animation: chartLblPrev .26s var(--ease) backwards; }
        @keyframes chartLblNext { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes chartLblPrev { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .chart-nav .nav-arrow { opacity: 0; transition: opacity .2s ease, color .15s ease; }
        .chart-nav:hover .nav-arrow, .chart-nav .nav-arrow:focus-visible { opacity: 1; }
        .chart-nav .nav-arrow:disabled { cursor: default; color: var(--c-ink-3); }
        .chart-nav:hover .nav-arrow:disabled { opacity: .25; }
        /* after a step the data redraws briskly; the slow first draw is only for opening */
        .ch-moved .line-sweep.slow { animation-duration: 1s; animation-delay: .04s; }
        .ch-moved .area-rise { animation-duration: .6s; animation-delay: .06s; }
        .trash-btn { display: inline-flex; align-items: center; justify-content: center; transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .trash-btn:hover { background: var(--c-red-pale) !important; border-color: var(--c-red-pale) !important; color: #111 !important; }
        .trash-lid { transition: transform .25s cubic-bezier(0.34, 1.4, 0.64, 1); transform-box: fill-box; transform-origin: 15% 85%; }
        .trash-btn:hover .trash-lid { transform: rotate(-26deg) translate(-1.5px, -1px); }
        .plus-btn span { display: inline-block; transition: transform .18s ease; }
        .plus-btn:hover span { transform: scale(1.25); }
        .draw-btn { display: inline-flex; align-items: center; justify-content: center; }
        .draw-btn svg rect { transform-box: fill-box; transform-origin: center center; }
        .draw-btn:hover .pi-h { animation: drawH .38s cubic-bezier(0.34,1.2,0.64,1) both; }
        .draw-btn:hover .pi-v { animation: drawV .38s cubic-bezier(0.34,1.2,0.64,1) .06s both; }
        @keyframes drawH { from { transform: scaleX(0.18); } to { transform: scaleX(1); } }
        @keyframes drawV { from { transform: scaleY(0.18); } to { transform: scaleY(1); } }
        .collapse-btn { overflow: hidden; }
        .collapse-btn span { display: inline-block; }
        .collapse-btn .ca-rot { transition: transform .38s cubic-bezier(0.34,1.3,0.64,1); }
        .collapse-btn:hover .ca-loop { animation: arrowLoop .42s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes arrowLoop {
          0% { transform: translateY(0); }
          49% { transform: translateY(22px); }
          50% { transform: translateY(-22px); }
          100% { transform: translateY(0); }
        }
        .chip-flip { will-change: transform; }
        .ghost-plus { background: none; border: 1px solid #3a3f44; color: var(--c-ink-3); transition: background .18s ease, color .18s ease, border-color .18s ease; }
        .ghost-plus:hover { background: var(--c-green) !important; border-color: var(--c-green) !important; color: #111 !important; font-weight: 800 !important; }
        .limit-input { background: transparent; border: 1px solid transparent; transition: background .2s ease, border-color .2s ease; }
        .limit-input:hover, .limit-input:focus { background: rgba(8,10,13,0.32) !important; border-color: rgba(255,255,255,0.10) !important; outline: none; }      /* the wells' own fill: it was the raised grey box from before the glass */
        .limit-input:focus { border-color: rgba(255,255,255,0.55) !important; }
        .amt-field { transition: border-color .25s ease, box-shadow .25s ease; outline: none !important; }
        .amt-field.green:focus { border-color: var(--c-green) !important; box-shadow: 0 0 0 2px rgba(61,220,151,0.14); }
        .amt-field.red:focus { border-color: var(--c-red) !important; box-shadow: 0 0 0 2px rgba(255,93,108,0.14); }
        .desc-field { transition: border-color .25s ease, box-shadow .25s ease; outline: none !important; }
        .desc-field:focus { border-color: rgba(255,255,255,0.55) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.10); }
        .entry-row { transition: border-color .2s ease; }
        .entry-row.inc:hover { border-color: #2f7d5c !important; }
        .entry-row.exp:hover { border-color: #8f3b45 !important; }
        .entry-row input { background: transparent; border: none; outline: none; }
        /* several items added up into one expense (PartLines). The button beside the description, the total that
           stands in for the amount box, the count on a logged row */
        .split-btn { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 38px; padding: 0; border-radius: 11px; cursor: pointer;
                     background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: var(--c-ink-3);
                     transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .split-btn:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.10); }
        .split-btn.on { color: var(--c-red-soft); border-color: rgba(255,93,108,0.45); background: rgba(255,93,108,0.10); }
        .split-sum { border-style: dashed !important; pointer-events: none; }
        .split-tag { position: absolute; right: 11px; top: 0; height: 100%; display: flex; align-items: center; pointer-events: none;
                     font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-mute); }
        .parts-btn { display: inline-flex; align-items: center; gap: 3px; height: 26px; padding: 0 8px 0 6px; margin-left: 6px; border-radius: 8px; cursor: pointer; flex-shrink: 0;
                     background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: var(--c-ink-3);
                     font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums;
                     transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .parts-btn:hover { color: var(--c-ink); border-color: rgba(255,255,255,0.24); }
        .parts-btn.on { color: var(--c-red-soft); border-color: rgba(255,93,108,0.40); background: rgba(255,93,108,0.08); }
        /* the list unfolds and shuts like the developer options' sections, and turns round from where it is; the lines
           hang off a thin guide under the row they belong to. A line unfolds as it comes and folds away as it goes */
        .parts-fold { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .28s cubic-bezier(0.4,0,0.2,1); }
        .parts-fold.open { grid-template-rows: 1fr; }
        .parts-fold > div { min-height: 0; overflow-x: visible; overflow-y: clip; }
        .parts { margin-left: 14px; padding: 2px 0 0 10px; border-left: 1px solid rgba(255,93,108,0.28); opacity: 0; transform: translateY(-8px);
                 transition: opacity .2s ease, transform .28s cubic-bezier(0.4,0,0.2,1); }
        .parts-fold.open .parts { opacity: 1; transform: none; }
        .pt-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .24s cubic-bezier(0.4,0,0.2,1), opacity .18s ease;
                   animation: ptIn .24s cubic-bezier(0.4,0,0.2,1) backwards; }
        .pt-wrap.out { grid-template-rows: 0fr; opacity: 0; }
        .pt-wrap > div { min-height: 0; overflow: hidden; }
        @keyframes ptIn { from { grid-template-rows: 0fr; opacity: 0; } to { grid-template-rows: 1fr; opacity: 1; } }
        .pt-line { display: flex; align-items: center; margin-top: 6px; border-radius: 10px; padding: 1px 6px; min-width: 0; transition: border-color .2s ease, box-shadow .2s ease; }
        .pt-line:hover { border-color: rgba(255,255,255,0.16); }
        /* the line being typed in is outlined in white, round corners and all: the boxes in it have no outline of their
           own (the page-wide green glow of a box in use is square, and was drawn inside the line) */
        .pt-line:focus-within { border-color: rgba(255,255,255,0.82); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.26); }
        .pt-line input { background: transparent; border: none; outline: none; min-width: 0; font-size: 13px; }
        .pt-line input:focus, .jr-pnl input:focus, .an-bal input:focus, .tcfg-num input:focus { box-shadow: none; }
        .pt-amt { position: relative; flex: 0 0 var(--pw); }
        .pt-amt input { width: 100%; padding: 7px 10px; font-weight: 600; color: #ff7a86; }
        .pt-ghost { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; padding: 0 10px; font-size: 13px; font-weight: 600;
                    pointer-events: none; font-variant-numeric: tabular-nums; white-space: pre; color: var(--c-mute); }
        .pt-div { width: 1px; height: 16px; background: #3a3f44; flex-shrink: 0; }
        .pt-name { flex: 1; padding: 7px 12px; color: var(--c-ink-2); }
        .pt-x { background: none; border: none; color: var(--c-mute); width: 26px; height: 26px; padding: 0; font-size: 10px; cursor: pointer; flex-shrink: 0; transition: color .18s ease; }
        /* liquid-glass chart bubble */
        /* the outer box only positions; opacity/scale animate on the glass itself, because a fading
           parent would cut the blur off from the chart behind it */
        .glass-tip { position: absolute; z-index: 5; pointer-events: none; transform: translate(-50%, calc(-100% - 16px)); }
        .glass-tip-inner { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 104px; padding: 9px 16px 10px;
                     border-radius: 16px; white-space: nowrap; position: relative; overflow: hidden;
                     background: linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.07) 100%), rgba(22,25,29,0.38);
                     backdrop-filter: blur(26px) saturate(170%); -webkit-backdrop-filter: blur(26px) saturate(170%);
                     animation: glassTipIn .22s cubic-bezier(0.34,1.35,0.64,1) both; transform-origin: 50% 100%;
                     border: 1px solid rgba(255,255,255,0.22);
                     box-shadow: 0 16px 36px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.25),
                                 inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 18px rgba(255,255,255,0.05); }
        .glass-tip-inner::before { content: ""; position: absolute; inset: 0 0 55% 0; border-radius: 16px 16px 40% 40%;
                     background: linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0)); pointer-events: none; }
        .glass-tip-label { position: relative; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(232,234,236,0.62); }
        .glass-tip-value { position: relative; font-size: 15px; font-weight: 800; color: #ffffff; font-variant-numeric: tabular-nums;
                     text-shadow: 0 1px 8px rgba(0,0,0,0.35); }
        @keyframes glassTipIn { from { opacity: 0; transform: translateY(8px) scale(.9); } to { opacity: 1; transform: none; } }
        .glass-tip.below { transform: translate(-50%, 16px); }
        .glass-tip.below .glass-tip-inner { transform-origin: 50% 0%; animation-name: glassTipInBelow; }
        @keyframes glassTipInBelow { from { opacity: 0; transform: translateY(-8px) scale(.9); } to { opacity: 1; transform: none; } }
        .tip-dot { filter: drop-shadow(0 0 6px rgba(255,255,255,0.55)); }
        /* in-page cards sit on a smooth fixed gradient: blurring it is visually identical but costs a full-card
           GPU blur on every scrolled frame. Real blur is kept for things that float over content. */
        .flow-card.glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
                .cell:hover > .cell-tip { backdrop-filter: blur(18px) saturate(150%) !important; -webkit-backdrop-filter: blur(18px) saturate(150%) !important; }
        .cell-tip {
          background: rgba(30,34,39,0.94) !important;
          border: 1px solid rgba(255,255,255,0.20) !important;
          box-shadow: 0 14px 30px rgba(0,0,0,0.5) !important;
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
          position: absolute; bottom: calc(100% + 8px); left: 50%;
          transform: translateX(-50%) translateY(5px) scale(0.95);
          opacity: 0; pointer-events: none;
          transition: opacity .18s ease, transform .18s ease; z-index: 20; white-space: nowrap;
        }
        .cell:hover .cell-tip, .ycell:hover .cell-tip { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        .row-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .26s cubic-bezier(0.4,0,0.2,1), opacity .2s ease; }
        .row-wrap.collapsing { grid-template-rows: 0fr; }
        /* ---- a logged row moved to another day by its bar (rowDrag). Only transform and opacity move. The bar is as
           it was at rest (1px, 20px high); what the pointer can take hold of reaches a little past it, and under the
           pointer a lighter, thicker bar shows on top of it ---- */
        /* ---- planned expenses, under the weekly chart (WeekPlans). Blue-grey is information: a plan is neither spent nor saved ---- */
        .wp { margin-top: 18px; padding-top: 16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.07); }
        .wp-pick { display: flex; align-items: center; padding: 4px 3px; border-radius: 11px; background: rgba(16,18,21,0.5); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07); }
        .wp-pick i { font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--c-mute); padding: 0 9px 0 10px; }
        /* the day chosen stands in a dashed red outline that slides to the day pressed (11 October 2026: "make the
           animation slide when choosing another date", then "the selected date should have a dotted red outline").
           The days are boxes of one width (72px, 2px apart), so the outline is one piece of that width, moved by
           --at days and never resized */
        .wp-days { position: relative; display: inline-flex; gap: 2px; }
        .wp-days button { position: relative; width: 72px; padding: 6px 0; border: none; background: none; cursor: pointer; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--c-mute);
                          white-space: nowrap; text-align: center; font-variant-numeric: tabular-nums; transition: color .2s ease; }
        .wp-days button:hover, .wp-days button.on { color: var(--c-ink-hi); }
        .wp-on { position: absolute; left: 0; top: 0; bottom: 0; width: 72px; border-radius: 8px; pointer-events: none; border: 1.5px dashed var(--c-red); background: rgba(255,93,108,0.09);
                 transform: translateX(calc(var(--at) * 74px)); transition: transform .34s var(--ease-soft); will-change: transform; }
        .wp .amt-field { border-color: rgba(255,93,108,0.38) !important; }
        .wp-amt { color: var(--c-red) !important; }
        /* the weekly chart's two arrows, and a day's note pressed open (WeekPin) */
        .wk-step:disabled { opacity: 0.3; }
        .wk-step .msym { font-size: 20px; }
        .glass-tip.pin { pointer-events: auto; z-index: 9; }
        .glass-tip.pin .glass-tip-inner { align-items: center; min-width: 228px; max-width: 320px; padding: 11px 14px 12px; transition: opacity .17s ease, transform .17s ease; animation-fill-mode: backwards; }
        .glass-tip.pin .glass-tip-inner::before { inset: 0 0 auto 0; height: 34px; border-radius: 16px 16px 50% 50%; }
        .glass-tip.pin.shut .glass-tip-inner { opacity: 0; transform: scale(0.95); }
        .wkp-list { position: relative; align-self: stretch; display: flex; flex-direction: column; gap: 6px; margin-top: 9px; padding-top: 9px;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.14); text-align: left; }
        /* only a long day scrolls: with the rule on every list, a bar showed beside three rows */
        .wkp-list.many { max-height: 172px; overflow-y: auto; padding-right: 2px; }
        .wkp-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
        .wkp-row .msym { font-size: 15px; color: #aab1b8; flex-shrink: 0; }
        .wkp-row > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: #e2e6ea; }
        .wkp-row b { font-weight: 700; color: #ffffff; font-variant-numeric: tabular-nums; padding-left: 10px; }
        .wkp-row.plan > span:nth-child(2), .wkp-row.plan b { color: var(--c-red-pale); }
        .wkp-row.plan .msym { color: var(--c-red-soft); }
        .wkp-none { font-size: 12px; color: rgba(232,234,236,0.6); text-align: center; }
        .wp-row { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; padding: 6px 7px 6px 12px; border-radius: 11px; }
        .wp-day { flex-shrink: 0; min-width: 92px; font-size: 12px; font-weight: 700; color: #8fa3b8; font-variant-numeric: tabular-nums; }
        .wp-name { flex: 1; min-width: 0; font-size: 14px; color: var(--c-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .wp-amt { font-size: 14px; font-weight: 700; color: var(--c-ink); font-variant-numeric: tabular-nums; }
        .wp-do { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 32px; padding: 0; margin-left: 2px; border-radius: 10px; cursor: pointer; flex-shrink: 0;
                 color: var(--c-green-soft); background: rgba(61,220,151,0.06); border: 1px solid rgba(61,220,151,0.26); transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .wp-do:hover { color: #c9f2dd; background: rgba(61,220,151,0.14); border-color: rgba(61,220,151,0.5); }
        .wp-do .msym { font-size: 18px; }
        .wp-row .trash-btn { margin-left: 0 !important; }
        .row-grip { position: relative; width: 1px; height: 20px; background: #3a3f44; flex-shrink: 0; cursor: grab; touch-action: none; }
        .row-grip::before { content: ""; position: absolute; inset: -9px -7px; }
        .row-grip::after { content: ""; position: absolute; left: -1px; top: -2px; width: 3px; height: 24px; border-radius: 2px; background: var(--c-ink-2); pointer-events: none;
                           opacity: 0; transform: scaleY(0.7); transition: opacity .16s ease, transform .22s var(--ease); }
        .row-grip:hover::after, .row-grip.held::after { opacity: 1; transform: scaleY(1); }
        .row-grip.held { cursor: grabbing; }
        .row-wrap.dnd-src { opacity: 0.3; }
        .row-wrap.gone { opacity: 0; }
        .cal-dnd .cell { pointer-events: none; }
        .cal-ring { position: absolute !important; left: 0; top: 0; z-index: 8 !important; width: 0; height: 0; border-radius: 15px; pointer-events: none; opacity: 0;
                    box-shadow: 0 0 0 2px var(--c-ink-hi), 0 0 28px rgba(255,255,255,0.24); transition: opacity .18s ease, transform .22s var(--ease); will-change: transform, opacity; }
        .cal-ring.on { opacity: 1; }
        .dnd-chip { position: fixed; left: 0; top: 0; z-index: 400; pointer-events: none; will-change: transform; }
        .dnd-chip-in { display: flex; align-items: center; height: 38px; max-width: 330px; padding: 0 15px 0 13px; border-radius: 12px; white-space: nowrap; font-size: 14px;
                       background: #2b2f34; box-shadow: 0 20px 44px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.13);
                       opacity: 0; transform: scale(0.8); transition: opacity .16s ease, transform .26s var(--ease); }
        .dnd-chip.on .dnd-chip-in { opacity: 1; transform: scale(1); }
        .dnd-chip.in .dnd-chip-in { opacity: 0; transform: scale(0.4); transition: opacity .26s ease, transform .28s ease; }
        .dnd-chip-in b { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--c-red); }
        .dnd-chip-in.inc b { color: var(--c-green); }
        .dnd-chip-in i { width: 3px; height: 22px; margin: 0 11px; border-radius: 2px; background: var(--c-ink-2); flex-shrink: 0; }
        .dnd-chip-in span { color: var(--c-ink-2); overflow: hidden; text-overflow: ellipsis; }
        .axis-fade { animation: axisIn .35s ease both; }
        /* axes grow out of the origin */
        .axis-y {
          transform-box: fill-box; transform-origin: bottom center;
          animation: axisGrow .5s var(--ease) both;
        }
        .axis-x {
          transform-box: fill-box; transform-origin: left center;
          animation: axisGrow .6s var(--ease) .12s both;
        }
        @keyframes axisGrow { from { transform: scale3d(1,0.02,1); opacity: 0.4; } to { transform: scale3d(1,1,1); opacity: 1; } }
        .axis-x { animation-name: axisGrowX; }
        @keyframes axisGrowX { from { transform: scale3d(0.02,1,1); opacity: 0.4; } to { transform: scale3d(1,1,1); opacity: 1; } }

        /* one continuous sweep from the first point to the right */
        .line-sweep {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          animation: drawLine 1.7s var(--ease-soft) .3s both;
        }
        .line-sweep.slow { animation-duration: 1.9s; animation-delay: .36s; }

        /* the gradient fill rises from the zero line */
        .area-rise {
          transform-box: view-box;
          animation: areaRise 1.1s var(--ease) .42s both;
        }
        @keyframes areaRise { from { transform: scaleY(0.04); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }

        /* chart tooltip settles smoothly between points */
        .ch-tip { animation: chTipIn .2s var(--ease) both; }
        @keyframes chTipIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .line-draw { stroke-dasharray: 1; animation: drawLine .55s ease both; }
        .bar-grow { animation: growBar .4s ease both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes axisIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawLine { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes growBar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes fadeRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tileIn {
          0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.85); }
          25% { opacity: 0.6; }
          70% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes panelOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-16px) scale(0.97); } }
        @keyframes popOutCenter {
          0% { opacity: 1; transform: scale(1); }
          45% { opacity: 0.85; transform: scale(1.06); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalPop { 0% { opacity: 0; transform: scale(0.94) translateY(12px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modalPopOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.96) translateY(8px); } }

        /* ================= LIQUID GLASS (12 October 2026) =================
           His brief: "overall improve the UI design ... the overall inspo is the ios 27 liquid glass UI", with other
           finance apps and trading terminals as reference. The layout, the fonts and every colour role stay; what
           changes is the material. Everything here is static paint, written last so it wins over the rules above at
           the same strength. The save point from before it is savepoints/before_glass_redesign.jsx.
           - A glass surface is a see-through fill that is lighter at the top, a fine edge that catches the light
             (brightest at the top-left corner, faint along the sides, a second softer glint at the bottom-right),
             and a soft shadow under it in two parts: one close, one wide.
           - On the cards that fold (.flow-card) the edge is made of inset shadows and the sheen has a fixed height,
             never a mask or a gradient sized from the card: a fold changes the card's height on every frame, and
             what is sized from the height is drawn again each time (the fold lag of 4 October 2026).
           - The edge drawn with a mask (just below) is only on things whose size never moves: the month's hero,
             the calendar, the floating buttons.
           - No new backdrop-filter anywhere. */
        html { background: #0f1114; }

        /* the light-catching edge, as a ring cut out of a gradient: one masked layer, painted once */
        .hero::after, .cal-wrap::after, .snav-burger::after, .calc-fab.glass::after, .year-nav::after {
          content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 3; padding: 1px;
          background: var(--lg-rim);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
        }

        /* the shared material (.glass, .glass-soft) is changed where it is first written, near the top of the styles,
           so that everything written after it that refines it (the score boxes' wash, the pop-ups' own fills) still wins */

        /* ---- the cards of a month ---- */
        .flow-card.glass {
          background: linear-gradient(180deg, rgba(255,255,255,0.058) 0px, rgba(255,255,255,0.02) 220px, rgba(255,255,255,0) 520px) 0 0 / 100% 520px no-repeat,
                      rgba(27,30,35,0.58);     /* down to nothing at its end: stopping at 0.008 left a faint line across a tall card */
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.045), inset 0 -1px 0 rgba(255,255,255,0.03), var(--lg-drop);
        }
        .flow-card.glass:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.045), inset 0 -1px 0 rgba(255,255,255,0.03), var(--lg-drop); }
        .card-tag { box-shadow: inset 0 1px 0 rgba(255,255,255,0.10); backdrop-filter: none; }
        .hero-tag, .hero-vs { box-shadow: inset 0 1px 0 rgba(255,255,255,0.10); }

        /* ---- the month's hero: tinted glass, its colour in the edge too ---- */
        .hero {
          background: radial-gradient(900px 300px at 0% 0%, color-mix(in srgb, var(--hc) 22%, transparent), transparent 70%),
                      radial-gradient(640px 260px at 100% 100%, color-mix(in srgb, var(--hc) 9%, transparent), transparent 72%),
                      linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015) 60%), rgba(24,27,31,0.5);
          box-shadow: inset 0 1.5px 0 color-mix(in srgb, var(--hc) 62%, transparent), inset 0 0 0 1px rgba(255,255,255,0.04),
                      0 -1px 26px color-mix(in srgb, var(--hc) 16%, transparent), var(--lg-drop);
        }
        .hero::after { background: linear-gradient(150deg, color-mix(in srgb, var(--hc) 70%, rgba(255,255,255,0.6)) 0%, color-mix(in srgb, var(--hc) 30%, transparent) 16%,
                                                   rgba(255,255,255,0.03) 36%, rgba(255,255,255,0) 54%, rgba(255,255,255,0.03) 76%, color-mix(in srgb, var(--hc) 34%, rgba(255,255,255,0.14)) 100%); }
        .hero-tile:first-child {
          background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), color-mix(in srgb, var(--tc) 10%, rgba(20,22,26,0.4));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px color-mix(in srgb, var(--tc) 16%, rgba(255,255,255,0.03)), 0 10px 26px -14px rgba(0,0,0,0.6);
        }
        .term .hero-tile, .term .hero-tile:first-child, .term .hero-tile:not(:first-child) {
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018)), rgba(14,16,19,0.45);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.035);
        }

        /* ---- the calendar's tray ---- */
        .cal-wrap {
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.016) 40%, rgba(255,255,255,0.008) 100%), rgba(24,27,31,0.42);
          box-shadow: var(--lg-drop) !important;
        }

        /* ---- day tiles and month boxes: clear glass chips, lit from the top ---- */
        .cell, .ycell { box-shadow: inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -1px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.22), 0 8px 18px -10px rgba(0,0,0,0.55); }
        .cell:hover, .ycell:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.22), 0 16px 28px -12px rgba(0,0,0,0.6); }
        .cell.today { box-shadow: 0 0 0 1px rgba(127,182,224,0.5), 0 0 22px rgba(127,182,224,0.28), inset 0 1px 0 rgba(255,255,255,0.12); }

        /* ---- controls: glass capsules ---- */
        .snav-burger {
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.045)), rgba(32,35,40,0.6);
          box-shadow: 0 1px 2px rgba(0,0,0,0.25), 0 10px 24px -8px rgba(0,0,0,0.55);
        }
        .snav-burger:hover { background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.07)), rgba(36,39,44,0.62); }
        .snav-burger i { z-index: 4; }
        .calc-fab.glass, .year-nav {
          background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03)) !important;
          border-color: rgba(255,255,255,0.06) !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.22), 0 14px 32px -10px rgba(0,0,0,0.55) !important;
        }
        .calc-fab.glass { border-radius: 50%; width: 48px; height: 48px; }
        .year-nav { border-radius: 24px; }
        /* the month switcher is one glass capsule, the way a toolbar groups its controls; the currency pill stands beside it */
        .month-nav { padding: 2px 6px; border-radius: 99px; background: linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.022));
                     box-shadow: inset 0 1px 0 rgba(255,255,255,0.11), inset 0 0 0 1px rgba(255,255,255,0.055), 0 4px 14px -8px rgba(0,0,0,0.55); }
        .term .month-nav { border-radius: 6px; padding: 2px 4px; }
        .term .cur-btn, .term .cur-tag, .term .chart-btn { border-radius: 5px !important; }
        .cur-btn, .chart-btn, .x-btn { box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 12px -6px rgba(0,0,0,0.5); }
        /* the way into the quick log on the finance month: a capsule of the currency pill's glass in the strip under the
           title, as high as the boxes beside it. It and the daily limit are one group at the row's right end */
        .log-side { display: flex; align-items: center; gap: 14px; margin-left: auto; }
        .log-pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 10px; border-radius: 99px; cursor: pointer;
                    font-size: 13px; font-weight: 600; color: var(--c-ink); white-space: nowrap; border: 1px solid rgba(255,255,255,0.10);
                    background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035));
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.13), 0 4px 12px -6px rgba(0,0,0,0.5); }
        .log-pill:hover { border-color: #6a7178; color: #ffffff; }
        .log-pill:active { transform: scale(0.97); }
        .log-pill .msym { font-size: 18px; }
        .log-pill kbd { font-size: 11px; font-weight: 600; color: var(--c-ink-3); margin-left: 3px; }
        .ghost-plus { background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)); border-color: rgba(255,255,255,0.10);
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.10); }
        .bk-tip, .info-tip { box-shadow: 0 22px 50px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12); }

        /* ---- the sidebar: solid, as it was, with the same lit edge ---- */
        .snav { background: linear-gradient(180deg, #282c31 0%, #1d2024 55%, #191b1f 100%);
                box-shadow: 0 30px 70px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.13); }
        .sd-act { background: linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.06)); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.12); }

        /* ---- pop-ups ---- */
        .wr-tile { box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.04); }

        /* ---- small symbols are easier to press than they look (12 October 2026): the press area reaches a few px
           past the drawing (the x on an income chip was 9px wide, the month's arrows 16). Nothing is drawn. The
           weekly chart's three stand close together, so theirs grows upwards and downwards only ---- */
        .chip-x, .plain-arrow.chev, .month-nav .nav-arrow, .goal-sym { position: relative; }
        .chip-x::after, .plain-arrow.chev::after, .month-nav .nav-arrow::after, .goal-sym::after { content: ""; position: absolute; inset: -7px -6px; }
        /* the same on the trading sides (13 October 2026): the x beside a calculator's target (15px wide) and the x on a trade's picture (18px) */
        .pc-x::after { content: ""; position: absolute; inset: -6px -7px; }
        .jr-shot-x::after { content: ""; position: absolute; inset: -5px; }
        .wk-cmp::after { content: ""; position: absolute; inset: -7px -3px; }
        /* Reduce motion (13 October 2026): for somebody whose Mac is set to "Reduce motion". Nothing here is read
           otherwise. The same rules and timings run, only the keyframes are swapped for calm ones, so every
           wait in the script still fits: what travelled or spun fades on the spot, the idle floats hold still,
           the title's flicker is one cross-fade, the toss is the coin standing still until the fade. */
        @media (prefers-reduced-motion: reduce) {
          html, body { scroll-behavior: auto; }
          @keyframes mvIn { from { opacity: 0; } }
          @keyframes modalPop { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalPopOut { from { opacity: 1; } to { opacity: 0; } }
          @keyframes openFall { to { opacity: 0; } }
          @keyframes swFloat {} @keyframes floaty {} @keyframes coinFloat {} @keyframes idxFloat {} @keyframes fxRock {}
          @keyframes coinSpin1 {} @keyframes coinSpin2 {} @keyframes coinSpin3 {} @keyframes coinHop {}
          @keyframes coinBlur {} @keyframes coinSmearOut {} @keyframes coinSmearIn {}
          @keyframes ybN0 { from { opacity: 1; } to { opacity: 0; } } @keyframes ybP0 { from { opacity: 0; } to { opacity: 1; } }
          @keyframes ybN1 { from { opacity: 1; } to { opacity: 0; } } @keyframes ybP1 { from { opacity: 0; } to { opacity: 1; } }
          @keyframes ybN2 { from { opacity: 1; } to { opacity: 0; } } @keyframes ybP2 { from { opacity: 0; } to { opacity: 1; } }
          @keyframes overPulse { 0% { opacity: 0; } 28% { opacity: 0.9; } 100% { opacity: 0; } }
        }

```
