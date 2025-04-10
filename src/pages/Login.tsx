
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import LoginForm from '@/components/auth/LoginForm';
import { AudioWaveform } from 'lucide-react';

const Login = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
      <div className="w-full max-w-md text-center mb-8">
        <AudioWaveform className="h-16 w-16 text-accent mx-auto mb-4 animate-pulse" />
        <h1 className="text-4xl font-extrabold mb-2 hutz-gradient-text">
          HUTZ LIVE
        </h1>
        <p className="text-white/70">
          Plataforma SaaS para experiências interativas em eventos
        </p>
      </div>
      
      <LoginForm onSuccess={onLogin} />
      
      <div className="mt-8 text-white/40 text-center text-sm max-w-md">
        <p>
          Ao acessar a plataforma Hutz Live, você concorda com nossos termos de serviço e política de privacidade.
        </p>
      </div>
    </div>
  );
};

export default Login;
