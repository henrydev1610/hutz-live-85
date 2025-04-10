
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { UploadCloud, Music, Palette, Image, Download } from "lucide-react";

const LightShowPage = () => {
  const [step, setStep] = useState(1);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const { toast } = useToast();

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
      toast({
        title: "Arquivo carregado",
        description: `${e.target.files[0].name} foi carregado com sucesso.`,
      });
    }
  };

  const handleSubmit = () => {
    toast({
      title: "Show de luzes criado",
      description: "Seu arquivo data-to-sound foi gerado com sucesso.",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Light Show</h1>
      
      <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
        <CardHeader>
          <CardTitle>Criador de Show de Luzes</CardTitle>
          <CardDescription>
            Crie experiências de áudio ultrassônico para sincronizar com os smartphones dos participantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="step1" className="w-full">
            <TabsList className="grid grid-cols-3 mb-8">
              <TabsTrigger 
                value="step1" 
                onClick={() => setStep(1)}
                className={step >= 1 ? "data-[state=active]:bg-accent" : ""}
              >
                <span className="mr-2">1</span> Selecionar Áudio
              </TabsTrigger>
              <TabsTrigger 
                value="step2" 
                onClick={() => setStep(2)}
                disabled={!audioFile}
                className={step >= 2 ? "data-[state=active]:bg-accent" : ""}
              >
                <span className="mr-2">2</span> Criar Visual
              </TabsTrigger>
              <TabsTrigger 
                value="step3" 
                onClick={() => setStep(3)}
                disabled={!audioFile}
                className={step >= 3 ? "data-[state=active]:bg-accent" : ""}
              >
                <span className="mr-2">3</span> Ação Final
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="step1" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Biblioteca de Músicas</h3>
                  <div className="h-64 overflow-y-auto hutz-card p-4">
                    <p className="text-white/60 text-center mt-16">
                      Biblioteca não disponível na versão de demonstração.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Enviar Música Personalizada</h3>
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center h-64 flex flex-col items-center justify-center">
                    <UploadCloud className="h-10 w-10 text-white/50 mb-4" />
                    <p className="mb-4 text-white/70">
                      Arraste o arquivo de áudio ou clique para selecionar
                    </p>
                    <Input
                      id="audio-upload"
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleAudioUpload}
                    />
                    <Label
                      htmlFor="audio-upload"
                      className="hutz-button-secondary cursor-pointer"
                    >
                      <Music className="h-4 w-4 mr-2 inline" />
                      Selecionar Arquivo
                    </Label>
                    {audioFile && (
                      <p className="mt-2 text-sm text-white/80">
                        {audioFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!audioFile}
                  className="hutz-button-primary"
                >
                  Próximo Passo
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="step2" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configuração Visual</h3>
                  
                  <div className="space-y-4 hutz-card p-4">
                    <div>
                      <Label htmlFor="show-title" className="mb-2 block">
                        Título do Show
                      </Label>
                      <Input
                        id="show-title"
                        type="text"
                        placeholder="Nome do seu show de luzes"
                        className="hutz-input"
                      />
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">
                        Sincronização de Luzes
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant={autoSync ? "default" : "outline"}
                          onClick={() => setAutoSync(true)}
                          className={autoSync ? "bg-accent text-white" : ""}
                        >
                          Automática
                        </Button>
                        <Button
                          variant={!autoSync ? "default" : "outline"}
                          onClick={() => setAutoSync(false)}
                          className={!autoSync ? "bg-accent text-white" : ""}
                        >
                          Manual
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Cores</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {['#FF5757', '#5CE1E6', '#FFDE59', '#A8FF9E', '#CB9EFF'].map(color => (
                          <div
                            key={color}
                            className="w-full aspect-square rounded-md cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="image-upload" className="mb-2 block">
                        Imagens Personalizadas
                      </Label>
                      <Button className="w-full hutz-button-secondary">
                        <Image className="h-4 w-4 mr-2" />
                        Carregar Imagem
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Pré-visualização</h3>
                  <div className="hutz-card p-4 h-80 flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <Palette className="h-12 w-12 mx-auto mb-4" />
                      <p>A pré-visualização do show aparecerá aqui</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button 
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="border-white/20 text-white/70 hover:text-white hover:bg-secondary"
                >
                  Voltar
                </Button>
                <Button 
                  onClick={() => setStep(3)}
                  className="hutz-button-primary"
                >
                  Próximo Passo
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="step3" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Ação ao Finalizar</h3>
                  
                  <div className="space-y-4 hutz-card p-4">
                    <div>
                      <Label className="mb-2 block">
                        Selecione o que acontecerá após a transmissão
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="no-action" name="finalAction" className="h-4 w-4" />
                          <Label htmlFor="no-action">Nenhuma ação</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="show-image" name="finalAction" className="h-4 w-4" defaultChecked />
                          <Label htmlFor="show-image">Mostrar imagem</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="show-coupon" name="finalAction" className="h-4 w-4" />
                          <Label htmlFor="show-coupon">Mostrar cupom</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="show-link" name="finalAction" className="h-4 w-4" />
                          <Label htmlFor="show-link">Mostrar imagem com link</Label>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="final-image-upload" className="mb-2 block">
                        Imagem Final
                      </Label>
                      <Button id="final-image-upload" className="w-full hutz-button-secondary">
                        <Image className="h-4 w-4 mr-2" />
                        Carregar Imagem
                      </Button>
                    </div>
                    
                    <div>
                      <Label htmlFor="link-url" className="mb-2 block">
                        URL do Link (opcional)
                      </Label>
                      <Input
                        id="link-url"
                        type="url"
                        placeholder="https://exemplo.com"
                        className="hutz-input"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Resumo</h3>
                  <div className="hutz-card p-4 h-64 overflow-y-auto">
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-white/60">Arquivo de Áudio</dt>
                        <dd className="text-white">{audioFile?.name || "Não selecionado"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/60">Sincronização</dt>
                        <dd className="text-white">{autoSync ? "Automática" : "Manual"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/60">Ação Final</dt>
                        <dd className="text-white">Mostrar imagem</dd>
                      </div>
                    </dl>
                  </div>
                  
                  <Button onClick={handleSubmit} className="w-full hutz-button-accent">
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Arquivo .WAV
                  </Button>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button 
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="border-white/20 text-white/70 hover:text-white hover:bg-secondary"
                >
                  Voltar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  className="hutz-button-primary"
                >
                  Finalizar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LightShowPage;
