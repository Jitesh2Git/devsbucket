import { formatBytes } from "@devsbucket/shared/bytes";
import {
  Bell,
  Clock,
  FileCode,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Moon,
  MoreHorizontal,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import ItemIcon from "@/components/drive/item-icon";
import DemoAvatar from "@/components/home/demo-avatar";
import { PEOPLE } from "@/components/home/demo-people";
import LogoMark from "@/components/logo-mark";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = { name: string; type: "folder" | "file"; size: number | null; modified: string };

const ROWS: Row[] = [
  { name: "src", type: "folder", size: null, modified: "10 min ago" },
  { name: "migrations", type: "folder", size: null, modified: "Yesterday" },
  { name: "docs", type: "folder", size: null, modified: "Nov 18" },
  { name: "README.md", type: "file", size: 6_100, modified: "2 min ago" },
  { name: "server.ts", type: "file", size: 3_200, modified: "1 hour ago" },
  { name: "compose.yml", type: "file", size: 1_100, modified: "Nov 20" },
  { name: ".env.example", type: "file", size: 412, modified: "Nov 20" },
  { name: "architecture.png", type: "file", size: 820_000, modified: "Nov 12" },
];
// The file that "arrives" while the uploads card fills.
const NEW_ROW: Row = { name: "seed.sql", type: "file", size: 4_200_000, modified: "Just now" };

const NAV = [
  { label: "My Drive", icon: HardDrive, active: true },
  { label: "Recent", icon: Clock },
  { label: "Shared with me", icon: Users },
  { label: "Notifications", icon: Bell, unread: 3 },
  { label: "Trash", icon: Trash2 },
];

const UPLOADS = [
  { name: "logo.svg", size: "18 KB" },
  { name: "seed.sql", size: "4.2 MB" },
  { name: "demo.mp4", size: "61 MB, in parts" },
];

const FileRow = ({ row, className }: { row: Row; className?: string }) => (
  <TableRow className={className}>
    <TableCell className="max-w-0">
      <span className="flex items-center gap-2">
        <ItemIcon
          item={{ type: row.type, name: row.name, mimeType: null }}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="truncate">{row.name}</span>
      </span>
    </TableCell>
    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
      {row.size === null ? "—" : formatBytes(row.size)}
    </TableCell>
    <TableCell className="hidden text-muted-foreground sm:table-cell">{row.modified}</TableCell>
    <TableCell className="w-10 text-muted-foreground">
      <MoreHorizontal className="size-4" />
    </TableCell>
  </TableRow>
);

// The hero's picture: the real drive page (the same sidebar, buttons and
// table as /drive) in a browser window, with an upload, a notification and
// someone editing floating around it. Made of the app's own components, so
// it follows the visitor's theme. Only a picture: hidden from screen
// readers and inert (nothing in it can be focused or clicked).
const DriveMock = () => {
  return (
    <div aria-hidden inert className="relative mx-auto w-full max-w-5xl text-left">
      <div
        className="home-float absolute top-28 -left-14 z-10 hidden w-68 items-start gap-2.5 rounded-xl border bg-popover p-3 text-sm shadow-xl xl:flex"
        style={{ animationDelay: "1.4s, 2.1s" }}
      >
        <DemoAvatar person={PEOPLE.ada} />
        <span className="leading-snug">
          Ada shared "design-docs" with you as editor
          <span className="mt-0.5 block text-xs text-muted-foreground">Just now</span>
        </span>
      </div>
      <div
        className="home-float absolute top-20 right-16 z-10 hidden items-center gap-2 rounded-full border bg-popover py-1 pr-3 pl-1 text-xs shadow-lg xl:flex"
        style={{ animationDelay: "2s, 2.7s" }}
      >
        <DemoAvatar person={PEOPLE.grace} className="size-5 text-[0.6rem]" />
        Grace is editing <span className="font-medium">README.md</span>
      </div>
      <div
        className="home-float absolute -right-12 bottom-10 z-10 hidden w-72 flex-col gap-2.5 rounded-xl border bg-popover p-3.5 text-sm shadow-xl xl:flex"
        style={{ animationDelay: "0.6s, 1.3s" }}
      >
        <div className="flex items-center justify-between font-medium">
          Uploading 3 files
          <span className="text-xs font-normal text-muted-foreground">2 of 3</span>
        </div>
        {UPLOADS.map((upload, index) => (
          <div key={upload.name} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-xs">
              <span>{upload.name}</span>
              <span className="text-muted-foreground">{upload.size}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="home-fill h-full rounded-full bg-primary"
                style={{ animationDelay: `${index * 0.4}s` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center gap-1.5 border-b bg-muted px-3.5 py-2.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="mx-auto truncate rounded-md border bg-background px-4 py-0.5 font-mono text-[0.7rem] text-muted-foreground sm:px-10">
            devsbucket/drive/folders/api-server
          </span>
        </div>
        <div className="flex h-12 items-center justify-between border-b px-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <LogoMark />
            DevsBucket
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" tabIndex={-1}>
              <Moon />
            </Button>
            <DemoAvatar person={PEOPLE.you} className="size-7" />
          </span>
        </div>

        <div className="flex gap-6 p-4 md:p-5">
          <aside data-slot="drive-sidebar" className="hidden w-52 shrink-0 flex-col gap-6 md:flex">
            <Button variant="outline" className="justify-start text-muted-foreground" tabIndex={-1}>
              <Search />
              Search
              <kbd className="ml-auto rounded border px-1.5 text-xs text-muted-foreground">⌘K</kbd>
            </Button>
            <nav className="flex flex-col gap-1">
              {NAV.map(({ label, icon: Icon, active, unread }) => (
                <Button
                  key={label}
                  variant={active ? "secondary" : "ghost"}
                  className="justify-start"
                  tabIndex={-1}
                >
                  <Icon />
                  {label}
                  {unread && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {unread}
                    </span>
                  )}
                </Button>
              ))}
            </nav>
            <div className="flex flex-col gap-2 px-3">
              <Progress value={31} />
              <p className="text-xs text-muted-foreground">312 MB of 1 GB used</p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>My Drive</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>api-server</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex flex-wrap gap-2">
                <span className="flex rounded-lg border p-0.5">
                  <Button variant="ghost" size="icon-xs" tabIndex={-1}>
                    <LayoutGrid />
                  </Button>
                  <Button variant="secondary" size="icon-xs" tabIndex={-1}>
                    <List />
                  </Button>
                </span>
                <Button variant="outline" className="hidden lg:inline-flex" tabIndex={-1}>
                  <UserPlus />
                  Share
                </Button>
                <Button variant="outline" className="hidden sm:inline-flex" tabIndex={-1}>
                  <FileCode />
                  New file
                </Button>
                <Button variant="outline" className="hidden sm:inline-flex" tabIndex={-1}>
                  <FolderPlus />
                  New folder
                </Button>
                <Button tabIndex={-1}>
                  <Upload />
                  Upload
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden w-28 text-right sm:table-cell">Size</TableHead>
                  <TableHead className="hidden w-36 sm:table-cell">Modified</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.slice(0, 3).map((row) => (
                  <FileRow key={row.name} row={row} />
                ))}
                <FileRow
                  row={NEW_ROW}
                  className="bg-primary/5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:fill-mode-both motion-safe:[animation-delay:1.2s] motion-safe:duration-700"
                />
                {ROWS.slice(3).map((row) => (
                  <FileRow key={row.name} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveMock;
