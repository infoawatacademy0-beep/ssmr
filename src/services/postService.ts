import {
  ref,
  push,
  set,
  get,
  remove,
  runTransaction,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { database } from '../config/firebase';
import type { Post, CreatePostPayload } from '../types';

/**
 * Normalizes raw post record or list into a sorted Post array.
 */
export function normalizePosts(rawPosts: unknown): Post[] {
  if (!rawPosts) return [];

  let list: unknown[] = [];
  if (Array.isArray(rawPosts)) {
    list = rawPosts;
  } else if (typeof rawPosts === 'object') {
    list = Object.values(rawPosts as Record<string, unknown>);
  }

  return list
    .filter((p): p is Post => Boolean(p && typeof p === 'object' && 'id' in p && 'content' in p))
    .map((p) => ({
      id: String(p.id),
      authorUid: String(p.authorUid),
      authorName: String(p.authorName || 'Anonymous'),
      authorAvatar: p.authorAvatar ? String(p.authorAvatar) : null,
      content: String(p.content),
      timestamp: Number(p.timestamp) || Date.now(),
      likesCount: Number(p.likesCount) || 0,
      likedBy: p.likedBy && typeof p.likedBy === 'object' ? (p.likedBy as Record<string, boolean>) : {},
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Creates and broadcasts a new micro-blogging post.
 * Atomically writes to `/posts/{postId}` and links the post ID to `/users/{uid}/posts`.
 */
export async function createPost(payload: CreatePostPayload): Promise<string> {
  const { authorUid, authorName, authorAvatar, content } = payload;
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error('Post content cannot be empty.');
  }
  if (cleanContent.length > 500) {
    throw new Error('Post content cannot exceed 500 characters.');
  }

  const postsRef = ref(database, 'posts');
  const newPostRef = push(postsRef);
  const postId = newPostRef.key;

  if (!postId) {
    throw new Error('Failed to generate post identifier.');
  }

  const newPost: Post = {
    id: postId,
    authorUid,
    authorName,
    authorAvatar: authorAvatar || null,
    content: cleanContent,
    timestamp: Date.now(),
    likesCount: 0,
    likedBy: {},
  };

  // 1. Write the post node
  await set(newPostRef, newPost);

  // 2. Append postId to user's personal posts array
  const userPostsRef = ref(database, `users/${authorUid}/posts`);
  await runTransaction(userPostsRef, (currentPosts) => {
    let postsList: string[] = [];
    if (Array.isArray(currentPosts)) {
      postsList = currentPosts;
    } else if (currentPosts && typeof currentPosts === 'object') {
      postsList = Object.values(currentPosts as Record<string, string>);
    }

    if (!postsList.includes(postId)) {
      postsList.unshift(postId);
    }
    return postsList;
  });

  return postId;
}

/**
 * Toggles like on a post atomically using Firebase transactions.
 * Returns true if liked, false if unliked.
 */
export async function toggleLikePost(postId: string, userId: string): Promise<boolean> {
  if (!postId || !userId) {
    throw new Error('Post ID and User ID are required.');
  }

  const postRef = ref(database, `posts/${postId}`);
  let isNowLiked = false;

  await runTransaction(postRef, (post: Post | null) => {
    if (!post) {
      throw new Error('Post not found.');
    }

    if (!post.likedBy) {
      post.likedBy = {};
    }

    if (post.likedBy[userId]) {
      // User already liked -> unlike
      delete post.likedBy[userId];
      post.likesCount = Math.max(0, (post.likesCount || 1) - 1);
      isNowLiked = false;
    } else {
      // User has not liked -> like
      post.likedBy[userId] = true;
      post.likesCount = (post.likesCount || 0) + 1;
      isNowLiked = true;
    }

    return post;
  });

  return isNowLiked;
}

/**
 * Deletes a post created by the author.
 */
export async function deletePost(postId: string, authorUid: string): Promise<void> {
  const postRef = ref(database, `posts/${postId}`);
  const snapshot = await get(postRef);

  if (!snapshot.exists()) return;

  const post = snapshot.val() as Post;
  if (post.authorUid !== authorUid) {
    throw new Error('You can only delete your own posts.');
  }

  // Remove from global posts
  await remove(postRef);

  // Remove from user's posts array
  const userPostsRef = ref(database, `users/${authorUid}/posts`);
  await runTransaction(userPostsRef, (currentPosts) => {
    if (!currentPosts) return [];
    let list: string[] = [];
    if (Array.isArray(currentPosts)) {
      list = currentPosts;
    } else if (typeof currentPosts === 'object') {
      list = Object.values(currentPosts as Record<string, string>);
    }
    return list.filter((id) => id !== postId);
  });
}

/**
 * Subscribes to real-time posts feed.
 */
export function subscribeToPosts(
  onUpdate: (posts: Post[]) => void,
): Unsubscribe {
  const postsRef = ref(database, 'posts');

  return onValue(postsRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
    } else {
      onUpdate(normalizePosts(snapshot.val()));
    }
  });
}
