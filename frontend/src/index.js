import React from 'react';
import ReactDOM from 'react-dom/client'; // Import createRoot from react-dom/client
import './index.css';
import App from './App';

// Get the root element
const rootElement = document.getElementById('root');

// Note: external scripts should be added in `public/index.html`.

// Defensive fetch wrapper: when the app requests a protected event endpoint
// without an Authorization token, try the public event endpoint instead.
// Also, if a protected GET returns 401, automatically retry the public endpoint.
(() => {
  const originalFetch = window.fetch.bind(window);
  const isEventUrl = (url) => {
    try {
      const u = typeof url === 'string' ? url : url.url || '';
      return /\/api\/events\/[0-9a-fA-F-]{36}(?:\b|$)/.test(u);
    } catch (e) {
      return false;
    }
  };

  window.fetch = async (input, init = {}) => {
    try {
      const reqUrl = typeof input === 'string' ? input : input.url || '';
      const method = (init.method || (input && input.method) || 'GET').toUpperCase();

      const hasAuthHeader = (() => {
        const headers = new Headers(init.headers || (input && input.headers) || {});
        return headers.has('Authorization') || localStorage.getItem('token');
      })();

      // If it's a GET to protected event endpoint and no token, call public endpoint directly
      if (method === 'GET' && isEventUrl(reqUrl) && !hasAuthHeader) {
        const publicUrl = reqUrl.replace('/api/events/', '/api/public/events/');
        return originalFetch(publicUrl, init);
      }

      const resp = await originalFetch(input, init);

      // On 401 from protected event GET, retry public endpoint once
      if (resp && resp.status === 401 && method === 'GET' && isEventUrl(reqUrl)) {
        const publicUrl = reqUrl.replace('/api/events/', '/api/public/events/');
        try {
          const publicResp = await originalFetch(publicUrl, init);
          return publicResp.ok ? publicResp : resp;
        } catch (e) {
          return resp;
        }
      }

      return resp;
    } catch (e) {
      return originalFetch(input, init);
    }
  };
})();

// Use createRoot to render the app
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
