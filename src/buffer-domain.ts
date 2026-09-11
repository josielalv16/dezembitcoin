import { z } from "zod";
export const BUFFER_SERVICES = ["instagram", "threads", "tiktok"] as const;
export type BufferService = (typeof BUFFER_SERVICES)[number];
export const sendSchema = z.object({
  requestId: z.string().uuid(),
  versionId: z.string().min(1).max(150),
  expectedChannelId: z.string().min(1).max(150),
  service: z.enum(BUFFER_SERVICES),
  text: z.string().trim().min(1).max(2200),
  assets: z.array(z.string().uuid()).min(1).max(10),
  mode: z.enum(["shareNow", "customScheduled"]),
  dueAt: z.string().datetime({ offset: true }).optional(),
  approved: z.literal(true),
  aiGenerated: z.boolean().default(false),
});
export type SendInput = z.infer<typeof sendSchema>;
export type Delivery = {
  id: string;
  item_id: string;
  version_id: string;
  service: BufferService;
  channel_id: string;
  payload_json: string;
  assets_json: string;
  status: string;
  post_id: string | null;
  due_at: string | null;
  sent_at: string | null;
  url: string;
  error: string;
  created_at: string;
  updated_at: string;
  checked_at: string | null;
  next_check_at: string;
};
export const DELIVERY_LABELS: Record<string, string> = {
  processing: "Publicando no Buffer",
  needs_approval: "Aguardando aprovação no Buffer",
  cancelling: "Cancelando — não repita",
  sending: "Enviando — não repita",
  uncertain: "Resultado incerto — conferir no Buffer",
  scheduled: "Agendado",
  sent: "Publicado",
  rejected: "Envio recusado",
  error: "Falha no Buffer",
  cancelled: "Cancelado",
  draft: "Rascunho no Buffer",
};
export function validateSend(
  input: SendInput,
  mimes: string[],
  now = Date.now(),
) {
  if (new Set(input.assets).size !== input.assets.length)
    throw new Error("Não repita arquivos no carrossel.");
  if (input.service === "threads" && [...input.text].length > 500)
    throw new Error("A legenda do Threads deve ter até 500 caracteres.");
  if (
    input.mode === "customScheduled" &&
    (!input.dueAt ||
      Date.parse(input.dueAt) < now + 120000 ||
      Date.parse(input.dueAt) > now + 30 * 86400000)
  )
    throw new Error("Agende entre 2 minutos e 30 dias a partir de agora.");
  if (
    input.service === "tiktok"
      ? mimes.length !== 1 || mimes[0] !== "video/mp4"
      : mimes.some((m) => m !== "image/png")
  )
    throw new Error("Use um MP4 no TikTok e PNGs no Instagram/Threads.");
}
export function postInput(input: SendInput, channelId: string, urls: string[]) {
  return {
    channelId,
    text: input.text,
    mode: input.mode,
    schedulingType: "automatic",
    needsApproval: false,
    saveToDraft: false,
    ...(input.mode === "customScheduled" ? { dueAt: input.dueAt } : {}),
    assets: urls.map((url) =>
      input.service === "tiktok" ? { video: { url } } : { image: { url } },
    ),
    ...(input.service === "instagram"
      ? { metadata: { instagram: { type: "post", shouldShareToFeed: true } } }
      : {}),
    ...(input.service === "tiktok"
      ? { metadata: { tiktok: { isAiGenerated: input.aiGenerated } } }
      : {}),
  };
}
export function remoteStatus(status: string): string {
  if (status === "sent") return "sent";
  if (status === "error") return "error";
  if (status === "draft") return "draft";
  if (status === "scheduled") return "scheduled";
  if (status === "needs_approval") return "needs_approval";
  if (status === "sending") return "processing";
  return "uncertain";
}
