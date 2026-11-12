# Dino's life

A visual, single-page design document and playable browser prototype for a cooperative prehistoric VR game.

Choose a dinosaur species, walk into the cartoon clearing, point at objects, and make choices that change your character and the world.

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

After the first successful deployment, the browser link is:

**https://cappilluppi.github.io/nestbound/**

Future pushes that change `dist/` deploy automatically. To redeploy manually, run **Deploy Dino's life to GitHub Pages** from the **Actions** tab.

The browser prototype simulates VR pointing; it does not connect to a headset.
