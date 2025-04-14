
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Scissors, Upload } from "lucide-react";

interface AudioEditorProps {
  audioFile: File | null;
  duration: number;
  audioEditInfo: {
    startTrim: number;
    endTrim: number;
  };
  onAudioUpload: (file: File) => void;
  setAudioEditInfo: (info: {
    startTrim: number;
    endTrim: number;
  }) => void;
  trimAudio: () => void;
}

const AudioEditor = ({
  audioFile,
  duration,
  audioEditInfo,
  onAudioUpload,
  setAudioEditInfo,
  trimAudio
}: AudioEditorProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAudioUpload(files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-black/30">
        <CardHeader>
          <CardTitle>Editor de Áudio</CardTitle>
          <CardDescription>
            Substitua ou edite o arquivo de áudio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="replace-audio">Substituir Áudio</Label>
              <div className="mt-2">
                <Input
                  id="replace-audio"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="bg-black/20 border-white/10"
                />
              </div>
            </div>

            <Separator className="my-4 bg-white/10" />

            <div>
              <Label className="text-md font-semibold">Cortar Áudio</Label>
              <div className="text-sm text-white/70 mt-1 mb-3">
                Defina os pontos de início e fim para cortar o áudio
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">Início (segundos)</Label>
                  <Input
                    id="start-time"
                    type="number"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={audioEditInfo.startTrim}
                    onChange={(e) => setAudioEditInfo({
                      ...audioEditInfo,
                      startTrim: parseFloat(e.target.value) || 0
                    })}
                    className="bg-black/20 border-white/10"
                    disabled={!audioFile}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">Fim (segundos)</Label>
                  <Input
                    id="end-time"
                    type="number"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={audioEditInfo.endTrim || duration}
                    onChange={(e) => setAudioEditInfo({
                      ...audioEditInfo,
                      endTrim: parseFloat(e.target.value) || duration
                    })}
                    className="bg-black/20 border-white/10"
                    disabled={!audioFile}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button
                  onClick={trimAudio}
                  disabled={!audioFile || audioEditInfo.endTrim <= audioEditInfo.startTrim}
                  className="w-full"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  Cortar Áudio
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioEditor;
