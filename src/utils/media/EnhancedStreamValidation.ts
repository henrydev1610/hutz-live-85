// FASE 2: Enhanced Stream Validation
// Validates streams with support for temporarily muted but valid tracks

export enum TrackValidationStatus {
  READY = 'ready',
  MUTED_BUT_VALID = 'muted_but_valid', 
  INVALID = 'invalid'
}

export interface TrackValidationResult {
  track: MediaStreamTrack;
  status: TrackValidationStatus;
  reason: string;
  canProceedToWebRTC: boolean;
  needsRecovery: boolean;
}

export interface StreamValidationResult {
  isValid: boolean;
  canProceedToWebRTC: boolean;
  tracks: TrackValidationResult[];
  readyTracks: TrackValidationResult[];
  mutedButValidTracks: TrackValidationResult[];
  invalidTracks: TrackValidationResult[];
  summary: {
    total: number;
    ready: number;
    mutedButValid: number;
    invalid: number;
  };
}

export class EnhancedStreamValidation {
  
  // Validate entire stream with enhanced muted track support
  public static validateStreamForWebRTC(
    stream: MediaStream | null, 
    participantId: string = 'unknown'
  ): StreamValidationResult {
    console.log(`🔍 FASE 2: Enhanced stream validation for ${participantId}`);

    if (!stream) {
      return this.createFailureResult('Stream is null or undefined');
    }

    if (!stream.getTracks || typeof stream.getTracks !== 'function') {
      return this.createFailureResult('Stream missing getTracks method');
    }

    const tracks = stream.getTracks();
    if (tracks.length === 0) {
      return this.createFailureResult('Stream has no tracks');
    }

    // Validate each track individually
    const trackResults: TrackValidationResult[] = tracks.map(track => 
      this.validateTrackForWebRTC(track, participantId)
    );

    // Categorize tracks
    const readyTracks = trackResults.filter(r => r.status === TrackValidationStatus.READY);
    const mutedButValidTracks = trackResults.filter(r => r.status === TrackValidationStatus.MUTED_BUT_VALID);
    const invalidTracks = trackResults.filter(r => r.status === TrackValidationStatus.INVALID);

    // Determine if stream can proceed to WebRTC
    const canProceedToWebRTC = readyTracks.length > 0 || mutedButValidTracks.length > 0;
    const isValid = invalidTracks.length === 0;

    const result: StreamValidationResult = {
      isValid,
      canProceedToWebRTC,
      tracks: trackResults,
      readyTracks,
      mutedButValidTracks,
      invalidTracks,
      summary: {
        total: tracks.length,
        ready: readyTracks.length,
        mutedButValid: mutedButValidTracks.length,
        invalid: invalidTracks.length
      }
    };

    console.log(`🔍 FASE 2: Stream validation result:`, {
      participantId,
      streamId: stream.id,
      isValid,
      canProceedToWebRTC,
      summary: result.summary
    });

    // Log detailed track analysis
    if (mutedButValidTracks.length > 0) {
      console.log(`⚠️ FASE 2: Found ${mutedButValidTracks.length} muted but valid tracks:`, 
        mutedButValidTracks.map(t => ({ 
          id: t.track.id, 
          kind: t.track.kind, 
          reason: t.reason 
        }))
      );
    }

    if (invalidTracks.length > 0) {
      console.error(`❌ FASE 2: Found ${invalidTracks.length} invalid tracks:`,
        invalidTracks.map(t => ({ 
          id: t.track.id, 
          kind: t.track.kind, 
          reason: t.reason 
        }))
      );
    }

    return result;
  }

  // Validate individual track with muted track support
  public static validateTrackForWebRTC(
    track: MediaStreamTrack, 
    participantId: string = 'unknown'
  ): TrackValidationResult {
    
    // Check basic track health
    if (track.readyState === 'ended') {
      return {
        track,
        status: TrackValidationStatus.INVALID,
        reason: 'Track has ended',
        canProceedToWebRTC: false,
        needsRecovery: true
      };
    }

    if (track.readyState !== 'live') {
      return {
        track,
        status: TrackValidationStatus.INVALID,
        reason: `Track readyState is '${track.readyState}', expected 'live'`,
        canProceedToWebRTC: false,
        needsRecovery: true
      };
    }

    if (!track.enabled) {
      return {
        track,
        status: TrackValidationStatus.INVALID,
        reason: 'Track is disabled',
        canProceedToWebRTC: false,
        needsRecovery: true
      };
    }

    // FASE 2 IMPROVEMENT: Handle muted tracks intelligently
    if (track.muted) {
      // Muted tracks can still be valid for WebRTC if they have proper readyState
      console.log(`🔇 FASE 2: Track ${track.id} (${track.kind}) is muted but readyState is '${track.readyState}'`);
      
      return {
        track,
        status: TrackValidationStatus.MUTED_BUT_VALID,
        reason: 'Track is muted but has valid readyState and is enabled',
        canProceedToWebRTC: true, // CRITICAL: Allow muted tracks to proceed
        needsRecovery: true // Mark for recovery attempt
      };
    }

    // Track is ready and not muted
    return {
      track,
      status: TrackValidationStatus.READY,
      reason: 'Track is ready and unmuted',
      canProceedToWebRTC: true,
      needsRecovery: false
    };
  }

  // Create failure result helper
  private static createFailureResult(reason: string): StreamValidationResult {
    return {
      isValid: false,
      canProceedToWebRTC: false,
      tracks: [],
      readyTracks: [],
      mutedButValidTracks: [],
      invalidTracks: [],
      summary: {
        total: 0,
        ready: 0,
        mutedButValid: 0,
        invalid: 0
      }
    };
  }

  // Get tracks that can proceed to WebRTC (ready + muted but valid)
  public static getWebRTCCompatibleTracks(validationResult: StreamValidationResult): MediaStreamTrack[] {
    return [
      ...validationResult.readyTracks.map(r => r.track),
      ...validationResult.mutedButValidTracks.map(r => r.track)
    ];
  }

  // Get tracks that need recovery attempt
  public static getTracksNeedingRecovery(validationResult: StreamValidationResult): TrackValidationResult[] {
    return validationResult.tracks.filter(r => r.needsRecovery);
  }

  // Check if validation result allows WebRTC to proceed
  public static canProceedWithWebRTC(validationResult: StreamValidationResult): boolean {
    return validationResult.canProceedToWebRTC && 
           (validationResult.readyTracks.length > 0 || validationResult.mutedButValidTracks.length > 0);
  }

  // Create a new stream with only WebRTC-compatible tracks
  public static createWebRTCCompatibleStream(
    originalStream: MediaStream,
    validationResult: StreamValidationResult
  ): MediaStream | null {
    const compatibleTracks = this.getWebRTCCompatibleTracks(validationResult);
    
    if (compatibleTracks.length === 0) {
      console.error('❌ FASE 2: No compatible tracks found for WebRTC stream');
      return null;
    }

    const newStream = new MediaStream(compatibleTracks);
    
    console.log(`✅ FASE 2: Created WebRTC-compatible stream:`, {
      originalId: originalStream.id,
      newId: newStream.id,
      originalTracks: originalStream.getTracks().length,
      compatibleTracks: compatibleTracks.length,
      ready: validationResult.readyTracks.length,
      mutedButValid: validationResult.mutedButValidTracks.length
    });

    return newStream;
  }
}