
/**
 * Browser Native Text-to-Speech Utility
 * Uses window.speechSynthesis to avoid API quotas.
 */

let voices: SpeechSynthesisVoice[] = [];

export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    const fetch = () => {
      voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
      }
    };

    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = fetch;
    }
    
    fetch();
    // Fallback if event doesn't fire immediately
    setTimeout(fetch, 500);
  });
};

export const getAvailableVoices = () => {
  return voices;
};

export const speakText = (text: string, voiceURI?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Cancel any current speaking
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voiceURI) {
      const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // Improved Fallback: Prefer Google voices for Android/Chrome which are higher quality
    if (!utterance.voice) {
       const googleVoice = voices.find(v => v.name.includes("Google") && v.lang.startsWith('en'));
       const enVoice = voices.find(v => v.lang.startsWith('en'));
       
       if (googleVoice) {
           utterance.voice = googleVoice;
       } else if (enVoice) {
           utterance.voice = enVoice;
       }
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (e) => {
      console.error("TTS Error", e);
      reject(e);
    };

    window.speechSynthesis.speak(utterance);
  });
};

export const stopSpeaking = () => {
  window.speechSynthesis.cancel();
};
