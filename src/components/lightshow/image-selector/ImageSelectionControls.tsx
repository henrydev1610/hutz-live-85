
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckSquare, Plus } from 'lucide-react';
import { useState } from 'react';

interface ImageSelectionControlsProps {
  selectedImagesCount: number;
  totalImagesCount: number;
  onSelectAll: () => void;
  onAddSelected: () => void;
}

const ImageSelectionControls = ({
  selectedImagesCount,
  totalImagesCount,
  onSelectAll,
  onAddSelected
}: ImageSelectionControlsProps) => {
  const [isAdding, setIsAdding] = useState(false);

  if (selectedImagesCount === 0) {
    return null;
  }

  const handleAddSelectedClick = () => {
    setIsAdding(true);
    
    // Add a slight delay to show the loading state
    setTimeout(() => {
      onAddSelected();
      setIsAdding(false);
    }, 300);
  };

  return (
    <>
      <div className="flex items-center gap-2 mt-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSelectAll}
          className="flex-1"
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          {selectedImagesCount === totalImagesCount ? "Desmarcar Todas" : "Selecionar Todas"}
        </Button>
        
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleAddSelectedClick}
          className="flex-1 bg-green-600 hover:bg-green-700"
          disabled={isAdding}
        >
          {isAdding ? (
            <span className="flex items-center">
              <span className="h-4 w-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              Adicionando...
            </span>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Selecionadas ({selectedImagesCount})
            </>
          )}
        </Button>
      </div>
      <Separator className="bg-white/10 my-4" />
    </>
  );
};

export default ImageSelectionControls;
