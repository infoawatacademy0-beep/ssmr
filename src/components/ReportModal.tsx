import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, X, Check, AlertTriangle } from 'lucide-react';
import type { ReportTargetType } from '../types';
import { useLanguage } from '../contexts';
import { submitReport } from '../services';

interface ReportModalProps {
  targetId: string;
  targetType: ReportTargetType;
  targetName: string;
  reporterUid: string;
  reporterName: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  { id: 'harassment', ku: 'هەراسانکردن یان ڕەفتاری نەشیاو', en: 'Harassment or inappropriate behavior' },
  { id: 'hate_speech', ku: 'وتاری ڕق و جیاکاری', en: 'Hate speech or discrimination' },
  { id: 'inappropriate_content', ku: 'دەنگ یان ناوەڕۆکی نەشیاو', en: 'Inappropriate audio or content' },
  { id: 'spam_scam', ku: 'سپام، فێڵکردن یان داواکاری نەشیاو', en: 'Spam, scams or unwanted solicitation' },
  { id: 'impersonation', ku: 'خۆکردن بە کەسێکی تر', en: 'Impersonation' },
  { id: 'game_cheating', ku: 'فێڵکردن لە یارییەکان', en: 'Game cheating or exploitation' },
];

export default function ReportModal({
  targetId,
  targetType,
  targetName,
  reporterUid,
  reporterName,
  onClose,
}: ReportModalProps) {
  const { tr } = useLanguage();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].id);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const activeReason = REPORT_REASONS.find(r => r.id === selectedReason);
    const reasonText = activeReason ? `${activeReason.ku} / ${activeReason.en}` : selectedReason;

    try {
      await submitReport(
        reporterUid,
        targetId,
        targetType,
        reasonText,
        details,
        reporterName,
      );
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-black text-white uppercase tracking-wider">
                {tr("ناردنی ڕاپۆرت", "Submit Report")}
              </h3>
              <p className="text-[10px] text-slate-400">
                {tr("ڕاپۆرت لەسەر", "Report against")} {targetType}: <strong className="text-slate-200">{targetName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="my-8 flex flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-3 animate-bounce">
              <Check className="h-7 w-7" />
            </div>
            <h4 className="text-sm font-bold text-white">{tr("ڕاپۆرتەکەت گەیشت", "Report Submitted")}</h4>
            <p className="mt-1 text-xs text-slate-400 max-w-xs">
              {tr("سوپاس بۆ پاراستنی ژینگەی ژوورەکان. تیمی چاودێری بە زووترین کات پێداچوونەوەی بۆ دەکات.", "Thank you for keeping our community safe. Our team will review this shortly.")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                {tr("جۆری سەرپێچی", "Violation Category")}
              </label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setSelectedReason(reason.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left text-xs transition ${
                      selectedReason === reason.id
                        ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{tr(reason.ku, reason.en)}</span>
                    {selectedReason === reason.id && <span className="h-2 w-2 rounded-full bg-rose-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                {tr("زانیاری زیاتر (ئارەزوومەندانە)", "Additional Details (Optional)")}
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={tr("باس لەوە بکە کە چی ڕوویداوە و زانیاری زیاتر بنووسە…", "Describe what happened in detail...")}
                className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-white placeholder-slate-500 outline-none transition focus:border-rose-400"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition active:scale-95 disabled:opacity-50 hover:bg-rose-500"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>{isSubmitting ? tr('خەریکی ناردنە…', 'Submitting...') : tr('دڵنیاکردنەوە و ناردنی ڕاپۆرت', 'Confirm & Send Report')}</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
