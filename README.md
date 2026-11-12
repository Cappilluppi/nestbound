# Dino's life

A standalone, browser-playable 2D forest prototype. Choose a dinosaur species, explore a bounded clearing in first person, and connect 10 interactive elements with 3 decisions each.

**Play:** https://cappilluppi.github.io/nestbound/

## Controls

- Drag horizontally to turn; WASD or the on-screen stones to walk. Q/R also turn with the keyboard.
- Click, tap, or press E to interact with the pointed-at element within reach.
- Esc closes the active panel. I opens the carried leaf-map, inventory, and recent choices.
- There is no countdown or required ending. Return to objects as clues, materials, and trust unlock new actions.

## Debug / tuning

Press F2 or use **Debug**. Adjust movement speed, interaction reach, and the stat reward multiplier. Inspect live state, jump safely to any element, grant puzzle items, and unlock passages. **Reset level progress** keeps your species and tuning; **Restore tuning defaults** changes only the tuning. Movement pauses while the panel is open. All state lasts for the current session only.

## Where the changes are

The website source is committed in [`dist/`](dist/):

- [`index.html`](dist/index.html): page content, illustrations, and title.
- [`scene.css`](dist/scene.css): layout, colors, and prehistoric background.
- [`scene.js`](dist/scene.js): movement, pointing, missions, decisions, and rewards.

An empty VS Code **Changes** list means there are no uncommitted edits. Existing changes are visible in the repository's commit history and in the files above.

## Play locally

Open `dist/index.html` in your browser. No install or build is required.

## GitHub Pages

GitHub Pages is enabled for this public repository. The [deployment workflow](.github/workflows/deploy-pages.yml) publishes only `dist/`, using **GitHub Actions** as its publishing source.

Future pushes that change `dist/` deploy automatically. To redeploy manually, run **Deploy Dino's life to GitHub Pages** from the **Actions** tab.

The browser prototype simulates VR pointing; it does not connect to a headset.
