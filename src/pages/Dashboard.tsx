
import { Bell, Tv, BrainCircuit } from 'lucide-react';
import WelcomeSection from '@/components/dashboard/WelcomeSection';
import ModuleCard from '@/components/common/ModuleCard';

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <WelcomeSection />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <ModuleCard 
          title="Momento Light Show" 
          description="Crie experiências sonoras com gatilhos de áudio ultrassônicos que sincronizam com os smartphones dos usuários."
          icon={<Bell className="h-8 w-8" />} 
          path="/lightshow" 
        />
        
        <ModuleCard 
          title="Momento Telão" 
          description="Transmita a câmera dos participantes para um telão em tempo real, com controle completo sobre o layout."
          icon={<Tv className="h-8 w-8" />} 
          path="/telao" 
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
