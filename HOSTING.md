# Hosting the AI Pricing App

The app is a **Next.js** static export (no Node server at runtime). You can host the built output on any static hosting service. No database or backend is required.

## Build and output

- **Build:** `npm run build` produces the default Next.js output (no static export unless `GITHUB_PAGES=1`; see below for GitHub Pages).
- **Data:** Ensure **`pricing.json`** and **`benchmarks.json`** are in **`public/`** before building so they are copied into the output and served at `/pricing.json` and `/benchmarks.json`.

### GitHub Pages (recommended)

For **GitHub Pages** (project site at `https://<user>.github.io/<repo>/`), the app is built with **static export** and a base path. Use the GitHub Actions workflow:

1. Push code to GitHub. The workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) runs on push to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source:** **GitHub Actions**.
3. The workflow runs `npm run build` with `GITHUB_PAGES=1`, which enables `output: 'export'` and `basePath` / `assetPrefix` in `next.config.js`. The built site is in the `out/` folder and is deployed to GitHub Pages.

See [docs/DEPLOY.md](docs/DEPLOY.md) for step-by-step push and deploy instructions.

## Other static hosts (Netlify, Vercel, Cloudflare Pages)

- **Netlify / Vercel:** Connect the repo; use build command `npm run build` and output directory `out` only if you configure Next.js for static export (e.g. set `output: 'export'` in `next.config.js` and optionally set `basePath` if you use a subpath). Otherwise use the default Next.js build and the host’s recommended output directory.
- **Cloudflare Pages:** Same idea: connect repo, set build command and output directory to match your Next.js config (static export → `out`, or default Next.js build as per Cloudflare’s Next.js guide).

## Data updates

- **Pricing** is updated by the [GitHub Action](.github/workflows/update-pricing.yml) (daily or manual), which writes `pricing.json`. Commit and push so the deployed site serves the new file.
- **Benchmarks** are updated by [.github/workflows/update-benchmarks.yml](.github/workflows/update-benchmarks.yml) (weekly), which writes `benchmarks.json`.
- **Refresh from web** in the app reloads pricing (and benchmarks) from the deployed `/pricing.json` and `/benchmarks.json` (or from the Vizra API when applicable).

## Notes

- **History & cache:** Stored in the browser’s `localStorage`. Each user’s data stays on their device.
- **HTTPS:** All options above serve over HTTPS, which is required for many browser features.

## Custom domain

On Netlify, Vercel, Cloudflare Pages, or GitHub Pages you can add a custom domain in the project’s domain settings.
