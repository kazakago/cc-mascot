export {};

declare global {
  interface Window {
    electron?: {
      onSpeak: (callback: (message: string) => void) => void;
    };
  }
}
