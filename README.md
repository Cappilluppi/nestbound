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

**Publication is pending:** GitHub rejected enabling Pages because this repository is private and its current plan does not support Pages for private repositories. The owner must choose to make the repository public or upgrade to a compatible plan before the first deployment. See [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The [deployment workflow](.github/workflows/deploy-pages.yml) publishes only `dist/`. Configure **Settings → Pages → Source → GitHub Actions** for this repository.

After the first successful deployment, the browser link is:

**https://cappilluppi.github.io/nestbound/**

After Pages is enabled, run the workflow once from the **Actions** tab. Future pushes that change `dist/` deploy automatically.

The browser prototype simulates VR pointing; it does not connect to a headset.
