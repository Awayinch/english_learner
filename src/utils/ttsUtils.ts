
import { getEdgeVoices, speakWithEdge } from "../services/edgeTtsService";

/**
 * TTS Utility that bridges Browser Native API and Edge Online API
 */

let nativeVoices: SpeechSynthesisVoice[] = [];
let edgeVoices: any[] = [];
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

// Normalized Voice Interface for UI
export interface AppVoice {
  name: string;
  id: string; // voiceURI for Native, ShortName for Edge
  lang: string;
  source: 'native' | 'edge';
}

export const loadVoices = async (useEdge: boolean): Promise<AppVoice[]> => {
  // Always load native to have a fallback
  if (nativeVoices.length === 0) {
      await new Promise<void>((resolve) => {
        const fetch = () => {
          nativeVoices = window.speechSynthesis.getVoices();
          if (nativeVoices.length > 0) resolve();
        };
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = fetch;
        }
        fetch();
        setTimeout(resolve, 500);
      });
  }

  const appVoices: AppVoice[] = [];

  // Add Edge Voices if enabled
  if (useEdge) {
      try {
          if (edgeVoices.length === 0) {
            const edgePromise = getEdgeVoices();
            const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000));
            edgeVoices = await Promise.race([edgePromise, timeoutPromise]);
          }
          edgeVoices.forEach(v => {
              appVoices.push({
                  name: `[Online] ${v.FriendlyName}`,
                  id: v.ShortName,
                  lang: v.Locale,
                  source: 'edge'
              });
          });
      } catch (e) {
          console.warn("Failed to load Edge voices", e);
      }
  }

  // Add Native Voices
  nativeVoices.filter(v => v.lang.startsWith('en')).forEach(v => {
      appVoices.push({
          name: `[Native] ${v.name}`,
          id: v.voiceURI,
          lang: v.lang,
          source: 'native'
      });
  });
  
  if (appVoices.filter(v => v.source === 'native').length === 0) {
       nativeVoices.forEach(v => {
          appVoices.push({
              name: `[Native] ${v.name}`,
              id: v.voiceURI,
              lang: v.lang,
              source: 'native'
          });
      });
  }

  return appVoices;
};

// Internal helper to play native TTS
const playNative = (text: string, voiceId?: string, rate: number = 1.0, pitch: number = 1.0): Promise<void> => {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply Rate and Pitch (Native API expects 0.1 to 10 for rate, 0 to 2 for pitch)
        // Our incoming rate is roughly 0.5 to 1.5 multiplier logic
        utterance.rate = rate; 
        utterance.pitch = pitch;

        if (voiceId) {
          const selected = nativeVoices.find(v => v.voiceURI === voiceId);
          if (selected) utterance.voice = selected;
        }
    
        if (!utterance.voice) {
            const best = nativeVoices.find(v => v.name.includes("Google") && v.lang.startsWith("en-US")) || 
                         nativeVoices.find(v => v.lang.startsWith("en"));
            if (best) utterance.voice = best;
        }
    
        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.error("Native TTS Error", e);
            resolve();
        };
        
        window.speechSynthesis.speak(utterance);
    });
};

interface SpeakOptions {
    rate?: number; // -50 to 50
    pitch?: number; // -50 to 50
}

export const speakText = async (text: string, voiceId?: string, options?: SpeakOptions): Promise<void> => {
  stopSpeaking(); 

  const rateVal = options?.rate || 0;
  const pitchVal = options?.pitch || 0;

  // Format for Edge: string like "+10%" or "-5Hz"
  // For simplicity, we treat inputs as percentage changes
  const edgeRateStr = rateVal >= 0 ? `+${rateVal}%` : `${rateVal}%`;
  const edgePitchStr = pitchVal >= 0 ? `+${pitchVal}Hz` : `${pitchVal}Hz`; // Edge pitch acts in Hz or semitones, relative Hz is safer

  // Format for Native: float multiplier. 0 input = 1.0. 
  // Map -50..50 to 0.5..1.5 roughly
  const nativeRate = 1.0 + (rateVal / 100);
  const nativePitch = 1.0 + (pitchVal / 100);

  const isEdgeVoice = voiceId && (voiceId.includes("Neural") || edgeVoices.some(e => e.ShortName === voiceId));

  if (isEdgeVoice && voiceId) {
      try {
          if (!audioContext) {
              audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          
          if (audioContext.state === 'suspended') {
              await audioContext.resume();
          }

          const bufferPromise = speakWithEdge(text, voiceId, edgeRateStr, edgePitchStr);
          const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("Edge TTS Timeout")), 5000)
          );

          const buffer = await Promise.race([bufferPromise, timeoutPromise]);
          
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          
          currentSource = source;
          
          return new Promise((resolve) => {
              source.onended = () => {
                  currentSource = null;
                  resolve();
              };
              source.start(0);
          });
      } catch (e) {
          console.error("Edge TTS failed/timed out, falling back to native.", e);
          return playNative(text, undefined, nativeRate, nativePitch);
      }
  }

  return playNative(text, voiceId, nativeRate, nativePitch);
};

export const stopSpeaking = () => {
  window.speechSynthesis.cancel();
  if (currentSource) {
      try {
          currentSource.stop();
      } catch(e) {}
      currentSource = null;
  }
};
