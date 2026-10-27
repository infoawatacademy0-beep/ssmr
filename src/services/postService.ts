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
import type { Post, CreatePostPayload, PostComment, CreateCommentPayload } from '../types';
import { sendNotification } from './notificationService';

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
      authorIsVerified: Boolean(p.authorIsVerified),
      content: String(p.content),
      imageUrl: p.imageUrl ? String(p.imageUrl) : null,
      timestamp: Number(p.timestamp) || Date.now(),
      likesCount: Number(p.likesCount) || 0,
      likedBy: p.likedBy && typeof p.likedBy === 'object' ? (p.likedBy as Record<string, boolean>) : {},
      commentsCount: Number(p.commentsCount) || 0,
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
    authorIsVerified: Boolean(payload.authorIsVerified),
    content: cleanContent,
    imageUrl: payload.imageUrl || null,
    timestamp: Date.now(),
    likesCount: 0,
    likedBy: {},
    commentsCount: 0,
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

  // Remove all comments associated with this post
  await remove(ref(database, `postComments/${postId}`));

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
 * Adds a new comment to a post.
 * Writes to `/postComments/{postId}/{commentId}` and atomically increments `commentsCount` on the post.
 */
export async function addPostComment(
  postId: string,
  payload: CreateCommentPayload,
): Promise<string> {
  const cleanContent = payload.content.trim();
  if (!cleanContent) {
    throw new Error('Comment cannot be empty.');
  }
  if (cleanContent.length > 300) {
    throw new Error('Comment cannot exceed 300 characters.');
  }

  const commentsRef = ref(database, `postComments/${postId}`);
  const newCommentRef = push(commentsRef);
  const commentId = newCommentRef.key;
  if (!commentId) {
    throw new Error('Failed to generate comment identifier.');
  }

  const newComment: PostComment = {
    id: commentId,
    postId,
    authorUid: payload.authorUid,
    authorName: payload.authorName,
    authorAvatar: payload.authorAvatar || null,
    authorIsVerified: Boolean(payload.authorIsVerified),
    content: cleanContent,
    imageUrl: payload.imageUrl || null,
    timestamp: Date.now(),
  };

  await set(newCommentRef, newComment);

  // Increment comments count on the post atomically
  const postRef = ref(database, `posts/${postId}`);
  let postAuthorUid = '';
  await runTransaction(postRef, (post: Post | null) => {
    if (post) {
      post.commentsCount = (post.commentsCount || 0) + 1;
      postAuthorUid = post.authorUid;
    }
    return post;
  });

  // Notify post author if commenter is someone else
  if (postAuthorUid && postAuthorUid !== payload.authorUid) {
    try {
      await sendNotification({
        recipientUid: postAuthorUid,
        senderUid: payload.authorUid,
        senderName: payload.authorName,
        senderAvatar: payload.authorAvatar || null,
        type: 'activity',
        title: 'کۆمێنتێکی نوێ 💬',
        body: `${payload.authorName}: ${cleanContent.slice(0, 45)}`,
      });
    } catch {
      // Non-critical notification error
    }
  }

  return commentId;
}

/**
 * Deletes a comment. Allowed if the caller is the comment author OR the post author.
 */
export async function deletePostComment(
  postId: string,
  commentId: string,
  currentUid: string,
): Promise<void> {
  const commentRef = ref(database, `postComments/${postId}/${commentId}`);
  const commentSnap = await get(commentRef);
  if (!commentSnap.exists()) return;

  const comment = commentSnap.val() as PostComment;

  const postSnap = await get(ref(database, `posts/${postId}`));
  const post = postSnap.exists() ? (postSnap.val() as Post) : null;
  const isPostAuthor = post?.authorUid === currentUid;
  const isCommentAuthor = comment.authorUid === currentUid;

  if (!isCommentAuthor && !isPostAuthor) {
    throw new Error('You do not have permission to delete this comment.');
  }

  await remove(commentRef);

  // Atomically decrement comments count on post
  const postCountRef = ref(database, `posts/${postId}/commentsCount`);
  await runTransaction(postCountRef, (count: number | null) => {
    return Math.max(0, (count || 1) - 1);
  });
}

/**
 * Subscribes to real-time comments on a specific post.
 */
export function subscribeToPostComments(
  postId: string,
  onUpdate: (comments: PostComment[]) => void,
): Unsubscribe {
  const commentsRef = ref(database, `postComments/${postId}`);

  return onValue(commentsRef, async (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }

    const raw = snapshot.val();
    const list: PostComment[] = Object.values(raw as Record<string, PostComment>)
      .filter((c): c is PostComment => Boolean(c && typeof c === 'object' && 'id' in c && 'content' in c))
      .map((c) => ({
        id: String(c.id),
        postId: String(c.postId || postId),
        authorUid: String(c.authorUid),
        authorName: String(c.authorName || 'Anonymous'),
        authorAvatar: c.authorAvatar ? String(c.authorAvatar) : null,
        authorIsVerified: Boolean(c.authorIsVerified),
        content: String(c.content),
        timestamp: Number(c.timestamp) || Date.now(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Optionally enrich with latest user profiles
    try {
      const usersSnap = await get(ref(database, 'users'));
      if (usersSnap.exists()) {
        const usersMap = usersSnap.val() as Record<string, any>;
        list.forEach((c) => {
          const u = usersMap[c.authorUid];
          if (u) {
            if (u.avatar || u.profileImage) {
              c.authorAvatar = u.avatar || u.profileImage;
            }
            if (u.isVerified) {
              c.authorIsVerified = true;
            }
          }
        });
      }
    } catch {
      // Fallback to stored comment author info
    }

    onUpdate(list);
  });
}

/**
 * Subscribes to real-time posts feed.
 */
export function subscribeToPosts(
  onUpdate: (posts: Post[]) => void,
): Unsubscribe {
  const postsRef = ref(database, 'posts');

  return onValue(postsRef, async (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
    } else {
      const normalized = normalizePosts(snapshot.val());
      try {
        const usersSnap = await get(ref(database, 'users'));
        if (usersSnap.exists()) {
          const usersMap = usersSnap.val() as Record<string, any>;
          normalized.forEach((p) => {
            const u = usersMap[p.authorUid];
            if (u) {
              if (u.avatar || u.profileImage) {
                p.authorAvatar = u.avatar || u.profileImage;
              }
              if (u.isVerified) {
                p.authorIsVerified = true;
              }
            }
          });
        }
      } catch {
        // Ignore user lookup error and use stored authorAvatar
      }
      onUpdate(normalized);
    }
  });
}
