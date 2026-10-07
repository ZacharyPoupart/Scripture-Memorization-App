import { useEffect, useState } from 'preact/hooks';

export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    addEventListener('hashchange', on);
    on(); // the hash may have changed between the first render and now
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string, replace = false) {
  const url = '#' + to;
  if (replace) history.replaceState(null, '', url), dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = to;
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else navigate(fallback, true);
}
