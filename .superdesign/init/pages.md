<!-- made by a script from src/App.jsx (the whole app is that one file): line numbers are as of the day it was made -->
# Page dependency trees (one file: the "dependencies" are line ranges of src/App.jsx)

## Finance month
Entry: src/App.jsx (PnlCalendar, from line 9657)
Dependencies:
- day tiles (cells): src/App.jsx:12791:12930
- month header, income row, hero: src/App.jsx:17268:17392
- calendar grid and day panel: src/App.jsx:17393:17642
- styles: .hero 15788, .hero-tile 15835, .cal-wrap 13649, .glass 13669, tokens at 13616, the LIQUID GLASS block from 16699
- tile colours: TILE (src/App.jsx:1111)

## Trading month (crypto / stocks / forex)
Entry: src/App.jsx:7703:18023 (TradeTracker)
Dependencies:
- the same primitives (FoldCard, SlideSeg, GlassTip) and the same stylesheet; trading-only rules are under `.term`
