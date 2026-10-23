import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Send,
  Eye,
} from 'lucide-react';
import type { User, Story, StoryGroup } from '../types';
import { useLanguage } from '../contexts';
import {
  createStory,
  markStoryViewed,
  deleteStory,
  subscribeToAllStories,
} from '../services';

interface StoriesBarProps {
  currentUser: User;
}

const BG_GRADIENTS = [
  'from-amber-600 to-yellow-600',
  'from-violet-600 to-indigo-800',
  'from-emerald-600 to-teal-800',
  'from-rose-600 to-pink-800',
  'from-cyan-600 to-blue-800',
];

export default function StoriesBar({ currentUser }: StoriesBarProps) {
  const { tr } = useLanguage();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [activeViewerGroup, setActiveViewerGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Story Creation Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [storyType, setStoryType] = useState<'text' | 'image'>('text');
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllStories(currentUser.uid, (groups) => {
      setStoryGroups(groups);
    });
    return () => unsub();
  }, [currentUser.uid]);

  // Handle opening viewer
  const handleOpenGroup = (group: StoryGroup) => {
    setActiveViewerGroup(group);
    setActiveStoryIndex(0);
    if (group.stories[0]) {
      markStoryViewed(group.authorUid, group.stories[0].id, currentUser.uid);
    }
  };

  // Step story
  const handleNextStory = () => {
    if (!activeViewerGroup) return;
    if (activeStoryIndex < activeViewerGroup.stories.length - 1) {
      const nextIdx = activeStoryIndex + 1;
      setActiveStoryIndex(nextIdx);
      markStoryViewed(
        activeViewerGroup.authorUid,
        activeViewerGroup.stories[nextIdx].id,
        currentUser.uid,
      );
    } else {
      setActiveViewerGroup(null);
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
    }
  };

  // Auto-advance timer
  useEffect(() => {
    if (!activeViewerGroup) return;
    const timer = setTimeout(() => {
      handleNextStory();
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeViewerGroup, activeStoryIndex]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = storyType === 'text' ? textContent.trim() : imageUrl.trim();
    if (!content) return;

    setIsPublishing(true);
    try {
      await createStory({
        authorUid: currentUser.uid,
        authorName: currentUser.username,
        authorAvatar: currentUser.avatar || currentUser.profileImage || null,
        type: storyType,
        content,
        bgColor: selectedBg,
      });

      setTextContent('');
      setImageUrl('');
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Failed to create story:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteActiveStory = async () => {
    if (!activeViewerGroup) return;
    const currentStory = activeViewerGroup.stories[activeStoryIndex];
    if (!currentStory) return;

    if (!window.confirm(tr('ئەم ستۆرییە بسڕدرێتەوە؟', 'Delete this story?'))) return;

    try {
      await deleteStory(currentUser.uid, currentStory.id);
      setActiveViewerGroup(null);
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  return (
    <div className="w-full">
      {/* Horizontal Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1 scrollbar-none">
        {/* + Add Story Bubble */}
        <div
          onClick={() => setIsCreateOpen(true)}
          className="group flex flex-col items-center cursor-pointer shrink-0"
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/50 bg-slate-900/80 transition group-hover:border-amber-400 group-hover:scale-105">
            {currentUser.avatar || currentUser.profileImage ? (
              <img
                src={currentUser.avatar || currentUser.profileImage}
                alt={currentUser.username}
                className="h-full w-full rounded-2xl object-cover opacity-70"
              />
            ) : (
              <span className="font-bold text-xs text-white opacity-70">
                {currentUser.username.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black shadow-md">
              <Plus className="h-3.5 w-3.5" />
            </div>
          </div>
          <span className="mt-1.5 truncate max-w-[60px] text-[10px] font-bold text-slate-300">
            ستۆری نوێ
          </span>
        </div>

        {/* Existing Story Groups */}
        {storyGroups.map((group) => {
          const isMe = group.authorUid === currentUser.uid;

          return (
            <div
              key={group.authorUid}
              onClick={() => handleOpenGroup(group)}
              className="group flex flex-col items-center cursor-pointer shrink-0"
            >
              <div
                className={`relative flex h-14 w-14 items-center justify-center rounded-2xl p-0.5 transition group-hover:scale-105 ${
                  group.hasUnread
                    ? 'bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-600 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800'
                }`}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-slate-950 font-bold text-xs text-white">
                  {group.authorAvatar ? (
                    <img
                      src={group.authorAvatar}
                      alt={group.authorName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    group.authorName.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
              <span className="mt-1.5 truncate max-w-[65px] text-[10px] font-medium text-slate-300">
                {isMe ? tr('ستۆری تۆ', 'Your Story') : group.authorName}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── CREATE STORY MODAL ── */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-900 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h3 className="font-display text-xs font-bold text-white uppercase tracking-wider">
                    {tr("دروستکردنی ستۆری ٢٤ کاتژمێری", "Create 24h Story")}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Type Switcher */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStoryType('text')}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    storyType === 'text'
                      ? 'border border-amber-400 bg-amber-400/15 text-amber-300'
                      : 'border border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  کارتی نووسین
                </button>
                <button
                  type="button"
                  onClick={() => setStoryType('image')}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    storyType === 'image'
                      ? 'border border-amber-400 bg-amber-400/15 text-amber-300'
                      : 'border border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  ستۆری وێنە
                </button>
              </div>

              <form onSubmit={handleCreate} className="mt-4 space-y-3">
                {storyType === 'text' ? (
                  <>
                    <div
                      className={`flex h-44 w-full items-center justify-center rounded-2xl bg-gradient-to-tr p-4 text-center shadow-inner ${selectedBg}`}
                    >
                      <textarea
                        rows={3}
                        maxLength={180}
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder={tr("ئەمڕۆ چی لە ژوورەکەت ڕوودەدات؟...", "What is happening in your room today?...")}
                        className="w-full resize-none bg-transparent text-sm font-bold text-white placeholder-white/60 outline-none text-center"
                      />
                    </div>

                    {/* Gradient Pickers */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {BG_GRADIENTS.map((bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => setSelectedBg(bg)}
                          className={`h-6 w-6 rounded-full bg-gradient-to-tr transition ${bg} ${
                            selectedBg === bg ? 'ring-2 ring-white scale-110' : 'opacity-70'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder={tr("بەستەری وێنە لێرە دابنێ (https://...)", "Paste image URL here (https://...)")}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                    />
                    {imageUrl && (
                      <div className="mt-2 h-44 w-full overflow-hidden rounded-2xl border border-slate-800">
                        <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPublishing || (storyType === 'text' ? !textContent.trim() : !imageUrl.trim())}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/20 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isPublishing ? tr('خەریکی بڵاوکردنەوەیە...', 'Publishing...') : tr('بڵاوکردنەوە بۆ ٢٤ کاتژمێر', 'Publish for 24 Hours')}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── STORY VIEWER FULLSCREEN OVERLAY ── */}
      <AnimatePresence>
        {activeViewerGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg">
            <div className="relative flex h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
              {/* Progress Bars */}
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1">
                {activeViewerGroup.stories.map((s, idx) => (
                  <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className={`h-full bg-white transition-all ${
                        idx < activeStoryIndex
                          ? 'w-full'
                          : idx === activeStoryIndex
                          ? 'w-full duration-[5000ms] ease-linear'
                          : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Author Header */}
              <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white shadow">
                    {activeViewerGroup.authorAvatar ? (
                      <img
                        src={activeViewerGroup.authorAvatar}
                        alt={activeViewerGroup.authorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      activeViewerGroup.authorName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white drop-shadow">
                      {activeViewerGroup.authorName}
                    </h4>
                    <span className="text-[9px] text-white/70 drop-shadow">{tr("ستۆری ٢٤ کاتژمێری", "24h Story")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeViewerGroup.authorUid === currentUser.uid && (
                    <button
                      onClick={handleDeleteActiveStory}
                      className="rounded-full p-1.5 text-white/80 hover:text-rose-400 bg-black/30 backdrop-blur-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setActiveViewerGroup(null)}
                    className="rounded-full p-1.5 text-white bg-black/30 backdrop-blur-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Story Content */}
              {(() => {
                const story = activeViewerGroup.stories[activeStoryIndex];
                if (!story) return null;

                if (story.type === 'image') {
                  return (
                    <img
                      src={story.content}
                      alt="Story"
                      className="h-full w-full object-cover"
                    />
                  );
                }

                return (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-tr p-8 text-center ${
                      story.bgColor || BG_GRADIENTS[0]
                    }`}
                  >
                    <p className="text-base font-bold text-white leading-relaxed whitespace-pre-wrap">
                      {story.content}
                    </p>
                  </div>
                );
              })()}

              {/* Navigation Tap Zones */}
              <button
                onClick={handlePrevStory}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/40 hover:text-white bg-black/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button
                onClick={handleNextStory}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/40 hover:text-white bg-black/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
