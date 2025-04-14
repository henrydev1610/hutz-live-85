
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckSquare, Trash2 } from 'lucide-react';

interface ImageSelectionControlsProps {
  selectedImagesCount: number;
  totalImagesCount: number;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
}

const ImageSelectionControls = ({
  selectedImagesCount,
  totalImagesCount,
  onSelectAll,
  onDeleteSelected
}: ImageSelectionControlsProps) => {
  if (selectedImagesCount === 0) {
    return null;
  }

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
          variant="outline" 
          size="sm" 
          onClick={onDeleteSelected}
          className="flex-1 text-red-500 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Excluir Selecionadas
        </Button>
      </div>
      <Separator className="bg-white/10 my-4" />
    </>
  );
};

export default ImageSelectionControls;
