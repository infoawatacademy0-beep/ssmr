import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Crown, Gift, X, Sparkles, Star, Shield } from 'lucide-react';
import type { AudienceMember, Seat, User } from '../types';

interface AudienceGridProps {
  audience: AudienceMember[];
  seats: Seat[];
  currentUser: User;
  onSendGiftToUser: (recipient: { uid: string; username: string }) => void;
}

export default function AudienceGrid({
  audience,
  seats,
  currentUser,
  onSendGiftToUser,
}: AudienceGridProps) {
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
          <span className="uppercase tracking-wider">Audience</span>
          <span className="rounded-full bg-violet-500/20 px-1.5 py-0.2 text-[9px] font-black text-violet-300">
            {listeningAudience.length}
          </span>
        </div>

        {/* Horizontal Avatars Stream */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-[210px] sm:max-w-[260px] py-0.5">
          {listeningAudience.length === 0 ? (
            <span className="text-[10px] text-slate-500 italic">Be the first listener</span>
          ) : (
            listeningAudience.map((member) => {
              const isVip = member.level >= 10;
              return (
                <button
                  key={member.uid}
                  onClick={() => setSelectedMember(member)}
                  className="group relative flex shrink-0 items-center justify-center"
                  title={`${member.username} (Lv.${member.level})`}
                >
                  <div
                    className={`
                      flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white transition-transform group-hover:scale-110 shadow
                      ${
                        isVip
                          ? 'border border-amber-400 bg-gradient-to-tr from-amber-500 to-yellow-600 text-black shadow-amber-400/20'
                          : 'border border-white/20 bg-gradient-to-tr from-violet-600 to-indigo-600'
                      }
                    `}
                  >
                    <span>{member.username.charAt(0).toUpperCase()}</span>
                  </div>

                  {isVip && (
                    <div className="absolute -top-1 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-400">
                      <Crown className="h-1.5 w-1.5 text-black" strokeWidth={3} />
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

              {/* Avatar with Ring */}
              <div className="relative mx-auto -mt-2 mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 to-cyan-500 font-display text-xl font-bold text-white shadow-xl shadow-violet-500/25">
                <span>{selectedMember.username.charAt(0).toUpperCase()}</span>
                {selectedMember.level >= 10 && (
                  <div className="absolute -top-1.5 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 shadow-md">
                    <Crown className="h-3 w-3 text-black" strokeWidth={2.5} />
                  </div>
                )}
              </div>

              <h3 className="text-sm font-bold text-white">{selectedMember.username}</h3>
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
                  <Shield className="h-2.5 w-2.5" /> Listener
                </span>
                {selectedMember.level >= 10 && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/25 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                    <Sparkles className="h-2.5 w-2.5" /> High Roller
                  </span>
                )}
              </div>

              {/* Action: Send Gift */}
              {selectedMember.uid !== currentUser.uid && (
                <button
                  onClick={() => {
                    const recipient = {
                      uid: selectedMember.uid,
                      username: selectedMember.username,
                    };
                    setSelectedMember(null);
                    onSendGiftToUser(recipient);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/25 transition-transform active:scale-95"
                >
                  <Gift className="h-4 w-4" />
                  <span>Send Gift</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
