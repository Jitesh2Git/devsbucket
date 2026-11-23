import { cn } from "cn";
import { ChevronDown, Link2 } from "lucide-react";
import type { CSSProperties } from "react";
import DemoAvatar from "@/components/home/demo-avatar";
import { type DemoPerson, PEOPLE } from "@/components/home/demo-people";
import { Button } from "@/components/ui/button";

const Person = ({
  person,
  access,
  className,
}: {
  person: DemoPerson;
  access: string;
  className?: string;
}) => (
  <li className={cn("flex items-center gap-2.5 py-2", className)}>
    <DemoAvatar person={person} />
    <span className="min-w-0 flex-1 leading-tight">
      {person.name}
      <span className="block truncate text-xs text-muted-foreground">{person.handle}</span>
    </span>
    {access === "Owner" ? (
      <span className="text-xs text-muted-foreground">Owner</span>
    ) : (
      <Button variant="ghost" size="xs" tabIndex={-1}>
        {access}
        <ChevronDown />
      </Button>
    )}
  </li>
);

// The share dialog (components/drive/share-dialog.tsx), shrunk: someone
// types @grace, and Grace joins the people with access.
const ShareDemo = () => {
  const typing = { "--chars": 6, "--duration": "6s" } as CSSProperties;
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 text-sm">
      <p className="font-heading text-base font-semibold">Share "api-server"</p>
      <div className="flex gap-1.5">
        <span className="flex h-8 min-w-0 flex-1 items-center rounded-lg border border-primary px-2.5 ring-3 ring-ring/50">
          <span className="home-typing" style={typing}>
            @grace
          </span>
          <span className="home-caret ml-px inline-block h-4 w-px bg-foreground" />
        </span>
        <Button variant="outline" tabIndex={-1}>
          Editor
          <ChevronDown />
        </Button>
        <Button tabIndex={-1}>Share</Button>
      </div>
      <div>
        <p className="font-medium">People with access</p>
        <ul className="flex flex-col divide-y">
          <Person person={PEOPLE.you} access="Owner" />
          <Person person={PEOPLE.ada} access="Editor" />
          <Person person={PEOPLE.grace} access="Editor" className="home-arrive [--duration:6s]" />
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">Link</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Anyone signed in with the link gets{" "}
            <span className="font-medium text-foreground">Viewer</span>
          </span>
          <Button variant="outline" size="xs" tabIndex={-1}>
            <Link2 />
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShareDemo;
