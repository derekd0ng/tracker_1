import { useState, useEffect } from 'react';
import type { Habit, HabitLog } from '../../types';

interface Props {
  habits: Habit[];
  allLogs: HabitLog[];
}

const CACHE_KEY = 'habit_insight_cache';

function getCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}
function setCache(key: string, value: string) {
  const cache = getCache();
  cache[key] = value;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// Compute the all-time metric value for a habit (the number that replaces {N})
function computeMetricValue(habit: Habit, allLogs: HabitLog[]): string {
  const logs = allLogs.filter(l => l.habitId === habit.id && l.value > 0);
  if (habit.type === 'numeric') {
    const total = logs.reduce((sum, l) => sum + l.value, 0);
    if (total === 0) return '0';
    // Format large numbers nicely
    if (total >= 10_000) return Math.round(total).toLocaleString();
    return String(Math.round(total * 10) / 10);
  } else {
    return String(logs.length);
  }
}

function buildPrompt(habit: Habit, allLogs: HabitLog[]): string {
  const logs = allLogs.filter(l => l.habitId === habit.id && l.value > 0);
  let metricDesc: string;
  if (habit.type === 'numeric') {
    const total = logs.reduce((sum, l) => sum + l.value, 0);
    metricDesc = `${Math.round(total)} ${habit.unit ?? 'units'} tracked in total`;
  } else {
    metricDesc = `${logs.length} days completed in total`;
  }

  const unitHint = habit.type === 'numeric' ? ` (unit: ${habit.unit ?? 'units'})` : ' (days completed)';
  return `The user tracks the habit "${habit.name}"${unitHint} and has accumulated ${metricDesc}. Write a single short, fun, uplifting sentence (max 15 words) celebrating this. Use exactly "{N}" as a placeholder for the metric number. The unit or context should appear naturally in the sentence. Only output the sentence, nothing else. Example style: "{N} glasses of water logged — your body is well-hydrated!" or "{N} days of meditation — you've built a real practice!"`;
}

export default function HabitInsight({ habits, allLogs }: Props) {
  // Only consider habits that have at least one logged entry
  const habitsWithLogs = habits.filter(h => allLogs.some(l => l.habitId === h.id && l.value > 0));

  // Pick a random habit once per mount (changes on every page reload)
  const [habit] = useState<Habit | null>(() => {
    if (habitsWithLogs.length === 0) return null;
    return habitsWithLogs[Math.floor(Math.random() * habitsWithLogs.length)];
  });

  const [template, setTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!habit) return;

    const cached = getCache()[habit.id];
    if (cached) {
      setTemplate(cached);
      return;
    }

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return;

    setLoading(true);
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
        max_tokens: 80,
        messages: [{ role: 'user', content: buildPrompt(habit, allLogs) }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        const text = data.content?.[0]?.text?.trim();
        if (text) { setCache(habit.id, text); setTemplate(text); }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [habit?.id]);

  if (!habit) return null;

  const metricValue = computeMetricValue(habit, allLogs);
  const displayText = template ? template.replace('{N}', metricValue) : null;

  return (
    <div className="med-tip-card">
      <h4 className="med-tip-title">Your progress</h4>
      {loading && !displayText && (
        <p className="med-tip-body" style={{ fontStyle: 'italic' }}>Generating insight…</p>
      )}
      {displayText && (
        <p className="med-tip-body">{displayText}</p>
      )}
    </div>
  );
}
