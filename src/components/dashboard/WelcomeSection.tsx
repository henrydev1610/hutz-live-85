
import { AudioWaveform } from 'lucide-react';

const WelcomeSection = () => {
  return (
    <section className="py-10 px-4 text-center">
      <div className="max-w-3xl mx-auto">
        <div className="inline-block mb-4">
          <AudioWaveform className="h-12 w-12 text-accent animate-pulse" />
        </div>
        <h1 className="text-4xl font-extrabold mb-4 hutz-gradient-text">
          Bem-vindo ao Hutz Live
        </h1>
        <p className="text-xl text-white/80 mb-8">
          Plataforma interativa para criar experiências imersivas em eventos com áudio ultrassônico, 
          streaming ao vivo e quiz interativo.
        </p>
        <div className="hutz-card p-4 inline-block">
          <p className="text-white/70">
            Selecione um dos módulos abaixo para começar a criar sua experiência interativa.
          </p>
        </div>
      </div>
    </section>
  );
};

export default WelcomeSection;
