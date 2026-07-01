declare module 'youtube-caption-extractor' {
  interface Subtitle {
    text: string;
    start: string;
    dur: string;
  }
  export function getSubtitles(opts: { videoID: string; lang?: string }): Promise<Subtitle[]>;
}
