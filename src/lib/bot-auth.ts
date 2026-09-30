import { timingSafeEqual } from "node:crypto";

// Endpoint khusus bot WA KUWERA: header x-bot-key harus sama dengan env KUWERA_BOT_KEY. Tanpa env, endpoint mati.
export function botAuthorized(req: Request) {
  const key = process.env.KUWERA_BOT_KEY ?? "";
  const given = req.headers.get("x-bot-key") ?? "";
  return key.length >= 32 && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
}
