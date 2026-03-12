'use client';

import { useState } from 'react';
import { usePricing } from '../../context/PricingContext';
import {
  getRecommendations,
  getFallbackReason,
  inferUseCaseType,
  extractKeywords,
  searchDocContent,
  cleanDocSnippetForDisplay,
  getGeneratedDocNote,
} from '../../src/calculator.js';
import { fetchWithCors } from '../../src/api.js';

const GEMINI_DOC_URL = 'https://ai.google.dev/gemini-api/docs/models/gemini';
const OPENAI_DOC_URL = 'https://platform.openai.com/docs/models';
const ANTHROPIC_DOC_URL = 'https://docs.anthropic.com/en/docs/build-with-claude/model-cards';
const MISTRAL_DOC_URL = 'https://docs.mistral.ai/models/';

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
    let recs = getRecommendations(data, useCaseType, description);
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
        return r;
      });
      const hasAnyDoc =
        docResults.gemini?.length ||
        docResults.openai?.length ||
        docResults.anthropic?.length ||
        docResults.mistral?.length;
      setFromDocs(!!hasAnyDoc);
    } else {
      setFromDocs(false);
    }
    setResults(recs || []);
    setLoading(false);
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
