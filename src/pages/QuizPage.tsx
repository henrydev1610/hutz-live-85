
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, BrainCircuit, Pencil, Trash2, Eye, Plus, Image, Palette } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const QuizPage = () => {
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const { toast } = useToast();

  const handleGenerateQRCode = () => {
    setQrCodeGenerated(true);
    toast({
      title: "QR Code gerado",
      description: "QR Code gerado com sucesso. Compartilhe com os participantes.",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Quiz</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>Gerenciador de Quiz</CardTitle>
              <CardDescription>
                Crie e configure perguntas para o seu quiz interativo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="quiz-title" className="text-sm font-medium">
                    Título do Quiz
                  </Label>
                  <Input
                    id="quiz-title"
                    placeholder="Meu Quiz Interativo"
                    className="hutz-input mt-1 max-w-md"
                  />
                </div>
                <Button className="hutz-button-accent">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Pergunta
                </Button>
              </div>
              
              <Separator className="bg-white/10" />
              
              <div className="space-y-6">
                {/* Pergunta 1 */}
                <Card className="bg-secondary/60 border border-white/20">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-base">Pergunta 1</CardTitle>
                      <CardDescription>Qual é a pergunta correta?</CardDescription>
                    </div>
                    <Checkbox id="q1-active" defaultChecked />
                  </CardHeader>
                  <CardContent className="pt-0 pb-2">
                    <Input
                      placeholder="Digite sua pergunta aqui..."
                      defaultValue="Qual destas tecnologias é utilizada para comunicação ultrassônica?"
                      className="hutz-input mb-4"
                    />
                    
                    <RadioGroup defaultValue="option3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label htmlFor="option1" className="flex items-center space-x-2 p-2 rounded border border-white/10 cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="option1" id="option1" />
                          <Input
                            placeholder="Alternativa 1"
                            defaultValue="Bluetooth"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                        
                        <Label htmlFor="option2" className="flex items-center space-x-2 p-2 rounded border border-white/10 cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="option2" id="option2" />
                          <Input
                            placeholder="Alternativa 2"
                            defaultValue="Wi-Fi"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                        
                        <Label htmlFor="option3" className="flex items-center space-x-2 p-2 rounded border border-accent cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="option3" id="option3" />
                          <Input
                            placeholder="Alternativa 3"
                            defaultValue="Data-to-Sound"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                        
                        <Label htmlFor="option4" className="flex items-center space-x-2 p-2 rounded border border-white/10 cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="option4" id="option4" />
                          <Input
                            placeholder="Alternativa 4"
                            defaultValue="NFC"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                  <CardFooter className="pt-2 flex justify-end space-x-2">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </CardFooter>
                </Card>
                
                {/* Pergunta 2 */}
                <Card className="bg-secondary/60 border border-white/20">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-base">Pergunta 2</CardTitle>
                      <CardDescription>Qual é a pergunta correta?</CardDescription>
                    </div>
                    <Checkbox id="q2-active" defaultChecked />
                  </CardHeader>
                  <CardContent className="pt-0 pb-2">
                    <Input
                      placeholder="Digite sua pergunta aqui..."
                      defaultValue="Qual o alcance máximo do sistema de transmissão para dispositivos móveis?"
                      className="hutz-input mb-4"
                    />
                    
                    <RadioGroup defaultValue="option2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Label htmlFor="q2-option1" className="flex items-center space-x-2 p-2 rounded border border-white/10 cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="q2-option1" id="q2-option1" />
                          <Input
                            placeholder="Alternativa 1"
                            defaultValue="Até 1 metro"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                        
                        <Label htmlFor="q2-option2" className="flex items-center space-x-2 p-2 rounded border border-accent cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="q2-option2" id="q2-option2" />
                          <Input
                            placeholder="Alternativa 2"
                            defaultValue="Até 3-10 metros"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                        
                        <Label htmlFor="q2-option3" className="flex items-center space-x-2 p-2 rounded border border-white/10 cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="q2-option3" id="q2-option3" />
                          <Input
                            placeholder="Alternativa 3"
                            defaultValue="Até 20-30 metros"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                        
                        <Label htmlFor="q2-option4" className="flex items-center space-x-2 p-2 rounded border border-white/10 cursor-pointer hover:bg-white/5">
                          <RadioGroupItem value="q2-option4" id="q2-option4" />
                          <Input
                            placeholder="Alternativa 4"
                            defaultValue="Até 50 metros"
                            className="hutz-input ml-2 flex-1"
                          />
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                  <CardFooter className="pt-2 flex justify-end space-x-2">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </CardFooter>
                </Card>
                
                {/* Adicione mais perguntas aqui */}
                <div className="text-center py-4">
                  <Button className="hutz-button-secondary">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Mais Perguntas
                  </Button>
                </div>
              </div>
              
              <Separator className="bg-white/10" />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configurações de Exibição</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="description-text" className="mb-2 block">
                      Texto de Descrição
                    </Label>
                    <Input
                      id="description-text"
                      placeholder="Escaneie o QR Code para participar do quiz"
                      className="hutz-input"
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block">Aparência</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" className="border-white/20">
                        Cor Sólida
                      </Button>
                      <Button variant="outline" className="border-white/20">
                        Gradiente
                      </Button>
                      <Button variant="default" className="bg-accent text-white">
                        Imagem
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="bg-image-upload" className="mb-2 block">
                      Imagem de Fundo
                    </Label>
                    <Button id="bg-image-upload" className="w-full hutz-button-secondary">
                      <Image className="h-4 w-4 mr-2" />
                      Carregar Imagem
                    </Button>
                  </div>
                  
                  <div>
                    <Label htmlFor="final-action" className="mb-2 block">
                      Ação ao Finalizar
                    </Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input type="radio" id="final-no-action" name="finalAction" className="h-4 w-4" />
                        <Label htmlFor="final-no-action">Nenhuma ação</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="radio" id="final-show-image" name="finalAction" className="h-4 w-4" defaultChecked />
                        <Label htmlFor="final-show-image">Mostrar imagem</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="radio" id="final-show-coupon" name="finalAction" className="h-4 w-4" />
                        <Label htmlFor="final-show-coupon">Mostrar cupom</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-4 border-t border-white/10">
              <Button variant="outline" className="border-white/20">
                Cancelar
              </Button>
              <Button className="hutz-button-accent">
                <BrainCircuit className="h-4 w-4 mr-2" />
                Salvar Quiz
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div>
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>QR Code da Sessão</CardTitle>
              <CardDescription>
                Gere um QR Code para os participantes acessarem o quiz
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="w-full aspect-square bg-secondary/60 rounded-lg flex items-center justify-center mb-4">
                {qrCodeGenerated ? (
                  <div className="w-3/4 h-3/4 bg-white p-4 rounded-lg flex items-center justify-center">
                    <QrCode className="h-full w-full text-black" />
                  </div>
                ) : (
                  <QrCode className="h-16 w-16 text-white/30" />
                )}
              </div>
              
              {!qrCodeGenerated ? (
                <Button 
                  onClick={handleGenerateQRCode} 
                  className="w-full hutz-button-primary"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code
                </Button>
              ) : (
                <div className="space-y-2 w-full">
                  <Button className="w-full hutz-button-secondary">
                    Compartilhar QR Code
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-white/20"
                    onClick={() => setQrCodeGenerated(false)}
                  >
                    Gerar Novo QR Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Separator className="my-6 bg-white/10" />
          
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>
                Veja como ficará a tela do seu quiz
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black/50 rounded-lg p-4 flex items-center justify-center">
                <div className="text-white/40 text-center">
                  <Palette className="h-12 w-12 mx-auto mb-2" />
                  <p>Pré-visualização do quiz</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Separator className="my-6 bg-white/10" />
          
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
              <CardDescription>
                Acompanhe a participação no quiz
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="hutz-card p-3 text-center">
                    <p className="text-xs text-white/60">Participantes</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="hutz-card p-3 text-center">
                    <p className="text-xs text-white/60">Respostas</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
                <Button className="w-full hutz-button-secondary">
                  Iniciar Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
