/**
 * Fallback para casos onde o servidor não está disponível
 */

export class OfflineFallback {
  static createOfflineAlert(): void {
    console.error('🚨 [OFFLINE] Server appears to be offline');
    
    // Criar alerta visual para o usuário
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-family: system-ui, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 90vw;
      text-align: center;
    `;
    alertDiv.innerHTML = `
      <strong>🔌 Servidor Offline</strong><br>
      <small>Verificando conectividade... Recarregue a página em alguns segundos.</small>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Remover após 10 segundos
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv);
      }
    }, 10000);
  }

  static suggestReload(): void {
    console.log('💡 [OFFLINE] Suggesting page reload to user');
    
    const confirmReload = confirm(
      'O servidor parece estar offline ou com problemas de conectividade.\n\n' +
      'Deseja recarregar a página para tentar novamente?'
    );
    
    if (confirmReload) {
      console.log('🔄 [OFFLINE] User accepted reload suggestion');
      window.location.reload();
    }
  }

  static checkServerAfterDelay(delayMs: number = 30000): void {
    console.log(`⏰ [OFFLINE] Will check server again in ${delayMs}ms`);
    
    setTimeout(async () => {
      try {
        const response = await fetch(window.location.origin, { 
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          console.log('✅ [OFFLINE] Server is back online!');
          this.suggestReload();
        } else {
          console.log('⚠️ [OFFLINE] Server still having issues');
          this.createOfflineAlert();
        }
      } catch (error) {
        console.log('❌ [OFFLINE] Server still offline');
        this.createOfflineAlert();
      }
    }, delayMs);
  }
}

// Disponibilizar globalmente para debug
(window as any).OfflineFallback = OfflineFallback;