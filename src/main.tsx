import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import './index.css';

(function restoreSpaRedirectRoute() {
  const l = window.location;
  if (l.search.startsWith('?/')) {
    const decoded = l.search
      .slice(1)
      .split('&')
      .map((s) => s.replace(/~and~/g, '&'))
      .join('?');
    const cleanPath = l.pathname.endsWith('/') ? l.pathname.slice(0, -1) : l.pathname;
    window.history.replaceState(null, '', cleanPath + decoded + l.hash);
  }
})();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
