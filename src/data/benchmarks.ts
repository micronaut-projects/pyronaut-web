/**
 * HTTPS/HTTP2 benchmark results (run of 2026-09-27, "standard" workload
 * https2-6-6). Every framework was driven by the same Hyperfoil ramp against
 * the same 3-OCPU VM; a step passes only if it meets the latency SLAs below.
 * Each framework ran two repetitions; we show its best one.
 *
 * `ramp` is the discovery ramp (identical +25% steps for every framework),
 * listed up to the last passing step. `sustained` is the highest rate that
 * passed validation (45s steps, +2% each) and `failsAt` is the validation
 * step that first exceeded the SLA.
 */

export interface RampStep {
  rps: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface BenchmarkFramework {
  id: string;
  name: string;
  server: string;
  sustained: number;
  /** True when validation never failed, so `sustained` is a lower bound. */
  lowerBound?: boolean;
  failsAt: number;
  ramp: RampStep[];
}

export const BENCHMARK_ENV = {
  date: "2026-09-27",
  sut: "OCI VM.Standard.E4.Flex, 3 OCPU, 24 GB",
  loadGenerator: "Hyperfoil on a separate 16-CPU VM",
  protocol: "HTTPS, HTTP/2",
  connections: 265,
  sla: { p50: 100, p95: 200, p99: 1000 },
};

export const BENCHMARKS: BenchmarkFramework[] = [
  {
    id: "pyronaut",
    name: "Pyronaut",
    server: "",
    sustained: 35351,
    failsAt: 36059,
    ramp: [
      { rps: 1000, p50: 0.348, p95: 0.412, p99: 0.438 },
      { rps: 1250, p50: 0.344, p95: 0.412, p99: 0.442 },
      { rps: 1563, p50: 0.336, p95: 0.41, p99: 0.436 },
      { rps: 1954, p50: 0.344, p95: 0.414, p99: 0.444 },
      { rps: 2443, p50: 0.338, p95: 0.412, p99: 0.44 },
      { rps: 3054, p50: 0.338, p95: 0.414, p99: 0.449 },
      { rps: 3818, p50: 0.338, p95: 0.416, p99: 0.453 },
      { rps: 4773, p50: 0.338, p95: 0.422, p99: 0.469 },
      { rps: 5967, p50: 0.336, p95: 0.424, p99: 0.473 },
      { rps: 7459, p50: 0.332, p95: 0.424, p99: 0.473 },
      { rps: 9324, p50: 0.334, p95: 0.43, p99: 0.489 },
      { rps: 11655, p50: 0.338, p95: 0.442, p99: 0.508 },
      { rps: 14569, p50: 0.348, p95: 0.465, p99: 0.565 },
      { rps: 18212, p50: 0.358, p95: 0.502, p99: 0.627 },
      { rps: 22765, p50: 0.377, p95: 0.59, p99: 0.795 },
      { rps: 28457, p50: 0.414, p95: 0.766, p99: 1.081 },
      { rps: 35572, p50: 0.549, p95: 1.491, p99: 2.458 },
    ],
  },
  {
    id: "fastapi",
    name: "FastAPI",
    server: "Granian",
    sustained: 13576,
    failsAt: 13848,
    ramp: [
      { rps: 1000, p50: 0.676, p95: 0.893, p99: 1.012 },
      { rps: 1250, p50: 0.659, p95: 0.877, p99: 1.004 },
      { rps: 1563, p50: 0.672, p95: 0.893, p99: 1.04 },
      { rps: 1954, p50: 0.668, p95: 0.901, p99: 1.073 },
      { rps: 2443, p50: 0.664, p95: 0.922, p99: 1.098 },
      { rps: 3054, p50: 0.684, p95: 0.983, p99: 1.196 },
      { rps: 3818, p50: 0.7, p95: 1.057, p99: 1.303 },
      { rps: 4773, p50: 0.737, p95: 1.188, p99: 1.491 },
      { rps: 5967, p50: 0.803, p95: 1.401, p99: 1.778 },
      { rps: 7459, p50: 0.946, p95: 1.753, p99: 2.261 },
      { rps: 9324, p50: 1.335, p95: 2.654, p99: 3.408 },
      { rps: 11655, p50: 2.572, p95: 5.112, p99: 6.619 },
    ],
  },
  {
    id: "flask",
    name: "Flask",
    server: "Gunicorn",
    sustained: 5453,
    failsAt: 5563,
    ramp: [
      { rps: 1000, p50: 0.918, p95: 1.401, p99: 1.851 },
      { rps: 1250, p50: 0.942, p95: 1.54, p99: 2.146 },
      { rps: 1563, p50: 0.95, p95: 1.606, p99: 2.294 },
      { rps: 1954, p50: 0.975, p95: 1.81, p99: 2.638 },
      { rps: 2443, p50: 1.032, p95: 2.114, p99: 3.047 },
      { rps: 3054, p50: 1.098, p95: 2.523, p99: 3.637 },
      { rps: 3818, p50: 1.204, p95: 3.473, p99: 5.571 },
      { rps: 4773, p50: 1.581, p95: 6.095, p99: 13.435 },
    ],
  },
];

/** Series identity: Pyronaut wears the flame, alternatives stay in ink. */
export const SERIES_COLORS: Record<string, { stroke: string; dash?: string }> = {
  pyronaut: { stroke: "#fb923c" },
  fastapi: { stroke: "#d3d8e2" },
  flask: { stroke: "#8b96b0", dash: "6 4" },
};

export const frameworkLabel = (f: BenchmarkFramework) => (f.server ? `${f.name} + ${f.server}` : f.name);
