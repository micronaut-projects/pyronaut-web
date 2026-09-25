import type { APIRoute } from "astro";
import docs from "@/generated/docs.json";

/** The pyronaut commit the published docs were rendered from; read by the upstream-updates workflow. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ repository: "micronaut-projects/pyronaut", branch: docs.branch, commit: docs.commit }), {
    headers: { "Content-Type": "application/json" },
  });
