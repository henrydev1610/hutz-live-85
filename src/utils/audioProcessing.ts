import { TimelineItem } from '@/types/lightshow';

/**
 * Generates an ultrasonic audio file with embedded data
 * Uses frequencies between 17.5kHz-19kHz to encode timeline data
 */
export async function generateUltrasonicAudio(
  audioFile: File,
  timelineItems: TimelineItem[]
): Promise<Blob> {
  console.log("Starting ultrasonic audio generation with", timelineItems.length, "items");
  
  try {
    // First convert the File to ArrayBuffer so we can process it
    const arrayBuffer = await audioFile.arrayBuffer();
    
    // Create AudioContext
    const audioContext = new window.AudioContext();
    
    // Decode the audio file
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log("Audio successfully decoded, duration:", audioBuffer.duration, "channels:", audioBuffer.numberOfChannels);
    
    // Create an offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels, // Use same channel count as original
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Create sources for original audio and ultrasonic signals
    const musicSource = offlineContext.createBufferSource();
    musicSource.buffer = audioBuffer;
    
    // Create gain node for the original audio
    const musicGain = offlineContext.createGain();
    musicGain.gain.value = 0.95; // Slightly reduce original audio volume
    
    // Connect music through gain to output
    musicSource.connect(musicGain);
    musicGain.connect(offlineContext.destination);
    
    // Create oscillator for ultrasonic carrier wave (18kHz)
    const carrier = offlineContext.createOscillator();
    carrier.frequency.value = 18000; // 18kHz carrier frequency
    
    // Create gain node for the ultrasonic signal
    const ultrasonicGain = offlineContext.createGain();
    ultrasonicGain.gain.value = 0.05; // Keep ultrasonic signal subtle
    
    // Connect carrier to gain
    carrier.connect(ultrasonicGain);
    ultrasonicGain.connect(offlineContext.destination);
    
    // Prepare the data to be encoded (handle image paths with care)
    const encodedData = timelineItems.map(item => {
      // Create a clean copy without circular references
      const cleanItem: any = {
        id: item.id,
        type: item.type,
        startTime: item.startTime,
        duration: item.duration
      };
      
      // Add type-specific properties
      if (item.type === 'image' && item.imageUrl) {
        // For image items, use just the image URL string
        // Use a predictable path format to avoid circular references or encoding issues
        cleanItem.imageUrl = typeof item.imageUrl === 'string' ? 
          item.imageUrl.split('?')[0] : // Remove any query params
          null;
      } else if (item.type === 'flashlight' && item.pattern) {
        // For flashlight items, include the pattern
        cleanItem.pattern = { ...item.pattern };
      } else if (item.type === 'callToAction' && item.content) {
        // For callToAction items, include a safe version of the content
        cleanItem.content = {
          type: item.content.type,
          ...(item.content.imageUrl && { imageUrl: item.content.imageUrl.split('?')[0] }),
          ...(item.content.buttonText && { buttonText: item.content.buttonText }),
          ...(item.content.externalUrl && { externalUrl: item.content.externalUrl }),
          ...(item.content.couponCode && { couponCode: item.content.couponCode }),
        };
      }
      
      return cleanItem;
    });
    
    // Convert data to binary string
    const binaryData = JSON.stringify(encodedData);
    console.log("Encoded data length:", binaryData.length, "characters");
    console.log("Sample encoded data:", binaryData.substring(0, 100) + "...");
    
    const encoder = new TextEncoder();
    const binaryArray = encoder.encode(binaryData);
    
    console.log("Encoded data length:", binaryArray.length, "bytes");
    
    // FSK modulation parameters
    const mark = 18500;  // 18.5kHz for binary 1
    const space = 17500; // 17.5kHz for binary 0
    const bitsPerSecond = 100; // Data rate
    
    // Schedule the data transmission
    let currentTime = 0;
    
    // Ensure we have enough time to transmit all data
    const requiredTime = (binaryArray.length * 8) / bitsPerSecond;
    console.log("Required time for data transmission:", requiredTime, "seconds");
    
    // Add preamble for signal detection (alternating pattern)
    const preambleLength = 1; // 1 second preamble
    for (let i = 0; i < preambleLength * bitsPerSecond; i++) {
      const value = i % 2; // Alternating 0, 1 pattern
      carrier.frequency.setValueAtTime(
        value ? mark : space,
        currentTime
      );
      currentTime += 1 / bitsPerSecond;
    }
    
    // Transmit the actual data
    binaryArray.forEach((byte, index) => {
      for (let bit = 0; bit < 8; bit++) {
        const value = (byte >> bit) & 1;
        carrier.frequency.setValueAtTime(
          value ? mark : space,
          currentTime
        );
        currentTime += 1 / bitsPerSecond;
      }
      
      // Add progress logging
      if (index % 100 === 0) {
        console.log(`Encoding data: ${Math.round((index / binaryArray.length) * 100)}%`);
      }
    });
    
    // Start the sources
    musicSource.start();
    carrier.start();
    
    console.log("Starting audio rendering...");
    
    // Render the audio
    const renderedBuffer = await offlineContext.startRendering();
    console.log("Audio rendering complete, converting to WAV...");
    
    // Convert back to WAV format
    const wavData = audioBufferToWav(renderedBuffer);
    
    console.log("WAV conversion complete, data size:", wavData.byteLength, "bytes");
    
    return new Blob([wavData], { type: 'audio/wav' });
  } catch (error) {
    console.error("Error generating ultrasonic audio:", error);
    throw new Error(`Failed to generate ultrasonic audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert AudioBuffer to WAV format
 */
function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  // Calculate total number of samples
  const numSamples = buffer.length * numChannels;
  const dataLength = numSamples * bytesPerSample;
  
  // Create sample data array
  const samples = new Float32Array(numSamples);
  
  // Interleave channels
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      samples[i * numChannels + channel] = channelData[i];
    }
  }
  
  const headerLength = 44;
  const wavData = new Uint8Array(headerLength + dataLength);
  
  // Write WAV header
  const writeString = (str: string, offset: number) => {
    for (let i = 0; i < str.length; i++) {
      wavData[offset + i] = str.charCodeAt(i);
    }
  };
  
  const view = new DataView(wavData.buffer);
  
  // RIFF chunk descriptor
  writeString('RIFF', 0);
  view.setUint32(4, 36 + dataLength, true);
  writeString('WAVE', 8);
  
  // Format chunk
  writeString('fmt ', 12);
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  view.setUint16(32, blockAlign, true); // BlockAlign = NumChannels * BitsPerSample/8
  view.setUint16(34, bitDepth, true);
  
  // Data chunk
  writeString('data', 36);
  view.setUint32(40, dataLength, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Normalize sample value between -1 and 1
    const sample = Math.max(-1, Math.min(1, samples[i]));
    
    // Convert to 16-bit signed integer
    const sampleValue = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    
    // Write sample value to buffer
    view.setInt16(offset, sampleValue, true);
    offset += 2;
  }
  
  return wavData;
}

/**
 * Detects beats in an audio file for auto-synchronization
 * This would use a real beat detection algorithm in production
 */
export async function detectBeats(audioFile: File): Promise<{beats: number[], bassBeats: number[], trebleBeats: number[]}> {
  // This is a simplified placeholder for actual beat detection
  // In a real implementation, this would analyze the audio waveform
  // and return timestamps of detected beats
  
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate detected beats at different points with slight variations for realism
      const beats = [];
      const bassBeats = [];
      const trebleBeats = [];
      
      // Generate main beats (approximately every 0.3 seconds for more frequent beats)
      for (let i = 0; i < 200; i++) {
        // Add some randomness to make it more realistic
        const jitter = Math.random() * 0.08;
        const beatTime = i * 0.3 + jitter;
        beats.push(beatTime);
        
        // Every third beat is a bass beat
        if (i % 3 === 0) {
          bassBeats.push(beatTime);
        }
        
        // Different treble pattern - more frequent 
        if (i % 2 === 0 || i % 4 === 0) {
          // Add slight offset to treble beats
          trebleBeats.push(beatTime + 0.05);
        }
      }
      
      // Add strobe effects every second (with minor variations)
      for (let i = 0; i < 60; i++) {
        for (let j = 0; j < 4; j++) {
          const strobeTime = i + (j * 0.05);
          beats.push(strobeTime);
        }
      }
      
      // Add some extra random bass drops
      for (let i = 0; i < 30; i++) {
        const randomTime = Math.random() * 60;
        bassBeats.push(randomTime);
      }
      
      // Add more random treble hits
      for (let i = 0; i < 40; i++) {
        const randomTime = Math.random() * 60;
        trebleBeats.push(randomTime);
      }
      
      // Sort all beat arrays
      beats.sort((a, b) => a - b);
      bassBeats.sort((a, b) => a - b);
      trebleBeats.sort((a, b) => a - b);
      
      resolve({ beats, bassBeats, trebleBeats });
    }, 1000);
  });
}

/**
 * Edits an audio file by trimming it
 * This is a simplified version that would need to be replaced with actual audio processing
 */
export async function trimAudioFile(
  audioFile: File, 
  startTime: number, 
  endTime: number
): Promise<Blob> {
  console.log(`Trimming audio file from ${startTime}s to ${endTime}s`);
  
  // This is a simplified placeholder for actual audio trimming
  // In a real implementation, this would decode the audio, trim it, and re-encode
  
  return new Promise((resolve) => {
    // Simulate processing time
    setTimeout(() => {
      // In a real implementation, this would be the trimmed audio
      resolve(audioFile);
    }, 1500);
  });
}
