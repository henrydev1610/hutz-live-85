// Complete stub matching expected interface - DEPRECATED, use Twilio Video Rooms
export class TurnConnectivityService {
  static async testTurnServers() {
    return { working: 0, total: 0 };
  }

  getLastDiagnostic() { 
    return { 
      working: 0, 
      total: 0,
      overallHealth: 'failed' as 'unknown' | 'failed' | 'healthy' | 'degraded',
      workingServers: [],
      allServersStatus: [],
      bestServer: null,
      recommendFallback: true
    }; 
  }
  
  async runDiagnostic(forceRefresh?: boolean) { 
    return { 
      working: 0, 
      total: 0,
      overallHealth: 'failed' as 'unknown' | 'failed' | 'healthy' | 'degraded',
      workingServers: [],
      allServersStatus: [],
      bestServer: null,
      recommendFallback: true
    }; 
  }
  
  forceRefresh() {
    return { 
      working: 0, 
      total: 0,
      overallHealth: 'failed' as 'unknown' | 'failed' | 'healthy' | 'degraded',
      workingServers: [],
      allServersStatus: [],
      bestServer: null,
      recommendFallback: true
    };
  }
  
  isHealthy() { return false; }
  getWorkingServerCount() { return 0; }
  static getLastTestResults() { return { working: 0, total: 0, servers: [] }; }
}

export const turnConnectivityService = new TurnConnectivityService();