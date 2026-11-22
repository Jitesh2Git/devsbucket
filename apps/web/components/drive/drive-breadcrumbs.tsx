import { cn } from "cn";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROOTS = {
  "my-drive": { label: "My Drive", href: "/drive" },
  shared: { label: "Shared with me", href: "/drive/shared" },
} as const;

type DriveBreadcrumbsProps = {
  // Your own tree starts at My Drive; someone else's at Shared with me.
  root: keyof typeof ROOTS;
  // From the top down to the current folder; empty at the top of My Drive.
  folders: { id: string; name: string }[];
};

// "My Drive › src › app": every level is a link except the current one,
// which is the page's heading. Always one line, names truncating:
// - from sm up, deeper than two levels, the folders between the top and
//   the parent fold into a "…" menu ("My Drive › … › app › components");
// - on a phone, from two levels deep, everything above the current folder
//   is in that menu ("… › components").
const DriveBreadcrumbs = ({ root, folders }: DriveBreadcrumbsProps) => {
  const current = folders.at(-1);
  const ancestors = folders.slice(0, -1);
  const parent = ancestors.at(-1);
  const top = ROOTS[root];
  // From sm up: the ones between the top and the parent.
  const folded = ancestors.slice(0, -1);
  const link = (href: string, label: string) => <Link href={href}>{label}</Link>;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-2xl">
        <BreadcrumbItem className={cn("min-w-0 shrink-3", parent && "max-sm:hidden")}>
          {current ? (
            <BreadcrumbLink asChild className="truncate">
              {link(top.href, top.label)}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="min-w-0">
              <h1 className="truncate font-semibold tracking-tight">{top.label}</h1>
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {parent && (
          <>
            {/* The menu: on a phone whenever there's a parent; from sm up
                only when there are folders between the top and the parent. */}
            <BreadcrumbSeparator className="max-sm:hidden" />
            <BreadcrumbItem className={cn("shrink-0", folded.length === 0 && "sm:hidden")}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="More folders"
                  className="flex items-center rounded-md px-1 hover:text-foreground"
                >
                  <Ellipsis className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-max max-w-72">
                  <DropdownMenuItem asChild className="sm:hidden">
                    {link(top.href, top.label)}
                  </DropdownMenuItem>
                  {folded.map((folder) => (
                    <DropdownMenuItem key={folder.id} asChild>
                      {link(`/drive/folders/${folder.id}`, folder.name)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild className="sm:hidden">
                    {link(`/drive/folders/${parent.id}`, parent.name)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            {folded.length > 0 && <BreadcrumbSeparator className="max-sm:hidden" />}
            <BreadcrumbItem className="min-w-0 shrink-3 max-sm:hidden">
              <BreadcrumbLink asChild className="truncate">
                {link(`/drive/folders/${parent.id}`, parent.name)}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}

        {current && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="min-w-0">
                <h1 className="truncate font-semibold tracking-tight">{current.name}</h1>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default DriveBreadcrumbs;
