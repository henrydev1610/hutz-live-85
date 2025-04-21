
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreateSessionPage from './pages/CreateSessionPage';
import LiveSessionPage from './pages/LiveSessionPage';
import TransmitSessionPage from './pages/TransmitSessionPage';
import ParticipantPage from './pages/ParticipantPage';
import { Toaster } from "@/components/ui/toaster";
import LightShowPage from './pages/LightShowPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreateSessionPage />} />
        <Route path="/session/:sessionId" element={<LiveSessionPage />} />
        <Route path="/transmit/:sessionId" element={<TransmitSessionPage />} />
        <Route path="/join/:sessionId" element={<ParticipantPage />} />
        <Route path="/lightshow" element={<LightShowPage />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
