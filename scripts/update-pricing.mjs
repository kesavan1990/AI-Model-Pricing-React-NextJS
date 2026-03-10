/**
 * Fetches LLM pricing from Vizra API (https://vizra.ai/api/v1/pricing/ai-models).
 * Outputs pricing.json with gemini, openai, anthropic, mistral for the frontend.
 * Flow: Vizra API → this script → GitHub Action (daily) → pricing.json → commit → frontend.
 * Run from repo root: node scripts/update-pricing.mjs
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const VIZRA_PRICING_URL = 'https://vizra.ai/api/v1/pricing/ai-models';

// Vizra provider id -> our pricing.json key (google -> gemini for display)
const PROVIDER_KEY = {
    google: 'gemini',
    openai: 'openai',
    anthropic: 'anthropic',
    mistral: 'mistral'
};

function fromVizraResponse(data) {
    const out = { gemini: [], openai: [], anthropic: [], mistral: [] };
    const models = data?.data?.models;
    if (!models || typeof models !== 'object') return out;

    for (const [modelId, m] of Object.entries(models)) {
        const provider = (m && m.provider) || '';
        const key = PROVIDER_KEY[provider];
        if (!key) continue;
        const input = typeof m.input_price_per_million === 'number' ? m.input_price_per_million : 0;
        const output = typeof m.output_price_per_million === 'number' ? m.output_price_per_million : 0;
        if (input <= 0 && output <= 0) continue;
        const name = modelId.replace(/^gemini\//, '').replace(/^mistral\//, '').replace(/^deepseek\//, '');
        out[key].push({ name, input, output, cachedInput: null });
    }
    return out;
}

async function main() {
    console.log('Fetching pricing from Vizra API...');
    let res;
    try {
        res = await fetch(VIZRA_PRICING_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.error('Vizra API fetch failed:', e.message);
        process.exit(1);
    }
    const data = await res.json();
    const { gemini, openai, anthropic, mistral } = fromVizraResponse(data);
    const total = (gemini?.length || 0) + (openai?.length || 0) + (anthropic?.length || 0) + (mistral?.length || 0);
    if (!data || total === 0) {
        throw new Error('Invalid dataset: API returned no usable pricing data (empty or failed parse). Refusing to overwrite.');
    }
    const updated = (data?.meta?.last_updated && String(data.meta.last_updated).slice(0, 10)) || new Date().toISOString().slice(0, 10);
    const payload = { updated, gemini, openai, anthropic, mistral };
    const outPath = join(process.cwd(), 'pricing.json');
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Written', outPath, '| gemini:', gemini.length, 'openai:', openai.length, 'anthropic:', anthropic.length, 'mistral:', mistral.length, '| updated:', updated);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
