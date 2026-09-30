import type { APIRoute } from "astro";
import { GUIDES_SOURCE } from "@/lib/guides";

/** The micronaut-guides commit the published guides were rendered from; read by the upstream-updates workflow. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(GUIDES_SOURCE), {
    headers: { "Content-Type": "application/json" },
  });
