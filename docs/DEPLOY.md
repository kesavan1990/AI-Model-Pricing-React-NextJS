# Push to GitHub and Deploy to GitHub Pages

This guide walks you through pushing the app to [https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS](https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS) and deploying it on GitHub Pages.

---

## Part 1: Push code to the new repository

### 1.1 Open terminal in the project folder

```bash
cd c:\Users\Kesavan\Desktop\AI_Pricing_App
```

### 1.2 (Optional) Point `origin` to the new repo

If this project already has another Git remote and you want this to be the main repo:

```bash
git remote set-url origin https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS.git
```

If the project is **not** a Git repo yet:

```bash
git init
git remote add origin https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS.git
```

Check the remote:

```bash
git remote -v
```

You should see:

- `origin  https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS.git (fetch)`
- `origin  https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS.git (push)`

### 1.3 Stage and commit all files

```bash
git add .
git status
git commit -m "Initial commit: AI Model Pricing Dashboard with Benchmarks, Calculators, GitHub Pages config"
```

### 1.4 Push to GitHub

**If the repo is empty and you’re on `main`:**

```bash
git branch -M main
git push -u origin main
```

**If the repo already has commits (e.g. README) and you want to overwrite:**

```bash
git push -u origin main --force
```

Use `--force` only if you’re sure you want to replace the remote history.

---

## Part 2: Deploy to GitHub Pages

### 2.1 Enable GitHub Pages from GitHub Actions

1. Open: **https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS**
2. Go to **Settings** → **Pages** (left sidebar).
3. Under **Build and deployment**:
   - **Source:** choose **GitHub Actions**.

No need to pick a branch or folder; the workflow will publish the built site.

### 2.2 Trigger the deployment

- Every **push to `main`** runs the workflow and deploys.
- Or run it manually: **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

### 2.3 Open your site

After the workflow finishes (a few minutes):

- **URL:** **https://kesavan1990.github.io/AI-Model-Pricing-React-NextJS/**

Bookmark this; all app routes (e.g. `/benchmarks`, `/calculator`) work under this base path.

---

## Summary checklist

| Step | Action |
|------|--------|
| 1 | `git remote` points to `https://github.com/kesavan1990/AI-Model-Pricing-React-NextJS.git` |
| 2 | `git add .` and `git commit` |
| 3 | `git push -u origin main` |
| 4 | Repo **Settings** → **Pages** → Source: **GitHub Actions** |
| 5 | Wait for **Actions** to finish; open **https://kesavan1990.github.io/AI-Model-Pricing-React-NextJS/** |

---

## What the project already has

- **`next.config.js`**  
  When `GITHUB_PAGES=1` is set (in the workflow), the build uses:
  - `output: 'export'` (static export)
  - `basePath` / `assetPrefix` for the project path
  - `trailingSlash: true` and `images: { unoptimized: true }` for static export

- **`.github/workflows/deploy-pages.yml`**  
  - Runs on push to `main` (and manual dispatch).
  - Installs deps, runs `npm run build` with `GITHUB_PAGES=1`, adds `out/.nojekyll`, uploads `out` as the Pages artifact, then deploys.

No extra backend or app code is required for this deployment.

---

## Optional: Build static export locally

To test the same build that runs on GitHub:

**PowerShell:**

```powershell
$env:GITHUB_PAGES='1'; npm run build
```

**Cmd:**

```cmd
set GITHUB_PAGES=1
npm run build
```

Then open the generated `out` folder with a static server. The app will expect to be served under `/AI-Model-Pricing-React-NextJS/` (e.g. `npx serve out` and open `http://localhost:3000/AI-Model-Pricing-React-NextJS/`).
