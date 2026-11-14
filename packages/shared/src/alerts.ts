import { FREE_OPS, OPS_BLOCK_AT, OPS_WARN_AT, type OpsCount } from "./limits.ts";
import type { NotificationType } from "./notifications.ts";

// System alerts (decision 0010): raised once when a threshold is crossed,
// remembered (alert_states), and cleared when usage falls back, so they
// don't repeat on every check.

// The storage thresholds someone has crossed, lowest first.
export const storageAlerts = (used: number, quota: number): NotificationType[] => {
  if (quota <= 0) return [];
  const share = used / quota;
  return [
    ...(share >= 0.8 ? (["storage_80"] as const) : []),
    ...(share >= 0.95 ? (["storage_95"] as const) : []),
    ...(used >= quota ? (["storage_full"] as const) : []),
  ];
};

// The app's operation thresholds this month (R2's free tier), lowest first.
export const opsAlerts = (ops: OpsCount): NotificationType[] => {
  const share = Math.max(ops.classA / FREE_OPS.classA, ops.classB / FREE_OPS.classB);
  return [
    ...(share >= OPS_WARN_AT ? (["r2_ops_70"] as const) : []),
    ...(share >= OPS_BLOCK_AT ? (["r2_ops_90"] as const) : []),
  ];
};

// What to do with the thresholds crossed now and the ones already raised:
// raise the new ones (but tell only about the highest: crossing 95% at once
// doesn't also need "80%"), and clear the ones no longer crossed.
export const alertChanges = (crossed: NotificationType[], raised: NotificationType[]) => {
  const raise = crossed.filter((type) => !raised.includes(type));
  return {
    raise,
    notify: raise.at(-1) ?? null,
    clear: raised.filter((type) => !crossed.includes(type)),
  };
};
