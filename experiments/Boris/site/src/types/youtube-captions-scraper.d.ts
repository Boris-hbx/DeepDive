declare module 'youtube-captions-scraper' {
  export type SubtitleLine = {
    start: string;
    dur: string;
    text: string;
  };
  export function getSubtitles(opts: {
    videoID: string;
    lang?: string;
  }): Promise<SubtitleLine[]>;
}
