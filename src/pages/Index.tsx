
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Automatically redirect to dashboard
    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">Momento</h1>
        <p className="text-xl text-gray-400">Redirecionando para o Dashboard...</p>
      </div>
    </div>
  );
};

export default Index;
