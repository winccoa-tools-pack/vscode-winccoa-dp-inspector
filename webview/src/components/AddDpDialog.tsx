import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { DpSearchEntry, DpMeta } from '../types';
import type { Action } from '../store/reducer';
import { useWs } from '../context/WsContext';

interface Group {
  id: string;
  name: string;
  dps: string[];
}

interface Props {
  groups: Group[];
  dpMeta: Record<string, DpMeta>;
  recentDps: string[];
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  float: '#4db8ff',
  int:   '#f0a030',
  bool:  '#b78fff',
  enum:  '#4ec94e',
};

export function AddDpDialog({ groups, dpMeta, recentDps, dispatch, onClose }: Props) {
  const { search, status } = useWs();
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<DpSearchEntry[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const [highlightedIdx, setHighlightedIdx]   = useState(-1);
  const inputRef    = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Build display list: recent when empty, search results otherwise
  const showRecent = !query.trim();
  const recentList: DpSearchEntry[] = recentDps.map((dp) => ({
    name: dp,
    type: dpMeta[dp]?.type ?? 'float',
  }));
  const displayList = showRecent ? recentList : results;

  const targetGroup = groups.find((g) => g.id === selectedGroupId);
  const alreadyInGroup = new Set(targetGroup?.dps ?? []);

  // Reset highlight when list changes
  useEffect(() => { setHighlightedIdx(-1); }, [query, results.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('.dp-result-row');
    items[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx]);

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
    if (!targetId || alreadyInGroup.has(dp.name)) return;
    dispatch({ type: 'ADD_DP', payload: { groupId: targetId, dp: dp.name, dpType: dp.type } });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, displayList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        e.preventDefault();
        const dp = displayList[highlightedIdx];
        if (dp) handleAdd(dp);
        break;
      }
    }
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

        <div className="dialog-results" ref={listRef}>
          {showRecent && recentList.length > 0 && (
            <div className="dialog-hint dialog-hint-section">Recently added</div>
          )}
          {showRecent && recentList.length === 0 && (
            <div className="dialog-hint">Type to search datapoints</div>
          )}
          {loading && <div className="dialog-hint">Searching…</div>}
          {error   && <div className="dialog-hint dialog-hint-error">{error}</div>}
          {!loading && !error && !showRecent && results.length === 0 && query.trim() && (
            <div className="dialog-hint">No results for "{query}"</div>
          )}
          {!loading && displayList.map((dp, idx) => {
            const isHighlighted = idx === highlightedIdx;
            const isAdded = alreadyInGroup.has(dp.name);
            return (
              <button
                key={dp.name}
                className={`dp-result-row${isHighlighted ? ' dp-result-row--highlighted' : ''}${isAdded ? ' dp-result-row--added' : ''}`}
                onClick={() => handleAdd(dp)}
                title={isAdded ? 'Already in this group' : dp.name}
              >
                <span className="dp-result-name" title={dp.name}>{dp.name}</span>
                <span
                  className="dp-type-badge"
                  style={{ background: isAdded ? 'var(--dp-border)' : (TYPE_COLORS[dp.type] ?? '#888') }}
                >
                  {dp.type}
                </span>
                {isAdded && <span className="dp-already-tag">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
