export enum Language {
  ENGLISH = 'English',
  TELUGU = 'Telugu'
}

export interface Scheme {
  id: string;
  title: string;
  teluguTitle: string;
  description: string;
  icon: string;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}