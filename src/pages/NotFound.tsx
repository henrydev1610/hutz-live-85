
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4 text-center">
      <FileQuestion className="h-24 w-24 text-accent mb-6" />
      <h1 className="text-5xl font-bold mb-4 hutz-gradient-text">404</h1>
      <p className="text-xl text-white/70 mb-8 max-w-md">
        Oops! A página que você está procurando não existe.
      </p>
      <Button asChild size="lg" className="hutz-button-primary">
        <Link to="/">Voltar para a Página Inicial</Link>
      </Button>
    </div>
  );
};

export default NotFound;
