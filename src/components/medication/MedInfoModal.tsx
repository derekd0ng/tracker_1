import { useState, useEffect } from 'react';

interface Props {
  medicationName: string;
  dose?: string;
  onClose: () => void;
}

const CACHE_KEY = 'med_ai_cache';

function getCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}
function setCache(key: string, value: string) {
  const cache = getCache();
  cache[key] = value;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export default function MedInfoModal({ medicationName, dose, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `${medicationName}|${dose ?? ''}`;
    const cached = getCache()[cacheKey];
    if (cached) { setContent(cached); setLoading(false); return; }

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError('API key not configured. Add VITE_ANTHROPIC_API_KEY to your .env.local file.');
      setLoading(false);
      return;
    }

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 340,
        messages: [{
          role: 'user',
          content: `Provide a concise, patient-friendly summary about the medication "${medicationName}"${dose ? ` (${dose})` : ''}. Cover: what it is typically prescribed for, how it works in simple terms, and one important note a patient should know. Keep it to 2 short paragraphs. Be direct and brief. Do not give specific medical advice.`,
        }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        console.log('Anthropic response:', data);
        if (data.error) { setError(`API error: ${data.error.message}`); return; }
        const text = data.content?.[0]?.text;
        if (text) { setContent(text); setCache(cacheKey, text); }
        else setError(`Unexpected response: ${JSON.stringify(data)}`);
      })
      .catch(err => setError(`Failed to fetch: ${err.message}`))
      .finally(() => setLoading(false));
  }, [medicationName, dose]);

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/icon-ai.svg" alt="" width="16" height="16" />
            </div>
            <div>
              <p className="modal-title" style={{ marginBottom: 0 }}>AI Overview</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{medicationName}{dose ? ` · ${dose}` : ''}</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div className="med-info-loading">
              <div className="med-info-spinner" />
              <p className="text-muted">Looking up medication info…</p>
            </div>
          )}
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>
          )}
          {content && (
            <div className="med-info-content">
              {content.split('\n').map((line, i) => {
                const heading = line.match(/^#{1,3}\s+(.+)/);
                if (heading) {
                  return <p key={i} className="med-info-heading">{heading[1]}</p>;
                }
                if (line.trim() === '') return null;
                // Render inline **bold**
                const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
                  const bold = part.match(/^\*\*(.+)\*\*$/);
                  return bold ? <strong key={j}>{bold[1]}</strong> : part;
                });
                return <p key={i}>{parts}</p>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
