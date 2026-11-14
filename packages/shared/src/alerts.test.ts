import { describe, expect, it } from "vitest";
import { alertChanges, opsAlerts, storageAlerts } from "./alerts.ts";

describe("storageAlerts", () => {
  it("crosses 80%, 95% and full in turn", () => {
    expect(storageAlerts(79, 100)).toEqual([]);
    expect(storageAlerts(80, 100)).toEqual(["storage_80"]);
    expect(storageAlerts(96, 100)).toEqual(["storage_80", "storage_95"]);
    expect(storageAlerts(100, 100)).toEqual(["storage_80", "storage_95", "storage_full"]);
  });
});

describe("opsAlerts", () => {
  it("uses the fuller class of operations", () => {
    expect(opsAlerts({ classA: 0, classB: 0 })).toEqual([]);
    expect(opsAlerts({ classA: 700_000, classB: 0 })).toEqual(["r2_ops_70"]);
    expect(opsAlerts({ classA: 0, classB: 9_500_000 })).toEqual(["r2_ops_70", "r2_ops_90"]);
  });
});

describe("alertChanges", () => {
  it("raises new thresholds but tells only about the highest", () => {
    expect(alertChanges(["storage_80", "storage_95"], [])).toEqual({
      raise: ["storage_80", "storage_95"],
      notify: "storage_95",
      clear: [],
    });
  });

  it("does nothing while the same thresholds stay crossed", () => {
    expect(alertChanges(["storage_80"], ["storage_80"])).toEqual({
      raise: [],
      notify: null,
      clear: [],
    });
  });

  it("clears what's no longer crossed, so it can be raised again later", () => {
    expect(alertChanges(["storage_80"], ["storage_80", "storage_95"])).toEqual({
      raise: [],
      notify: null,
      clear: ["storage_95"],
    });
  });
});
