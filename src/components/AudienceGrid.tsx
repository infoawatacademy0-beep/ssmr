import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Crown, Gift, X, Sparkles, Star, Shield, MessageCircle, User as UserIcon, Flame } from 'lucide-react';
import { getVipAvatarClass, type AudienceMember, type Seat, type User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AudienceGridProps {
  audience: AudienceMember[];
  seats: Seat[];
  currentUser: User;
  vipUsersMap?: Record<string, boolean>;
  vipFramesMap?: Record<string, string>;
  onSendGiftToUser: (recipient: { uid: string; username: string }) => void;
  onOpenPrivateChat?: (recipient: { uid: string; username: string; avatar?: string }) => void;
  onOpenProfile?: (uid: string) => void;
}

export default function AudienceGrid({
  audience,
  seats,
  currentUser,
  vipUsersMap = {},
  vipFramesMap = {},
  onSendGiftToUser,
  onOpenPrivateChat,
  onOpenProfile,
}: AudienceGridProps) {
  const { tr } = useLanguage();
  const [selectedMember, setSelectedMember] = useState<AudienceMember | null>(null);

  // Filter out any user who is currently sitting on one of the 8 mic seats
  const seatedUserIds = new Set(seats.map((s) => s.userId).filter(Boolean));
  const listeningAudience = audience.filter((member) => !seatedUserIds.has(member.uid));

  return (
    <>
      {/* ── Audience Strip Row (Above Live Chat) ── */}
      <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-surface-900/40 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
          <Users className="h-3.5 w-3.5 text-violet-400" />
          <span className="uppercase tracking-wider">{tr('گوێگران', 'Audience')}</span>
          <span className="rounded-full bg-violet-500/20 px-1.5 py-0.2 text-[9px] font-black text-violet-300">
            {listeningAudience.length}
          </span>
        </div>

        {/* Horizontal Avatars Stream */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-[210px] sm:max-w-[260px] py-0.5">
          {listeningAudience.length === 0 ? (
            <span className="text-[10px] text-slate-500 italic">{tr('یەکەم گوێگری ئەم ژوورە بە', 'Be the first listener')}</span>
          ) : (
            listeningAudience.map((member) => {
              const isVip = Boolean(
                member.isVerified ||
                  vipUsersMap[member.uid] ||
                  (member.uid === currentUser.uid && currentUser.isVerified) ||
                  member.level >= 10,
              );
              return (
                <button
                  key={member.uid}
                  onClick={() => setSelectedMember(member)}
                  className="group relative flex shrink-0 items-center justify-center p-0.5"
                  title={`${member.username}${isVip ? ' (VIP 🔥)' : ''} (Lv.${member.level})`}
                >
                  <div
                    className={`
                      flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white transition-transform group-hover:scale-110 shadow
                      ${
                        isVip
                          ? `${getVipAvatarClass(isVip, vipFramesMap[member.uid])} bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 text-black`
                          : 'border border-white/20 bg-gradient-to-tr from-violet-600 to-indigo-600'
                      }
                    `}
                  >
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.username} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span>{member.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  {isVip && (
                    <div className="absolute -top-1 -right-0.5 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 shadow">
                      <Crown className="h-2 w-2 text-black fill-black" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
         MODAL: Audience Member Profile Card
         ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs rounded-3xl border border-white/[0.1] bg-surface-800 p-5 text-center shadow-2xl"
            >
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Avatar with Blazing Fire Ring if VIP */}
              {(() => {
                const isSelectedVip = Boolean(
                  selectedMember.isVerified ||
                    vipUsersMap[selectedMember.uid] ||
                    (selectedMember.uid === currentUser.uid && currentUser.isVerified) ||
                    selectedMember.level >= 10,
                );
                return (
                  <>
                    <div
                      onClick={() => {
                        if (onOpenProfile) {
                          const targetId = selectedMember.uid;
                          setSelectedMember(null);
                          onOpenProfile(targetId);
                        }
                      }}
                      className={`relative mx-auto -mt-2 mb-3 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 font-display text-xl font-bold text-white shadow-xl ${
                        isSelectedVip
                          ? getVipAvatarClass(isSelectedVip, vipFramesMap[selectedMember.uid])
                          : 'shadow-violet-500/25'
                      }`}
                    >
                      <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                        {selectedMember.avatar ? (
                          <img src={selectedMember.avatar} alt={selectedMember.username} className="h-full w-full object-cover" />
                        ) : (
                          <span>{selectedMember.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {isSelectedVip && (
                        <div className="absolute -top-1.5 -right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 shadow-md">
                          <Crown className="h-3 w-3 text-black fill-black" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-1.5">
                      <h3 className="text-sm font-bold text-white">{selectedMember.username}</h3>
                      {isSelectedVip && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500/25 to-red-500/25 border border-amber-400/50 px-1.5 py-0.5 text-[9px] font-black text-amber-300 uppercase">
                          <Flame className="h-2.5 w-2.5 text-orange-400 fill-orange-400" />
                          VIP
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  Level {selectedMember.level}
                </span>
                <span>·</span>
                <span>Audience</span>
              </div>

              {/* Badges preview */}
              <div className="my-3 flex items-center justify-center gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/20 px-2 py-0.5 text-[9px] font-bold text-violet-300">
                  <Shield className="h-2.5 w-2.5" /> {tr('گوێگر', 'Audience')}
                </span>
                {(selectedMember.isVerified || vipUsersMap[selectedMember.uid] || selectedMember.level >= 10) && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/25 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                    <Sparkles className="h-2.5 w-2.5" /> {tr('ئەندامی VIP', 'VIP Member')}
                  </span>
                )}
              </div>

              {/* Actions: View Profile, Direct Message (Chat), Send Gift */}
              <div className="mt-3 space-y-2">
                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = selectedMember.uid;
                      setSelectedMember(null);
                      onOpenProfile(targetId);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/10 active:scale-95"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-amber-400" />
                    <span>{tr('بینینی پڕۆفایل (View Profile)', 'View Profile')}</span>
                  </button>
                )}

                {selectedMember.uid !== currentUser.uid && (
                  <>
                    {onOpenPrivateChat && (
                      <button
                        type="button"
                        onClick={() => {
                          const recipient = {
                            uid: selectedMember.uid,
                            username: selectedMember.username,
                            avatar: selectedMember.avatar,
                          };
                          setSelectedMember(null);
                          onOpenPrivateChat(recipient);
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-cyan-500/40 bg-cyan-500/15 py-2.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/25 active:scale-95"
                      >
                        <MessageCircle className="h-4 w-4 text-cyan-400" />
                        <span>{tr('ناردنی نامە', 'Chat')} · Chat with {selectedMember.username}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const recipient = {
                          uid: selectedMember.uid,
                          username: selectedMember.username,
                        };
                        setSelectedMember(null);
                        onSendGiftToUser(recipient);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95"
                    >
                      <Gift className="h-4 w-4" />
                      <span>{tr('ناردنی دیاری', 'Send Gift')}</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
