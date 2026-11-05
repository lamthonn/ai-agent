import { useEffect } from 'react';

/** Sets the tab title per screen. */
export function useTitle(t: string) {
  useEffect(() => { document.title = `${t} · Agent Platform`; }, [t]);
}
