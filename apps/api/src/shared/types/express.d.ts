/**
 * Typed Express request augmentation. `apiKey` is set by the auth middleware,
 * `requestId` by the request-id middleware, `pagination` by the validate layer.
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      apiKey?: {
        apiKeyId: string;
        organizationId: string;
        mode: 'sandbox' | 'live';
        scopes: string[];
      };
      pagination?: { limit: number; cursor?: string };
      /**
       * Raw request bytes captured by the webhook sub-app's body parser, so the
       * HMAC signature can be verified against the EXACT bytes the provider
       * signed (a re-serialized JSON body would not match). Set only on the
       * inbound-webhook app.
       */
      rawBody?: Buffer;
    }
  }
}

export {};
