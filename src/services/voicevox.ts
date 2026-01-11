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

export async function createAudioQuery(
  text: string,
  speakerId: number,
  baseUrl: string
): Promise<AudioQuery> {
  const res = await fetch(
    `${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    throw new Error(`audio_query failed: ${res.status}`);
  }
  return res.json();
}

export async function synthesis(
  query: AudioQuery,
  speakerId: number,
  baseUrl: string
): Promise<ArrayBuffer> {
  const res = await fetch(
    `${baseUrl}/synthesis?speaker=${speakerId}`,
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

export async function speak(
  text: string,
  speakerId: number,
  baseUrl: string
): Promise<ArrayBuffer> {
  const query = await createAudioQuery(text, speakerId, baseUrl);
  return synthesis(query, speakerId, baseUrl);
}
