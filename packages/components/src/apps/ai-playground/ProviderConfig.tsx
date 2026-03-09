/**
 * ProviderConfig — API key & LLM provider configuration panel
 *
 * Supports preset providers (OpenAI, Anthropic, Ollama, Groq, Together, Loom)
 * and custom OpenAI-compatible endpoints.
 *
 * API keys are stored in-memory only (React state) and never persisted.
 */
import * as React from 'react';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../../primitives/select';
import { testConnection } from './llm-client';
import { PROVIDER_PRESETS, type LLMProviderConfig, type ProviderPreset } from './types';
import { cn } from '@/lib/utils';
import { Check, X, Loader2, Shield, Settings } from 'lucide-react';

interface ProviderConfigProps {
  config: LLMProviderConfig | null;
  onConfigured: (config: LLMProviderConfig) => void;
  /** Compact mode — shown as a small settings trigger instead of full card */
  compact?: boolean;
}

export function ProviderConfig({ config, onConfigured, compact = false }: ProviderConfigProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<ProviderPreset>(
    PROVIDER_PRESETS.find(p => p.id === config?.presetId) ?? PROVIDER_PRESETS[0]!
  );
  const [apiKey, setApiKey] = React.useState(config?.apiKey || '');
  const [baseUrl, setBaseUrl] = React.useState(config?.baseUrl || selectedPreset.baseUrl);
  const [model, setModel] = React.useState(config?.model || selectedPreset.defaultModel);
  const [customModel, setCustomModel] = React.useState('');
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = React.useState('');
  const [showPanel, setShowPanel] = React.useState(!compact || !config);

  // Dynamic model fetching for local providers (Ollama)
  const [fetchedModels, setFetchedModels] = React.useState<string[] | null>(null);
  const [modelsFetching, setModelsFetching] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);

  // Fetch available models from Ollama when selected
  React.useEffect(() => {
    if (selectedPreset.id !== 'ollama') {
      setFetchedModels(null);
      setModelsError(null);
      return;
    }

    let cancelled = false;
    setModelsFetching(true);
    setModelsError(null);

    fetch(`${baseUrl}/models`)
      .then(res => {
        if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
        return res.json();
      })
      .then((data: { data?: { id: string }[] }) => {
        if (cancelled) return;
        const models = (data.data || []).map(m => m.id);
        setFetchedModels(models);
        // Auto-select first available model if current one isn't installed
        if (models.length > 0 && !models.includes(model)) {
          setModel(models[0]!);
        }
        setModelsFetching(false);
      })
      .catch(err => {
        if (cancelled) return;
        setModelsError(err instanceof Error ? err.message : 'Failed to fetch models');
        setFetchedModels(null);
        setModelsFetching(false);
      });

    return () => { cancelled = true; };
  }, [selectedPreset.id, baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePresetChange = React.useCallback((presetId: string) => {
    const preset = PROVIDER_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(preset);
      setBaseUrl(preset.baseUrl);
      setModel(preset.defaultModel);
      setApiKey('');
      setTestStatus('idle');
    }
  }, []);

  const handleTest = React.useCallback(async () => {
    setTestStatus('testing');
    setTestError('');

    const currentConfig: LLMProviderConfig = {
      type: selectedPreset.type,
      apiKey,
      baseUrl,
      model: customModel || model,
      presetId: selectedPreset.id,
    };

    const result = await testConnection(currentConfig);

    if (result.ok) {
      setTestStatus('success');
    } else {
      setTestStatus('error');
      setTestError(result.error || 'Connection failed');
    }
  }, [selectedPreset, apiKey, baseUrl, model, customModel]);

  const handleSave = React.useCallback(() => {
    onConfigured({
      type: selectedPreset.type,
      apiKey,
      baseUrl,
      model: customModel || model,
      presetId: selectedPreset.id,
    });
    if (compact) setShowPanel(false);
  }, [selectedPreset, apiKey, baseUrl, model, customModel, onConfigured, compact]);

  const needsApiKey = selectedPreset.type !== 'loom' && selectedPreset.id !== 'ollama';
  const isCustom = selectedPreset.id === 'custom';

  if (compact && !showPanel) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPanel(true)}
        className="gap-1.5"
      >
        <Settings className="h-4 w-4" />
        {config ? `${PROVIDER_PRESETS.find(p => p.id === config.presetId)?.name || 'Custom'} / ${config.model}` : 'Configure LLM'}
      </Button>
    );
  }

  return (
    <div className={cn(
      'flex flex-col gap-5',
      !compact && 'bg-card border border-border rounded-xl p-6 shadow-sm max-w-xl mx-auto',
    )}>
      {!compact && (
        <div className="text-center mb-2">
          <h2 className="text-xl font-semibold text-foreground">Connect Your LLM</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a provider and enter your API key to start generating UIs
          </p>
        </div>
      )}

      {/* Provider Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Provider</label>
        <Select value={selectedPreset.id} onValueChange={handlePresetChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_PRESETS.map(preset => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex flex-col">
                  <span>{preset.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
      </div>

      {/* API Key */}
      {needsApiKey && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">API Key</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
            placeholder={selectedPreset.type === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
          />
        </div>
      )}

      {/* Base URL (editable for custom/Loom) */}
      {(isCustom || selectedPreset.type === 'loom') && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Base URL</label>
          <Input
            type="url"
            value={baseUrl}
            onChange={(e) => { setBaseUrl(e.target.value); setTestStatus('idle'); }}
            placeholder="https://api.example.com/v1"
          />
        </div>
      )}

      {/* Model Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Model</label>
        {modelsFetching ? (
          <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-muted/30">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Detecting models…</span>
          </div>
        ) : modelsError && selectedPreset.id === 'ollama' ? (
          <div className="flex flex-col gap-1.5">
            <Input
              value={customModel}
              onChange={(e) => { setCustomModel(e.target.value); setTestStatus('idle'); }}
              placeholder="e.g. llama3.3"
            />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Could not reach Ollama at {baseUrl} — type a model name manually.
            </p>
          </div>
        ) : (fetchedModels ?? selectedPreset.models).length > 0 ? (
          <Select value={model} onValueChange={(v) => { setModel(v); setTestStatus('idle'); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(fetchedModels ?? selectedPreset.models).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={customModel}
            onChange={(e) => { setCustomModel(e.target.value); setTestStatus('idle'); }}
            placeholder="model-name"
          />
        )}
        {fetchedModels && selectedPreset.id === 'ollama' && (
          <p className="text-xs text-muted-foreground">
            {fetchedModels.length} model{fetchedModels.length !== 1 ? 's' : ''} available locally
          </p>
        )}
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Shield className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Keys are stored in memory only and cleared when you close this tab. They are sent directly to the provider and never to SurfacesUI servers.</span>
      </div>

      {/* Test & Save Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testStatus === 'testing' || (needsApiKey && !apiKey)}
          className="gap-1.5"
        >
          {testStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
          {testStatus === 'success' && <Check className="h-4 w-4 text-green-600" />}
          {testStatus === 'error' && <X className="h-4 w-4 text-red-600" />}
          Test Connection
        </Button>
        <Button
          onClick={handleSave}
          disabled={(needsApiKey && !apiKey) || modelsFetching}
        >
          {config ? 'Update' : 'Connect'}
        </Button>
        {compact && config && (
          <Button variant="ghost" size="sm" onClick={() => setShowPanel(false)}>
            Cancel
          </Button>
        )}
      </div>

      {/* Test Error */}
      {testStatus === 'error' && testError && (
        <p className="text-xs text-destructive">{testError}</p>
      )}

      {/* CORS Warning for Anthropic */}
      {selectedPreset.type === 'anthropic' && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Note: Direct browser access to Anthropic&apos;s API may encounter CORS restrictions.
          Consider using Loom Bridge or an OpenAI-compatible proxy for Anthropic models.
        </p>
      )}
    </div>
  );
}
