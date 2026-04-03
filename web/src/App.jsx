// App.jsx - 라우팅 설정
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import { useLang } from './contexts/LanguageContext';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DailyQuestion from './pages/DailyQuestion';
import MyMemories from './pages/MyMemories';
import FamilyConnect from './pages/FamilyConnect';
import TrustSettings from './pages/TrustSettings';
import ProfileSetup from './pages/ProfileSetup';
import Chat from './pages/Chat';
import DollCreate from './pages/DollCreate';
import DollHome from './pages/DollHome';
import DollChat from './pages/DollChat';
import DollWardrobe from './pages/DollWardrobe';
import Shop from './pages/Shop';
import Diary from './pages/Diary';
import MemorialBook from './pages/MemorialBook';
import Settings from './pages/Settings';
import DevMode from './pages/DevMode';
import { MemorialProvider } from './context/MemorialContext';

// 이미 로그인한 사람이 /login 접근 시 대시보드로 보내기
function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

// 언어 전환 시 fade out → fade in (0.3s)
function FadeWrapper({ children }) {
  const { fading } = useLang();
  return (
    <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.15s ease' }}>
      {children}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MemorialProvider>
        <FadeWrapper>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          <Route path="/profile-setup" element={<PrivateRoute><ProfileSetup /></PrivateRoute>} />
          <Route path="/dashboard"    element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/questions"    element={<PrivateRoute><DailyQuestion /></PrivateRoute>} />
          <Route path="/memories"     element={<PrivateRoute><MyMemories /></PrivateRoute>} />
          <Route path="/family"       element={<PrivateRoute><FamilyConnect /></PrivateRoute>} />
          <Route path="/trust"        element={<PrivateRoute><TrustSettings /></PrivateRoute>} />
          <Route path="/chat"         element={<PrivateRoute><Chat /></PrivateRoute>} />
          <Route path="/doll/create"  element={<PrivateRoute><DollCreate /></PrivateRoute>} />
          <Route path="/doll"         element={<PrivateRoute><DollHome /></PrivateRoute>} />
          <Route path="/doll/chat"      element={<PrivateRoute><DollChat /></PrivateRoute>} />
          <Route path="/doll/wardrobe" element={<PrivateRoute><DollWardrobe /></PrivateRoute>} />
          <Route path="/shop"         element={<PrivateRoute><Shop /></PrivateRoute>} />
          <Route path="/diary"        element={<PrivateRoute><Diary /></PrivateRoute>} />
          <Route path="/settings"     element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/dev"          element={<PrivateRoute><DevMode /></PrivateRoute>} />
          <Route path="/memorial-book" element={<PrivateRoute><MemorialBook /></PrivateRoute>} />
        </Routes>
        </FadeWrapper>
        </MemorialProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
