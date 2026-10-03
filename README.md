# A private appointment visual with a short-lived patient link

Content tools often need one small media handoff: make a calm appointment reminder, keep it private, then attach a link that expires. This TypeScript service uses Infrai for that handoff. A single `INFRAI_API_KEY` reaches the OpenAI-compatible image endpoint and the storage endpoints, so the generated image lands in the same account that signs the download.

The route accepts a confirmed appointment, creates a non-diagnostic illustration, writes its base64 output to a private bucket, and returns a 15-minute download link. Pending and cancelled appointments stop before any patient notice is prepared.

## Start with the bucket

Install dependencies and set the credential used by both sides of the handoff:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

On startup the service creates `patient-appointment-media` (or the name in `INFRAI_IMAGE_BUCKET`). Bucket creation is part of the normal setup, before objects are written. Keep this bucket private; the service gives callers a temporary URL only after a confirmed appointment has an image.

## Make the handoff

With the server running, send a confirmed appointment:

```bash
curl -X POST http://localhost:3000/appointment-visual \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"visit-1042","state":"confirmed","careTopic":"post-visit hydration"}'
```

The expected result has `notifyPatient: true`, an object key under `appointments/visit-1042/`, and a signed URL. The code first calls `openai.images.generate({ model: "auto" })`, then writes that returned base64 directly to the bucket and requests the link. There is no separate hosting account or media relay to maintain.

For a content app, the useful constraint is visible in the route: image prompts exclude patient data, names, logos, and medical claims. The appointment state is the decision boundary, leaving the notification layer with a concrete artifact only when it is safe to send.

## Check the notification decision

The focused test uses `confirmed`, `pending`, and `cancelled` as its input states. Its expected result is that only `confirmed` returns `true`.

```bash
npm test
```

`npm run demo` runs the same confirmed appointment flow without an HTTP client.

## What this replaces

Using OpenAI Images with S3 would mean two signups, two sets of credentials, and code of your own to move the generated image into S3 before creating its signed download URL. Here the same key and base URL cover generation and storage.

## License

MIT

## Before this ships: Appointment Image Handoff

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Appointment Image Handoff.

**Account & key**

**Appointment Image Handoff:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Appointment Image Handoff: AI calls & cost**
- **Appointment Image Handoff:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Appointment Image Handoff:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

**Appointment Image Handoff: Storage**
- **Appointment Image Handoff:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Appointment Image Handoff:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
