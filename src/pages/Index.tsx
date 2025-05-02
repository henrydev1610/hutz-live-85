
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Momento Interactive
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Crie experiências interativas incríveis para seus eventos.
            Conecte-se com seu público de forma única e memorável.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Momento Light Show</CardTitle>
              <CardDescription>Experiências sonoras sincronizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-6">
                Crie experiências sonoras com gatilhos de áudio ultrassônicos que sincronizam com os smartphones dos usuários.
              </p>
              <Link to="/lightshow">
                <Button variant="outline" className="w-full border-white/20 hover:bg-white/10 transition-all">
                  Acessar <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Momento Live</CardTitle>
              <CardDescription>Transmissões ao vivo interativas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-6">
                Crie sessões de video streaming com QR Code, gerenciando participantes em tempo real para transmissões ao vivo.
              </p>
              <Link to="/live">
                <Button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                  Acessar <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Momento Quiz</CardTitle>
              <CardDescription>Quizzes interativos em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-6">
                Crie quizzes interativos para seus eventos, onde os participantes respondem em tempo real.
              </p>
              <Link to="/quiz">
                <Button variant="outline" className="w-full border-white/20 hover:bg-white/10 transition-all">
                  Acessar <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-400">
            Desenvolvido com tecnologia WebRTC e WebSocket para comunicação em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
