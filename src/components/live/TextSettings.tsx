import { Minus, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TextSettingsProps {
  participantCount: number;
  setParticipantCount: (count: number) => void;
  qrCodeDescription: string;
  setQrCodeDescription: (text: string) => void;
  selectedFont: string;
  setSelectedFont: (font: string) => void;
  selectedTextColor: string;
  setSelectedTextColor: (color: string) => void;
  qrDescriptionFontSize: number;
  setQrDescriptionFontSize: (size: number) => void;
}

const TextSettings = ({
  participantCount,
  setParticipantCount,
  qrCodeDescription,
  setQrCodeDescription,
  selectedFont,
  setSelectedFont,
  selectedTextColor,
  setSelectedTextColor,
  qrDescriptionFontSize,
  setQrDescriptionFontSize
}: TextSettingsProps) => {
  const fontOptions = [
    { name: 'Sans-serif', value: 'sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: 'Cursive', value: 'cursive' },
    { name: 'Fantasy', value: 'fantasy' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Tahoma', value: 'Tahoma, sans-serif' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Garamond', value: 'Garamond, serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Brush Script MT', value: 'Brush Script MT, cursive' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
    { name: 'Impact', value: 'Impact, fantasy' },
    { name: 'Lucida Handwriting', value: 'Lucida Handwriting, cursive' },
    { name: 'Lucida Console', value: 'Lucida Console, monospace' },
    { name: 'Palatino', value: 'Palatino, serif' },
    { name: 'Book Antiqua', value: 'Book Antiqua, serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Arial Black', value: 'Arial Black, sans-serif' },
    { name: 'Copperplate', value: 'Copperplate, fantasy' },
    { name: 'Papyrus', value: 'Papyrus, fantasy' },
    { name: 'Rockwell', value: 'Rockwell, serif' },
    { name: 'Century Gothic', value: 'Century Gothic, sans-serif' },
    { name: 'Calibri', value: 'Calibri, sans-serif' },
    { name: 'Cambria', value: 'Cambria, serif' },
    { name: 'Consolas', value: 'Consolas, monospace' },
    { name: 'Franklin Gothic', value: 'Franklin Gothic, sans-serif' }
  ];

  const textColors = [
    '#FFFFFF', '#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', 
    '#94A3B8', '#64748B', '#475569', '#334155', '#1E293B', 
    '#0F172A', '#020617', '#000000', '#FEF2F2', '#FEE2E2', 
    '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', 
    '#B91C1C', '#ECFDF5', '#D1FAE5', '#A7F3D0', '#6EE7B7', 
    '#34D399', '#10B981', '#059669', '#047857', '#FFEDD5'
  ];

  const increaseFontSize = () => {
    const newSize = Math.min(qrDescriptionFontSize + 2, 32);
    setQrDescriptionFontSize(newSize);
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(qrDescriptionFontSize - 2, 10);
    setQrDescriptionFontSize(newSize);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">
          Número de participantes na tela
        </Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 4, 6, 9, 12, 16, 24].map((num) => (
            <Button
              key={num}
              variant={participantCount === num ? "default" : "outline"}
              onClick={() => setParticipantCount(num)}
              className={participantCount === num ? "bg-accent text-white" : "border-white/20"}
            >
              {num}
            </Button>
          ))}
        </div>
      </div>
      
      <div>
        <Label htmlFor="description-text" className="mb-2 block">
          Texto de Descrição
        </Label>
        <Input
          id="description-text"
          placeholder="Escaneie o QR Code para participar"
          value={qrCodeDescription}
          onChange={(e) => setQrCodeDescription(e.target.value)}
          className="hutz-input"
        />
      </div>
      
      <div>
        <Label className="mb-2 block">Fonte do Texto</Label>
        <Select value={selectedFont} onValueChange={setSelectedFont}>
          <SelectTrigger className="hutz-input">
            <SelectValue placeholder="Selecione a fonte" />
          </SelectTrigger>
          <SelectContent>
            {fontOptions.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="mb-2 block">Cor do Texto</Label>
        <div className="grid grid-cols-9 gap-1">
          {textColors.map((color) => (
            <button
              key={color}
              className={`w-6 h-6 rounded-full border ${selectedTextColor === color ? 'border-white ring-2 ring-accent' : 'border-white/20'}`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedTextColor(color)}
              aria-label={`Selecionar cor ${color}`}
            />
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Tamanho do Texto</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={decreaseFontSize}
            disabled={qrDescriptionFontSize <= 10}
            className="border-white/20"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2">{qrDescriptionFontSize}px</span>
          <Button
            variant="outline"
            onClick={increaseFontSize}
            disabled={qrDescriptionFontSize >= 32}
            className="border-white/20"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TextSettings;
