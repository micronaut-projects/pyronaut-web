/**
 * HTTPS/HTTP2 benchmark results (run of 2026-09-24, "standard" workload
 * https2-6-6). Every framework was driven by the same Hyperfoil ramp against
 * the same 3-OCPU VM; a step passes only if it meets the latency SLAs below.
 *
 * `ramp` is the discovery ramp (identical +25% steps for every framework),
 * listed up to the last passing step; `failsAt` is the first failing step.
 * `sustained` is the highest rate that passed validation (45s steps).
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
  date: "2026-09-24",
  sut: "OCI VM.Standard.E4.Flex, 3 OCPU, 24 GB",
  loadGenerator: "Hyperfoil on a separate 8-CPU VM",
  protocol: "HTTPS, HTTP/2",
  connections: 265,
  streams: 100,
  sla: { p50: 100, p95: 200, p99: 1000 },
};

export const BENCHMARKS: BenchmarkFramework[] = [
  {
    id: "pyronaut",
    name: "Pyronaut",
    server: "",
    sustained: 33802,
    failsAt: 35572,
    ramp: [
      { rps: 1000, p50: 0.414, p95: 0.473, p99: 0.508 },
      { rps: 1250, p50: 0.412, p95: 0.469, p99: 0.504 },
      { rps: 1563, p50: 0.408, p95: 0.459, p99: 0.496 },
      { rps: 1954, p50: 0.41, p95: 0.475, p99: 0.522 },
      { rps: 2443, p50: 0.406, p95: 0.467, p99: 0.512 },
      { rps: 3054, p50: 0.403, p95: 0.467, p99: 0.51 },
      { rps: 3818, p50: 0.399, p95: 0.467, p99: 0.514 },
      { rps: 4773, p50: 0.403, p95: 0.479, p99: 0.537 },
      { rps: 5967, p50: 0.401, p95: 0.483, p99: 0.545 },
      { rps: 7459, p50: 0.397, p95: 0.477, p99: 0.541 },
      { rps: 9324, p50: 0.403, p95: 0.5, p99: 0.586 },
      { rps: 11655, p50: 0.408, p95: 0.518, p99: 0.618 },
      { rps: 14569, p50: 0.416, p95: 0.557, p99: 0.688 },
      { rps: 18212, p50: 0.436, p95: 0.655, p99: 0.86 },
      { rps: 22765, p50: 0.473, p95: 0.815, p99: 1.122 },
      { rps: 28457, p50: 0.59, p95: 1.368, p99: 2.146 },
    ],
  },
  {
    id: "emmett",
    name: "Emmett",
    server: "Granian",
    sustained: 14569,
    lowerBound: true,
    failsAt: 14569,
    ramp: [
      { rps: 1000, p50: 0.557, p95: 0.635, p99: 0.737 },
      { rps: 1250, p50: 0.561, p95: 0.651, p99: 1.458 },
      { rps: 1563, p50: 0.557, p95: 0.643, p99: 1.384 },
      { rps: 1954, p50: 0.561, p95: 0.668, p99: 1.483 },
      { rps: 2443, p50: 0.561, p95: 0.676, p99: 1.425 },
      { rps: 3054, p50: 0.565, p95: 0.696, p99: 1.012 },
      { rps: 3818, p50: 0.569, p95: 0.754, p99: 2.179 },
      { rps: 4773, p50: 0.578, p95: 0.819, p99: 19.005 },
      { rps: 5967, p50: 0.59, p95: 0.881, p99: 1.819 },
      { rps: 7459, p50: 0.61, p95: 0.991, p99: 2.064 },
      { rps: 9324, p50: 0.655, p95: 1.18, p99: 2.327 },
      { rps: 11655, p50: 0.758, p95: 1.647, p99: 350.224 },
    ],
  },
  {
    id: "flask",
    name: "Flask",
    server: "Gunicorn",
    sustained: 5675,
    failsAt: 5967,
    ramp: [
      { rps: 1000, p50: 0.967, p95: 1.466, p99: 1.86 },
      { rps: 1250, p50: 0.979, p95: 1.556, p99: 2.114 },
      { rps: 1563, p50: 1.012, p95: 1.704, p99: 2.441 },
      { rps: 1954, p50: 1.044, p95: 1.909, p99: 2.753 },
      { rps: 2443, p50: 1.106, p95: 2.392, p99: 3.539 },
      { rps: 3054, p50: 1.163, p95: 2.753, p99: 4.047 },
      { rps: 3818, p50: 1.278, p95: 3.801, p99: 5.865 },
      { rps: 4773, p50: 1.769, p95: 7.307, p99: 14.615 },
    ],
  },
];

/** Series identity: Pyronaut wears the flame, alternatives stay in ink. */
export const SERIES_COLORS: Record<string, { stroke: string; dash?: string }> = {
  pyronaut: { stroke: "#fb923c" },
  emmett: { stroke: "#d3d8e2" },
  flask: { stroke: "#8b96b0", dash: "6 4" },
};

export const frameworkLabel = (f: BenchmarkFramework) => (f.server ? `${f.name} + ${f.server}` : f.name);
