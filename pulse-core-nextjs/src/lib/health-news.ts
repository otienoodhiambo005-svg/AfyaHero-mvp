export type HealthNewsRole = 'reception' | 'medical' | 'lab' | 'pharmacy' | 'admin';

export interface EducationTopicData {
  title: string;
  tag: string;
  duration: string;
  summary: string;
  actionLabel: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  isLive?: boolean;
  /** Optional background image URL shown behind the slide card. */
  image?: string;
}

export interface LiveHealthNewsPayload {
  updatedAt: string;
  regionCode: string;
  refreshMinutes: number;
  sourceNames: string[];
  insightText: string;
  items: EducationTopicData[];
}
