<p align="center">
  <img src="docs/art/banner.svg" alt="Flow: a pixel-art swamp at sunset with the word FLOW over the sky" width="100%">
</p>

<p align="center">
  <b>Your money, your health and your trades, each day on one calendar.</b><br>
  A private desktop app for Mac and Windows. Everything you enter stays on your computer.
</p>

<p align="center">
  <a href="https://github.com/trihardio/flow/releases/latest/download/Flow-Mac.dmg"><img src="docs/art/btn-mac.svg" alt="Download for Mac" height="52"></a>
  &nbsp;
  <a href="https://github.com/trihardio/flow/releases/latest/download/Flow-Windows-Setup.exe"><img src="docs/art/btn-win.svg" alt="Download for Windows" height="52"></a>
</p>

<p align="center"><sub>Mac: Apple silicon (M1 or newer) · Windows: 10 or 11, 64-bit · about 350 MB · <a href="https://github.com/trihardio/flow/releases/latest">all downloads</a></sub></p>

---

## What it is

Flow treats each day like a trading day. You set how much you can spend each day. A day under that limit shows green, a day over it shows red. Months and years add up the same way. Flow has three apps, and you choose one when it opens:

| | | |
|:-:|---|---|
| <img src="docs/art/wallet.svg" width="48" alt="wallet"> | **Finance** | Log spending and income in rupiah (or ringgit) and keep the days green. See where your money goes, and save toward goals. Also: split a bill, ask "Worth it?" before buying something, and convert currencies at live rates. |
| <img src="docs/art/rings.svg" width="48" alt="activity rings"> | **Health** | Activity rings, to-dos, your week's timetable, assignments with deadlines, workouts, diet and body. |
| <img src="docs/art/coin.svg" width="48" alt="coin"> <img src="docs/art/globe.svg" width="48" alt="globe"> <img src="docs/art/die.svg" width="48" alt="die"> | **Trading** | A profit-and-loss calendar and a trade journal for crypto (the coin), Indonesian stocks (the globe) and forex (the die). Each has a position calculator with live prices. |

Every app opens on **Home**: a board of widgets you can move, resize, add and remove.

## Download and install

### Mac

1. Download **[Flow-Mac.dmg](https://github.com/trihardio/flow/releases/latest/download/Flow-Mac.dmg)** and open it.
2. Drag **Flow** into **Applications**.
3. Open Flow from Applications. The app isn't from the App Store, so the first time macOS stops it:
   - Open **System Settings → Privacy & Security** and scroll down.
   - Press **Open Anyway** next to "Flow", then confirm.
   - If macOS says Flow "is damaged and can't be opened", open **Terminal** and paste this line:
     ```
     xattr -cr /Applications/Flow.app
     ```
     Then open Flow again.
4. If Flow asks to use your **Documents** folder, press **Allow**. That is where your backups go.

### Windows

1. Download **[Flow-Windows-Setup.exe](https://github.com/trihardio/flow/releases/latest/download/Flow-Windows-Setup.exe)** and open it.
2. If Windows shows **"Windows protected your PC"**, press **More info → Run anyway**. Windows shows this for any app that isn't signed by a big publisher.
3. Flow installs by itself and opens. It adds a shortcut to the desktop and to the Start menu.

**Updating:** download the new version and install it over the old one. Your entries stay.

## How to use it

1. **Make your account.** Pick a picture and type your name, then press Continue. There is no password and no online account. A few short cards then show you around.
2. **Choose an app**: the wallet is Finance, the rings are Health, the coin is Trading.
3. **Log a day.** Press a day on the calendar and add what you spent. Or press **Ctrl+N** (**⌘N** on Mac) anywhere and type one line, such as `kopi 25`.
4. **Read the colours.** Green days stayed under your daily limit, red days went over. The month and year cards show where your money went.
5. **Make Home yours.** Press the pencil on Home to move, resize, add or remove widgets.

| Shortcut | Windows | Mac |
|---|---|---|
| Quick log | Ctrl+N | ⌘N |
| Worth it? | Ctrl+B | ⌘B |
| Time plan | Ctrl+T | ⌘T |
| Exchange money | Ctrl+E | ⌘E |
| Next currency | Ctrl+K | ⌘K |

## Your data

- Your entries are saved on your computer. Flow never uploads them anywhere.
- Flow makes a **Flow** folder in your **Documents**:
  - **Export** saves a copy there, in a folder for each app.
  - Every day Flow saves a backup by itself in **Flow/automatic backups**. It keeps the last 7 days.
- To move to a new computer, press **Import** there and choose an export file.
- Flow goes online only to get live exchange rates and prices. Everything else works offline, including the AI that sorts what you log into categories.
- Two Health extras need a Mac: reading your timetable from a picture, and counting steps from an iPhone.

---

<details>
<summary><b>For developers</b></summary>

```
npm install
npm run dev     the app in your browser at http://localhost:5173
npm run app     build and open the desktop app (Mac)
npm run dmg     the Mac installer: release/Flow-<version>-arm64.dmg
npm run win     the Windows installer: release/Flow-Setup-<version>.exe
```

- The whole interface is one React file, `src/App.jsx`. The desktop shell is in `electron/`.
- The on-device AI model `models/flow-ai.gguf` is not in git: it is too big (238 MB). `npm run train-ai` retrains the part that sorts notes into categories.
- For `npm run win` on a Mac, the AI runtime for Windows needs to be in `node_modules` first:
  ```
  npm pack @node-llama-cpp/win-x64@3.22.1
  mkdir -p node_modules/@node-llama-cpp/win-x64
  tar -xzf node-llama-cpp-win-x64-3.22.1.tgz -C node_modules/@node-llama-cpp/win-x64 --strip-components=1
  ```
  `build/after-pack.cjs` then keeps each system's runtime out of the other system's installer.
- The pixel art on this page is made by `node tools/readme/art.mjs`.

</details>

<p align="center"><img src="docs/art/coin.svg" width="20" alt=""> <img src="docs/art/wallet.svg" width="20" alt=""> <img src="docs/art/rings.svg" width="20" alt=""></p>
