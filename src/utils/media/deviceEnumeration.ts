// Device enumeration and analysis
export interface DeviceInfo {
  video: number;
  audio: number;
  devices: MediaDeviceInfo[];
}

export const enumerateMediaDevices = async (): Promise<DeviceInfo> => {
  let deviceInfo: DeviceInfo = { video: 0, audio: 0, devices: [] };
  
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      deviceInfo.devices = devices;
      deviceInfo.video = devices.filter(d => d.kind === 'videoinput').length;
      deviceInfo.audio = devices.filter(d => d.kind === 'audioinput').length;
      
      console.log(`📹 DEVICES: Available - Video: ${deviceInfo.video}, Audio: ${deviceInfo.audio}`);
      console.log(`📹 DEVICES: Details:`, devices.map(d => ({ 
        kind: d.kind, 
        label: d.label || 'unlabeled',
        deviceId: d.deviceId ? 'present' : 'missing' 
      })));
      
      if (deviceInfo.video === 0 && deviceInfo.audio === 0) {
        console.warn('⚠️ DEVICES: No devices found, but continuing...');
      }
    }
  } catch (error) {
    console.warn('⚠️ DEVICES: Could not enumerate devices:', error);
  }
  
  return deviceInfo;
};