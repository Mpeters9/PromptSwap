'use client';

import { useMemo, useState } from 'react';

type Props = {
  promptText: string;
  promptId: string;
};

const models = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'text-davinci-003', label: 'text-davinci-003' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
];

export default function PromptTester({ promptText, promptId }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [model, setModel] = useState(models[0]?.value ?? 'gpt-4o');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const warning = useMemo(
    () =>
      'Your API key is used only for this test request and is not stored. Avoid sharing keys broadly; rotate if needed.',
    [],
  );

  const handleRun = async () => {
    setError(null);
    setOutput(null);

    if (!apiKey.trim()) {
      setError('Please provide your API key.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model,
          promptInput,
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Test request failed.');
      }

      const data = await res.json();
      setOutput(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong while testing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Prompt Tester</h2>
          <p className="text-sm text-slate-600">Run a quick test using your own model API key.</p>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          Rate limits may apply
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">{warning}</p>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800" htmlFor="apiKey">
            Your OpenAI/Anthropic API key — not stored
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800" htmlFor="variables">
            Prompt input / variables (optional)
          </label>
          <textarea
            id="variables"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            rows={4}
            placeholder="E.g., product name=PromptSwap, audience=marketers"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            <div className="font-semibold text-slate-900">Prompt being tested</div>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">
              {promptText}
            </pre>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? 'Running...' : 'Run Test'}
          </button>
          <span className="text-xs text-slate-500">
            We do not store your key. Rate limiting or provider costs may apply.
          </span>
        </div>

        {output && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Output</div>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm text-slate-800">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
