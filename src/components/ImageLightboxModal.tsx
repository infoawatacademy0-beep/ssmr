import { motion } from 'framer-motion';
import { X, Download, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts';

interface ImageLightboxModalProps {
  imageUrl: string;
  senderName?: string;
  onClose: () => void;
}

export default function ImageLightboxModal({
  imageUrl,
  senderName,
  onClose,
}: ImageLightboxModalProps) {
  const { tr } = useLanguage();

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-black/50 shadow-2xl"
      >
        {/* Top Control Bar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4">
          <span className="text-xs font-bold text-white drop-shadow">
            {senderName ? `${senderName} • ${tr('وێنەی هاوپێچکراو', 'Attachment')}` : tr('وێنەی هاوپێچکراو', 'Attachment')}
          </span>

          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
              title="Open full size"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <img
          src={imageUrl}
          alt="Chat Full View"
          className="max-h-[85vh] w-auto max-w-full object-contain mx-auto"
        />
      </motion.div>
    </div>
  );
}
