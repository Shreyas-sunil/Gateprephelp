import { describe, expect, it } from "vitest";
import { benchmarkFor, benchmarkStatus, marksToGateScore, matchGroup } from "@/lib/calc/college";
import { PROGRAMME_MAP } from "@/data/colleges";

describe("college predictor", () => {
  it("uses official benchmarks unless community data is allowed", () => {
    const csa = PROGRAMME_MAP["iisc-csa-mtech"]!;
    expect(benchmarkFor(csa, "UR", false)).toBeNull();
    expect(benchmarkFor(csa, "UR", true)!.value).toBe(903);
    expect(benchmarkFor(PROGRAMME_MAP["iisc-ai"]!, "OBC", false)!.value).toBe(845);
    expect(benchmarkFor(PROGRAMME_MAP["iisc-pddm"]!, "WQ", false)).toBeNull();
  });
  it("classifies statuses honestly", () => {
    expect(benchmarkStatus(900, 880)).toBe("within");
    expect(benchmarkStatus(840, 880)).toBe("approaching");
    expect(benchmarkStatus(700, 880)).toBe("below");
    expect(benchmarkStatus(700, null)).toBe("unavailable");
    expect(benchmarkStatus(null, 880)).toBe("no-score");
    expect(matchGroup("approaching")).toBe("dream");
    expect(matchGroup("within")).toBe("target");
    expect(matchGroup("unavailable")).toBe("additional");
  });
  it("converts marks only with user-supplied Mq and Mt", () => {
    expect(marksToGateScore(70)).toBeNull();
    expect(marksToGateScore(70, 30, 20)).toBeNull();
    expect(marksToGateScore(80, 30, 80)).toBe(900);
    expect(marksToGateScore(30, 30, 80)).toBe(350);
    expect(marksToGateScore(55, 30, 80)).toBe(625);
  });
});
