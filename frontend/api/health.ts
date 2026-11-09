import type { ApiRequest, ApiResponse } from "./_types";

export default function handler(_request: ApiRequest, response: ApiResponse) {
  response.status(200).json({
    ok: true,
    service: "shopqr-vercel-api",
    env: process.env.NODE_ENV ?? "development",
    time: new Date().toISOString(),
  });
}
