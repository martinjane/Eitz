/**
 * Eitaa Bot Messaging Library (server-side only)
 *
 * The bot token never leaves this module.
 * All messaging is gated behind the TEST_MODE flag:
 *   - TEST_MODE=true  → messaging is a no-op (no bot token required)
 *   - TEST_MODE=false → bot token required, messages sent via Eitaa API
 */

import { logger } from "./logger";

// ── TEST_MODE ────────────────────────────────────────────────────────────────

/** Returns true when the app is in development/test mode (no Eitaa enforcement). */
export function isTestMode(): boolean {
  return process.env.TEST_MODE !== "false";
}

// ── Eitaa Bot API ────────────────────────────────────────────────────────────

const EITAA_API_BASE = "https://eitaayar.ir/api/app";

function getBotToken(): string {
  return process.env.EITAA_BOT_TOKEN ?? "";
}

/**
 * Send a text message to a user via the Eitaa Bot API.
 *
 * @param chatId - The user's Eitaa numeric ID (from initData)
 * @param text   - Markdown-formatted message text
 * @returns true if sent successfully, false otherwise
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
): Promise<boolean> {
  if (isTestMode()) {
    logger.info({ chatId }, "[eitaa] TEST_MODE — skipping sendMessage");
    return true; // treat as success in test mode
  }

  const token = getBotToken();
  if (!token) {
    logger.warn("[eitaa] EITAA_BOT_TOKEN not set — cannot send message");
    return false;
  }

  try {
    const res = await fetch(`${EITAA_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        chat_id: String(chatId),
        text,
      }),
    });

    const data = (await res.json()) as { ok?: boolean; result?: string };

    if (data.ok) {
      logger.info({ chatId }, "[eitaa] message sent successfully");
      return true;
    }

    logger.warn({ chatId, data }, "[eitaa] sendMessage failed");
    return false;
  } catch (err) {
    logger.error({ err, chatId }, "[eitaa] sendMessage network error");
    return false;
  }
}

// ── Auth Date Freshness ──────────────────────────────────────────────────────

/** Maximum age for auth_date in seconds (24 hours). */
const AUTH_DATE_MAX_AGE_S = 24 * 60 * 60;

/**
 * Check if the auth_date from Eitaa initData is fresh enough.
 * Returns true if the data is within AUTH_DATE_MAX_AGE_S of the current time,
 * or if we are in TEST_MODE (skip the check).
 */
export function isAuthDateFresh(authDateStr: string | null): boolean {
  if (isTestMode()) return true;
  if (!authDateStr) return false;

  const authDate = Number(authDateStr);
  if (!Number.isFinite(authDate)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec - authDate <= AUTH_DATE_MAX_AGE_S;
}

// ── Message Templates ────────────────────────────────────────────────────────

/**
 * Generate the registration welcome message.
 * The message uses the username as a handle, not as their real name.
 * It explains useful features and encourages using the clean UI.
 */
export function registrationMessage(username: string): string {
  return (
    `سلام ${username}! 👋\n\n` +
    `حساب کاربری تو در ایتاشات با موفقیت ساخته شد.\n\n` +
    `از اینجا می‌تونی:\n` +
    `• تصاویرت رو ویرایش و تنظیم کنی 🎨\n` +
    `• استایل‌های جدید امتحان کنی\n` +
    `• نتیجه رو مستقیم از ایتا ذخیره کنی\n\n` +
    `اگه سوالی داشتی، اینجا پیام بده. ولی برای سریع‌ترین تجربه، از رابط کاربری ساده ایتاشات استفاده کن! ✨`
  );
}

/**
 * Generate a payment success notification message.
 */
export function paymentSuccessMessage(
  amountTomans: number,
  orderId: string,
): string {
  return (
    `✅ پرداخت با موفقیت انجام شد!\n\n` +
    `💰 مبلغ: ${amountTomans.toLocaleString("fa-IR")} تومان\n` +
    `📋 شماره سفارش: \`${orderId.slice(0, 8)}\`\n\n` +
    `ممنون از حمایتت! ❤️`
  );
}

/**
 * Generate a payment failure notification message.
 */
export function paymentFailedMessage(orderId: string): string {
  return (
    `❌ پرداخت ناموفق بود\n\n` +
    `📋 شماره سفارش: \`${orderId.slice(0, 8)}\`\n\n` +
    `اگه مجدداً تلاش کنی، می‌تونی از بخش آگهی‌ها پرداخت رو از سر بگیری.`
  );
}
