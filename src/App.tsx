
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { secureContextEnforcer } from '@/utils/security/SecureContextEnforcer';

// Pages
import Index from './pages/Index';
import Dashboard from './pages/Dashboard';
import LivePage from './pages/LivePage';
import LightShowPage from './pages/LightShowPage';
import QuizPage from './pages/QuizPage';
import NotFound from './pages/NotFound';
import ParticipantPage from './pages/ParticipantPage';

function App() {
  // FASE 1: CRÍTICO - Enforçar HTTPS e validar contexto seguro na inicialização
  useEffect(() => {
    console.log('🔒 FASE 1: Initializing security context enforcement...');
    
    // Forçar HTTPS se necessário
    const httpsEnforced = secureContextEnforcer.enforceHTTPS();
    if (!httpsEnforced) {
      console.log('🔒 SECURITY: HTTPS redirect initiated, app will reload');
      return;
    }
    
    // Validar contexto seguro
    const validation = secureContextEnforcer.validateSecureContext();
    console.log('🔒 SECURITY: Initial validation:', validation);
    
    // Corrigir mixed content se detectado
    if (validation.issues.some(issue => issue.includes('Mixed content'))) {
      console.log('🔒 SECURITY: Fixing mixed content...');
      secureContextEnforcer.fixMixedContent();
    }
    
    // Verificar redirecionamento 404
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('route') === '404') {
      window.history.replaceState({}, '', '/404');
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/lightshow" element={<LightShowPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/participant/:sessionId" element={<ParticipantPage />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
