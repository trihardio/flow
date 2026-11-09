# Code map

Back to [[HOME]] · Made by `tools/vault/codemap.mjs`, run by `npm run check`: **don't edit by hand**. The numbers are lines of `src/App.jsx` (or `electron/main.cjs`) at the last check: read the file at that line instead of searching it. A file edited since the last check may have moved by a few lines.

## Key tables and helpers
`store` 379 · `rawStore` 333 · `flowEl` 281 · `ld` 127 · `toLight` 164 · `lightCss` 310 · `LIGHT_EXTRA` 1305 · `PAGE_BG` 1270 · `TILE` 1763 · `LG_LENS` 149 · `GLASS_KEY` 134 · `glassK` 137 · `THEME_KEY` 113 · `migrateSpending` 1616 · `migrateIncomes` 1670 · `MAX_AMOUNT` 1595 · `fmt` 23137 · `fmtLive` 23158 · `liveText` 1233 · `curBody` 7003 · `curLive` 7011 · `sanitizeAmount` 2711 · `grp` 7404 · `SHOT_KEYS` 6790 · `CARD_TINT` 9252 · `DG_W` 10360 · `DG_SIZE` 10351 · `DGH` 10827 · `dgPlan` 10834 · `dgRoom` 10829 · `dgRows` 10846 · `projectMonth` 6419 · `useCmds` 1527 · `openCtx` 1473 · `warmWhenIdle` 593 · `warmFonts` 1194 · `YEARS` 15082 · `hlReadTimetable` 20351 · `hlAsgReadMany` 19238 · `CROC_LOGO` 2059

## Shared pieces (every side)
Notes: [[notes/style]]

`BkTip` 533 · `Linger` 538 · `CountNum` 1813 · `Num` 1825 · `CurrencyRoll` 1942 · `DigitRoll` 1955 · `InfoTip` 2263 · `PlusIcon` 6735 · `MinusIcon` 6741 · `CurRoll` 7028 · `SlideSeg` 7045 · `Pick` 7076

## Undo
Notes: [[notes/data-export-undo]]

`UndoNote` 1441

## Navigation and settings
Notes: [[notes/navigation-settings]]

`CtxMenu` 1479 · `CmdBar` 1532 · `Kb` 3928 · `SideNav` 4272 · `HamburgerIcon` 6232 · `ThemeSwitch` 7659 · `GlassSlider` 7675 · `SetSay` 7718 · `SetGroup` 7735 · `KbFold` 7747 · `XcleanNote` 7822 · `SettingsPop` 7835 · `SetDo` 7898 · `SetNum` 7904

## Charts
Notes: [[notes/charts]]

`GhostLine` 1912 · `CmpButton` 1920 · `RangePop` 4980 · `HoverSlot` 5821 · `GlassTip` 5828

## Panels before an app
Notes: [[notes/stage]]

`SimChip` 1969 · `CardPattern` 2003 · `CrocLogo` 2060 · `CardFace` 2301 · `PuzzleBody` 2319 · `ArenaSkin` 2346 · `ArenaBody` 2354 · `Chevron` 2385 · `PythonBody` 2392 · `CoinFace` 2559 · `BtcCoin` 2568 · `FxDie` 2589 · `IdxGlobe` 2680 · `RollWord` 3570 · `HlRings3D` 22829 · `FaWallet` 22867 · `FaCoin` 22881 · `FaGlobe` 22892 · `FaDie` 22903 · `FootLogo` 22915

## Accounts
Notes: [[notes/accounts]]

`AvBack` 2213 · `Avatar` 2217 · `AccountGate` 3614

## Logging on the finance side
Notes: [[notes/finance-day]]

`TrashIcon` 2696 · `AmountField` 2774 · `NoteFold` 3037 · `PartLines` 3184 · `QlDate` 3952 · `QuickLog` 3990 · `RowAmt` 4516

## Split bill
Notes: [[notes/split-bill]]

`SplitFold` 3074 · `BillRate` 3349 · `BillSplit` 3358

## Year and month panels, wrapped
Notes: [[notes/year-month-panels]]

`PxCount` 3255 · `PxFig` 3256 · `WrHeroNum` 3285 · `WrList` 5267 · `CatTitleReel` 6257 · `CatReel` 6713 · `Reveal` 9234 · `FoldCard` 9255 · `PnlCalendar` 22934

## Trading
Notes: [[notes/trading]]

`TradeQuickLog` 4132 · `AnChart` 8856 · `PnlAnalysis` 8985 · `CoinRing` 9169 · `PairBox` 9305 · `SideChip` 9316 · `Shot` 9451 · `ShotView` 9465 · `JrRow` 9514 · `TradeSheet` 9520 · `TradeView` 9772 · `IdxBreakdown` 9864 · `DepositBox` 9911 · `TradeJournal` 9962 · `TradeTracker` 14850

## Money flow, goals, debts
Notes: [[notes/money-flow-goals]]

`SecHead` 4477 · `InsFold` 4491 · `Debts` 4594 · `SubPick` 4793 · `Subs` 4804 · `GoalRing` 5923 · `GoalBar` 5937 · `SplitBar` 5955 · `ProjChart` 6599 · `RulePop` 7154 · `InsB` 22932

## Weekly expenses
Notes: [[notes/weekly-plans]]

`WeekPlans` 4528 · `WeekendFund` 5142 · `WeekBox` 5843 · `WeekPin` 5863

## Test data
Notes: [[notes/dev-test-data]]

`CardFlask` 5508 · `PartTestPop` 5526 · `DayGrid` 5687 · `TestCfg` 5692 · `TradeTestCfg` 10201

## Calculators
Notes: [[notes/calculators]]

`PcStatus` 7321 · `QuoteChip` 7355 · `CalcUndo` 7936 · `PositionCalc` 7952 · `StockCalc` 8473

## Home widgets
Notes: [[notes/dashboard]]

`DgHead` 10853 · `DgChip` 10867 · `DgEmpty` 10885 · `DgAv` 10889 · `DgCat` 10895 · `DgLine` 10900 · `DgBars` 10930 · `DgSpendBars` 10947 · `DgRing` 10964 · `DgStat` 10981 · `DgFig` 10983 · `DgDots` 10990 · `DgStreakBody` 11021 · `DgBal` 11033 · `DgPnl` 11101 · `DgWin` 11157 · `DgCurve` 11206 · `DgCal` 11249 · `DgYear` 11285 · `DgNames` 11308 · `DgRecent` 11349 · `DgPrices` 11435 · `DgStreak` 11484 · `DgToday` 11512 · `DgSides` 11543 · `DgActs` 11613 · `DgFToday` 11641 · `DgFMonth` 11693 · `DgFWeek` 11724 · `DgFCal` 11760 · `DgFCats` 11795 · `DgFRecent` 11838 · `DgFGoals` 11870 · `DgFDebts` 11908 · `DgFYear` 11938 · `DgFIncome` 11960 · `DgArc` 12671 · `DgHBars` 12681 · `DgHWeekRings` 12694 · `DgHScore` 12708 · `DgHRings` 12739 · `DgHSteps` 12773 · `DgHHeat` 12798 · `DgHNext` 12837 · `DgHTodo` 12884 · `DgHShop` 12914 · `DgHWeight` 12941 · `DgHFuel` 12965 · `DgHBmi` 12986 · `DgHGym` 13009 · `DgMedal` 13087 · `DgHAwards` 13096 · `DgHVision` 13135 · `DashWidget` 13280 · `DgStack` 13299 · `DgGallery` 13489 · `DgPresets` 13620 · `HomeDash` 14314

## Money exchanger
Notes: [[notes/exchanger]]

`DgFx` 11995 · `FxRoll` 13837 · `CalcPad` 13945 · `FxDoor` 14008 · `Exchanger` 14033

## Time plan
Notes: [[notes/time-plan]]

`TpFig` 12229 · `TpRows` 12236 · `DgPlan` 12263 · `TimePlan` 12303

## Worth it
Notes: [[notes/worth-it]]

`WiStrip` 12514 · `WorthIt` 12525

## Health
Notes: [[notes/health]]

`HlNum` 17427 · `HlRings` 17448 · `HlMini` 17468 · `HlTodos` 17512 · `HlShopAdd` 17609 · `HlShopName` 17622 · `HlShop` 17629 · `ColorPick` 17710 · `HlSlide` 17783 · `TimeField` 17848 · `HlLibEdit` 17909 · `HlWeek` 17940 · `HlClsAll` 18423 · `HlReveal` 18582 · `HlLesItem` 18587 · `RichBox` 18674 · `HlLesson` 18831 · `HlClsNotes` 18888 · `HlAsg` 19355 · `HlAsgScanSheet` 19692 · `HlAsgList` 19766 · `HlHeads` 19877 · `HlScanSheet` 20413 · `HlSleepLog` 20527 · `HlMonthTip` 20611 · `HlActivity` 20627 · `HlBody` 20931 · `HlWeightChart` 20987 · `HlDiet` 21020 · `HlNumLive` 21101 · `HlGym` 21116 · `HlBoard` 21254 · `CardArrange` 21472 · `HlWrapped` 21669 · `HealthApp` 21940

## The Mac shell (electron/main.cjs)
Notes: [[notes/shell]]

`freeName` 61 · `exportSide` 67 · `keepBackup` 81 · `backupInfo` 95 · `exportDirs` 104 · `exportAge` 105 · `exportOlds` 112 · `exportClean` 126 · `fileFind` 159 · `noteOpen` 187 · `noteReveal` 214 · `dueNotify` 229 · `dueAI` 250 · `phoneRead` 262 · `run` 283 · `ocrSkewOf` 316 · `ocrSkewLong` 339 · `ocrSkew` 344 · `ocrStraight` 350 · `ocrBmp` 364 · `ocrRead` 384 · `hasData` 408 · `gfxHome` 433 · `gfxHasCache` 442 · `gfxCold` 443 · `gfxPrimed` 450 · `packAiCache` 483 · `loadAiCache` 484 · `saveAiCache` 499 · `startAi` 506 · `aiPick` 524 · `warmAi` 553 · `askJson` 584 · `fetchRates` 585 · `tvScan` 608 · `tvPick` 613 · `priceText` 644 · `readQuote` 652 · `fetchFxTable` 687 · `fetchFxLive` 701 · `fetchQuote` 740 · `createWindow` 749

## Sections of App.jsx, in order
Its own banners. The stylesheet is one template near the end: liquid glass, Home and the rest of the look are there.

- 100 Light mode (13 October 2026: "make light mode version, can be toggled on and off in settings")
- 491 a copy a day (13 October 2026)
- 549 warm-up: the screens he has opened before are drawn once more, all but invisibly, under the opening screen
- 678 after the opening: the screens there was no time for under it
- 818 first launch: the graphics programs are built before anything moves
- 983 first launch: the panels before an app are gone through once, behind the backdrop
- 1430 undo for a delete (13 October 2026)
- 2058 the crocodile logo: the original artwork, background removed (192×179, own palette)
- 2422 the trading coin: a 3D Bitcoin coin for the selections panel
- 2580 forex: the currency die
- 2600 Indonesian stocks: the IDX globe
- 5285 test data: the generator
- 5413 test data: end of the generator
- 5636 test-data settings: the developer options (a double click on "Add test data")
- 6072 the monthly spending rule: end of the sums
- 6345 month-end projection: the maths
- 6588 month-end projection: end of the maths
- 6747 TRADING PnL TRACKER
- 6988 crypto tracker: currencies
- 7288 live prices: the latest price of the coin or stock typed in a calculator
- 7366 position calculator: the maths
- 7507 forex calculator: the maths (8 October 2026)
- 7585 position calculator: the pop-up
- 8330 stock calculator (IDX/IHSG): the maths
- 8454 stock calculator (IDX/IHSG): the pop-up
- 8816 trading side: PnL analysis, the first card under the calendar (after Bybit's P&L analysis page)
- 9323 pictures on a trade (crypto journal)
- 9476 trading journal (crypto day panel)
- 10322 Home: the dashboard of every side (20 October 2026)
- 10492 the board's arithmetic: places in cells, never in pixels
- 10651 the widgets' figures
- 10790 what each side's widgets read, worked out once per change of its figures
- 10819 fitting a widget's pieces into its room
- 10852 the widgets' parts
- 11032 the trading widgets
- 11640 the finance widgets
- 14472 moving and resizing: the page is written to directly while the pointer moves
- 14632 the other edits: each saved at once
- 14895 currency, exchange rates and the calculator's last levels: kept apart from the trades
- 14987 data: load once, then every change is written in order
- 15110 header year: the digits flicker from the normal font into the pixel font when the panel opens
- 15121 year stack: one scroll step per year
- 15179 month title flicker: the same one as the finance side
- 15202 the selected day and its trades
- 15259 chart pop-up: its own month / year, so browsing in it never moves the panel behind
- 15341 PnL analysis: its time frame, and the balance that its percentage and asset charts stand on
- 15379 the month in detail: coins, sides, best and worst trade
- 15398 wrapped: a year or a month looked back on, in the finance side's own pop-up
- 15509 backup: export / import the trades
- 15571 test data: adds to what's there; every generated trade carries test: true so it can be removed again
- 15872 performance: win rate, verdict and the numbers behind it
- 15974 coins: what each one made or lost this month
- 16016 CHART
- 16178 wrapped: the pop-up
- 16941 health: the maths (tools/health-test.mjs reads everything from here to "the maths end")
- 17039 health: the maths end
- 17356 health: what the page shows, worked out from the data
- 17446 health: the rings (Apple's, in this app's colours): steps outside, kcal moved, to-dos inside
- 20407 health: reading a timetable end
- 21447 health: the page
- 22081 everything a card can change, as one ref: the cards are memo'd and redraw only when what they show changes
- 22462 what the page shows
- 22540 backup
- 23323 backup: export / import the whole dataset
- 23424 test data (for trying the app out)
- 23827 recap ("wrapped") for a month or a year
- 23997 year stack: one scroll step per year
- 24529 categories
- 24659 chart pop-up: its own month / year
- 24711 ghost .000 helper
- 24762 weekly expense chart
- 25044 money flow (sankey)
- 25057 insights
- 25512 money efficiency score
- 25746 how the score is worked out (the number in the ring, pressed)
- 25861 month-end projection (money flow, between the efficiency score and the insights)
- 26060 test-data settings pop-up
- 26061 recap modal
- 26373 insights drop-down (inside money flow)
- 26435 goals
- 26583 dot add/remove animation
- 26607 CHART
- 26869 launch card (3D tilt + cursor light)
- 27014 open app panel: FLOW splash at app start, and again whenever the footer logo is pressed
- 27564 liquid glass surfaces
- 27649 trading panel (work in progress)
- 28071 greeting (card -> year)
- 28094 year opening animation
- 28233 year stack
- 28264 launch screen
- 28346 stage: wallet (phase 1) -> card (phase 2)
- 28539 Arena lambskin holder
- 28614 python holder
- 28658 card faces
- 28795 selections panel: the trading coin
- 28970 trading selection: the IDX globe (Indonesian stocks)
- 29013 metal cards
- 29081 leather card holder
- 30045 open app panel
- 30102 warm-up (see the top of the file): filed screens drawn for a few frames, all but invisibly
- 31352 LIQUID GLASS (12 October 2026)
- 31488 HOME: the trading dashboard (20 October 2026)
