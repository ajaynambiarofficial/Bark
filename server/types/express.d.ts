import type { AuthPrincipal } from "../auth/types.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthPrincipal;
    }
  }
}

export {};
