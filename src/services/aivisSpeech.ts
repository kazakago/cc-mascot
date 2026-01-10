const BASE_URL = 'http://localhost:10101';
const SPEAKER_ID = 888753760;

export interface AudioQuery {
  accent_phrases: unknown[];
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  outputSamplingRate: number;
  outputStereo: boolean;
  kana?: string;
}

export async function createAudioQuery(text: string): Promise<AudioQuery> {
  const res = await fetch(
    `${BASE_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    throw new Error(`audio_query failed: ${res.status}`);
  }
  return res.json();
}

export async function synthesis(query: AudioQuery): Promise<ArrayBuffer> {
  const res = await fetch(
    `${BASE_URL}/synthesis?speaker=${SPEAKER_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    }
  );
  if (!res.ok) {
    throw new Error(`synthesis failed: ${res.status}`);
  }
  return res.arrayBuffer();
}

export async function speak(text: string): Promise<ArrayBuffer> {
  const query = await createAudioQuery(text);
  return synthesis(query);
}
