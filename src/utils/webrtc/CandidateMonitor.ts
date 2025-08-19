// Monitoramento avançado de candidatos ICE para WebRTC
interface CandidateStats {
  host: number;
  srflx: number;
  relay: number;
  unknown: number;
  total: number;
}

interface ParticipantCandidateInfo {
  participantId: string;
  stats: CandidateStats;
  lastRelay?: Date;
  hasRelayCandidates: boolean;
  warnings: string[];
}

class CandidateMonitor {
  private participantStats = new Map<string, ParticipantCandidateInfo>();
  private globalStats: CandidateStats = { host: 0, srflx: 0, relay: 0, unknown: 0, total: 0 };

  recordCandidate(participantId: string, candidate: RTCIceCandidate, source: 'host' | 'participant' = 'participant'): void {
    const candidateType = this.getCandidateType(candidate);
    
    // Initialize participant stats if not exists
    if (!this.participantStats.has(participantId)) {
      this.participantStats.set(participantId, {
        participantId,
        stats: { host: 0, srflx: 0, relay: 0, unknown: 0, total: 0 },
        hasRelayCandidates: false,
        warnings: []
      });
    }

    const participantInfo = this.participantStats.get(participantId)!;
    
    // Update stats
    participantInfo.stats[candidateType]++;
    participantInfo.stats.total++;
    this.globalStats[candidateType]++;
    this.globalStats.total++;

    // Track relay candidates
    if (candidateType === 'relay') {
      participantInfo.hasRelayCandidates = true;
      participantInfo.lastRelay = new Date();
      console.log(`✅ [CAND-MON] RELAY candidate recorded for ${participantId} from ${source}`);
    }

    // Generate warnings
    this.checkForWarnings(participantId);

    console.log(`🧊 [CAND-MON] Candidate recorded:`, {
      participantId,
      source,
      type: candidateType,
      stats: participantInfo.stats,
      hasRelay: participantInfo.hasRelayCandidates
    });
  }

  private getCandidateType(candidate: RTCIceCandidate): keyof CandidateStats {
    const candidateStr = candidate.candidate.toLowerCase();
    if (candidateStr.includes('host')) return 'host';
    if (candidateStr.includes('srflx')) return 'srflx';
    if (candidateStr.includes('relay')) return 'relay';
    return 'unknown';
  }

  private checkForWarnings(participantId: string): void {
    const info = this.participantStats.get(participantId)!;
    const { stats } = info;
    
    info.warnings = [];

    // Warning: No relay candidates after significant time
    if (stats.total > 5 && !info.hasRelayCandidates) {
      info.warnings.push('NO_RELAY_CANDIDATES');
    }

    // Warning: Only host candidates (local network only)
    if (stats.total > 3 && stats.host === stats.total) {
      info.warnings.push('ONLY_HOST_CANDIDATES');
    }

    // Warning: No STUN reflexive candidates
    if (stats.total > 3 && stats.srflx === 0) {
      info.warnings.push('NO_STUN_CANDIDATES');
    }

    // Log critical warnings
    if (info.warnings.length > 0) {
      console.warn(`⚠️ [CAND-MON] Warnings for ${participantId}:`, info.warnings);
    }
  }

  getParticipantReport(participantId: string): ParticipantCandidateInfo | null {
    return this.participantStats.get(participantId) || null;
  }

  getGlobalReport(): {
    globalStats: CandidateStats;
    participantCount: number;
    participantsWithRelay: number;
    criticalWarnings: string[];
  } {
    const participantsWithRelay = Array.from(this.participantStats.values())
      .filter(p => p.hasRelayCandidates).length;
    
    const criticalWarnings = Array.from(this.participantStats.values())
      .filter(p => p.warnings.includes('NO_RELAY_CANDIDATES'))
      .map(p => p.participantId);

    return {
      globalStats: { ...this.globalStats },
      participantCount: this.participantStats.size,
      participantsWithRelay,
      criticalWarnings
    };
  }

  logDetailedReport(): void {
    const globalReport = this.getGlobalReport();
    
    console.log('📊 [CAND-MON] DETAILED CANDIDATE REPORT:');
    console.log('Global Stats:', globalReport.globalStats);
    console.log(`Participants: ${globalReport.participantCount}, With Relay: ${globalReport.participantsWithRelay}`);
    
    if (globalReport.criticalWarnings.length > 0) {
      console.warn('❌ [CAND-MON] Participants WITHOUT relay candidates:', globalReport.criticalWarnings);
    }

    // Log per-participant details
    this.participantStats.forEach((info, participantId) => {
      console.log(`🧊 [CAND-MON] ${participantId}:`, {
        stats: info.stats,
        hasRelay: info.hasRelayCandidates,
        warnings: info.warnings
      });
    });
  }

  cleanup(participantId?: string): void {
    if (participantId) {
      this.participantStats.delete(participantId);
    } else {
      this.participantStats.clear();
      this.globalStats = { host: 0, srflx: 0, relay: 0, unknown: 0, total: 0 };
    }
  }
}

// Global instance
export const candidateMonitor = new CandidateMonitor();

// Auto-reporting every 30 seconds during development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const report = candidateMonitor.getGlobalReport();
    if (report.participantCount > 0) {
      candidateMonitor.logDetailedReport();
    }
  }, 30000);
}