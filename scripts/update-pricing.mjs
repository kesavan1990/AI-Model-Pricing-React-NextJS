/**
 * Fetches official Gemini & OpenAI pricing pages, parses them, and writes pricing.json.
 * Used by GitHub Actions for cloud-based pricing updates (no local Node needed for the site).
 * Run from repo root: node scripts/update-pricing.mjs
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const OPENAI_PRICING_URL = 'https://developers.openai.com/api/docs/pricing';
const OPENAI_PRICING_FALLBACK_URL = 'https://openai.com/api/pricing/';
const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';

function parsePrice(str) {
    if (!str || typeof str !== 'string') return 0;
    const m = str.replace(/,/g, '').match(/\$?([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
}

function isOpenAITextOrEmbeddingOnly(name) {
    const n = (name || '').toLowerCase();
    if (/^text-embedding-/.test(n)) return true;
    if (/gpt-image|chatgpt-image|gpt-realtime|gpt-audio|gpt-4o-realtime|gpt-4o-mini-realtime|gpt-4o-audio|computer-use|sora/i.test(n)) return false;
    return /^(gpt-|GPT|o\d|davinci|babbage|gpt-3\.5|text-embedding)/i.test(n);
}

function parseOpenAIPricing(html) {
    const byName = new Map();
    function addOrPrefer(name, input, output, cachedInput) {
        if (!name || name.length < 2 || !isOpenAITextOrEmbeddingOnly(name)) return;
        const key = name.toLowerCase().trim();
        const existing = byName.get(key);
        const hasCached = cachedInput != null && cachedInput > 0;
        const shouldOverwrite = !existing ||
            (hasCached && (existing.cachedInput == null || existing.cachedInput === 0)) ||
            (output > (existing.output || 0));
        if (shouldOverwrite && (input > 0 || output > 0)) {
            byName.set(key, { name, input: input || 0, output: output || 0, cachedInput: hasCached ? cachedInput : null });
        }
    }
    const text = html.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ');
    const blocks = text.split(/(?:##|###|<\/h[2-4]>)\s*/i);
    const modelNameRegex = /(?:^|\s)(gpt-[\w.-]+|GPT[- ]?[\d.o]+(?:[- ]?(?:mini|nano|pro))?|o\d+(?:[- ]?mini)?|text-embedding-[\w.-]+)\b/gi;
    for (const block of blocks) {
        const nameMatch = block.match(modelNameRegex);
        if (!nameMatch) continue;
        let name = nameMatch[0].replace(/\s+/g, ' ').trim();
        if (name.length < 4 || !isOpenAITextOrEmbeddingOnly(name)) continue;
        const inputMatch = block.match(/Input[:\s]*\$?([\d.,]+)/i);
        const cachedMatch = block.match(/Cached input[:\s]*\$?([\d.,]+)/i);
        const outputMatch = block.match(/Output[:\s]*\$?([\d.,]+)/i);
        let input = inputMatch ? parsePrice(inputMatch[1]) : 0;
        const cachedInput = cachedMatch ? parsePrice(cachedMatch[1]) : null;
        let output = outputMatch ? parsePrice(outputMatch[1]) : 0;
        if (input <= 0 && output <= 0) {
            const perM = block.match(/\$?([\d.,]+)\s*\/\s*1\s*M/i);
            const costMatch = block.match(/Cost[:\s]*\$?([\d.,]+)/i);
            if (perM) input = parsePrice(perM[1]);
            else if (costMatch) input = parsePrice(costMatch[1]);
        }
        addOrPrefer(name, input, output, cachedInput);
    }
    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of tableRows) {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
        if (!cells || cells.length < 2) continue;
        const cellText = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
        const first = (cellText[0] || '').replace(/\s+/g, ' ').trim();
        const isEmbedding = /^text-embedding-/i.test(first);
        const isTextToken = /^(gpt-|GPT|o\d|davinci|babbage|gpt-3)/i.test(first);
        if (!isTextToken && !isEmbedding) continue;
        if (!isOpenAITextOrEmbeddingOnly(first)) continue;
        const name = first;
        if (name.length < 2) continue;
        let input = 0, output = 0, cachedInput = null;
        if (isEmbedding && cellText.length >= 2) {
            input = parsePrice(cellText[1]);
        } else if (cellText.length >= 4) {
            input = parsePrice(cellText[1]);
            const cachedVal = cellText[2];
            if (cachedVal && cachedVal !== '-' && cachedVal !== '–') cachedInput = parsePrice(cachedVal);
            output = parsePrice(cellText[3]);
        } else {
            for (let i = 1; i < cellText.length; i++) {
                const p = parsePrice(cellText[i]);
                if (p > 0) { if (input === 0) input = p; else if (output === 0) output = p; else cachedInput = p; }
            }
            if (output === 0 && cellText.length >= 3) output = parsePrice(cellText[cellText.length - 1]);
        }
        addOrPrefer(name, input, output, cachedInput);
    }
    const models = Array.from(byName.values());
    return models.length ? models : null;
}

function parseGeminiPricing(html) {
    const models = [];
    const seen = new Set();
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const nameRegex = /Gemini\s*[\d.]+(?:\s*(?:Pro|Flash(?:-Lite|-8B)?|Flash-Lite))?(?=\s|$|\.|,)/gi;
    let nameMatch;
    while ((nameMatch = nameRegex.exec(text)) !== null) {
        const name = nameMatch[0].replace(/\s+/g, ' ').trim();
        if (seen.has(name)) continue;
        const chunk = text.slice(nameMatch.index, nameMatch.index + 400);
        const priceMatches = chunk.match(/\$?([\d.]+)\s*(?:\/|\s)*1\s*M?\s*(?:token)?s?/gi);
        const prices = priceMatches ? priceMatches.map(m => parseFloat((m.match(/([\d.]+)/) || [])[1]) || 0) : [];
        const input = prices[0] || 0;
        const output = prices[1] || 0;
        if (input > 0 || output > 0) {
            seen.add(name);
            models.push({ name, input, output });
        }
    }
    const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
    for (const table of tables) {
        const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows.slice(1)) {
            const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
            if (!cells || cells.length < 3) continue;
            const name = cells[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (!/Gemini\s*[\d.]/i.test(name)) continue;
            const input = parsePrice(cells[1]);
            const output = parsePrice(cells.length > 2 ? cells[2] : cells[1]);
            if (name && (input > 0 || output > 0) && !seen.has(name)) {
                seen.add(name);
                models.push({ name, input, output });
            }
        }
    }
    const blockRegex = /Gemini\s*[\d.]+(?:\s*(?:Pro|Flash(?:-Lite|-8B)?|Flash-Lite))?[^$]*?\$?([\d.]+)[^$]*?\$?([\d.]+)/gi;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(text)) !== null) {
        const nameMatch = text.slice(Math.max(0, blockMatch.index - 60), blockMatch.index + 80).match(/Gemini\s*[\d.]+(?:\s*(?:Pro|Flash(?:-Lite|-8B)?|Flash-Lite))?/i);
        const name = nameMatch ? nameMatch[0].replace(/\s+/g, ' ').trim() : '';
        if (!name || seen.has(name)) continue;
        const input = parseFloat(blockMatch[1]) || 0;
        const output = parseFloat(blockMatch[2]) || 0;
        if (input > 0 || output > 0) {
            seen.add(name);
            models.push({ name, input, output });
        }
    }
    return models.length ? models : null;
}

async function main() {
    console.log('Fetching pricing pages...');
    const [geminiRes, openaiRes] = await Promise.all([
        fetch(GEMINI_PRICING_URL).then(r => r.ok ? r.text() : ''),
        fetch(OPENAI_PRICING_URL).then(r => r.ok ? r.text() : '')
    ]);
    let gemini = parseGeminiPricing(geminiRes || '') || [];
    let openai = parseOpenAIPricing(openaiRes || '');
    if (!openai || openai.length < 8) {
        try {
            const fallbackRes = await fetch(OPENAI_PRICING_FALLBACK_URL).then(r => r.ok ? r.text() : '');
            if (fallbackRes) {
                const fallbackParsed = parseOpenAIPricing(fallbackRes);
                if (fallbackParsed && fallbackParsed.length > (openai ? openai.length : 0)) openai = fallbackParsed;
            }
        } catch (_) {}
    }
    if (!openai) openai = [];
    const updated = new Date().toISOString().slice(0, 10);
    const payload = { updated, gemini, openai };
    const outPath = join(process.cwd(), 'pricing.json');
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Written', outPath, '| gemini:', gemini.length, 'openai:', openai.length, '| updated:', updated);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
