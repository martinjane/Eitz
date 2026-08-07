/**
 * One-time post-login role picker.
 * Shows once after the user's first successful login (onboarding complete).
 * Navigates to the appropriate Guide tab and records the choice in localStorage.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Image as ImageIcon } from "lucide-react";

const ROLE_KEY = "eitashot_role_chosen";

export function RolePickerModal() {
  const { auth } = useAuth();
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show for fully authenticated users who haven't picked a role yet.
    // auth.status === "authenticated" means onboarding (username + ToS) is done.
    if (auth.status === "authenticated" && !localStorage.getItem(ROLE_KEY)) {
      // Brief delay so the page settles first.
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [auth.status]);

  const pick = (role: "owner" | "user") => {
    localStorage.setItem(ROLE_KEY, role);
    setVisible(false);
    setTimeout(() => {
      setLocation(role === "owner" ? "/guide?tab=styles" : "/guide?tab=tools");
    }, 220);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="role-picker-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          dir="rtl"
          onClick={(e) => { if (e.target === e.currentTarget) setVisible(false); }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-[520px] bg-card rounded-t-3xl p-6 space-y-5 shadow-2xl border-t border-border"
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto" />

            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">به ایتاشات خوش آمدید!</h2>
              <p className="text-sm text-muted-foreground">
                برای شروع بهتر، چطور از ایتاشات استفاده می‌کنید؟
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Channel Owner */}
              <button
                onClick={() => pick("owner")}
                className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 border-border bg-background hover:border-primary/60 hover:bg-primary/5 active:scale-[0.97] transition-all text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">مالک کانال</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">
                    کانال ایتا دارم
                  </p>
                </div>
              </button>

              {/* Regular user */}
              <button
                onClick={() => pick("user")}
                className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 border-border bg-background hover:border-primary/60 hover:bg-primary/5 active:scale-[0.97] transition-all text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">کاربر عادی</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">
                    فقط ویرایش تصویر
                  </p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setVisible(false)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              بعداً تصمیم می‌گیرم
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
