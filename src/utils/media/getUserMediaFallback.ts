
import { detectMobileAggressively, getCameraPreference } from './deviceDetection';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  
  console.log(`🎬 CAPTURA DE MÍDIA: Iniciando captura ${isMobile ? 'MOBILE' : 'DESKTOP'} com prioridade MOBILE`);
  
  // FASE 4: Mobile first - prioridade absoluta
  if (isMobile) {
    return await getMobileStreamWithEnhancedDetection();
  }
  
  // Lógica desktop
  return await getDesktopStreamWithMobileFallback();
};

const getMobileStreamWithEnhancedDetection = async (): Promise<MediaStream | null> => {
  console.log('📱 MOBILE CAPTURE: Aquisição de câmera mobile com priorização de traseira');
  
  // FASE 4: Detecção de parâmetros de URL para override da câmera
  const urlParams = new URLSearchParams(window.location.search);
  const forcedCamera = urlParams.get('camera'); // 'environment' ou 'user'
  const preferredFacing = forcedCamera === 'user' ? 'user' : 'environment'; // Default para traseira
  
  console.log(`📱 MOBILE CAPTURE: Preferência de câmera da URL: ${forcedCamera || 'auto'}, usando: ${preferredFacing}`);
  
  // FASE 4: CRITICAL - Validar e guardar acesso via QR
  if (urlParams.has('qr') || urlParams.has('mobile')) {
    sessionStorage.setItem('accessedViaQR', 'true');
    console.log('✅ MOBILE CAPTURE: Acesso via QR detectado e armazenado');
  }
  
  // Fase 1: Tentar câmera traseira EXACT primeiro (PRIORIDADE MÁXIMA para mobile)
  try {
    console.log('📱 MOBILE CAPTURE: Fase 1 - Câmera traseira EXACT');
    const constraints = {
      video: {
        facingMode: { exact: preferredFacing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Câmera traseira EXACT obtida com sucesso');
    
    // FASE 4: Validação aprimorada
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('📱 MOBILE CAPTURE: Configurações da câmera verificadas:', {
        facingMode: settings.facingMode,
        width: settings.width,
        height: settings.height,
        deviceId: settings.deviceId?.substring(0, 20),
        label: videoTrack.label
      });
      
      // FASE 4: Detecção aprimorada de câmera traseira
      const isCameraRear = settings.facingMode === 'environment' || 
                          videoTrack.label.toLowerCase().includes('back') || 
                          videoTrack.label.toLowerCase().includes('traseira') ||
                          videoTrack.label.toLowerCase().includes('rear');
      
      console.log(`📱 MOBILE CAPTURE: Câmera traseira detectada: ${isCameraRear ? 'SIM' : 'NÃO'}`);
      
      if (preferredFacing === 'environment' && !isCameraRear) {
        console.warn('⚠️ MOBILE CAPTURE: Câmera pode não ser traseira, tentando alternativa');
        // Continuar para próxima fase se não temos certeza que é traseira
      } else {
        return stream;
      }
    }
    
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Fase 1 falhou, tentando câmera traseira IDEAL');
  }
  
  // Fase 2: Tentar câmera traseira IDEAL
  try {
    console.log('📱 MOBILE CAPTURE: Fase 2 - Câmera traseira IDEAL');
    const constraints = {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Câmera traseira IDEAL obtida');
    
    // FASE 4: Validação rápida da stream
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      console.log('✅ MOBILE CAPTURE: Video track obtido:', videoTrack.label);
    }
    
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Fase 2 falhou, tentando qualquer câmera com áudio');
  }
  
  // Fase 3: Tentar QUALQUER câmera com áudio (fallback mobile)
  try {
    console.log('📱 MOBILE CAPTURE: Fase 3 - QUALQUER câmera com áudio');
    const constraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: QUALQUER câmera com áudio obtida');
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Fase 3 falhou, tentando apenas vídeo');
  }
  
  // Fase 4: Tentar apenas vídeo (último recurso para mobile)
  try {
    console.log('📱 MOBILE CAPTURE: Fase 4 - Apenas vídeo (último recurso mobile)');
    const constraints = {
      video: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Stream apenas vídeo obtida');
    return stream;
  } catch (error) {
    console.error('❌ MOBILE CAPTURE: Todas as fases mobile falharam:', error);
    return null;
  }
};

const getDesktopStreamWithMobileFallback = async (): Promise<MediaStream | null> => {
  console.log('🖥️ DESKTOP CAPTURE: Iniciando com capacidade de fallback mobile');
  
  const desktopConstraints = [
    // Alta qualidade desktop
    {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: true
    },
    // Qualidade média
    {
      video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 }
      },
      audio: true
    },
    // FASE 4: Constraints tipo mobile para fallback desktop
    {
      video: {
        width: { ideal: 640, max: 800 },
        height: { ideal: 480, max: 600 }
      },
      audio: true
    },
    // Qualidade básica
    {
      video: {
        width: { ideal: 640, max: 640 },
        height: { ideal: 480, max: 480 }
      },
      audio: true
    },
    // Fallback apenas vídeo
    {
      video: true
    }
  ];
  
  for (let i = 0; i < desktopConstraints.length; i++) {
    try {
      console.log(`🖥️ DESKTOP CAPTURE: Tentando conjunto de constraints ${i + 1}`);
      const stream = await navigator.mediaDevices.getUserMedia(desktopConstraints[i]);
      console.log(`✅ DESKTOP CAPTURE: Sucesso com conjunto ${i + 1}`);
      
      // FASE 4: Validação do stream desktop
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('🖥️ DESKTOP CAPTURE: Configurações da câmera:', {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          deviceId: settings.deviceId?.substring(0, 20),
          label: videoTrack.label
        });
      }
      
      return stream;
    } catch (error) {
      console.log(`⚠️ DESKTOP CAPTURE: Conjunto ${i + 1} falhou:`, error);
    }
  }
  
  console.error('❌ DESKTOP CAPTURE: Todos os conjuntos falharam');
  return null;
};

// FASE 5: Diagnóstico aprimorado para mobile
export const getCameraInfo = async (): Promise<void> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('📹 CAMERA INFO: Câmeras disponíveis com detecção mobile:', videoDevices.map(device => ({
      deviceId: device.deviceId?.substring(0, 20),
      label: device.label || 'Câmera desconhecida',
      groupId: device.groupId?.substring(0, 20),
      isCamera: device.kind === 'videoinput',
      isMobileCapable: device.label.toLowerCase().includes('back') || 
                     device.label.toLowerCase().includes('traseira') || 
                     device.label.toLowerCase().includes('rear') || 
                     device.label.toLowerCase().includes('environment')
    })));
    
    // FASE 5: Testar todas as câmeras
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug')) {
      await testAllCameras();
    }
  } catch (error) {
    console.error('❌ CAMERA INFO: Falha ao enumerar dispositivos:', error);
  }
};

// FASE 5: Teste completo de todas as câmeras
const testAllCameras = async () => {
  try {
    console.log('🧪 TESTE COMPLETO: Testando todas as câmeras...');
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    for (const device of videoDevices) {
      try {
        console.log(`🧪 TESTANDO CÂMERA: ${device.label || 'Câmera sem label'} (${device.deviceId.substring(0, 20)})`);
        
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
          audio: false
        });
        
        const videoTrack = testStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        console.log(`✅ CÂMERA FUNCIONAL: ${device.label}`, {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          facingMode: settings.facingMode
        });
        
        // Limpar stream de teste
        testStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.log(`❌ CÂMERA FALHOU: ${device.label}:`, error.name);
      }
    }
    
    // Testar especificamente câmeras traseira e frontal
    await testSpecificCamera('environment');
    await testSpecificCamera('user');
    
  } catch (error) {
    console.error('❌ TESTE DE CÂMERAS FALHOU:', error);
  }
};

// FASE 5: Teste de câmera específica
const testSpecificCamera = async (facingMode: 'user' | 'environment') => {
  try {
    console.log(`🧪 TESTANDO CÂMERA ${facingMode.toUpperCase()}`);
    
    const testStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode } }
    });
    
    const videoTrack = testStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
    console.log(`✅ CÂMERA ${facingMode.toUpperCase()} FUNCIONAL:`, {
      label: videoTrack.label,
      settings
    });
    
    // Limpar stream
    testStream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.log(`❌ CÂMERA ${facingMode.toUpperCase()} FALHOU:`, error);
    return false;
  }
};

// Expor funções de diagnóstico
(window as any).testAllCameras = testAllCameras;
(window as any).getCameraInfo = getCameraInfo;
