import React, { useRef, useEffect } from 'react';
import { Participant } from './ParticipantGrid';
import ParticipantPreviewGrid from './ParticipantPreviewGrid';
import QRCodeOverlay from './QRCodeOverlay';
import LiveIndicator from './LiveIndicator';

interface LivePreviewFixedProps {
  qrCodeVisible: boolean;
  qrCodeSvg: string | null;
  qrCodePosition: { x: number; y: number; width: number; height: number };
  setQrCodePosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number }>>;
  qrDescriptionPosition: { x: number; y: number; width: number; height: number };
  setQrDescriptionPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number }>>;
  qrCodeDescription: string;
  selectedFont: string;
  selectedTextColor: string;
  qrDescriptionFontSize: number;
  backgroundImage: string | null;
  selectedBackgroundColor: string;
  participantList: Participant[];
  participantCount: number;
  participantStreams: {[id: string]: MediaStream};
}

const LivePreviewFixed: React.FC<LivePreviewFixedProps> = ({
  qrCodeVisible,
  qrCodeSvg,
  qrCodePosition,
  setQrCodePosition,
  qrDescriptionPosition,
  setQrDescriptionPosition,
  qrCodeDescription,
  selectedFont,
  selectedTextColor,
  qrDescriptionFontSize,
  backgroundImage,
  selectedBackgroundColor,
  participantList,
  participantCount,
  participantStreams
}) => {
  // CRITICAL: Separate refs for mobile (main) and desktop (miniature) streams
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // CRITICAL: Stream prioritization logic - Mobile streams get main display
  useEffect(() => {
    console.log('🎯 MOBILE-CRITICAL: Processing stream changes for video display');
    
    let mobileStream: MediaStream | null = null;
    let desktopStream: MediaStream | null = null;
    
    // Find mobile and desktop streams
    participantList.forEach(participant => {
      const stream = participantStreams[participant.id];
      if (stream) {
        console.log(`📱 STREAM-CHECK: ${participant.id}:`, {
          isMobile: participant.isMobile,
          hasVideo: stream.getVideoTracks().length > 0,
          streamId: stream.id
        });
        
        if (participant.isMobile && stream.getVideoTracks().length > 0) {
          mobileStream = stream;
          console.log(`📱 MOBILE-PRIORITY: Using mobile stream from ${participant.id}`);
        } else if (!participant.isMobile && stream.getVideoTracks().length > 0) {
          desktopStream = stream;
          console.log(`💻 DESKTOP-SECONDARY: Desktop stream from ${participant.id}`);
        }
      }
    });
    
    // CRITICAL: Apply stream priority logic
    if (mobileStream && remoteVideoRef.current) {
      console.log('🚨 MOBILE-DISPLAY: Setting mobile stream to main display');
      remoteVideoRef.current.srcObject = mobileStream;
      remoteVideoRef.current.play().catch(e => 
        console.error('❌ Mobile video play error:', e)
      );
    }
    
    if (desktopStream && localVideoRef.current) {
      console.log('💻 DESKTOP-MINI: Setting desktop stream to miniature');
      localVideoRef.current.srcObject = desktopStream;
      localVideoRef.current.play().catch(e => 
        console.error('❌ Desktop video play error:', e)
      );
    }
    
  }, [participantStreams, participantList]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden live-preview">
      {/* Container with background color or image */}
      <div className="absolute inset-0" style={{ backgroundColor: selectedBackgroundColor }}>
        {backgroundImage && (
          <img 
            src={backgroundImage} 
            alt="Background" 
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      {/* MAIN VIDEO: Mobile stream (priority) */}
      <video 
        ref={remoteVideoRef}
        autoPlay 
        playsInline 
        muted={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          display: 'block',
          backgroundColor: 'transparent' 
        }}
      />
      
      {/* MINIATURE VIDEO: Desktop stream (local/host) */}
      <video 
        ref={localVideoRef}
        autoPlay 
        playsInline 
        muted 
        className="absolute top-4 right-4 w-32 h-24 object-cover rounded-lg border-2 border-white/20 mini-selfview"
        style={{ 
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 10
        }}
      />
      
      {/* Fallback: Original participant grid for debugging */}
      <div className="opacity-30">
        <ParticipantPreviewGrid 
          participantList={participantList}
          participantCount={participantCount}
          participantStreams={participantStreams}
        />
      </div>
      
      {/* QR Code and description overlays */}
      <QRCodeOverlay
        qrCodeVisible={qrCodeVisible}
        qrCodeSvg={qrCodeSvg}
        qrCodePosition={qrCodePosition}
        setQrCodePosition={setQrCodePosition}
        qrDescriptionPosition={qrDescriptionPosition}
        setQrDescriptionPosition={setQrDescriptionPosition}
        qrCodeDescription={qrCodeDescription}
        selectedFont={selectedFont}
        selectedTextColor={selectedTextColor}
        qrDescriptionFontSize={qrDescriptionFontSize}
      />
      
      {/* Live indicator */}
      <LiveIndicator />
    </div>
  );
};

export default LivePreviewFixed;