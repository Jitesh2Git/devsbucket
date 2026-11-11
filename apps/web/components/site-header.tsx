import Link from "next/link";
import ModeToggle from "@/components/mode-toggle";

const SiteHeader = () => {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          DevsBucket
        </Link>
        <ModeToggle />
      </div>
    </header>
  );
};

export default SiteHeader;
