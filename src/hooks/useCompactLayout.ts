import { useEffect, useState } from 'react';

// Keep this breakpoint aligned with the compact controls in index.css.
export const COMPACT_LAYOUT_QUERY = '(max-width: 1023px), (max-height: 500px)';

export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_LAYOUT_QUERY).matches
  );

  useEffect(() => {
    const query = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
}
