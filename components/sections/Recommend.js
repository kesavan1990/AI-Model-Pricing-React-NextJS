'use client';

import { useState } from 'react';
import { usePricing } from '../../context/PricingContext';
import { getRecommendations, getFallbackReason } from '../../src/calculator.js';

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

  const handleGetRecommendations = () => {
    setLoading(true);
    setHasSearched(true);
    const data = getData();
    const useCaseType = inferUseCaseType(description);
    const recs = getRecommendations(data, useCaseType, description);
    setResults(recs || []);
    setFromDocs(false);
    setLoading(false);
  };

  function inferUseCaseType(d) {
    const desc = (d || '').toLowerCase();
    if (/cheap|low cost|budget|minimize cost|cost effective|save money|affordable|lowest cost/i.test(desc)) return 'cost';
    if (/accurate|best quality|complex|reasoning|precise|correct|quality|sophisticated/i.test(desc)) return 'accuracy';
    if (/long document|pdf|context|cached|large file|many pages|high context|summariz/i.test(desc)) return 'long-doc';
    if (/code|programming|developer|software|script|api/i.test(desc)) return 'code';
    if (/high volume|throughput|real-time|realtime|batch|millions|scale|performance|fast|speed/i.test(desc)) return 'high-volume';
    if (/balance|general|default|all purpose|multi|various/i.test(desc)) return 'general';
    if (desc.trim().length > 0) return 'balanced';
    return 'general';
  }

  return (
    <section className="page-section" id="section-recommend">
      <h2 className="section-title">🎯 Get a recommendation</h2>
      <p className="section-subtitle">Describe your use case (e.g. &quot;cheap model for high volume&quot; or &quot;best quality for long documents&quot;) and get model suggestions.</p>
      <div className="recommend-form">
        <label htmlFor="useCaseDesc">Use case description</label>
        <textarea
          id="useCaseDesc"
          rows={5}
          placeholder="e.g. I need a cheap model for high volume batch processing..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          className="calc-btn"
          id="getRecommendBtn"
          onClick={handleGetRecommendations}
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Get recommendation'}
        </button>
      </div>
      <div id="recommendResult" className={'recommend-result' + (results.length > 0 || hasSearched ? '' : ' hidden')}>
        <h3>Recommended models</h3>
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
