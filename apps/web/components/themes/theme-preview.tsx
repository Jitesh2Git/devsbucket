"use client";

import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Ellipsis,
  File,
  FileCode,
  FileImage,
  Folder,
  FolderDown,
  FolderInput,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// A colour from the theme's accent, turned around the colour wheel: the
// code colours and the people's dots follow the theme (CSS relative colour
// syntax; an older browser just shows the text colour).
const tone = (turn: number): CSSProperties => ({
  color: `oklch(from var(--primary-text) l c calc(h + ${turn}))`,
});
const dot = (turn: number): CSSProperties => ({
  background: `oklch(from var(--primary) l c calc(h + ${turn}))`,
});

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-3">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
    {children}
  </section>
);

// Drawn like the app's toasts (sonner), always visible.
const SampleToast = ({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: string;
}) => (
  <div className="flex items-start gap-3 rounded-lg border bg-popover p-3.5 text-sm text-popover-foreground shadow-md">
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="font-medium">{title}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </div>
    {action && (
      <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
        {action}
      </span>
    )}
  </div>
);

// docker-compose.yml, coloured the way an editor would: keys in the accent,
// strings, numbers and comments in its neighbours.
type Token = [text: string, kind?: "key" | "string" | "number" | "comment" | "punct"];
const CODE: Token[][] = [
  [["# Local services for DevsBucket", "comment"]],
  [
    ["services", "key"],
    [":", "punct"],
  ],
  [["  "], ["postgres", "key"], [":", "punct"]],
  [["    "], ["image", "key"], [": ", "punct"], ['"postgres:18.6-alpine"', "string"]],
  [
    ["    "],
    ["ports", "key"],
    [": [", "punct"],
    ['"127.0.0.1:5432:5432"', "string"],
    ["]", "punct"],
  ],
  [["    "], ["healthcheck", "key"], [":", "punct"]],
  [["      "], ["interval", "key"], [": ", "punct"], ["5s", "number"]],
  [["      "], ["retries", "key"], [": ", "punct"], ["10", "number"]],
  [["  "], ["garage", "key"], [":", "punct"], ["  # S3 storage", "comment"]],
  [["    "], ["image", "key"], [": ", "punct"], ['"dxflrs/garage:v2.1.0"', "string"]],
];
const CURRENT_LINE = 4;
const tokenStyle = (kind: Token[1]): CSSProperties | undefined =>
  kind === "key"
    ? tone(0)
    : kind === "string"
      ? tone(130)
      : kind === "number"
        ? tone(60)
        : undefined;

const CodeSample = () => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <div className="flex border-b bg-muted/50 text-xs">
      <span className="flex items-center gap-1.5 border-r border-b-2 border-b-primary bg-card px-3 py-2 font-medium">
        <FileCode className="size-3.5 text-primary-text" />
        docker-compose.yml
      </span>
      <span className="flex items-center gap-1.5 px-3 py-2 text-muted-foreground">
        <File className="size-3.5" />
        README.md
      </span>
    </div>
    <pre className="overflow-x-auto py-2 font-mono text-xs leading-6">
      {CODE.map((line, index) => {
        const number = index + 1;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed sample lines
            key={index}
            className={number === CURRENT_LINE ? "flex bg-muted/60 pr-4" : "flex pr-4"}
          >
            <span className="w-10 shrink-0 pr-3 text-right text-muted-foreground/70 select-none">
              {number}
            </span>
            <code>
              {line.map(([text, kind], i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed sample tokens
                  key={i}
                  style={tokenStyle(kind)}
                  className={
                    kind === "comment"
                      ? "text-muted-foreground italic"
                      : kind === "punct"
                        ? "text-muted-foreground"
                        : undefined
                  }
                >
                  {text}
                </span>
              ))}
              {number === CURRENT_LINE && (
                <span
                  aria-hidden
                  className="ml-px inline-block h-4 w-0.5 translate-y-0.5 bg-primary"
                />
              )}
            </code>
          </div>
        );
      })}
    </pre>
  </div>
);

const ROWS = [
  { name: "design-system", icon: Folder, size: "171 MB", shared: true, folder: true },
  { name: "api-server", icon: Folder, size: "5.4 MB", folder: true, hover: true },
  { name: "docker-compose.yml", icon: FileCode, size: "2.1 KB" },
  { name: "screenshot-login.png", icon: FileImage, size: "820 KB" },
];

const MenuSample = () => (
  <div className="w-max min-w-48 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <FolderDown className="size-4" /> Download as ZIP
    </div>
    <div className="-mx-1 my-1 h-px bg-border" />
    <div className="flex items-center gap-2 rounded-md bg-accent px-1.5 py-1 text-accent-foreground">
      <UserPlus className="size-4" /> Share
    </div>
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <Pencil className="size-4" /> Rename
    </div>
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <FolderInput className="size-4" /> Move
    </div>
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <Ellipsis className="size-4" /> More
    </div>
    <div className="-mx-1 my-1 h-px bg-border" />
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-destructive">
      <Trash2 className="size-4" /> Move to trash
    </div>
  </div>
);

// A sample of the app's pieces, all visible at once, so a theme can be
// judged without clicking around. (The rest of the app changes too.)
const ThemePreview = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>The same pieces the drive uses, with the theme applied.</CardDescription>
      </CardHeader>
      {/* Two columns on wide screens, so the preview reads like a screen:
          the drive beside the toasts, the editor beside the menu, then the
          fields across the bottom. */}
      <CardContent className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Section title="Drive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5 font-heading text-lg font-semibold">
              <span className="font-normal text-muted-foreground">My Drive</span>
              <ChevronRight className="size-4 text-muted-foreground" />
              <span className="truncate">Projects</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <Upload />
                Upload
              </Button>
              <Button size="sm">New folder</Button>
            </div>
          </div>
          <Table aria-label="Preview files">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.name} className={row.hover ? "bg-muted/50" : undefined}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <row.icon
                        className={
                          row.folder ? "size-4 text-primary-text" : "size-4 text-muted-foreground"
                        }
                      />
                      {row.name}
                      {row.shared && (
                        <span className="rounded-full border px-2 text-[0.7rem] font-normal text-muted-foreground">
                          Shared
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.size}</TableCell>
                  <TableCell>
                    <MoreHorizontal className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Toasts">
          <div className="flex flex-col gap-2">
            <SampleToast
              icon={<CircleCheck className="size-4 text-primary-text" />}
              title="Saved as version 2"
            />
            <SampleToast
              icon={<Info className="size-4 text-muted-foreground" />}
              title={'"old-notes" moved to trash'}
              action="Undo"
            />
            <SampleToast
              icon={<Spinner className="size-4" />}
              title={'Preparing "Projects.zip"…'}
              description="12 files, 4.8 MB"
            />
            <SampleToast
              icon={<CircleAlert className="size-4 text-destructive" />}
              title="You don't have permission to do that."
            />
          </div>
        </Section>

        <Section title="Editor">
          <CodeSample />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Also here</span>
            {[
              ["Ada", 0],
              ["Bob", 120],
              ["Cleo", 240],
            ].map(([name, turn]) => (
              <span
                key={name}
                className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-foreground"
              >
                <span aria-hidden className="size-2 rounded-full" style={dot(Number(turn))} />
                {name}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Menu">
          <MenuSample />
        </Section>

        <div className="xl:col-span-2">
          <Section title="Fields and status">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="preview-name">Folder name</Label>
                <Input id="preview-name" defaultValue="api-server" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="preview-role">Role</Label>
                <Select defaultValue="editor">
                  <SelectTrigger id="preview-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="preview-notify" defaultChecked />
              <Label htmlFor="preview-notify" className="font-normal">
                Tell me when files are added
              </Label>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <Progress value={36} aria-label="Storage used" />
              363 MB of 1 GB used
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground">
                Owner
              </span>
              <span className="rounded-md border px-2 py-0.5">Editor</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">Viewer</span>
              <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive">
                Storage full
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <div className="flex flex-col gap-0.5">
                <span>
                  <span className="font-medium">Ada</span> shared "design-system" with you
                </span>
                <span className="text-xs text-muted-foreground">2 minutes ago · Editor</span>
              </div>
            </div>
          </Section>
        </div>

        <div>
          <Button variant="outline" size="sm" onClick={() => toast.success("Saved as version 2")}>
            Show a real toast
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemePreview;
