/**
 * SequenceManager - Gerencia a ordem correta de execução das operações WebSocket/WebRTC
 * Resolve problemas de "Not in room" e tentativas de conexão antes da confirmação da sala
 */

export interface SequenceStep {
  id: string;
  name: string;
  execute: () => Promise<void>;
  timeout: number;
  retries: number;
}

export interface SequenceState {
  current: string | null;
  completed: string[];
  failed: string[];
  isRunning: boolean;
}

export class SequenceManager {
  private steps: Map<string, SequenceStep> = new Map();
  private state: SequenceState = {
    current: null,
    completed: [],
    failed: [],
    isRunning: false
  };
  private currentTimeout: NodeJS.Timeout | null = null;
  private onStateChange?: (state: SequenceState) => void;

  constructor(onStateChange?: (state: SequenceState) => void) {
    this.onStateChange = onStateChange;
    console.log('🔄 SequenceManager: Initialized');
  }

  /**
   * Adiciona um passo à sequência
   */
  addStep(step: SequenceStep): void {
    this.steps.set(step.id, step);
    console.log(`➕ SequenceManager: Added step "${step.name}" (${step.id})`);
  }

  /**
   * Executa a sequência em ordem
   */
  async executeSequence(stepIds: string[]): Promise<void> {
    if (this.state.isRunning) {
      console.warn('⚠️ SequenceManager: Sequence already running, aborting new execution');
      return;
    }

    console.log(`🚀 SequenceManager: Starting sequence with ${stepIds.length} steps`);
    
    this.state = {
      current: null,
      completed: [],
      failed: [],
      isRunning: true
    };
    this.notifyStateChange();

    try {
      for (const stepId of stepIds) {
        const step = this.steps.get(stepId);
        if (!step) {
          console.error(`❌ SequenceManager: Step "${stepId}" not found`);
          this.state.failed.push(stepId);
          continue;
        }

        console.log(`⏯️ SequenceManager: Executing step "${step.name}" (${stepId})`);
        this.state.current = stepId;
        this.notifyStateChange();

        const success = await this.executeStepWithRetries(step);
        
        if (success) {
          this.state.completed.push(stepId);
          console.log(`✅ SequenceManager: Step "${step.name}" completed successfully`);
        } else {
          this.state.failed.push(stepId);
          console.error(`❌ SequenceManager: Step "${step.name}" failed after retries`);
          throw new Error(`Sequence failed at step: ${step.name}`);
        }

        this.state.current = null;
        this.notifyStateChange();

        // Pequeno delay entre passos para estabilização
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`🎉 SequenceManager: Sequence completed successfully`);
    } catch (error) {
      console.error(`💥 SequenceManager: Sequence execution failed:`, error);
      throw error;
    } finally {
      this.state.isRunning = false;
      this.state.current = null;
      this.notifyStateChange();
    }
  }

  /**
   * Executa um passo com retry automático
   */
  private async executeStepWithRetries(step: SequenceStep): Promise<boolean> {
    let attempts = 0;
    const maxAttempts = step.retries + 1;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 SequenceManager: Executing step "${step.name}" (attempt ${attempts}/${maxAttempts})`);

      try {
        await this.executeStepWithTimeout(step);
        return true;
      } catch (error) {
        console.error(`❌ SequenceManager: Step "${step.name}" failed (attempt ${attempts}):`, error);
        
        if (attempts < maxAttempts) {
          const delay = Math.min(1000 * attempts, 5000); // Exponential backoff até 5s
          console.log(`⏱️ SequenceManager: Retrying step "${step.name}" in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return false;
  }

  /**
   * Executa um passo com timeout
   */
  private async executeStepWithTimeout(step: SequenceStep): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.currentTimeout = setTimeout(() => {
        reject(new Error(`Step "${step.name}" timed out after ${step.timeout}ms`));
      }, step.timeout);

      step.execute()
        .then(() => {
          if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
          }
          resolve();
        })
        .catch((error) => {
          if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
          }
          reject(error);
        });
    });
  }

  /**
   * Para a execução da sequência atual
   */
  stop(): void {
    console.log('🛑 SequenceManager: Stopping sequence execution');
    
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    this.state.isRunning = false;
    this.state.current = null;
    this.notifyStateChange();
  }

  /**
   * Reset do estado da sequência
   */
  reset(): void {
    console.log('🔄 SequenceManager: Resetting state');
    this.stop();
    
    this.state = {
      current: null,
      completed: [],
      failed: [],
      isRunning: false
    };
    this.notifyStateChange();
  }

  /**
   * Obter estado atual
   */
  getState(): SequenceState {
    return { ...this.state };
  }

  /**
   * Verificar se um passo foi completado
   */
  isStepCompleted(stepId: string): boolean {
    return this.state.completed.includes(stepId);
  }

  /**
   * Verificar se a sequência está rodando
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Notificar mudanças de estado
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  /**
   * Cleanup - limpar timeouts e estado
   */
  cleanup(): void {
    console.log('🧹 SequenceManager: Cleanup');
    this.stop();
    this.steps.clear();
  }
}