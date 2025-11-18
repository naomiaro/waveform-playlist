declare module 'fade-maker' {
  export const FADEIN: string;
  export const FADEOUT: string;

  export function createFadeIn(
    audioParam: AudioParam,
    type: string,
    start: number,
    duration: number
  ): void;

  export function createFadeOut(
    audioParam: AudioParam,
    type: string,
    start: number,
    duration: number
  ): void;
}
