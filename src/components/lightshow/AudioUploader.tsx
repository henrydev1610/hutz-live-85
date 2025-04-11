
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Music, Upload } from 'lucide-react';

interface AudioUploaderProps {
  onAudioUploaded: (file: File) => void;
}

const AudioUploader = ({ onAudioUploaded }: AudioUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes('audio/')) {
        onAudioUploaded(file);
      }
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAudioUploaded(e.target.files[0]);
    }
  };
  
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div 
      className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 
        ${isDragging ? 'border-accent bg-accent/10' : 'border-white/20'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Music className="h-16 w-16 text-white/30 mb-4" />
      <h3 className="text-xl font-medium mb-2">Carregue seu áudio</h3>
      <p className="text-white/50 text-center mb-6">
        Arraste e solte um arquivo de áudio aqui ou clique no botão abaixo
      </p>
      
      <input 
        type="file" 
        ref={fileInputRef}
        accept="audio/*" 
        className="hidden" 
        onChange={handleFileInputChange} 
      />
      
      <Button onClick={handleButtonClick} className="hutz-button-primary">
        <Upload className="h-4 w-4 mr-2" />
        Selecionar Arquivo
      </Button>
      
      <p className="mt-4 text-sm text-white/50">
        Formatos suportados: MP3, WAV, M4A
      </p>
    </div>
  );
};

export default AudioUploader;
