
/**
 * Service to interact with Microsoft Edge's Read Aloud (TTS) WebSocket.
 * This provides high-quality Neural voices for free.
 */

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

export interface EdgeVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
  Status: string;
}

// Format the request ID
const uuidv4 = () => {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
};

// Fetch list of available Edge voices
export const getEdgeVoices = async (): Promise<EdgeVoice[]> => {
  try {
    const response = await fetch(
      "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=" +
        TRUSTED_CLIENT_TOKEN
    );
    if (!response.ok) return [];
    const voices: EdgeVoice[] = await response.json();
    // Filter for English voices primarily, or let user decide
    return voices.filter((v) => v.Locale.startsWith("en-"));
  } catch (e) {
    console.error("Failed to fetch Edge voices", e);
    return [];
  }
};

export const speakWithEdge = (
  text: string,
  voiceShortName: string = "en-US-GuyNeural",
  rate: string = "+0%",
  pitch: string = "+0Hz"
): Promise<AudioBuffer> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WSS_URL);
    const requestId = uuidv4();
    let audioChunks: Blob[] = [];

    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      // 1. Send Configuration
      const configData = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "false",
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      };
      
      const configMessage = 
        `X-Timestamp:${new Date().toString()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify(configData);
      
      ws.send(configMessage);

      // 2. Send SSML
      const ssml = `
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
          <voice name='${voiceShortName}'>
            <prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${text}</prosody>
          </voice>
        </speak>
      `;

      const ssmlMessage = 
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${new Date().toString()}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;

      ws.send(ssmlMessage);
    };

    ws.onmessage = async (event) => {
      const data = event.data;

      if (typeof data === "string") {
        // Text message (metadata or turn.end)
        if (data.includes("Path:turn.end")) {
          ws.close();
          // Decode collected audio
          if (audioChunks.length === 0) {
              reject(new Error("No audio received"));
              return;
          }
          const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          try {
             const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
             resolve(decodedBuffer);
          } catch (e) {
             reject(e);
          }
        }
      } else if (data instanceof ArrayBuffer) {
        // Binary message (Audio)
        // The binary message has a header we need to strip.
        // Usually header is 2 bytes (length) + header text + \r\n\r\n + audio data
        const view = new DataView(data);
        const headerLength = view.getInt16(0);
        const audioData = data.slice(headerLength + 2); 
        audioChunks.push(new Blob([audioData]));
      }
    };

    ws.onerror = (e) => {
      console.error("Edge TTS WebSocket Error", e);
      reject(e);
    };

    ws.onclose = () => {
      // Clean up handled in onmessage turn.end usually
    };
  });
};
