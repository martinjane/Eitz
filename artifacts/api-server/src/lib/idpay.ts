/**
 * IDPay Web Service API v1.1 client.
 *
 * The merchant API key never leaves this module.
 * Sandbox mode is enabled automatically in non-production environments.
 * All amounts must be in Rials (1 Toman = 10 Rials).
 */

const IDPAY_BASE = "https://api.idpay.ir/v1.1";

function getApiKey(): string {
  return process.env.IDPAY_API_KEY ?? "";
}

function isSandbox(): boolean {
  return process.env.NODE_ENV !== "production";
}

function requestHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-KEY": getApiKey(),
  };
  if (isSandbox()) h["X-SANDBOX"] = "1";
  return h;
}

export interface CreatePaymentParams {
  orderId: string;   // unique merchant order ID
  amount: number;    // in Rials
  callback: string;  // backend callback URL
  name?: string;
  phone?: string;
  desc?: string;
}

export interface CreatePaymentResult {
  id: string;    // IDPay payment identifier
  link: string;  // redirect URL for the customer
}

/**
 * Create a new payment session with IDPay.
 * Persisting the returned `id` together with the internal order is the
 * caller's responsibility before returning the link to the client.
 */
export async function createPayment(
  params: CreatePaymentParams,
): Promise<CreatePaymentResult> {
  const body: Record<string, unknown> = {
    order_id: params.orderId,
    amount:   params.amount,
    callback: params.callback,
  };
  if (params.name)  body["name"]  = params.name;
  if (params.phone) body["phone"] = params.phone;
  if (params.desc)  body["desc"]  = params.desc;

  const res = await fetch(`${IDPAY_BASE}/payment`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;

  if (!res.ok || !data["id"] || !data["link"]) {
    throw new Error(`IDPay createPayment failed: ${JSON.stringify(data)}`);
  }

  return { id: String(data["id"]), link: String(data["link"]) };
}

export interface VerifyPaymentParams {
  id: string;      // IDPay payment identifier (from creation)
  orderId: string; // same merchant order ID used at creation
}

export interface VerifyPaymentResult {
  status: number;          // 100 = success, 101 = already verified
  track_id: string | number;
  id: string;
  order_id: string;
  amount: number;
  [key: string]: unknown;  // preserve the full payload for audit
}

/**
 * Verify a payment server-to-server.
 * Returns the full IDPay response; caller must check `status === 100 || 101`.
 * This operation is idempotent: calling it again on a verified payment returns 101.
 */
export async function verifyPayment(
  params: VerifyPaymentParams,
): Promise<VerifyPaymentResult> {
  const res = await fetch(`${IDPAY_BASE}/payment/verify`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({ id: params.id, order_id: params.orderId }),
  });

  const data = await res.json() as VerifyPaymentResult;
  return data;
}

/** Returns true for IDPay status codes that represent a verified payment. */
export function isVerifiedStatus(status: number): boolean {
  return status === 100 || status === 101;
}
