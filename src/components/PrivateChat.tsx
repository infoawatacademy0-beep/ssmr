import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, onValue } from 'firebase/database';
import { database } from '../config/firebase';
import {
  Send,
  ImagePlus,
  Mic,
  X,
  Clock,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Radio,
  Sparkles,
  Crown,
  Smile,
  Palette,
  Trash2,
  Check,
  Loader2,
  Camera,
  Link as LinkIcon,
} from 'lucide-react';
import type { User, DirectMessage } from '../types';
import { useLanguage } from '../contexts';
import {
  getThreadId,
  sendDirectMessage,
  subscribeToDirectMessages,
  subscribeToUserPresence,
  subscribeToFollowState,
  followUser,
  unfollowUser,
} from '../services';
import { uploadImageToImgBB } from '../services/imgbbService';
import { getChatThemeById, type ChatTheme } from '../constants/chatThemes';

import ReportModal from './ReportModal';
import { SeatEmojiPickerModal } from './SeatEmojiSystem';
import ChatAudioPlayer from './ChatAudioPlayer';
import ChatThemeModal from './ChatThemeModal';
import ImageLightboxModal from './ImageLightboxModal';
import { renderTextWithLinks } from '../utils/linkify';

interface PrivateChatProps {
  currentUser: User;
  recipientUser: { uid: string; username: string; avatar?: string | null };
  onClose: () => void;
}

function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PrivateChat({
  currentUser,
  recipientUser,
  onClose,
}: PrivateChatProps) {
  const { tr } = useLanguage();
  const threadId = getThreadId(currentUser.uid, recipientUser.uid);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Chat Theme & Wallpaper State
  const [themeId, setThemeId] = useState<string>(() => {
    return (
      localStorage.getItem(`ssmr_chat_theme_${threadId}`) ||
      localStorage.getItem('ssmr_chat_theme_default') ||
      'inferno_fire'
    );
  });
  const [customWallpaper, setCustomWallpaper] = useState<string>(() => {
    return localStorage.getItem(`ssmr_chat_wallpaper_${threadId}`) || '';
  });
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => {
    const saved = localStorage.getItem(`ssmr_chat_wallpaper_opacity_${threadId}`);
    return saved ? Number(saved) : 25;
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  const currentTheme: ChatTheme = getChatThemeById(themeId);

  // Presence State
  const [presence, setPresence] = useState<{ isOnline: boolean; lastSeen: number; statusText: string }>({
    isOnline: false,
    lastSeen: Date.now(),
    statusText: 'Connecting…',
  });

  // Live Recipient Profile Avatar & VIP State
  const [recipientLiveAvatar, setRecipientLiveAvatar] = useState<string | null>(
    recipientUser.avatar || null,
  );
  const [recipientIsVip, setRecipientIsVip] = useState<boolean>(false);

  useEffect(() => {
    const userRef = ref(database, `users/${recipientUser.uid}`);
    const unsub = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        if (val.avatar || val.profileImage) {
          setRecipientLiveAvatar(val.avatar || val.profileImage);
        }
        setRecipientIsVip(Boolean(val.isVerified));
      }
    });
    return () => unsub();
  }, [recipientUser.uid]);

  // Follow State
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);

  // Image Upload / Attachment State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImageUrlModalOpen, setIsImageUrlModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Voice Memo Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Moderation Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 1. Subscribe to real-time direct messages
  useEffect(() => {
    const unsubscribe = subscribeToDirectMessages(threadId, (updatedMessages) => {
      setMessages(updatedMessages);
    });
    return () => unsubscribe();
  }, [threadId]);

  // 2. Subscribe to recipient's live presence
  useEffect(() => {
    const unsubscribe = subscribeToUserPresence(recipientUser.uid, (pres) => {
      setPresence(pres);
    });
    return () => unsubscribe();
  }, [recipientUser.uid]);

  // 3. Subscribe to mutual follow status
  useEffect(() => {
    const unsubscribe = subscribeToFollowState(currentUser.uid, recipientUser.uid, (following) => {
      setIsFollowing(following);
    });
    return () => unsubscribe();
  }, [currentUser.uid, recipientUser.uid]);

  // 4. Auto-scroll on new message
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Theme updates
  const handleSelectTheme = (newId: string) => {
    setThemeId(newId);
    localStorage.setItem(`ssmr_chat_theme_${threadId}`, newId);
    localStorage.setItem('ssmr_chat_theme_default', newId);
  };

  const handleSetCustomWallpaper = (url: string) => {
    setCustomWallpaper(url);
    localStorage.setItem(`ssmr_chat_wallpaper_${threadId}`, url);
  };

  const handleSetWallpaperOpacity = (op: number) => {
    setWallpaperOpacity(op);
    localStorage.setItem(`ssmr_chat_wallpaper_opacity_${threadId}`, String(op));
  };

  // Follow Toggle
  const handleToggleFollow = async () => {
    if (isTogglingFollow) return;
    setIsTogglingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, recipientUser.uid);
      } else {
        await followUser(currentUser.uid, recipientUser.uid);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    } finally {
      setIsTogglingFollow(false);
    }
  };

  // Send Text Message
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      await sendDirectMessage({
        threadId,
        senderUid: currentUser.uid,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatar || currentUser.profileImage || null,
        recipientUid: recipientUser.uid,
        recipientName: recipientUser.username,
        recipientAvatar: recipientUser.avatar || null,
        text,
        type: 'text',
      });
      setInputText('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  // Select Image File from Device
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(tr('تکایە تەنها وێنە هەڵبژێرە.', 'Please select an image file.'));
      return;
    }
    setSelectedImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setSelectedImagePreview(objectUrl);
    e.target.value = '';
  };

  // Paste image from clipboard
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setSelectedImageFile(file);
          setSelectedImagePreview(URL.createObjectURL(file));
          e.preventDefault();
          break;
        }
      }
    }
  };

  // Send Selected Image File
  const handleSendImageFile = async () => {
    if (!selectedImageFile || isUploadingImage) return;

    setIsUploadingImage(true);
    try {
      let finalImageUrl = '';

      try {
        finalImageUrl = await uploadImageToImgBB(
          selectedImageFile,
          `chat_${threadId}_${Date.now()}`,
        );
      } catch (uploadErr) {
        console.warn('ImgBB upload fallback to Base64:', uploadErr);
        // Fallback to Base64 data URL
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedImageFile);
        });
      }

      await sendDirectMessage({
        threadId,
        senderUid: currentUser.uid,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatar || currentUser.profileImage || null,
        recipientUid: recipientUser.uid,
        recipientName: recipientUser.username,
        recipientAvatar: recipientUser.avatar || null,
        imageUrl: finalImageUrl,
        text: imageCaption.trim() || undefined,
        type: 'image',
      });

      setSelectedImageFile(null);
      setSelectedImagePreview(null);
      setImageCaption('');
    } catch (err: any) {
      alert(err.message || tr('نەتوانرا وێنەکە بنێردرێت.', 'Failed to send image.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Send Image via URL link
  const handleSendImageUrl = async () => {
    const imgUrl = imageUrlInput.trim();
    if (!imgUrl) return;

    setIsSending(true);
    try {
      await sendDirectMessage({
        threadId,
        senderUid: currentUser.uid,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatar || currentUser.profileImage || null,
        recipientUid: recipientUser.uid,
        recipientName: recipientUser.username,
        recipientAvatar: recipientUser.avatar || null,
        imageUrl: imgUrl,
        type: 'image',
      });
      setImageUrlInput('');
      setIsImageUrlModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to send image.');
    } finally {
      setIsSending(false);
    }
  };

  // Voice Memo: Start Recording
  const handleStartRecording = async () => {
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        let selectedMime = '';
        for (const m of mimeTypes) {
          if (MediaRecorder.isTypeSupported(m)) {
            selectedMime = m;
            break;
          }
        }

        const mediaRecorder = selectedMime
          ? new MediaRecorder(stream, { mimeType: selectedMime })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(200);
        setIsRecordingVoice(true);

        recordingTimerRef.current = window.setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } else {
        throw new Error('MediaRecorder not available');
      }
    } catch (err: any) {
      console.error('Microphone error:', err);
      alert(
        tr(
          'نەتوانرا دەست بە مایک بگات. تکایە مۆڵەتی مایک بدە لە وێبگەڕەکەتدا.',
          'Microphone access denied. Please allow microphone permissions in browser.',
        ),
      );
    }
  };

  // Voice Memo: Cancel Recording
  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  // Voice Memo: Stop Recording and Send
  const handleStopRecordingAndSend = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds;
    setIsRecordingVoice(false);
    setIsSending(true);

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mime });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await sendDirectMessage({
              threadId,
              senderUid: currentUser.uid,
              senderName: currentUser.username,
              senderAvatar: currentUser.avatar || currentUser.profileImage || null,
              recipientUid: recipientUser.uid,
              recipientName: recipientUser.username,
              recipientAvatar: recipientUser.avatar || null,
              audioUrl: base64Audio,
              duration,
              type: 'voice',
            });
            setIsSending(false);
            setRecordingSeconds(0);
          };
          mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
        };
        mediaRecorderRef.current.stop();
      } else {
        setIsSending(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record voice memo.');
      setIsSending(false);
      setRecordingSeconds(0);
    }
  };

  return (
    <div
      onPaste={handleContainerPaste}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`relative flex h-full w-full max-w-md flex-col border-l border-white/10 shadow-2xl overflow-hidden ${currentTheme.containerBg}`}
      >
        {/* Custom Background Wallpaper Layer */}
        {customWallpaper && (
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none z-0"
            style={{
              backgroundImage: `url(${customWallpaper})`,
              opacity: wallpaperOpacity / 100,
            }}
          />
        )}

        {/* ── CHAT HEADER ── */}
        <header
          className={`relative z-10 flex items-center justify-between border-b p-4 backdrop-blur-xl ${currentTheme.headerBg}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md ${
                recipientIsVip ? 'border-2 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : ''
              }`}
            >
              <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                {recipientLiveAvatar || recipientUser.avatar ? (
                  <img
                    src={recipientLiveAvatar || recipientUser.avatar || ''}
                    alt={recipientUser.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  recipientUser.username.charAt(0).toUpperCase()
                )}
              </div>
              {recipientIsVip && (
                <span className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow">
                  <Crown className="h-2.5 w-2.5 text-black fill-black" strokeWidth={2.5} />
                </span>
              )}
              {/* Presence Indicator Dot */}
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-slate-950 ${
                  presence.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-white">
                {recipientUser.username}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] font-medium">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    presence.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                <span className={presence.isOnline ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {presence.isOnline ? tr('ئۆنلاینە', 'Online') : tr('ئۆفلاینە', 'Offline')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme & Wallpaper Settings Button */}
            <button
              onClick={() => setIsThemeModalOpen(true)}
              title={tr('ڕووکار و باکگراوندی چات', 'Chat Themes & Wallpaper')}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-amber-300 transition hover:bg-white/[0.1] hover:scale-105 active:scale-95"
            >
              <Palette className="h-4 w-4" />
            </button>

            {/* Mutual Follow Button */}
            <button
              onClick={handleToggleFollow}
              disabled={isTogglingFollow}
              title={isFollowing ? tr('فۆڵۆکراوە', 'Following') : tr('فۆڵۆکردن', 'Follow')}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                isFollowing
                  ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
              }`}
            >
              {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">
                {isFollowing ? tr('فۆڵۆکراوە', 'Following') : tr('فۆڵۆکردن', 'Follow')}
              </span>
            </button>

            {/* Moderation Report Button */}
            <button
              onClick={() => setIsReportModalOpen(true)}
              title={tr('ناردنی ڕاپۆرت', 'Report User')}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
            >
              <ShieldAlert className="h-4 w-4" />
            </button>

            {/* Close Slider Button */}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── MESSAGES STREAM ── */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-amber-400 mb-2">
                <Radio className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-bold text-white">
                {tr('کەناڵی تایبەتی ڕاستەوخۆ', 'Direct Private Channel')}
              </h4>
              <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                {tr(
                  'پەیوەندی تایبەت و پارێزراو. نامە، بەستەری وێنە و تۆماری دەنگی ئاڵوگۆڕ بکە.',
                  'Private & secure connection. Exchange messages, images and voice memos.',
                )}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderUid === currentUser.uid;
              const senderAvatarUrl = isMine
                ? currentUser.avatar || currentUser.profileImage || msg.senderAvatar || null
                : recipientLiveAvatar || recipientUser.avatar || msg.senderAvatar || null;
              const isSenderVip = isMine ? Boolean(currentUser.isVerified) : recipientIsVip;
              const isEmojiOnly = Boolean(
                msg.text &&
                  msg.text.trim().length <= 20 &&
                  /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(msg.text.trim()),
              );
              const senderInitial = (isMine ? currentUser.username : recipientUser.username)
                .charAt(0)
                .toUpperCase();

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Sender Profile Picture in Chat */}
                  <div
                    className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-[11px] font-black text-white shadow ${
                      isSenderVip
                        ? 'border-2 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                        : 'border border-white/15'
                    }`}
                  >
                    <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                      {senderAvatarUrl ? (
                        <img
                          src={senderAvatarUrl}
                          alt={isMine ? currentUser.username : recipientUser.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        senderInitial
                      )}
                    </div>
                    {isSenderVip && (
                      <span className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 shadow">
                        <Crown className="h-2 w-2 text-black fill-black" strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  <div className={`flex flex-col max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-3xl p-3 shadow-md backdrop-blur-sm ${
                        isMine
                          ? `${currentTheme.myBubbleClass} rounded-br-sm`
                          : `${currentTheme.theirBubbleClass} rounded-bl-sm`
                      }`}
                    >
                      {/* Variant 1: Text message */}
                      {isEmojiOnly && msg.type === 'text' && (
                        <div className="text-3xl sm:text-4xl py-1 inline-block tracking-wider select-none drop-shadow">
                          {msg.text}
                        </div>
                      )}
                      {!isEmojiOnly && msg.type === 'text' && (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans break-words">
                          {renderTextWithLinks(msg.text)}
                        </p>
                      )}

                      {/* Variant 2: Image attachment message */}
                      {msg.type === 'image' && msg.imageUrl && (
                        <div className="space-y-1.5">
                          <div
                            onClick={() => setLightboxImageUrl(msg.imageUrl!)}
                            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10"
                          >
                            <img
                              src={msg.imageUrl}
                              alt="Attachment"
                              className="max-h-56 w-full rounded-2xl object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold drop-shadow">
                              {tr('کلیک بکە بۆ گەورەکردن', 'Click to expand')}
                            </div>
                          </div>
                          {msg.text && (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap pt-0.5">{renderTextWithLinks(msg.text)}</p>
                          )}
                        </div>
                      )}

                      {/* Variant 3: Voice memo message */}
                      {msg.type === 'voice' && msg.audioUrl && (
                        <ChatAudioPlayer
                          audioUrl={msg.audioUrl}
                          duration={msg.duration}
                          isMine={isMine}
                          accentColor={currentTheme.accentHex}
                        />
                      )}
                    </div>

                    <span className="mt-1 px-1.5 text-[9px] text-slate-400 font-medium opacity-80">
                      {formatChatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatScrollRef} />
        </div>

        {/* ── IMAGE ATTACHMENT PREVIEW DRAWER ── */}
        <AnimatePresence>
          {selectedImagePreview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative z-20 border-t border-white/10 bg-slate-950/95 p-3.5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" />
                  <span>{tr('ناردنی وێنە', 'Send Image')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImageFile(null);
                    setSelectedImagePreview(null);
                    setImageCaption('');
                  }}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-3 items-center">
                <img
                  src={selectedImagePreview}
                  alt="Preview"
                  className="h-20 w-20 rounded-2xl object-cover border border-amber-400/30 shadow-md shrink-0"
                />

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder={tr('کورتەیەک بنووسە لەگەڵ وێنەکە…', 'Add a caption…')}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImageFile(null);
                        setSelectedImagePreview(null);
                        setImageCaption('');
                      }}
                      className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300"
                    >
                      {tr('پاشگەزبوونەوە', 'Cancel')}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendImageFile}
                      disabled={isUploadingImage}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-1.5 text-xs font-black text-black shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{tr('خەریکی ناردنە…', 'Sending…')}</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>{tr('ناردنی وێنە', 'Send')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── IMAGE URL LINK MODAL ── */}
        <AnimatePresence>
          {isImageUrlModalOpen && (
            <div className="relative z-20 border-t border-white/10 bg-slate-950/95 p-3.5 backdrop-blur-xl">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  <span>{tr('هاوپێچکردنی بەستەری وێنە', 'Attach Image Link')}</span>
                </span>
                <button
                  onClick={() => setIsImageUrlModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/…"
                  className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleSendImageUrl}
                  disabled={!imageUrlInput.trim()}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                >
                  {tr('ناردن', 'Send')}
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ── VOICE RECORDING BANNER ── */}
        {isRecordingVoice && (
          <div className="relative z-20 flex items-center justify-between border-t border-rose-500/30 bg-rose-950/80 px-4 py-3 text-rose-200 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
              <div className="flex items-center gap-1 font-mono text-xs font-black">
                <Mic className="h-3.5 w-3.5 text-rose-400" />
                <span>
                  {Math.floor(recordingSeconds / 60)}:
                  {recordingSeconds % 60 < 10 ? '0' : ''}
                  {recordingSeconds % 60}
                </span>
              </div>
              <span className="text-[11px] font-medium text-rose-300">
                {tr('خەریکی تۆمارکردنە…', 'Recording audio…')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                title={tr('پاشگەزبوونەوە و سڕینەوە', 'Discard')}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleStopRecordingAndSend}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1.5 text-xs font-black text-white shadow-md shadow-emerald-500/25 active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{tr('تەواو و ناردن', 'Send Memo')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── CHAT INPUT COMPOSER ── */}
        <footer
          className={`relative z-10 border-t p-3 backdrop-blur-xl ${currentTheme.footerBg}`}
        >
          {/* Hidden File Input for Device Image Selection */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <form onSubmit={handleSendText} className="flex items-center gap-1.5 sm:gap-2">
            {/* Image from device button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={tr('هەڵبژاردنی وێنە لە مۆبایل/ئامێر', 'Upload Image from Device')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:border-amber-400/40 hover:text-amber-300 active:scale-95"
            >
              <ImagePlus className="h-4 w-4" />
            </button>

            {/* Voice Memo Button */}
            <button
              type="button"
              onClick={isRecordingVoice ? handleStopRecordingAndSend : handleStartRecording}
              title={
                isRecordingVoice
                  ? tr('وەستاندنی تۆمارکردن', 'Stop Recording')
                  : tr('تۆمارکردنی دەنگ', 'Record Voice Memo')
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                isRecordingVoice
                  ? 'border-rose-500 bg-rose-500/30 text-rose-300 animate-pulse'
                  : 'border-white/10 bg-white/[0.05] text-slate-300 hover:border-amber-400/40 hover:text-amber-300 active:scale-95'
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Mobile Emoji Button */}
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              title={tr('ئیمۆجی', 'Emojis')}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                isEmojiPickerOpen
                  ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-md shadow-amber-400/20'
                  : 'border-white/10 bg-white/[0.05] text-slate-300 hover:border-amber-400/40 hover:text-amber-300 active:scale-95'
              }`}
            >
              <Smile className="h-4 w-4" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={tr('نامەی تایبەتی بنووسە…', 'Write a private message…')}
              disabled={isRecordingVoice}
              className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isSending || isRecordingVoice}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-md shadow-amber-500/25 transition disabled:opacity-40 hover:brightness-110 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </motion.div>

      {/* ── THEME & WALLPAPER SETTINGS MODAL ── */}
      <AnimatePresence>
        {isThemeModalOpen && (
          <ChatThemeModal
            currentThemeId={themeId}
            customWallpaperUrl={customWallpaper}
            wallpaperOpacity={wallpaperOpacity}
            onSelectTheme={handleSelectTheme}
            onSetCustomWallpaper={handleSetCustomWallpaper}
            onSetWallpaperOpacity={handleSetWallpaperOpacity}
            onClose={() => setIsThemeModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── IMAGE LIGHTBOX FULLSCREEN MODAL ── */}
      <AnimatePresence>
        {lightboxImageUrl && (
          <ImageLightboxModal
            imageUrl={lightboxImageUrl}
            senderName={recipientUser.username}
            onClose={() => setLightboxImageUrl(null)}
          />
        )}
      </AnimatePresence>

      {/* ── MOBILE EMOJI PICKER MODAL ── */}
      <SeatEmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelectMobileEmoji={(emoji) => {
          setInputText((prev) => prev + emoji);
        }}
        isVip={Boolean(currentUser.isVerified || currentUser.isAdmin)}
        initialTab="mobile"
      />

      {/* ── MODERATION REPORT MODAL ── */}
      <AnimatePresence>
        {isReportModalOpen && (
          <ReportModal
            targetId={recipientUser.uid}
            targetType="user"
            targetName={recipientUser.username}
            reporterUid={currentUser.uid}
            reporterName={currentUser.username}
            onClose={() => setIsReportModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
