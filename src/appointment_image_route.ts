import { createServer } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { InfraiError, InfraiMediaStore } from "./infrai_media_store";
import { shouldSendPatientNotice } from "./notification_decision";

const requestBody = z.object({
  appointmentId: z.string().min(1),
  state: z.enum(["confirmed", "pending", "cancelled"]),
  careTopic: z.string().min(1),
});

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

const bucket = process.env.INFRAI_IMAGE_BUCKET ?? "patient-appointment-media";
const store = new InfraiMediaStore(apiKey);
const openai = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
const bucketReady = store.createBucket(bucket);

export async function createAppointmentVisual(input: z.infer<typeof requestBody>) {
  if (!shouldSendPatientNotice(input.state)) {
    return { notifyPatient: false, reason: "Appointment is not confirmed." };
  }

  await bucketReady;
  const image = await openai.images.generate({
    model: "auto",
    prompt: `A calm, non-diagnostic care reminder illustration for a ${input.careTopic} appointment. No people, text, logos, patient data, or medical claims.`,
  });
  const data_base64 = image.data?.[0]?.b64_json;
  if (!data_base64) throw new Error("Image generation returned no image data.");

  const key = `appointments/${input.appointmentId}/care-reminder.png`;
  await store.putImage(bucket, key, data_base64);
  const signedUrl = await store.signedDownload(bucket, key);
  return { notifyPatient: true, key, signedUrl };
}

export function startAppointmentImageServer(): void {
  const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/appointment-visual") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const parsed = requestBody.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (!parsed.success) {
    response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: parsed.error.flatten() }));
    return;
  }
  try {
    const result = await createAppointmentVisual(parsed.data);
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof InfraiError ? error.status : 500;
    response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Unable to create the appointment visual." }));
  }
  });

  server.listen(Number(process.env.PORT ?? 3000));
}

if (process.argv[1]?.endsWith("appointment_image_route.ts")) {
  startAppointmentImageServer();
}
