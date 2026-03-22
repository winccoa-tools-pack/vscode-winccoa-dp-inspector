import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { DpSearchEntry } from '../types';
import type { Action } from '../store/reducer';
import { useWs } from '../context/WsContext';

interface Group {
  id: string;
  name: string;
}

interface Props {
  groups: Group[];
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  float: '#4db8ff',
  int:   '#f0a030',
  bool:  '#b78fff',
  enum:  '#4ec94e',
};

export function AddDpDialog({ groups, dispatch, onClose }: Props) {
  const { search, status } = useWs();
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<DpSearchEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const inputRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const dps = await search(query.trim());
        setResults(dps);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleAdd(dp: DpSearchEntry) {
    const targetId = selectedGroupId;
    if (!targetId) return;
    dispatch({ type: 'ADD_DP', payload: { groupId: targetId, dp: dp.name, dpType: dp.type } });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const content = (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <span>Add Datapoint</span>
          <button className="dialog-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {groups.length > 1 && (
          <div className="dialog-field">
            <label>Target Group</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="toolbar-input"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="dialog-field">
          <label>Search</label>
          <input
            ref={inputRef}
            className="toolbar-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={status === 'connected' ? 'e.g. Pump1, *pressure*' : 'Not connected'}
            disabled={status !== 'connected'}
            style={{ width: '100%' }}
          />
        </div>

        <div className="dialog-results">
          {loading && <div className="dialog-hint">Searching…</div>}
          {error   && <div className="dialog-hint dialog-hint-error">{error}</div>}
          {!loading && !error && results.length === 0 && query.trim() && (
            <div className="dialog-hint">No results for "{query}"</div>
          )}
          {results.map((dp) => (
            <button key={dp.name} className="dp-result-row" onClick={() => handleAdd(dp)}>
              <span className="dp-result-name" title={dp.name}>{dp.name}</span>
              <span
                className="dp-type-badge"
                style={{ background: TYPE_COLORS[dp.type] ?? '#888' }}
              >
                {dp.type}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
