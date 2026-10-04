# Flow

First time (in VS Code's terminal, inside this folder):

    npm install
    npm run dev

The app opens in your browser at http://localhost:5173. Edits to src/App.jsx reload instantly.

Moving your data over: in the old version, press Export; here, press Import and choose that file.

## Mac app

    npm run app     build and open the app straight from this folder
    npm run dmg     build the installer: release/Flow-1.0.0-arm64.dmg
    npm run train-ai   retrain the AI helper after adding notes to tools/ai/cats.txt or goals.txt

Open the DMG and drag Flow into Applications. The app works fully offline: fonts, icons and the AI helper
(models/flow-ai.gguf) are all inside it. It keeps its own data, so Export from the browser version and
Import in the app once.
