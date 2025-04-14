
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface ImageLibraryHeaderProps {
  selectedImagesCount: number;
  onDeleteSelected: () => void;
}

const ImageLibraryHeader = ({
  selectedImagesCount,
  onDeleteSelected
}: ImageLibraryHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-medium">Biblioteca de Imagens</h3>
      <div className="flex items-center gap-2">
        <div className="text-sm text-white/60">
          {selectedImagesCount} imagens selecionadas
        </div>
        {selectedImagesCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onDeleteSelected}
            className="text-red-500 hover:text-red-400 hover:bg-red-950/20"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
};

export default ImageLibraryHeader;
