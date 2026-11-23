import { THEMES } from "@devsbucket/shared/themes";
import { cn } from "cn";
import {
  Activity,
  Bell,
  Code,
  Eye,
  History,
  Palette,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import ItemIcon from "@/components/drive/item-icon";
import DemoAvatar from "@/components/home/demo-avatar";
import { PEOPLE } from "@/components/home/demo-people";
import EditorDemo from "@/components/home/editor-demo";
import MarkdownDemo from "@/components/home/markdown-demo";
import Reveal from "@/components/home/reveal";
import ShareDemo from "@/components/home/share-demo";
import ThemesDemo from "@/components/home/themes-demo";
import VersionsDemo from "@/components/home/versions-demo";
import { Button } from "@/components/ui/button";

// The themes people can pick on the Themes page (the default isn't one).
const LISTED_THEMES = THEMES.filter((theme) => theme.listed !== false).length;

// One tile of the grid: a title, a sentence, and a demo of the real thing
// (only a picture: hidden from screen readers and inert).
const Tile = ({
  icon: Icon,
  title,
  text,
  className,
  children,
}: {
  icon: ElementType;
  title: string;
  text: string;
  className?: string;
  children: ReactNode;
}) => (
  <Reveal
    className={cn(
      "flex flex-col gap-1 overflow-hidden rounded-2xl border bg-card p-5 hover:border-primary/40",
      className,
    )}
  >
    <h3 className="flex items-center gap-2 text-base font-semibold">
      <Icon className="size-4 text-primary-text" aria-hidden />
      {title}
    </h3>
    <p className="text-sm text-muted-foreground">{text}</p>
    <div aria-hidden inert className="mt-4 flex min-w-0 flex-1 flex-col justify-end text-sm">
      {children}
    </div>
  </Reveal>
);

const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("overflow-hidden rounded-xl border bg-background", className)}>{children}</div>
);

const SearchDemo = () => (
  <Panel>
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <Search className="size-4 text-muted-foreground" />
      <span className="home-typing" style={{ "--chars": 6, "--duration": "5s" } as CSSProperties}>
        readme
      </span>
      <span className="home-caret -ml-1.5 inline-block h-4 w-px bg-foreground" />
    </div>
    <p className="px-3 pt-2 text-xs text-muted-foreground">Files</p>
    {[
      { name: "README.md", where: "api-server" },
      { name: "read-config.ts", where: "scripts" },
    ].map((result, index) => (
      <div
        key={result.name}
        className={cn(
          "m-1 flex items-center gap-2 rounded-md px-2 py-1.5",
          index === 0 && "bg-muted",
        )}
      >
        <ItemIcon
          item={{ type: "file", name: result.name, mimeType: null }}
          className="size-4 text-muted-foreground"
        />
        <span className="flex-1 truncate">{result.name}</span>
        <span className="text-xs text-muted-foreground">{result.where}</span>
      </div>
    ))}
  </Panel>
);

const NotificationsDemo = () => (
  <Panel className="divide-y">
    {[
      {
        person: PEOPLE.grace,
        text: 'Grace asked for editor access to "api-server"',
        when: "Just now",
      },
      { person: PEOPLE.ada, text: 'Ada added 3 files to "docs"', when: "12 min ago" },
    ].map((note, index) => (
      <div
        key={note.text}
        className={cn("flex items-start gap-2.5 px-3 py-2.5", index === 0 && "home-arrive")}
      >
        <DemoAvatar person={note.person} />
        <span className="flex-1 leading-snug">
          {note.text}
          <span className="block text-xs text-muted-foreground">{note.when}</span>
        </span>
        <span className="mt-1.5 size-2 rounded-full bg-primary" />
      </div>
    ))}
  </Panel>
);

const UploadsDemo = () => (
  <Panel className="flex flex-col gap-3 p-3">
    {[
      { name: "assets", size: "12 files" },
      { name: "dump.sql.gz", size: "48 MB" },
    ].map((upload, index) => (
      <div key={upload.name} className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-xs">
          <span>{upload.name}</span>
          <span className="text-muted-foreground">{upload.size}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="home-fill h-full rounded-full bg-primary"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        </div>
      </div>
    ))}
  </Panel>
);

const ActivityDemo = () => (
  <Panel className="flex flex-col gap-1 px-3 py-1.5 [mask-image:linear-gradient(black_70%,transparent)]">
    {[
      {
        person: PEOPLE.ada,
        text: 'renamed it from "notes.md" to "README.md"',
        when: "Today, 10:42",
      },
      { person: PEOPLE.you, text: "shared it with Grace as editor", when: "Today, 09:15" },
      { person: PEOPLE.grace, text: "downloaded it", when: "Yesterday" },
    ].map((line) => (
      <div key={line.text} className="flex items-start gap-2.5 py-1.5 leading-snug">
        <DemoAvatar person={line.person} />
        <span>
          <span className="font-medium">{line.person.name}</span> {line.text}
          <span className="block text-xs text-muted-foreground">{line.when}</span>
        </span>
      </div>
    ))}
  </Panel>
);

const TrashDemo = () => (
  <Panel className="divide-y">
    {[
      { name: "old-config.yml", type: "file" as const, left: "28 days left" },
      { name: "tmp", type: "folder" as const, left: "3 days left" },
    ].map((item) => (
      <div key={item.name} className="flex items-center gap-2 px-3 py-2">
        <ItemIcon
          item={{ type: item.type, name: item.name, mimeType: null }}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{item.left}</span>
        <Button variant="outline" size="xs" tabIndex={-1}>
          Restore
        </Button>
      </div>
    ))}
  </Panel>
);

// What's in the bucket: a grid of the app's features, each with a small
// working-looking demo built from the app's own components.
const FeatureGrid = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <Tile
        icon={Code}
        title="Edit any text file, together"
        text="Every text file opens in a real code editor. Everyone's cursor, live, with their name on it."
        className="md:col-span-2 lg:col-span-4 lg:row-span-2"
      >
        <EditorDemo />
      </Tile>
      <Tile
        icon={UserPlus}
        title="Share like a drive"
        text="Owner, Editor or Viewer. By email, @username or a link."
        className="lg:col-span-2 lg:row-span-2"
      >
        <ShareDemo />
      </Tile>
      <Tile
        icon={Search}
        title="Find anything"
        text="⌘K from anywhere. Typos welcome."
        className="lg:col-span-2"
      >
        <SearchDemo />
      </Tile>
      <Tile
        icon={Bell}
        title="Know right away"
        text="Realtime notifications, muted per folder if you like."
        className="lg:col-span-2"
      >
        <NotificationsDemo />
      </Tile>
      <Tile
        icon={Upload}
        title="Drop it in"
        text="Files and folders, up to 100 MB each, straight to storage."
        className="lg:col-span-2"
      >
        <UploadsDemo />
      </Tile>
      <Tile
        icon={History}
        title="Git-like versions, without the git"
        text="A version when everyone leaves, named ones when you want. Compare any two, restore in a click."
        className="md:col-span-2 lg:col-span-3"
      >
        <VersionsDemo />
      </Tile>
      <Tile
        icon={Eye}
        title="Markdown, side by side"
        text="Notes are Markdown files: write on the left, read on the right."
        className="md:col-span-2 lg:col-span-3"
      >
        <MarkdownDemo />
      </Tile>
      <Tile
        icon={Activity}
        title="See what happened"
        text="Every file and folder keeps its own activity log."
        className="lg:col-span-2"
      >
        <ActivityDemo />
      </Tile>
      <Tile
        icon={Trash2}
        title="Undo the oops"
        text="The trash keeps things for 30 days. Restore with one click."
        className="lg:col-span-2"
      >
        <TrashDemo />
      </Tile>
      <Tile
        icon={Palette}
        title="Make it yours"
        text={`${LISTED_THEMES} themes, your own accent, fonts and density.`}
        className="md:col-span-2 lg:col-span-2"
      >
        <ThemesDemo />
      </Tile>
    </div>
  );
};

export default FeatureGrid;
