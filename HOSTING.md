# Hosting the AI Pricing App Online

This app is **static** (HTML, CSS, JavaScript only). You can host it on any static hosting service. No server or database is required.

## What to upload

- **index.html** (required)
- **pricing.json** (optional; provides fallback pricing if the file is present)

## Free hosting options

### 1. **GitHub Pages** (good if you use Git)

1. Create a GitHub repository and push your project:
   ```bash
   cd AI_Pricing_App
   git init
   git add index.html pricing.json scripts
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Source**: choose **main** branch, root folder.
3. Your site will be at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

**Pricing:** The app loads `pricing.json`, which is updated automatically by a [GitHub Action](.github/workflows/update-pricing.yml) (daily or manual). "Refresh from web" reloads that file on GitHub Pages. See [PRICING_UPDATES.md](PRICING_UPDATES.md) and [docs/PRICING_UPDATES.md](docs/PRICING_UPDATES.md).

### 2. **Netlify** (drag-and-drop)

1. Go to [netlify.com](https://www.netlify.com) and sign up (free).
2. Drag the **AI_Pricing_App** folder (or a zip of it) into the Netlify drop zone.
3. Netlify will give you a URL like `https://random-name-123.netlify.app`. You can set a custom name in Site settings.

### 3. **Vercel** (drag-and-drop or CLI)

1. Go to [vercel.com](https://vercel.com) and sign up (free).
2. **Drag & drop**: Upload the folder containing `index.html` and `pricing.json`.
3. Or use CLI: `npx vercel` in the project folder and follow the prompts.
4. You get a URL like `https://your-project.vercel.app`.

### 4. **Cloudflare Pages** (free)

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign up.
2. **Create project → Direct Upload** → upload your project folder (or connect a Git repo).
3. Your site will be at `https://your-project.pages.dev`.

### 5. **Surge.sh** (quick CLI deploy)

```bash
# Install once: npm install -g surge
cd AI_Pricing_App
surge
# Follow prompts; you'll get a URL like https://your-name.surge.sh
```

---

## Notes

- **Pricing**: Kept up to date by a GitHub Action that fetches the Vizra API and updates `pricing.json`. The app loads that file (or cache/default). "Refresh from web" reloads pricing.
- **Refresh from web**: Fetches the Vizra API to update pricing. (A CORS proxy is used only for the "Find the right model" documentation search.)
- **History & cache**: Stored in the browser's `localStorage`. Each user's data stays on their device and is not shared across devices or browsers.
- **HTTPS**: All options above serve over HTTPS, which is required for many browser features.

## Custom domain (optional)

On Netlify, Vercel, or Cloudflare Pages you can add your own domain (e.g. `pricing.yourdomain.com`) in the project's domain settings.
