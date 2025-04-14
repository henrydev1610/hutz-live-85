
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Save } from "lucide-react";

interface HeaderProps {
  showName: string;
  onShowNameChange: (name: string) => void;
  handleGenerateFile: () => void;
  audioFile: File | null;
  timelineItems: any[];
}

const Header = ({
  showName,
  onShowNameChange,
  handleGenerateFile,
  audioFile,
  timelineItems,
}: HeaderProps) => {
  return (
    <div className="mb-4 flex flex-wrap gap-4 items-center">
      <div className="flex-1">
        <Label htmlFor="show-name" className="mb-2 block">Nome do Show</Label>
        <Input
          id="show-name"
          value={showName}
          onChange={(e) => onShowNameChange(e.target.value)}
          className="hutz-input w-full"
        />
      </div>
      
      <div className="flex-1 md:flex-initial flex gap-2">
        <Button 
          onClick={handleGenerateFile} 
          className="hutz-button-accent"
          disabled={!audioFile || !timelineItems.length}
        >
          <Download className="h-4 w-4 mr-2" />
          Gerar Arquivo .WAV
        </Button>
        
        <Button variant="outline" className="border-white/20 hover:bg-secondary">
          <Save className="h-4 w-4 mr-2" />
          Salvar Projeto
        </Button>
      </div>
    </div>
  );
};

export default Header;
