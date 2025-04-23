
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to dashboard on component mount
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/40">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 hutz-gradient-text">Hutz Live</h1>
        <p className="text-xl text-white/70">Carregando...</p>
      </div>
    </div>
  );
};

export default Index;
