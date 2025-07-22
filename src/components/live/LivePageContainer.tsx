import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import { LivePageContent } from './LivePageContent';
import FinalActionDialog from './FinalActionDialog';
import { signalingResolver } from '@/utils/signaling/SignalingResolver';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

import {
  useParticipantMedia,
} from '@/hooks/participant/useParticipantMedia';
import {
  useParticipantConnection,
} from '@/hooks/participant/useParticipantConnection';

interface LivePageContainerProps {
  sessionId: string;
}

export const LivePageContainer: React.FC<LivePageContainerProps> = ({
  sessionId,
}) => {
  const navigate = useNavigate();

  // Media State
  const {
    hasVideo,
    hasAudio,
    localStreamRef,
    initializeMedia,
    retryMediaInitialization,
  } = useParticipantMedia();

  // Connection State
  const participantId = sessionId + '-host'; // Simple ID generation
  const {
    isConnected,
    isConnecting,
    connectionStatus,
    error: connectionError,
    connectToSession,
    disconnectFromSession,
    isMobile,
  } = useParticipantConnection(sessionId, participantId);

  // State management
  const [participantStreams, setParticipantStreams] = useState<{ [id: string]: MediaStream }>({});
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [transmissionActive, setTransmissionActive] = useState(false);
  const [isTransmissionActive, setIsTransmissionActive] = useState(false);
  const [qrCodeURL, setQrCodeURL] = useState('');
  const [participantCount, setParticipantCount] = useState(0);

  // State for Final Action Dialog
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'end' | 'leave' | null>(null);

  const [signalingDiagnostics, setSignalingDiagnostics] = useState({
    resolved: false,
    type: 'unknown' as 'node' | 'supabase' | 'unknown',
    conflictDetected: false
  });

  // Initialize signaling with conflict resolution
  useEffect(() => {
    const initializeSignaling = async () => {
      try {
        console.log('🔧 LIVE CONTAINER: Initializing optimal signaling...');
        
        // Use resolver to determine and connect to optimal signaling
        await signalingResolver.connectWithOptimalSignaling();
        
        const config = signalingResolver.getCurrentConfig();
        if (config) {
          setSignalingDiagnostics({
            resolved: true,
            type: config.type,
            conflictDetected: false // Will be updated by diagnostics component
          });
          
          console.log(`✅ LIVE CONTAINER: Using ${config.type} signaling for session ${sessionId}`);
          toast.success(`Conectado via ${config.type === 'node' ? 'Node.js' : 'Supabase'} signaling`);
        }
        
      } catch (error) {
        console.error('❌ LIVE CONTAINER: Failed to initialize signaling:', error);
        toast.error('Falha ao inicializar signaling');
        
        setSignalingDiagnostics({
          resolved: false,
          type: 'unknown',
          conflictDetected: true
        });
      }
    };

    initializeSignaling();
  }, [sessionId]);

  // Initialize media and connection
  useEffect(() => {
    const initialize = async () => {
      try {
        const stream = await initializeMedia();
        if (stream) {
          console.log('🔗 LIVE CONTAINER: Media is ready, connecting to session...');
          connectToSession(stream);
        }
      } catch (error) {
        console.error('❌ LIVE CONTAINER: Failed to initialize media:', error);
      }
    };

    initialize();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (connectionStatus === 'connected') {
      console.log('✅ LIVE CONTAINER: Connected to session, starting transmission...');
      setTransmissionActive(true);
      setIsTransmissionActive(true);
    } else if (connectionStatus === 'disconnected') {
      console.log('🔌 LIVE CONTAINER: Disconnected from session, stopping transmission...');
      setTransmissionActive(false);
      setIsTransmissionActive(false);
    }
  }, [connectionStatus]);

  // Final Action Handlers
  const handleEndSession = () => {
    console.log('🚪 LIVE CONTAINER: Ending session...');
    setTransmissionActive(false);
    setIsTransmissionActive(false);
    disconnectFromSession();
    navigate('/dashboard');
  };

  const handleLeaveSession = () => {
    console.log('🚶 LIVE CONTAINER: Leaving session...');
    disconnectFromSession();
    navigate('/dashboard');
  };

  const handleOpenDialog = (type: 'end' | 'leave') => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDialogType(null);
  };

  const handleFinalAction = () => {
    if (dialogType === 'end') {
      handleEndSession();
    } else if (dialogType === 'leave') {
      handleLeaveSession();
    }
    handleCloseDialog();
  };

  const handleRetryMedia = async (): Promise<void> => {
    try {
      console.log('🔄 LIVE CONTAINER: Retrying media initialization...');
      
      // Check if signaling is properly resolved
      if (!signalingDiagnostics.resolved) {
        console.log('🔧 LIVE CONTAINER: Re-resolving signaling before retry...');
        await signalingResolver.connectWithOptimalSignaling();
      }
      
      await retryMediaInitialization();
      
    } catch (error) {
      console.error('❌ LIVE CONTAINER: Media retry failed:', error);
      toast.error('Falha ao reinicializar mídia');
    }
  };

  // Handle signaling type switching
  const handleSwitchSignaling = async (type: 'node' | 'supabase') => {
    try {
      console.log(`🔄 LIVE CONTAINER: Switching to ${type} signaling...`);
      toast.info(`Mudando para signaling ${type}...`);
      
      await unifiedWebSocketService.switchSignalingType(type);
      
      setSignalingDiagnostics(prev => ({
        ...prev,
        type,
        resolved: true
      }));
      
      toast.success(`Conectado via ${type === 'node' ? 'Node.js' : 'Supabase'} signaling`);
      
    } catch (error) {
      console.error(`❌ LIVE CONTAINER: Failed to switch to ${type} signaling:`, error);
      toast.error(`Falha ao mudar para signaling ${type}`);
    }
  };

  return (
    <div className="container mx-auto p-4">
      {/* Signaling Status Indicator */}
      {signalingDiagnostics.resolved && (
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              🔗 Conectado via {signalingDiagnostics.type === 'node' ? 'Node.js Server' : 'Supabase Edge Function'}
            </span>
            {signalingDiagnostics.conflictDetected && (
              <span className="text-xs text-yellow-600">
                ⚠️ Múltiplos sistemas detectados
              </span>
            )}
          </div>
        </div>
      )}

      <LivePageContent
        selectedParticipantId={selectedParticipantId}
        participantStreams={participantStreams}
        onParticipantSelect={setSelectedParticipantId}
        onParticipantRemove={(id: string) => {
          const newStreams = { ...participantStreams };
          delete newStreams[id];
          setParticipantStreams(newStreams);
        }}
        onRetryMedia={handleRetryMedia}
        transmissionActive={transmissionActive}
        selectedStream={localStreamRef.current}
        sessionId={sessionId}
        qrCodeURL={qrCodeURL}
        participantCount={participantCount}
        isTransmissionActive={isTransmissionActive}
      />

      <FinalActionDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleFinalAction}
        type={dialogType}
      />
    </div>
  );
};
