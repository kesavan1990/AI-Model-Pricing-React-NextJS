'use client';

import { useState } from 'react';
import Fuse from 'fuse.js';
import { usePricing } from '../../context/PricingContext';
import {
  getRecommendations,
  getFallbackReason,
  inferUseCaseType,
  getAllModels,
  normalizeModelName,
  extractKeywords,
  searchDocContent,
  cleanDocSnippetForDisplay,
  getGeneratedDocNote,
} from '../../src/calculator.js';
import { fetchWithCors } from '../../src/api.js';
import { RECOMMEND_DOC_INDEX } from '../../data/recommendDocIndex.js';

// Official API / model documentation URLs (used for live doc search in Recommend)
// Gemini: https://ai.google.dev/gemini-api/docs/models
// OpenAI: https://developers.openai.com/api/docs/models
// Anthropic: https://docs.anthropic.com/en/docs/models-overview
// Mistral: https://docs.mistral.ai/models/
const GEMINI_DOC_URL = 'https://ai.google.dev/gemini-api/docs/models';
const OPENAI_DOC_URL = 'https://developers.openai.com/api/docs/models';
const ANTHROPIC_DOC_URL = 'https://docs.anthropic.com/en/docs/models-overview';
const MISTRAL_DOC_URL = 'https://docs.mistral.ai/models/';

const MAX_RECOMMENDATIONS = 6;

/** Build a single searchable string per index entry so Fuse ranks by query-term matches. */
function toSearchableRecord(item) {
  const parts = [...(item.keywords || []), item.model, item.provider, item.source].filter(Boolean);
  return { ...item, _searchable: parts.join(' ').toLowerCase() };
}

/** Search static doc index with Fuse.js; returns index entries sorted by relevance (best first). */
function searchStaticIndex(query, index) {
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  const withSearchable = index.map(toSearchableRecord);
  const fuse = new Fuse(withSearchable, {
    keys: ['_searchable'],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
  });
  const results = fuse.search(query.trim().toLowerCase());
  return results.map((r) => ({ ...r.item, _score: r.score }));
}

/** Match index model name to a data model: exact, normalized exact, or prefix (index name is prefix of data name). */
function indexHitMatchesDataModel(hitModel, dataModelName, normalizeModelNameFn) {
  if (!hitModel || !dataModelName) return false;
  const nHit = normalizeModelNameFn(hitModel);
  const nData = normalizeModelNameFn(dataModelName);
  if (nHit === nData) return true;
  if (nData.startsWith(nHit)) return true;
  if (nHit.startsWith(nData)) return true;
  return false;
}

/** Resolve static index hits to full model objects from getAllModels(data). Uses flexible matching (exact + prefix). */
function resolveIndexHitsToModels(indexHits, allModels) {
  const seen = new Set();
  const out = [];
  for (const hit of indexHits) {
    const hitKey = hit.providerKey + ':' + (hit.model || '').toLowerCase();
    if (seen.has(hitKey)) continue;
    const candidates = allModels.filter(
      (m) =>
        m.providerKey === hit.providerKey &&
        indexHitMatchesDataModel(hit.model, m.name, normalizeModelName)
    );
    if (candidates.length === 0) continue;
    seen.add(hitKey);
    const exact = candidates.find((m) => normalizeModelName(m.name) === normalizeModelName(hit.model));
    const model = exact || candidates.find((m) => m.name === hit.model) || candidates[0];
    out.push({
      ...model,
      docSnippet: 'From ' + (hit.source || 'provider documentation') + '.',
      _fromIndex: true,
    });
  }
  return out;
}

async function fetchDocsAndSearch(description, data) {
  const keywords = extractKeywords(description);
  if (!keywords.length) return null;
  const geminiNames = (data.gemini || []).map((m) => m.name).filter(Boolean);
  const openaiNames = (data.openai || []).map((m) => m.name).filter(Boolean);
  const anthropicNames = (data.anthropic || []).map((m) => m.name).filter(Boolean);
  const mistralNames = (data.mistral || []).map((m) => m.name).filter(Boolean);
  const [g, o, a, m] = await Promise.allSettled([
    fetchWithCors(GEMINI_DOC_URL),
    fetchWithCors(OPENAI_DOC_URL),
    fetchWithCors(ANTHROPIC_DOC_URL),
    fetchWithCors(MISTRAL_DOC_URL),
  ]);
  const geminiHtml = g.status === 'fulfilled' && g.value ? g.value : '';
  const openaiHtml = o.status === 'fulfilled' && o.value ? o.value : '';
  const anthropicHtml = a.status === 'fulfilled' && a.value ? a.value : '';
  const mistralHtml = m.status === 'fulfilled' && m.value ? m.value : '';
  const geminiMatches = geminiHtml.trim() ? searchDocContent(geminiHtml, geminiNames, keywords) : [];
  const openaiMatches = openaiHtml.trim() ? searchDocContent(openaiHtml, openaiNames, keywords) : [];
  const anthropicMatches = anthropicHtml.trim() ? searchDocContent(anthropicHtml, anthropicNames, keywords) : [];
  const mistralMatches = mistralHtml.trim() ? searchDocContent(mistralHtml, mistralNames, keywords) : [];
  return {
    gemini: geminiMatches.map((x) => ({ ...x, providerKey: 'gemini', provider: 'Google Gemini' })),
    openai: openaiMatches.map((x) => ({ ...x, providerKey: 'openai', provider: 'OpenAI' })),
    anthropic: anthropicMatches.map((x) => ({ ...x, providerKey: 'anthropic', provider: 'Anthropic' })),
    mistral: mistralMatches.map((x) => ({ ...x, providerKey: 'mistral', provider: 'Mistral' })),
  };
}

function priceStr(m) {
  if (m.input === 0 && m.output === 0) return 'Free';
  const parts = [];
  if (m.input > 0) parts.push(`In: $${m.input}/1M`);
  if (m.cachedInput != null) parts.push(`Cached: $${m.cachedInput}/1M`);
  if (m.output > 0) parts.push(`Out: $${m.output}/1M`);
  return parts.join(' · ');
}

export function Recommend() {
  const { getData } = usePricing();
  const [description, setDescription] = useState('');
  const [results, setResults] = useState([]);
  const [fromDocs, setFromDocs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleGetRecommendations = async () => {
    setLoading(true);
    setHasSearched(true);
    const data = getData();
    const useCaseType = inferUseCaseType(description);
    const allModels = getAllModels(data);
    const fallbackRecs = getRecommendations(data, useCaseType, description);

    // Static documentation index (Fuse.js) for better coverage
    const indexHits = searchStaticIndex(description, RECOMMEND_DOC_INDEX);
    const fromIndex = resolveIndexHitsToModels(indexHits, allModels).slice(0, MAX_RECOMMENDATIONS);

    let recs;
    let usedFromIndex = false;
    if (fromIndex.length > 0) {
      usedFromIndex = true;
      const seen = new Set(fromIndex.map((m) => m.providerKey + ':' + m.name));
      recs = fromIndex.map((m) => ({
        ...m,
        reason: m.reason || getFallbackReason(m),
      }));
      // Fill up to MAX_RECOMMENDATIONS with fallback recs (no duplicates)
      for (const r of fallbackRecs) {
        if (recs.length >= MAX_RECOMMENDATIONS) break;
        const id = r.providerKey + ':' + r.name;
        if (!seen.has(id)) {
          seen.add(id);
          recs.push(r);
        }
      }
    } else {
      recs = fallbackRecs || [];
    }

    // Optional: enrich with live doc snippets when available
    let docResults = null;
    try {
      docResults = await fetchDocsAndSearch(description, data);
    } catch (_) {}
    if (docResults) {
      const docMap = new Map();
      [
        ...(docResults.gemini || []),
        ...(docResults.openai || []),
        ...(docResults.anthropic || []),
        ...(docResults.mistral || []),
      ].forEach((match) => {
        const key = match.providerKey + ':' + match.modelName;
        if (!docMap.has(key) || (match.snippet && match.snippet.length > (docMap.get(key).snippet || '').length)) {
          docMap.set(key, match);
        }
      });
      recs = recs.map((r) => {
        const key = r.providerKey + ':' + r.name;
        const match = docMap.get(key);
        if (match?.snippet) {
          const cleaned = cleanDocSnippetForDisplay(match.snippet);
          const docSnippet = cleaned || getGeneratedDocNote(r, useCaseType);
          return { ...r, docSnippet };
        }
        if (r.docSnippet) return r;
        return r;
      });
      const hasAnyDoc =
        docResults.gemini?.length ||
        docResults.openai?.length ||
        docResults.anthropic?.length ||
        docResults.mistral?.length;
      setFromDocs(!!hasAnyDoc || usedFromIndex);
    } else {
      setFromDocs(usedFromIndex);
    }
    setResults(recs || []);
    setLoading(false);
  };

  const handleReset = () => {
    setDescription('');
    setResults([]);
    setFromDocs(false);
    setHasSearched(false);
  };

  return (
    <section className="page-section recommend-section" id="section-recommend">
      <h2 className="section-title">🎯 Get a recommendation</h2>
      <p className="section-subtitle">Describe your use case (e.g. &quot;cheap model for high volume&quot; or &quot;best quality for long documents&quot;) and get model suggestions.</p>
      <div className="recommend-card">
        <div className="recommend-form">
          <div className="calc-row">
            <label htmlFor="useCaseDesc">Use case description</label>
            <textarea
              id="useCaseDesc"
              rows={5}
              placeholder="e.g. I need a cheap model for high volume batch processing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="recommend-actions">
            <button
              type="button"
              className="calc-btn recommend-btn"
              id="getRecommendBtn"
              onClick={handleGetRecommendations}
              disabled={loading}
            >
              {loading ? 'Searching…' : 'Get recommendation'}
            </button>
            <button
              type="button"
              className="calc-btn reset"
              id="recommendResetBtn"
              onClick={handleReset}
              disabled={loading}
              aria-label="Clear description"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
      <div id="recommendResult" className={'recommend-result' + (results.length > 0 || hasSearched ? '' : ' hidden')}>
        <h3 className="recommend-result-title">Recommended models</h3>
        {fromDocs && <p className="recommend-doc-note">Results informed by official Gemini, OpenAI, Anthropic, and Mistral documentation.</p>}
        <div id="recommendList" className="recommend-list">
          {results.length === 0 && !hasSearched && (
            <p className="recommend-item model-reason">Enter a use case and click &quot;Get recommendation&quot;.</p>
          )}
          {results.length === 0 && hasSearched && !loading && (
            <p className="recommend-item model-reason">No models match this use case with current data.</p>
          )}
          {results.length > 0 &&
            results.map((m, i) => (
              <div key={i} className="recommend-item">
                <span className={'provider-tag ' + m.providerKey}>{m.provider}</span>
                <div>
                  <div className="model-name-rec">{m.name}</div>
                  <div className="model-reason">{(m.reason && String(m.reason).trim()) ? m.reason : getFallbackReason(m)}</div>
                  {m.docSnippet && <div className="recommend-doc-snippet">{m.docSnippet}</div>}
                  <div className="model-price">{priceStr(m)}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
