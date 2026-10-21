/**
 * Social Post Entity Schema
 * Stored under `/posts/{postId}` in Firebase Realtime Database.
 */
export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  timestamp: number;
  likesCount: number;
  likedBy?: Record<string, boolean>;
}

export interface CreatePostPayload {
  authorUid: string;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
}
