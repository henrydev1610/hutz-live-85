
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="absolute top-4 right-4 text-white/70 hover:text-white"
      onClick={() => navigate('/dashboard')}
    >
      <ChevronLeft className="h-4 w-4 mr-1" />
      Voltar
    </Button>
  );
};

export default BackButton;
