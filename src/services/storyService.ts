import { ref, push, set, update, onValue, get, remove, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { Story, StoryGroup } from '../types';

const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Creates a new story for a user under `/stories/{authorUid}/{storyId}`.
 */
export async function createStory(params: {
  authorUid: string;
  authorName: string;
  authorAvatar?: string | null;
  type: 'text' | 'image';
  content: string;
  bgColor?: string;
}): Promise<string> {
  const storiesRef = ref(database, `stories/${params.authorUid}`);
  const newRef = push(storiesRef);
  const id = newRef.key!;
  const now = Date.now();

  const story: Story = {
    id,
    authorUid: params.authorUid,
    authorName: params.authorName,
    authorAvatar: params.authorAvatar || null,
    type: params.type,
    content: params.content,
    bgColor: params.bgColor,
    viewerUids: [],
    expiresAt: now + STORY_TTL_MS,
    timestamp: now,
  };

  await set(newRef, story);
  return id;
}

/**
 * Records that a user viewed a story.
 */
export async function markStoryViewed(
  authorUid: string,
  storyId: string,
  viewerUid: string,
): Promise<void> {
  const viewRef = ref(database, `stories/${authorUid}/${storyId}/viewerUids/${viewerUid}`);
  await set(viewRef, true);
}

/**
 * Deletes a story (author only).
 */
export async function deleteStory(authorUid: string, storyId: string): Promise<void> {
  const storyRef = ref(database, `stories/${authorUid}/${storyId}`);
  await remove(storyRef);
}

/**
 * Subscribes to all active (non-expired) stories across all users.
 * Groups them by author into StoryGroup[] for the stories bar.
 */
export function subscribeToAllStories(
  currentUid: string,
  callback: (groups: StoryGroup[]) => void,
): Unsubscribe {
  const storiesRef = ref(database, 'stories');
  return onValue(storiesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const now = Date.now();
    const groups: StoryGroup[] = [];

    snapshot.forEach((authorSnap) => {
      const activeStories: Story[] = [];

      authorSnap.forEach((storySnap) => {
        const raw = storySnap.val();
        if (!raw || !raw.id) return;

        // Reconstruct viewerUids array from map
        const viewerMap = raw.viewerUids || {};
        const viewerUids = typeof viewerMap === 'object' && !Array.isArray(viewerMap)
          ? Object.keys(viewerMap)
          : (Array.isArray(viewerMap) ? viewerMap : []);

        const story: Story = { ...raw, viewerUids };

        // Filter expired stories
        if (story.expiresAt > now) {
          activeStories.push(story);
        }
      });

      if (activeStories.length > 0) {
        activeStories.sort((a, b) => a.timestamp - b.timestamp);
        const first = activeStories[0];
        const hasUnread = activeStories.some(
          (s) => !s.viewerUids.includes(currentUid),
        );

        groups.push({
          authorUid: first.authorUid,
          authorName: first.authorName,
          authorAvatar: first.authorAvatar || null,
          stories: activeStories,
          hasUnread,
        });
      }
    });

    // Sort: current user's stories first, then by recency
    groups.sort((a, b) => {
      if (a.authorUid === currentUid) return -1;
      if (b.authorUid === currentUid) return 1;
      const aLatest = Math.max(...a.stories.map((s) => s.timestamp));
      const bLatest = Math.max(...b.stories.map((s) => s.timestamp));
      return bLatest - aLatest;
    });

    callback(groups);
  });
}
