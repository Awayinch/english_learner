
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
        // Timeout fallback
        setTimeout(resolve, 500);
      });
  }

  const appVoices: AppVoice[] = [];

  // Add Edge Voices if enabled
  if (useEdge) {
      try {
          if (edgeVoices.length === 0) {
            edgeVoices = await getEdgeVoices();
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
  
  // Add other native languages if English not found (fallback)
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

export const speakText = async (text: string, voiceId?: string): Promise<void> => {
  stopSpeaking(); // Stop any current audio

  // Heuristic: If voiceId looks like "en-US-GuyNeural", it's Edge. 
  // Native URIs are usually "com.google..." or "urn:moz..." or just "Google US English"
  const isEdgeVoice = voiceId && (voiceId.includes("Neural") || edgeVoices.some(e => e.ShortName === voiceId));

  if (isEdgeVoice && voiceId) {
      try {
          if (!audioContext) audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') await audioContext.resume();

          const buffer = await speakWithEdge(text, voiceId);
          
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
          console.error("Edge TTS failed, falling back to native", e);
          // Fallback logic below...
      }
  }

  // Native Fallback
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find native voice
    if (voiceId) {
      const selected = nativeVoices.find(v => v.voiceURI === voiceId);
      if (selected) utterance.voice = selected;
    }

    // Auto-select best native English voice if no specific voice or if Edge failed
    if (!utterance.voice) {
        const best = nativeVoices.find(v => v.name.includes("Google") && v.lang.startsWith("en-US")) || 
                     nativeVoices.find(v => v.lang.startsWith("en"));
        if (best) utterance.voice = best;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
        console.error(e);
        // Don't reject, just resolve to allow flow to continue
        resolve(); 
    };
    
    window.speechSynthesis.speak(utterance);
  });
};

export const stopSpeaking = () => {
  // Stop Native
  window.speechSynthesis.cancel();
  
  // Stop AudioContext (Edge)
  if (currentSource) {
      try {
          currentSource.stop();
      } catch(e) {}
      currentSource = null;
  }
};
