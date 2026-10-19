import { useState, useEffect } from './vendor/preact-htm.js';

// Routeur minimal par hash : "#/enfant/abc?onglet=boutique" -> { path: ['enfant', 'abc'], query: { onglet: 'boutique' } }
export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path, query, raw };
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`;
  if (replace) history.replaceState(null, '', target);
  else history.pushState(null, '', target);
  window.dispatchEvent(new Event('hashchange'));
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return route;
}
