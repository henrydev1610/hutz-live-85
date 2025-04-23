
import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Auth from '@/pages/Auth';
import LightShowPage from '@/pages/LightShowPage';
import QuizPage from '@/pages/QuizPage';
import LivePage from '@/pages/LivePage';
import LiveBroadcastPage from '@/pages/LiveBroadcastPage';
import LiveJoinPage from '@/pages/LiveJoinPage';
import { AuthProvider } from '@/contexts/AuthContext';
import { LiveSessionProvider } from '@/contexts/LiveSessionContext';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lightshow" element={<LightShowPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        
        {/* Live routes wrapped in LiveSessionProvider */}
        <Route path="/live" element={<LiveSessionProvider><LivePage /></LiveSessionProvider>} />
        <Route path="/live/broadcast/:sessionId" element={<LiveBroadcastPage />} />
        <Route path="/live/join/:sessionId" element={<LiveJoinPage />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
