import React, { useEffect, useRef, useState } from 'react';
import type { Action } from '../store/reducer';
import type { ChartGroup } from '../types';
import { useWs } from '../context/WsContext';

interface Props {
  query: string;
  groups: ChartGroup[];
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

export function DpSearchDropdown({ query, groups, dispatch, onClose }: Props) {
  const { search } = useWs();
  const [results, setResults] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDps, setSelectedDps] = useState<Set<string>>(new Set());
  const [targetGroupId, setTargetGroupId] = useState<string>(groups[0]?.id ?? '__new__');
  const containerRef = useRef<HTMLDivElement>(null);

  // Run the search when the dropdown mounts
  useEffect(() => {
    setLoading(true);
    search(query)
      .then((dps) => {
        setResults(dps);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function toggleDp(dp: string) {
    setSelectedDps((prev) => {
      const next = new Set(prev);
      if (next.has(dp)) next.delete(dp); else next.add(dp);
      return next;
    });
  }

  function handleAdd() {
    if (selectedDps.size === 0) return;

    let groupId = targetGroupId;
    if (groupId === '__new__') {
      groupId = `group-${Date.now()}`;
      dispatch({
        type: 'ADD_GROUP',
        group: { id: groupId, name: `Group ${groups.length + 1}`, dps: [], timeRange: '2min' },
      });
    }

    for (const dp of selectedDps) {
      dispatch({ type: 'ADD_DP_TO_GROUP', groupId, dp });
    }

    onClose();
  }

  return (
    <div ref={containerRef} className="dp-search-dropdown">
      {loading && <div className="dp-search-loading">Searching…</div>}
      {error && <div className="dp-search-error">Error: {error}</div>}
      {results !== null && results.length === 0 && (
        <div className="dp-search-empty">No DPs found matching "{query}"</div>
      )}

      {results !== null && results.length > 0 && (
        <>
          <div className="dp-search-list">
            {results.map((dp) => (
              <label key={dp} className="dp-search-item">
                <input
                  type="checkbox"
                  checked={selectedDps.has(dp)}
                  onChange={() => toggleDp(dp)}
                />
                <span className="dp-search-name">{dp}</span>
              </label>
            ))}
          </div>

          <div className="dp-search-footer">
            <select
              className="toolbar-input"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="__new__">— New group —</option>
            </select>
            <button
              className="toolbar-btn toolbar-btn-primary"
              onClick={handleAdd}
              disabled={selectedDps.size === 0}
            >
              Add {selectedDps.size > 0 ? `(${selectedDps.size})` : ''}
            </button>
            <button className="toolbar-btn toolbar-btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
