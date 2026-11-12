import Link from "next/link";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type DriveBreadcrumbsProps = {
  // From the top of My Drive down to the current folder; empty at the top.
  folders: { id: string; name: string }[];
};

// "My Drive › src › app": every level is a link except the current one,
// which is the page's heading.
const DriveBreadcrumbs = ({ folders }: DriveBreadcrumbsProps) => {
  const current = folders.at(-1);
  const ancestors = folders.slice(0, -1);

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="text-2xl">
        <BreadcrumbItem>
          {current ? (
            <BreadcrumbLink asChild>
              <Link href="/drive">My Drive</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>
              <h1 className="font-semibold tracking-tight">My Drive</h1>
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {ancestors.map((folder) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbLink asChild className="truncate">
                <Link href={`/drive/folders/${folder.id}`}>{folder.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}
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
