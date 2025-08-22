// Minimal stub for backwards compatibility - DEPRECATED
export class TurnConnectivityService {
  static async testTurnServers() {
    return { working: 0, total: 0 };
  }

  getLastDiagnostic() { return { working: 0, total: 0 }; }
  async runDiagnostic() { return { working: 0, total: 0 }; }
  forceRefresh() {}
  isHealthy() { return false; }
  getWorkingServerCount() { return 0; }
  static getLastTestResults() { return { working: 0, total: 0, servers: [] }; }
}

export const turnConnectivityService = new TurnConnectivityService();