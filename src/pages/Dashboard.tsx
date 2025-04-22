
import { Bell, BrainCircuit, Video } from 'lucide-react';
import WelcomeSection from '@/components/dashboard/WelcomeSection';
import ModuleCard from '@/components/common/ModuleCard';

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <WelcomeSection />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
        <ModuleCard 
          title="Momento Light Show" 
          description="Crie experiências sonoras com gatilhos de áudio ultrassônicos que sincronizam com os smartphones dos usuários."
          icon={<Bell className="h-8 w-8" />} 
          path="/lightshow" 
        />
        {/* Removed the Momento Telão ModuleCard */}

        <ModuleCard 
          title="Momento Live" 
          description="Crie sessões de video streaming com QR Code, gerenciando participantes em tempo real para transmissões ao vivo."
          icon={<Video className="h-8 w-8" />} 
          path="/live" 
        />
        
        <ModuleCard 
          title="Momento Quiz" 
          description="Crie quizzes interativos para seus eventos, onde os participantes respondem em tempo real."
          icon={<BrainCircuit className="h-8 w-8" />} 
          path="/quiz" 
        />
      </div>
    </div>
  );
};

export default Dashboard;

