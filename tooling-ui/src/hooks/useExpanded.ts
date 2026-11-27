import { useCallback, useState } from 'react';

/** Tracks which cards are expanded (all collapsed by default). */
export function useExpanded() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isCollapsed = useCallback((id: string) => !expanded.has(id), [expanded]);
  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const expand = useCallback((id: string) => setExpanded(prev => new Set(prev).add(id)), []);
  return { isCollapsed, toggle, expand };
}
