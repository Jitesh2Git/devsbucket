import { formatBytes } from "@devsbucket/shared/bytes";
import { APP_STORAGE_LIMIT, FREE_OPS, type OpsCount } from "@devsbucket/shared/limits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type UsageCardProps = { storageUsed: number; ops: OpsCount };

const percent = (used: number, limit: number) => Math.min(100, (used / limit) * 100);

// The app's free limits (LOCKED.md "Limits"): uploads stop at 9 GB stored
// and at 90% of R2's free operations this month.
const UsageCard = ({ storageUsed, ops }: UsageCardProps) => {
  const meters = [
    {
      label: "Storage",
      value: percent(storageUsed, APP_STORAGE_LIMIT),
      text: `${formatBytes(storageUsed)} of ${formatBytes(APP_STORAGE_LIMIT)}`,
    },
    {
      label: "Writes this month",
      value: percent(ops.classA, FREE_OPS.classA),
      text: `${ops.classA.toLocaleString("en")} of ${FREE_OPS.classA.toLocaleString("en")}`,
    },
    {
      label: "Reads this month",
      value: percent(ops.classB, FREE_OPS.classB),
      text: `${ops.classB.toLocaleString("en")} of ${FREE_OPS.classB.toLocaleString("en")}`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>The whole app, against the free tier.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-3">
        {meters.map((meter) => (
          <div key={meter.label} className="flex flex-col gap-2">
            <span className="text-sm font-medium">{meter.label}</span>
            <Progress value={meter.value} aria-label={meter.label} />
            <span className="text-xs text-muted-foreground">{meter.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default UsageCard;
