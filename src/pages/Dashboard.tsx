
import React from 'react';
import { Bell, BrainCircuit, Video } from 'lucide-react';
import { Button } from "@/components/ui/button";
import WelcomeSection from '@/components/dashboard/WelcomeSection';
import ModuleCard from '@/components/common/ModuleCard';
import ConnectivityTestPanel from '@/components/debug/ConnectivityTestPanel';

const Dashboard = () => {
  const [showDebugPanel, setShowDebugPanel] = React.useState(false);

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <WelcomeSection />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mt-12">
        <ModuleCard 
          title="Momento Light Show" 
          description="Crie experiências sonoras com gatilhos de áudio ultrassônicos que sincronizam com os smartphones dos usuários."
          icon={<Bell className="h-10 w-10" />} 
          path="/lightshow" 
        />

        <ModuleCard 
          title="Momento Live" 
          description="Crie sessões de video streaming com QR Code, gerenciando participantes em tempo real para transmissões ao vivo."
          icon={<Video className="h-10 w-10" />} 
          path="/live" 
        />
        
        <ModuleCard 
          title="Momento Quiz" 
          description="Crie quizzes interativos para seus eventos, onde os participantes respondem em tempo real."
          icon={<BrainCircuit className="h-10 w-10" />} 
          path="/quiz" 
        />
      </div>

      {/* Debug Panel Toggle */}
      <div className="mt-12 text-center">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowDebugPanel(!showDebugPanel)}
        >
          {showDebugPanel ? 'Ocultar' : 'Mostrar'} Painel de Debug de Conectividade
        </Button>
      </div>

      {/* Connectivity Test Panel */}
      {showDebugPanel && (
        <div className="mt-8">
          <ConnectivityTestPanel />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
