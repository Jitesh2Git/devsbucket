import { cn } from "cn";
import type { DemoPerson } from "@/components/home/demo-people";

// A demo person's round avatar: their initial on their cursor colour.
const DemoAvatar = ({ person, className }: { person: DemoPerson; className?: string }) => {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: person.color }}
    >
      {person.name[0]}
    </span>
  );
};

export default DemoAvatar;
