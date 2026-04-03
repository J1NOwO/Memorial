// main.jsx - React 앱의 진입점
// index.html의 <div id="root"> 안에 App 컴포넌트를 렌더링해

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';  // 전역 스타일
import App from './App.jsx';
import { LanguageProvider } from './contexts/LanguageContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);
