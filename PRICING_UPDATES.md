# Price update flow

Pricing is fetched **directly from the Vizra API** in the browser. No GitHub Actions or backend.

## Flow

```
Vizra API (https://vizra.ai/api/v1/pricing/ai-models)
  → Frontend fetches on load (pricing.json) or "Refresh from web" or auto-fill when Anthropic/Mistral missing
        ↓
App shows Gemini, OpenAI, Anthropic, Mistral
```

## How the app gets data

1. **Initial load**: Tries to load `pricing.json` from the host (or cache). If Anthropic or Mistral are empty, the app fetches from the Vizra API once and fills them in.

2. **"Refresh from web"**: Fetches the Vizra API and updates all four providers. Saves to localStorage.

3. **pricing.json** in the repo is optional. It’s used when the app is first opened so there’s something to show before any Vizra request. You can update it manually by running the script (see below).

## Running the script locally (optional)

To refresh the `pricing.json` file in the repo (e.g. for a better first-load experience):

```bash
node scripts/update-pricing.mjs
```

Then commit and push `pricing.json` if you want.

## Vizra API

[Vizra.ai](https://vizra.ai/ai-llm-model-pricing) provides a free API with pricing for 284+ AI models. The app uses `https://vizra.ai/api/v1/pricing/ai-models` from the browser.
