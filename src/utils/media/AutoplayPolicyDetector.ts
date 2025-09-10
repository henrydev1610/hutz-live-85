interface AutoplayTestResult {
  isBlocked: boolean;
  needsUserInteraction: boolean;
  errorType?: string;
  browserPolicy?: string;
}

interface UserInteractionRequirement {
  isRequired: boolean;
  reason: string;
  suggestedAction: string;
}

export class AutoplayPolicyDetector {
  private static instance: AutoplayPolicyDetector;
  private testResults = new Map<string, AutoplayTestResult>();
  private userInteractionCallbacks = new Set<() => void>();

  static getInstance(): AutoplayPolicyDetector {
    if (!AutoplayPolicyDetector.instance) {
      AutoplayPolicyDetector.instance = new AutoplayPolicyDetector();
    }
    return AutoplayPolicyDetector.instance;
  }

  async testAutoplayPolicy(videoElement: HTMLVideoElement): Promise<AutoplayTestResult> {
    console.log(`[AutoplayPolicyDetector] Testando política de autoplay do navegador`);
    
    try {
      // Tentar reprodução
      const playPromise = videoElement.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log(`[AutoplayPolicyDetector] ✅ Autoplay permitido`);
        return {
          isBlocked: false,
          needsUserInteraction: false
        };
      }
      
      return {
        isBlocked: false,
        needsUserInteraction: false
      };
    } catch (error: any) {
      console.log(`[AutoplayPolicyDetector] ❌ Autoplay bloqueado:`, error.name);
      
      const result: AutoplayTestResult = {
        isBlocked: true,
        needsUserInteraction: true,
        errorType: error.name,
        browserPolicy: this.detectBrowserPolicy(error)
      };
      
      return result;
    }
  }

  private detectBrowserPolicy(error: any): string {
    if (error.name === 'NotAllowedError') {
      return 'Usuário deve interagir com a página antes de reproduzir mídia';
    }
    
    if (error.name === 'AbortError') {
      return 'Reprodução foi abortada por política do navegador';
    }
    
    if (error.name === 'NotSupportedError') {
      return 'Formato de mídia não suportado pelo navegador';
    }
    
    return 'Política de autoplay desconhecida';
  }

  checkUserInteractionRequirement(): UserInteractionRequirement {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isMobile && (isChrome || isSafari)) {
      return {
        isRequired: true,
        reason: 'Navegadores móveis exigem interação do usuário para mídia',
        suggestedAction: 'Mostrar botão "Ativar Câmera" para o usuário clicar'
      };
    }
    
    return {
      isRequired: false,
      reason: 'Navegador permite autoplay de mídia',
      suggestedAction: 'Nenhuma ação necessária'
    };
  }

  async waitForUserInteraction(): Promise<void> {
    return new Promise((resolve) => {
      const handleUserInteraction = () => {
        console.log(`[AutoplayPolicyDetector] ✅ Interação do usuário detectada`);
        
        // Remover listeners
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        
        // Notificar callbacks
        this.userInteractionCallbacks.forEach(callback => callback());
        this.userInteractionCallbacks.clear();
        
        resolve();
      };

      // Escutar vários tipos de interação
      document.addEventListener('click', handleUserInteraction, { once: true });
      document.addEventListener('touchstart', handleUserInteraction, { once: true });
      document.addEventListener('keydown', handleUserInteraction, { once: true });
      
      console.log(`[AutoplayPolicyDetector] ⏳ Aguardando interação do usuário...`);
    });
  }

  registerUserInteractionCallback(callback: () => void): void {
    this.userInteractionCallbacks.add(callback);
  }

  hasUserInteracted(): boolean {
    // Verificar se já houve alguma interação na página
    return document.visibilityState === 'visible' && 
           document.hasFocus() && 
           this.userInteractionCallbacks.size === 0;
  }

  createActivationButton(onActivate: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = '🎥 Ativar Câmera';
    button.className = 'autoplay-activation-button';
    button.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
    `;
    
    button.addEventListener('click', () => {
      console.log(`[AutoplayPolicyDetector] ✅ Usuário clicou no botão de ativação`);
      onActivate();
      button.remove();
    });
    
    return button;
  }

  showAutoplayBlockedWarning(videoElement: HTMLVideoElement): void {
    const container = videoElement.parentElement;
    if (!container) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'autoplay-blocked-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      text-align: center;
      z-index: 100;
      border-radius: 8px;
    `;
    
    overlay.innerHTML = `
      <div>
        <div style="margin-bottom: 8px;">🔇</div>
        <div>Clique para ativar o vídeo</div>
      </div>
    `;
    
    overlay.addEventListener('click', async () => {
      try {
        await videoElement.play();
        overlay.remove();
        console.log(`[AutoplayPolicyDetector] ✅ Vídeo ativado após clique do usuário`);
      } catch (error) {
        console.error(`[AutoplayPolicyDetector] ❌ Erro ao ativar vídeo:`, error);
      }
    });
    
    if (container.style.position !== 'relative' && container.style.position !== 'absolute') {
      container.style.position = 'relative';
    }
    
    container.appendChild(overlay);
  }
}