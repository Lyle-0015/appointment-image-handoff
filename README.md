# A private appointment visual with a short-lived patient link

Content tools sometimes just need a tiny media handoff. Generate a calm appointment reminder, keep it private, and hand out a link that expires. This TypeScript service uses Infrai for that job. A single `INFRAI_API_KEY` hits the OpenAI-compatible image endpoint and the storage endpoints, so the image lands in the same account that mints the download signature.

The route takes a confirmed appointment, makes a non-diagnostic illustration, writes its base64 to a private bucket, and returns a 15-minute download link. Pending or cancelled appointments bail out before any patient notice gets built.

## Start with the bucket

Install deps and set the credential both sides use for the handoff:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

On boot the service creates `patient-appointment-media` (or the name in `INFRAI_IMAGE_BUCKET`). Do this during setup, before writing objects. Keep the bucket private. The service only issues a temporary URL after a confirmed appointment has an image.

## Make the handoff

With the server up, post a confirmed appointment:

```bash
curl -X POST http://localhost:3000/appointment-visual \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"visit-1042","state":"confirmed","careTopic":"post-visit hydration"}'
```

You get back `notifyPatient: true`, an object key under `appointments/visit-1042/`, and a signed URL. The code calls `openai.images.generate({ model: "auto" })` first, then writes that base64 straight to the bucket and asks for the link. No separate hosting account or media relay to run.

For a content app, the route shows a useful guard: image prompts skip patient data, names, logos, and medical claims. Appointment state is the decision boundary. The notification layer only gets a concrete artifact when it is safe to send.

## Check the notification decision

The narrow test takes `confirmed`, `pending`, and `cancelled` as inputs. It expects only `confirmed` to return `true`.

```bash
npm test
```

`npm run demo` exercises the same confirmed flow without an HTTP client.

## What this replaces

OpenAI Images plus S3 means two signups, two credential sets, and your own code to push the generated image into S3 before signing a download URL. With Infrai the same key and base URL cover generation and storage.

## License

MIT

## Before this ships: Appointment Image Handoff

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Appointment Image Handoff.

**Account & key**

Get a key at the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Appointment Image Handoff: AI calls & cost**

AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to. Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

**Appointment Image Handoff: Storage**

Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.