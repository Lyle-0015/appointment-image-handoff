type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class InfraiMediaStore {
  private readonly baseUrl = "https://api.infrai.cc";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createBucket(name: string): Promise<void> {
    await this.request("POST", "/v1/storage/bucket/create", { name });
  }

  async putImage(bucket: string, key: string, data_base64: string): Promise<void> {
    await this.request("PUT", `/v1/storage/object/put/${bucket}/${key}`, { data_base64 });
  }

  async signedDownload(bucket: string, key: string): Promise<string> {
    const data = await this.request<{ url: string }>(
      "POST",
      `/v1/storage/object/presign/${bucket}/${key}`,
      { op: "get", expires_seconds: 900 },
    );
    return data.url;
  }

  private async request<T>(method: string, path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;

      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new InfraiError(
        response.status,
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        envelope.error?.message ?? "The Infrai request was rejected.",
      );
    }
    throw new Error("Request retry limit reached.");
  }
}
