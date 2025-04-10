
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "./components/layout/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LightShowPage from "./pages/LightShowPage";
import TelaoPage from "./pages/TelaoPage";
import QuizPage from "./pages/QuizPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check if user was previously authenticated
  useEffect(() => {
    const savedAuth = localStorage.getItem('hutz-auth');
    if (savedAuth) {
      setIsAuthenticated(true);
    }
  }, []);
  
  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('hutz-auth', 'true');
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('hutz-auth');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {isAuthenticated ? (
            <div className="min-h-screen flex flex-col bg-black">
              <Navbar onLogout={handleLogout} />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/lightshow" element={<LightShowPage />} />
                  <Route path="/telao" element={<TelaoPage />} />
                  <Route path="/quiz" element={<QuizPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          ) : (
            <Routes>
              <Route path="*" element={<Login onLogin={handleLogin} />} />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
