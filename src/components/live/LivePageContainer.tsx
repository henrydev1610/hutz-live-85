import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import { LivePageContent } from './LivePageContent';
import { FinalActionDialog } from './FinalActionDialog';
import { signalingResolver } from '@/utils/signaling/SignalingResolver';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

import {
  useParticipantMedia,
  ParticipantMediaState,
} from '@/hooks/participant/useParticipantMedia';
import {
  useHostControls,
  HostControlActions,
} from '@/hooks/host/useHostControls';
import {
  useParticipantConnection,
  ParticipantConnectionState,
} from '@/hooks/participant/useParticipantConnection';
import {
  useBroadcast,
  BroadcastState,
} from '@/hooks/host/useBroadcast';
import { generateRandomId } from '@/utils';

interface LivePageContainerProps {
  sessionId: string;
}

export const LivePageContainer: React.FC<LivePageContainerProps> = ({
  sessionId,
}) => {
  const navigate = useNavigate();

  // Media State (Host and Participant)
  const {
    hasMediaPermissions,
    isMediaReady,
    stream: mediaStream,
    error: mediaError,
    startMedia,
    stopMedia,
    retryMedia,
  } = useParticipantMedia();

  // Connection State (Host and Participant)
  const participantId = generateRandomId();
  const {
    isConnected,
    isConnecting,
    connectionStatus,
    error: connectionError,
    connectToSession,
    disconnectFromSession,
    isMobile,
  } = useParticipantConnection(sessionId, participantId);

  // Host Controls (Host Only)
  const {
    participantStreams,
    selectedParticipantId,
    transmissionActive,
    startBroadcast,
    stopBroadcast,
    selectParticipant,
    removeParticipant,
  } = useHostControls(sessionId, mediaStream);

  // Broadcast State (Host Only)
  const {
    isTransmissionActive,
    startTransmission,
    stopTransmission,
    qrCodeURL,
    participantCount,
  } = useBroadcast(sessionId, isConnected);

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

  // Initialize connection and media
  useEffect(() => {
    if (isMediaReady && mediaStream) {
      console.log('🔗 LIVE CONTAINER: Media is ready, connecting to session...');
      connectToSession(mediaStream);
    } else if (isMediaReady && !mediaStream) {
      console.warn('⚠️ LIVE CONTAINER: Media is ready but stream is null');
    }
  }, [isMediaReady, mediaStream, connectToSession]);

  // Handle connection status changes
  useEffect(() => {
    if (connectionStatus === 'connected') {
      console.log('✅ LIVE CONTAINER: Connected to session, starting transmission...');
      startTransmission();
    } else if (connectionStatus === 'disconnected') {
      console.log('🔌 LIVE CONTAINER: Disconnected from session, stopping transmission...');
      stopTransmission();
    }
  }, [connectionStatus, startTransmission, stopTransmission]);

  // Handle broadcast state changes
  useEffect(() => {
    if (transmissionActive) {
      console.log('📢 LIVE CONTAINER: Starting broadcast...');
      startBroadcast();
    } else {
      console.log('🔇 LIVE CONTAINER: Stopping broadcast...');
      stopBroadcast();
    }
  }, [transmissionActive, startBroadcast, stopBroadcast]);

  // Final Action Handlers
  const handleEndSession = () => {
    console.log('🚪 LIVE CONTAINER: Ending session...');
    stopTransmission();
    disconnectFromSession();
    navigate('/sessions');
  };

  const handleLeaveSession = () => {
    console.log('🚶 LIVE CONTAINER: Leaving session...');
    stopMedia();
    disconnectFromSession();
    navigate('/sessions');
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
      
      if (!hasMediaPermissions) {
        console.warn('⚠️ LIVE CONTAINER: No media permissions, requesting...');
        await startMedia();
      }
  
      if (!isMediaReady) {
        console.warn('⚠️ LIVE CONTAINER: Media not ready, retrying...');
        await retryMedia();
      }
      
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
        onParticipantSelect={selectParticipant}
        onParticipantRemove={removeParticipant}
        onRetryMedia={handleRetryMedia}
        transmissionActive={transmissionActive}
        selectedStream={mediaStream}
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
