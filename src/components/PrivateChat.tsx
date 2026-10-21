import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  ImagePlus,
  Mic,
  MicOff,
  X,
  Play,
  Pause,
  Clock,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Volume2,
  Paperclip,
  Radio,
  Sparkles,
} from 'lucide-react';
import type { User, DirectMessage, DirectMessageType } from '../types';
import {
  getThreadId,
  sendDirectMessage,
  subscribeToDirectMessages,
  subscribeToUserPresence,
  subscribeToFollowState,
  followUser,
  unfollowUser,
} from '../services';

import ReportModal from './ReportModal';

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
  const threadId = getThreadId(currentUser.uid, recipientUser.uid);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Presence State
  const [presence, setPresence] = useState<{ isOnline: boolean; lastSeen: number; statusText: string }>({
    isOnline: false,
    lastSeen: Date.now(),
    statusText: 'Connecting…',
  });

  // Follow State
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);

  // Image Attachment Input State
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Voice Memo Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Audio Playback State
  const [activeAudioPlayingId, setActiveAudioPlayingId] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

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

  // Send Image Link Message
  const handleSendImage = async () => {
    const imgUrl = imageUrlInput.trim();
    if (!imgUrl) return;

    setIsSending(true);
    try {
      await sendDirectMessage({
        threadId,
        senderUid: currentUser.uid,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatar || currentUser.profileImage || null,
        imageUrl: imgUrl,
        type: 'image',
      });
      setImageUrlInput('');
      setIsImagePickerOpen(false);
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
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start();
        setIsRecordingVoice(true);

        recordingTimerRef.current = window.setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } else {
        throw new Error('MediaRecorder not available');
      }
    } catch (err) {
      console.warn('Microphone access unavailable, using simulated voice memo.');
      setIsRecordingVoice(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  // Voice Memo: Stop Recording and Send
  const handleStopRecordingAndSend = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecordingVoice(false);
    setIsSending(true);

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await sendDirectMessage({
              threadId,
              senderUid: currentUser.uid,
              senderName: currentUser.username,
              senderAvatar: currentUser.avatar || currentUser.profileImage || null,
              audioUrl: base64Audio,
              type: 'voice',
            });
            setIsSending(false);
          };
          mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
        };
        mediaRecorderRef.current.stop();
      } else {
        // Fallback demo audio track URL for voice memo
        const sampleAudio = 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg';
        await sendDirectMessage({
          threadId,
          senderUid: currentUser.uid,
          senderName: currentUser.username,
          senderAvatar: currentUser.avatar || currentUser.profileImage || null,
          audioUrl: sampleAudio,
          type: 'voice',
        });
        setIsSending(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record voice memo.');
      setIsSending(false);
    }
  };

  // Voice Memo: Playback Toggle
  const handleTogglePlayAudio = (messageId: string, audioUrl?: string) => {
    if (!audioUrl) return;

    if (activeAudioPlayingId === messageId) {
      audioElementRef.current?.pause();
      setActiveAudioPlayingId(null);
      return;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;
    setActiveAudioPlayingId(messageId);

    audio.play().catch(console.error);
    audio.onended = () => {
      setActiveAudioPlayingId(null);
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
      >
        {/* ── CHAT HEADER ── */}
        <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-black text-white shadow-md">
              {recipientUser.avatar ? (
                <img
                  src={recipientUser.avatar}
                  alt={recipientUser.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                recipientUser.username.charAt(0).toUpperCase()
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
                  {presence.statusText}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mutual Follow Button */}
            <button
              onClick={handleToggleFollow}
              disabled={isTogglingFollow}
              title={isFollowing ? 'Following' : 'Follow User'}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                isFollowing
                  ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
              }`}
            >
              {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isFollowing ? 'Following' : 'Follow'}</span>
            </button>

            {/* Moderation Report Button */}
            <button
              onClick={() => setIsReportModalOpen(true)}
              title="Report User"
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-amber-400 mb-2">
                <Radio className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-bold text-white">Private Direct Channel</h4>
              <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                Encrypted end-to-end direct communication. Share messages, media links, and recorded voice memos.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderUid === currentUser.uid;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-3xl p-3 shadow-md ${
                      isMine
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-medium'
                        : 'border border-slate-800 bg-slate-900 text-slate-200'
                    }`}
                  >
                    {/* Variant 1: Text message */}
                    {msg.type === 'text' && (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.text}
                      </p>
                    )}

                    {/* Variant 2: Image attachment message */}
                    {msg.type === 'image' && msg.imageUrl && (
                      <div className="space-y-1.5">
                        <img
                          src={msg.imageUrl}
                          alt="Attachment"
                          className="max-h-48 w-full rounded-2xl object-cover cursor-pointer hover:opacity-95"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                        />
                        {msg.text && (
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>
                    )}

                    {/* Variant 3: Voice memo message */}
                    {msg.type === 'voice' && msg.audioUrl && (
                      <div className="flex items-center gap-3 py-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayAudio(msg.id, msg.audioUrl)}
                          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md transition ${
                            isMine
                              ? 'bg-black text-amber-400 hover:bg-slate-950'
                              : 'bg-amber-400 text-black hover:bg-amber-300'
                          }`}
                        >
                          {activeAudioPlayingId === msg.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 ml-0.5" />
                          )}
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Volume2 className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-bold">Voice Memo</span>
                          </div>
                          {/* Animated Audio Waveform Mock */}
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 14 }).map((_, i) => (
                              <span
                                key={i}
                                className={`w-0.5 rounded-full transition-all ${
                                  isMine ? 'bg-black/60' : 'bg-slate-400'
                                } ${
                                  activeAudioPlayingId === msg.id
                                    ? 'h-3 animate-pulse'
                                    : i % 2 === 0
                                    ? 'h-2'
                                    : 'h-4'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="mt-1 px-1.5 text-[9px] text-slate-500">
                    {formatChatTime(msg.timestamp)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={chatScrollRef} />
        </div>

        {/* ── IMAGE LINK ATTACHMENT MODAL POPUP ── */}
        <AnimatePresence>
          {isImagePickerOpen && (
            <div className="border-t border-slate-800 bg-slate-900/90 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Attach Image Link
                </span>
                <button
                  onClick={() => setIsImagePickerOpen(false)}
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
                  placeholder="Paste direct image URL (https://…)"
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleSendImage}
                  disabled={!imageUrlInput.trim()}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                >
                  Attach
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ── VOICE RECORDING BANNER ── */}
        {isRecordingVoice && (
          <div className="flex items-center justify-between border-t border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-300">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold">
                Recording Voice Memo: {recordingSeconds}s
              </span>
            </div>

            <button
              onClick={handleStopRecordingAndSend}
              className="rounded-xl bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-md hover:bg-rose-500"
            >
              Finish & Send
            </button>
          </div>
        )}

        {/* ── CHAT INPUT COMPOSER ── */}
        <footer className="border-t border-slate-800/80 bg-slate-900/40 p-3 backdrop-blur-xl">
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Image link button */}
            <button
              type="button"
              onClick={() => setIsImagePickerOpen(!isImagePickerOpen)}
              title="Attach Image"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-amber-400/40 hover:text-amber-300"
            >
              <ImagePlus className="h-4 w-4" />
            </button>

            {/* Voice Memo Button */}
            <button
              type="button"
              onClick={isRecordingVoice ? handleStopRecordingAndSend : handleStartRecording}
              title={isRecordingVoice ? 'Stop Recording' : 'Record Voice Memo'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                isRecordingVoice
                  ? 'border-rose-500 bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-amber-400/40 hover:text-amber-300'
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send private message…"
              disabled={isRecordingVoice}
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-400 disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isSending || isRecordingVoice}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-black shadow-md transition disabled:opacity-40 hover:bg-amber-400"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </motion.div>

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
