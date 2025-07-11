// Utility for updating streams in existing WebRTC connections
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

export class StreamUpdater {
  private static peerConnections: Map<string, RTCPeerConnection> | null = null;

  static setPeerConnections(peerConnections: Map<string, RTCPeerConnection>) {
    this.peerConnections = peerConnections;
  }

  /**
   * Updates all peer connections with a new stream
   * This forces renegotiation to send the new camera stream
   */
  static async updateStreamInAllConnections(newStream: MediaStream): Promise<void> {
    if (!this.peerConnections) {
      console.warn('⚠️ STREAM UPDATER: No peer connections available for update');
      return;
    }

    console.log('🔄 STREAM UPDATER: Updating stream in all peer connections', {
      streamId: newStream.id,
      connectionCount: this.peerConnections.size,
      videoTracks: newStream.getVideoTracks().length,
      audioTracks: newStream.getAudioTracks().length
    });

    const updatePromises: Promise<void>[] = [];

    this.peerConnections.forEach((pc, participantId) => {
      const updatePromise = this.updateStreamInConnection(pc, participantId, newStream);
      updatePromises.push(updatePromise);
    });

    try {
      await Promise.all(updatePromises);
      console.log('✅ STREAM UPDATER: All connections updated successfully');
    } catch (error) {
      console.error('❌ STREAM UPDATER: Error updating connections:', error);
    }
  }

  /**
   * Updates a specific peer connection with a new stream
   */
  private static async updateStreamInConnection(
    peerConnection: RTCPeerConnection, 
    participantId: string, 
    newStream: MediaStream
  ): Promise<void> {
    try {
      console.log(`🔄 STREAM UPDATER: Updating connection for ${participantId}`);

      // Step 1: Remove all existing senders
      const senders = peerConnection.getSenders();
      console.log(`🗑️ STREAM UPDATER: Removing ${senders.length} existing senders for ${participantId}`);
      
      for (const sender of senders) {
        if (sender.track) {
          console.log(`🗑️ STREAM UPDATER: Removing ${sender.track.kind} track for ${participantId}`);
          peerConnection.removeTrack(sender);
        }
      }

      // Step 2: Add all tracks from new stream
      console.log(`➕ STREAM UPDATER: Adding ${newStream.getTracks().length} tracks for ${participantId}`);
      newStream.getTracks().forEach(track => {
        console.log(`➕ STREAM UPDATER: Adding ${track.kind} track to ${participantId}:`, {
          trackId: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        });
        peerConnection.addTrack(track, newStream);
      });

      // Step 3: CRITICAL - Force immediate renegotiation for mobile camera
      console.log(`📤 STREAM UPDATER: CRITICAL - Creating offer for mobile renegotiation with ${participantId}`);
      
      // Add small delay to ensure tracks are properly added
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
        iceRestart: true // Force ICE restart for better connectivity
      });

      console.log(`🔧 STREAM UPDATER: Setting local description for ${participantId}`);
      await peerConnection.setLocalDescription(offer);
      
      // CRITICAL: Don't wait for ICE gathering - send immediately for mobile
      console.log(`📡 STREAM UPDATER: CRITICAL - Sending immediate renegotiation offer to ${participantId}`);
      unifiedWebSocketService.sendOffer(participantId, peerConnection.localDescription!);
      
      // Optional: Wait for ICE gathering in background for better quality
      setTimeout(() => {
        if (peerConnection.iceGatheringState !== 'complete') {
          console.log(`🧊 STREAM UPDATER: Background ICE gathering for ${participantId}`);
          const checkIceGathering = () => {
            if (peerConnection.iceGatheringState === 'complete' && peerConnection.localDescription) {
              console.log(`🧊 STREAM UPDATER: ICE complete, sending updated offer to ${participantId}`);
              unifiedWebSocketService.sendOffer(participantId, peerConnection.localDescription);
            }
          };
          peerConnection.addEventListener('icegatheringstatechange', checkIceGathering, { once: true });
        }
      }, 0);
      
      console.log(`✅ STREAM UPDATER: CRITICAL - Successfully initiated renegotiation for ${participantId}`);

    } catch (error) {
      console.error(`❌ STREAM UPDATER: Failed to update connection for ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Updates only video tracks (useful for camera switching)
   */
  static async updateVideoTrackInAllConnections(newStream: MediaStream): Promise<void> {
    if (!this.peerConnections) {
      console.warn('⚠️ STREAM UPDATER: No peer connections available for video update');
      return;
    }

    const videoTracks = newStream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('⚠️ STREAM UPDATER: No video tracks in new stream');
      return;
    }

    console.log('🎥 STREAM UPDATER: Updating video tracks in all connections', {
      streamId: newStream.id,
      videoTracks: videoTracks.length,
      connectionCount: this.peerConnections.size
    });

    const updatePromises: Promise<void>[] = [];

    this.peerConnections.forEach((pc, participantId) => {
      const updatePromise = this.updateVideoTrackInConnection(pc, participantId, videoTracks[0], newStream);
      updatePromises.push(updatePromise);
    });

    try {
      await Promise.all(updatePromises);
      console.log('✅ STREAM UPDATER: All video tracks updated successfully');
    } catch (error) {
      console.error('❌ STREAM UPDATER: Error updating video tracks:', error);
    }
  }

  /**
   * Updates video track in a specific connection using replaceTrack (faster than renegotiation)
   */
  private static async updateVideoTrackInConnection(
    peerConnection: RTCPeerConnection,
    participantId: string,
    newVideoTrack: MediaStreamTrack,
    newStream: MediaStream
  ): Promise<void> {
    try {
      console.log(`🎥 STREAM UPDATER: Updating video track for ${participantId}`);

      // Find the video sender
      const videoSender = peerConnection.getSenders().find(sender => 
        sender.track && sender.track.kind === 'video'
      );

      if (videoSender) {
        // Use replaceTrack for faster update (no renegotiation needed)
        console.log(`🔄 STREAM UPDATER: Replacing video track for ${participantId}`);
        await videoSender.replaceTrack(newVideoTrack);
        console.log(`✅ STREAM UPDATER: Video track replaced for ${participantId}`);
      } else {
        // No existing video sender, add the track
        console.log(`➕ STREAM UPDATER: Adding new video track for ${participantId}`);
        peerConnection.addTrack(newVideoTrack, newStream);
        
        // Need renegotiation when adding new track
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        unifiedWebSocketService.sendOffer(participantId, offer);
        console.log(`✅ STREAM UPDATER: New video track added for ${participantId}`);
      }

    } catch (error) {
      console.error(`❌ STREAM UPDATER: Failed to update video track for ${participantId}:`, error);
      throw error;
    }
  }
}