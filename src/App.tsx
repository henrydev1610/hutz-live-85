
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Navbar from "./components/layout/Navbar";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import LightShowPage from "./pages/LightShowPage";
import TelaoPage from "./pages/TelaoPage";
import QuizPage from "./pages/QuizPage";
import NotFound from "./pages/NotFound";
import ParticipantPage from "./pages/ParticipantPage";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="animate-spin h-8 w-8 border-4 border-accent border-r-transparent rounded-full"></div>
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="animate-spin h-8 w-8 border-4 border-accent border-r-transparent rounded-full"></div>
    </div>;
  }

  return (
    <Routes>
      {user ? (
        <>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/lightshow" 
            element={
              <ProtectedRoute>
                <LightShowPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/telao" 
            element={
              <ProtectedRoute>
                <TelaoPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/quiz" 
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            } 
          />
          {/* Public route for participants that doesn't require authentication */}
          <Route path="/participant/:sessionId" element={<ParticipantPage />} />
          <Route path="*" element={<NotFound />} />
        </>
      ) : (
        <>
          <Route path="/auth" element={<Auth />} />
          {/* Public route for participants that doesn't require authentication */}
          <Route path="/participant/:sessionId" element={<ParticipantPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </>
      )}
    </Routes>
  );
};

const App = () => {
  // Create a new QueryClient instance inside the component
  const [queryClient] = useState(() => new QueryClient());

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <div className="min-h-screen flex flex-col bg-black">
              <AppRoutes />
            </div>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
