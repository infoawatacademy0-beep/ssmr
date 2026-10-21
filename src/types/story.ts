export type StoryMediaType = 'text' | 'image';

export interface Story {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string | null;
  type: StoryMediaType;
  content: string;       // text content or image URL
  bgColor?: string;      // for text stories
  viewerUids: string[];  // list of UIDs who viewed
  expiresAt: number;     // timestamp: created + 24h
  timestamp: number;
}

export interface StoryGroup {
  authorUid: string;
  authorName: string;
  authorAvatar?: string | null;
  stories: Story[];
  hasUnread: boolean;
}
