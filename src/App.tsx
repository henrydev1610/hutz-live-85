
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";

// Pages
import Index from './pages/Index';
import Dashboard from './pages/Dashboard';
import LivePage from './pages/LivePage';
import LightShowPage from './pages/LightShowPage';
import QuizPage from './pages/QuizPage';
import NotFound from './pages/NotFound';
import ParticipantPage from './pages/ParticipantPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/lightshow" element={<LightShowPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/participant/:sessionId" element={<ParticipantPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
