import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function EitaaIcon({ size = 18 }: { size?: number }) {
  return (
    <img
      src="/eitaa-icon.png"
      width={size}
      height={size}
      alt="Eitaa"
      style={{ borderRadius: size * 0.25, display: "inline-block", verticalAlign: "middle" }}
    />
  );
}

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown when the backend requires authentication and a guest tries to use an
 * app entry point (e.g. image selection). Reuses the same `login()` trigger
 * from AuthContext as the homepage's login button — no duplicate auth logic.
 */
export function LoginRequiredModal({ open, onClose }: LoginRequiredModalProps) {
  const { login } = useAuth();

  const handleLogin = async () => {
    await login();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          dir="rtl"
          onClick={onClose}
        >
          <motion.div
            key="card"
            className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-xl p-7 space-y-6"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">ورود لازم است</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                برای استفاده از ایتاشات ابتدا باید با حساب ایتای خود وارد شوید.
              </p>
            </div>

            <div className="space-y-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLogin}
                className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2"
              >
                <EitaaIcon size={18} />
                ورود با ایتا
              </motion.button>
              <button
                onClick={onClose}
                className="w-full h-11 text-sm text-muted-foreground font-medium"
              >
                بازگشت
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
