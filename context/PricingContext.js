'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as api from '../src/api.js';
import * as pricingApi from '../src/api/pricingService.js';
import * as pricing from '../src/pricingService.js';
import { mergeTiersIntoPayload } from '../src/data/pricingTiersOverlay.js';
import { applyOfficialOverlays, processPayload } from '../lib/dataPipeline.js';
import { getCachedPricing, setCachedPricing } from '../src/utils/cacheManager.js';

const PricingContext = createContext(null);

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error('usePricing must be used within PricingProvider');
  return ctx;
}

const initialData = {
  gemini: [],
  openai: [],
  anthropic: [],
  mistral: [],
};

export function PricingProvider({ children }) {
  const [data, setDataState] = useState(initialData);
  const [benchmarksData, setBenchmarksData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('—');
  const [benchmarksLastUpdated, setBenchmarksLastUpdated] = useState('—');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: 'success', show: false });
  const [comparisonProviderFilter, setComparisonProviderFilter] = useState('all');
  const [comparisonSortBy, setComparisonSortBy] = useState('default');
  const [valueChartProviderFilter, setValueChartProviderFilter] = useState('all');
  const [valueChartMetric, setValueChartMetric] = useState('arena');
  const [modelTypeFilter, setModelTypeFilter] = useState('chat');
  const [calcLastResult, setCalcLastResult] = useState(null);
  const [calcSub, setCalcSub] = useState('pricing');

  const setData = useCallback((raw) => {
    const processed = processPayload(raw);
    setDataState({
      gemini: processed.gemini || [],
      openai: processed.openai || [],
      anthropic: processed.anthropic || [],
      mistral: processed.mistral || [],
    });
  }, []);

  const applyDefaultFallback = useCallback(() => {
    const fallback = {
      gemini: pricing.DEFAULT_PRICING.gemini.slice(),
      openai: pricing.DEFAULT_PRICING.openai.slice(),
      anthropic: (pricing.DEFAULT_PRICING.anthropic || []).slice(),
      mistral: (pricing.DEFAULT_PRICING.mistral || []).slice(),
    };
    let merged = applyOfficialOverlays(fallback);
    mergeTiersIntoPayload(merged);
    setData(merged);
    setBenchmarksData(null);
    setLastUpdated('embedded default');
    setBenchmarksLastUpdated('—');
    setToast({ msg: 'Using embedded default pricing.', type: 'success', show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  }, [setData]);

  const LOAD_TIMEOUT_MS = 12000;

  const loadPricing = useCallback(async () => {
    setLoading(true);
    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          applyDefaultFallback();
          return false;
        }
        return prev;
      });
    }, LOAD_TIMEOUT_MS);
    try {
      const [result, benchPayload] = await Promise.all([
        pricing.loadPricingFromApi(pricingApi.fetchPricingData),
        api.getBenchmarks(),
      ]);
      clearTimeout(timeoutId);
      let merged = applyOfficialOverlays(result);
      mergeTiersIntoPayload(merged);
      setData(merged);
      setBenchmarksData(benchPayload?.benchmarks ?? null);
      setLastUpdated(result.updated || '—');
      setBenchmarksLastUpdated(benchPayload?.updated != null ? String(benchPayload.updated) : '—');
      if (result.usedFallback === 'cache') {
        setToast({ msg: 'Using cached pricing. Click Refresh to load the latest from the server.', type: 'success', show: true });
        setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
      }
      if (result.usedFallback === 'default') {
        setToast({ msg: 'Using embedded default pricing (no file or cache).', type: 'success', show: true });
        setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
      }
    } catch (err) {
      console.error('loadPricing failed:', err);
      clearTimeout(timeoutId);
      applyDefaultFallback();
    } finally {
      setLoading(false);
    }
  }, [setData, applyDefaultFallback]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [result, benchPayload] = await Promise.all([
        pricing.loadPricingFromApi(pricingApi.fetchPricingData),
        api.getBenchmarks(),
      ]);
      let merged = applyOfficialOverlays(result);
      mergeTiersIntoPayload(merged);
      setData(merged);
      setBenchmarksData(benchPayload?.benchmarks ?? null);
      setLastUpdated(result.updated || '—');
      setBenchmarksLastUpdated(benchPayload?.updated != null ? String(benchPayload.updated) : '—');
      setToast({ msg: 'Pricing updated.', type: 'success', show: true });
      const hideToast = () => setToast((t) => ({ ...t, show: false }));
      setTimeout(hideToast, 3500);
    } catch (err) {
      setToast({ msg: 'Refresh failed. Kept current pricing.', type: 'error', show: true });
      setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
    } finally {
      setLoading(false);
    }
  }, [setData]);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  }, []);

  const value = {
    data,
    getData: () => data,
    benchmarksData,
    getBenchmarksData: () => benchmarksData,
    lastUpdated,
    benchmarksLastUpdated,
    setLastUpdated,
    setBenchmarksLastUpdated,
    loading,
    setData,
    loadPricing,
    refresh,
    toast,
    showToast,
    comparisonProviderFilter,
    setComparisonProviderFilter,
    comparisonSortBy,
    setComparisonSortBy,
    valueChartProviderFilter,
    setValueChartProviderFilter,
    valueChartMetric,
    setValueChartMetric,
    modelTypeFilter,
    setModelTypeFilter,
    calcLastResult,
    setCalcLastResult,
    calcSub,
    setCalcSub,
    pricing,
    getCachedPricing,
    setCachedPricing,
  };

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}
