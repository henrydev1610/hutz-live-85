// Device enumeration and analysis
export interface DeviceInfo {
  video: number;
  audio: number;
  devices: MediaDeviceInfo[];
  backCamera?: MediaDeviceInfo;
  frontCamera?: MediaDeviceInfo;
}

export const enumerateMediaDevices = async (): Promise<DeviceInfo> => {
  let deviceInfo: DeviceInfo = { video: 0, audio: 0, devices: [] };
  
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      deviceInfo.devices = devices;
      
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      deviceInfo.video = videoInputs.length;
      deviceInfo.audio = devices.filter(d => d.kind === 'audioinput').length;
      
      // 🎯 CRITICAL: Find back camera for mobile
      deviceInfo.backCamera = findBackCamera(videoInputs);
      deviceInfo.frontCamera = findFrontCamera(videoInputs);
      
      console.log(`📹 DEVICES: Available - Video: ${deviceInfo.video}, Audio: ${deviceInfo.audio}`);
      console.log(`📹 DEVICES: Details:`, devices.map(d => ({ 
        kind: d.kind, 
        label: d.label || 'unlabeled',
        deviceId: d.deviceId ? 'present' : 'missing' 
      })));
      
      if (deviceInfo.backCamera) {
        console.log(`📱 BACK CAMERA FOUND:`, { 
          label: deviceInfo.backCamera.label, 
          deviceId: deviceInfo.backCamera.deviceId ? 'present' : 'missing' 
        });
      }
      
      if (deviceInfo.frontCamera) {
        console.log(`📱 FRONT CAMERA FOUND:`, { 
          label: deviceInfo.frontCamera.label, 
          deviceId: deviceInfo.frontCamera.deviceId ? 'present' : 'missing' 
        });
      }
      
      if (deviceInfo.video === 0 && deviceInfo.audio === 0) {
        console.warn('⚠️ DEVICES: No devices found, but continuing...');
      }
    }
  } catch (error) {
    console.warn('⚠️ DEVICES: Could not enumerate devices:', error);
  }
  
  return deviceInfo;
};

// 🎯 CRITICAL: Find back camera using device labels and deviceId
export const findBackCamera = (videoInputs: MediaDeviceInfo[]): MediaDeviceInfo | undefined => {
  // Look for back/rear/environment camera by label
  const backCamera = videoInputs.find(device => 
    /back|rear|environment/i.test(device.label || '')
  );
  
  if (backCamera) {
    console.log('🎯 BACK CAMERA: Found by label:', backCamera.label);
    return backCamera;
  }
  
  // Fallback: Try to find based on deviceId patterns (some devices)
  const backByPattern = videoInputs.find(device => 
    /back|rear|env/i.test(device.deviceId || '')
  );
  
  if (backByPattern) {
    console.log('🎯 BACK CAMERA: Found by deviceId pattern:', backByPattern.deviceId);
    return backByPattern;
  }
  
  // If no specific back camera found but multiple cameras exist,
  // assume the second camera might be the back one (common pattern)
  if (videoInputs.length > 1) {
    console.log('🎯 BACK CAMERA: Using second camera as fallback');
    return videoInputs[1];
  }
  
  console.warn('🎯 BACK CAMERA: Not found, will use facingMode fallback');
  return undefined;
};

// 🎯 Find front camera using device labels  
export const findFrontCamera = (videoInputs: MediaDeviceInfo[]): MediaDeviceInfo | undefined => {
  const frontCamera = videoInputs.find(device => 
    /front|user|selfie/i.test(device.label || '')
  );
  
  if (frontCamera) {
    console.log('🎯 FRONT CAMERA: Found by label:', frontCamera.label);
    return frontCamera;
  }
  
  // Fallback: first camera is usually front camera
  if (videoInputs.length > 0) {
    console.log('🎯 FRONT CAMERA: Using first camera as fallback');
    return videoInputs[0];
  }
  
  return undefined;
};