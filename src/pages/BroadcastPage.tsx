
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BroadcastView from "@/components/live/BroadcastView";
import { useSessionManager } from "@/hooks/useSessionManager";

const BroadcastPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { joinExistingSession, isSessionActive } = useSessionManager();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      joinExistingSession(sessionId);
      setIsLoading(false);
    }
  }, [sessionId, joinExistingSession]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!sessionId || !isSessionActive) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl mb-4">Sessão inválida ou finalizada</h1>
          <p>Esta janela pode ser fechada.</p>
        </div>
      </div>
    );
  }

  return <BroadcastView sessionId={sessionId} />;
};

export default BroadcastPage;
