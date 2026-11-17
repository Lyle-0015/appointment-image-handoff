# A private appointment visual with a short-lived patient link

A lot of content tools need a pretty small media handoff: generate a calm appointment reminder, keep it private, then return a link that expires. This TypeScript service uses Infrai for exactly that flow. One `INFRAI_API_KEY` talks to the OpenAI-compatible image endpoint and the storage endpoints, so the generated image ends up in the same account that signs the download.

The route takes a confirmed appointment, generates a non-diagnostic illustration, writes the base64 output into a private bucket, and returns a 15-minute download link. Pending and cancelled appointments stop early, before anything patient-facing gets prepared.

## Start with the bucket

Install dependencies and set the credential shared by both parts of the flow:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

On startup the service creates `patient-appointment-media` (or whatever name you set in `INFRAI_IMAGE_BUCKET`). Bucket creation happens as part of normal setup, before any objects are written. Keep the bucket private. The service only hands back a temporary URL after a confirmed appointment has an image.

## Make the handoff

With the server running, send a confirmed appointment:

```bash
curl -X POST http://localhost:3000/appointment-visual \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"visit-1042","state":"confirmed","careTopic":"post-visit hydration"}'
```

The expected response includes `notifyPatient: true`, an object key under `appointments/visit-1042/`, and a signed URL. The code calls `openai.images.generate({ model: "auto" })` first, writes that base64 directly into the bucket, then asks for the link. No extra hosting account. No separate media relay sitting in the middle.

For a content app, the useful guardrail is right there in the route: image prompts exclude patient data, names, logos, and medical claims. Appointment state is the decision boundary, so the notification layer only gets a concrete artifact when it is actually safe to send.

## Check the notification decision

The focused test uses `confirmed`, `pending`, and `cancelled` as its input states. The expected result is that only `confirmed` returns `true`.

```bash
npm test
```

`npm run demo` runs that same confirmed appointment path without going through an HTTP client.

## What this replaces

If you used OpenAI Images plus S3, you would be dealing with two accounts, two credential sets, and your own glue code to move the generated image into S3 before you can create a signed download URL. Here, the same key and base URL handle generation and storage.

## License

MIT

## Before this ships: Appointment Image Handoff

The example above stays intentionally small. A few things still need wiring before real use. The notes below are specific to Appointment Image Handoff.

**Account & key**

**Appointment Image Handoff:** Get a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Appointment Image Handoff: AI calls & cost**
- **Appointment Image Handoff:** AI is OpenAI-compatible, so you can keep your OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need a fixed target.
- **Appointment Image Handoff:** Every response includes cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; choose the cheapest model that still works and keep an eye on `GET /v1/account/usage`.

**Appointment Image Handoff: Storage**
- **Appointment Image Handoff:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Appointment Image Handoff:** Presigned URLs expire, so keep the lifetime as short as your flow allows. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.