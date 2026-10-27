/**
 * Social Post Entity Schema
 * Stored under `/posts/{postId}` in Firebase Realtime Database.
 */
export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string | null;
  authorIsVerified?: boolean;
  content: string;
  imageUrl?: string | null;
  timestamp: number;
  likesCount: number;
  likedBy?: Record<string, boolean>;
  commentsCount?: number;
}

export interface PostComment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string | null;
  authorIsVerified?: boolean;
  content: string;
  timestamp: number;
}

export interface CreatePostPayload {
  authorUid: string;
  authorName: string;
  authorAvatar?: string | null;
  authorIsVerified?: boolean;
  content: string;
  imageUrl?: string | null;
}

export interface CreateCommentPayload {
  authorUid: string;
  authorName: string;
  authorAvatar?: string | null;
  authorIsVerified?: boolean;
  content: string;
}
