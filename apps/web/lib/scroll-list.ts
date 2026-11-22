// The scroll box for a page's list (folders, Recent, Shared with me, Trash,
// Notifications). From md up the drive's right column has a fixed height
// and the page fills it: the heading and buttons stay, and only this box
// scrolls, with the table's column headings stuck to its top. Phones keep
// normal page scrolling.
//
// - shadcn's table wrapper scrolls sideways (overflow-x-auto), which would
//   make it the headings' scroll box instead, so from md up it doesn't (the
//   tables' phone-only min widths are off there, so nothing overflows).
// - The line under the headings is a shadow: with collapsed borders the
//   row's own border would scroll away with the rows.
// - `relative` keeps sr-only text (positioned absolutely) inside the box;
//   without it, it's placed against the page and stretches it.
export const SCROLL_LIST =
  "relative md:min-h-0 md:flex-1 md:overflow-y-auto md:**:data-[slot=table-container]:overflow-visible md:[&_thead]:sticky md:[&_thead]:top-0 md:[&_thead]:z-10 md:[&_thead]:bg-background md:[&_th]:shadow-[inset_0_-1px_0_var(--color-border)]";
