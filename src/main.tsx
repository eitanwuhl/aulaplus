import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { mockGroups } from './data/mockData'

// DEV instrumentation: Expose mockGroups for browser console inspection
if (import.meta.env.DEV) {
  (window as any).__mockGroups = mockGroups;
  console.log('[DEV] mockGroups exposed to window.__mockGroups for inspection');
}

createRoot(document.getElementById("root")!).render(<App />);
