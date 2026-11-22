"use client";

import { isEditableName } from "@devsbucket/shared/editing";
import { SEARCH_MIN } from "@devsbucket/shared/search";
import { useQuery } from "@tanstack/react-query";
import { File, Folder, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { loadRecentForSearch, searchDrive } from "@/app/drive/search-actions";
import FilePreview, { type PreviewFile } from "@/components/drive/file-preview";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";

type Found = {
  id: string;
  type: "folder" | "file";
  name: string;
  mimeType: string | null;
  size: number | null;
  // Shown next to the name: where it is (empty for recent files).
  detail: string;
};

// The text being typed, settled for `ms`: searching on every key would send
// a request per letter.
const useSettled = (value: string, ms: number) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
};

// "⌘K" on a Mac, "Ctrl K" elsewhere. The server can't know, so it renders
// "Ctrl K" and the browser swaps in its own right after hydration.
const subscribe = () => () => {};
const ShortcutHint = () => {
  const mac = useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  return (
    // Not on phones: no keyboard to press it on, and little room.
    <kbd className="ml-auto hidden rounded border px-1.5 text-xs text-muted-foreground sm:inline">
      {mac ? "⌘K" : "Ctrl K"}
    </kbd>
  );
};

// Cmd+K (Ctrl+K) anywhere in the drive, or the Search button in the
// sidebar (Phase 5, decision 0017). Searches names on the server; with an
// empty box it lists the last files you opened. Folders and text files
// open their page; other files open the preview here.
const SearchPalette = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [previewing, setPreviewing] = useState<PreviewFile | null>(null);
  const query = useSettled(text.trim(), 200);
  const searching = query.length >= SEARCH_MIN;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Already handled: Monaco uses Ctrl+K to start its own shortcuts.
      if (event.defaultPrevented) return;
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const recent = useQuery({
    queryKey: ["search", "recent"],
    queryFn: async () => {
      const result = await loadRecentForSearch();
      if (result.error !== null) throw new Error(result.error);
      return result.recent.map((item): Found => ({ ...item, detail: "" }));
    },
    enabled: open && !searching,
    staleTime: 0,
  });
  const results = useQuery({
    queryKey: ["search", "results", query],
    queryFn: async () => {
      const result = await searchDrive({ query });
      if (result.error !== null) throw new Error(result.error);
      return result.results.map(
        (item): Found => ({
          ...item,
          detail: item.ownerName ? `${item.location} · ${item.ownerName}` : item.location,
        }),
      );
    },
    enabled: open && searching,
  });

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setText("");
  };

  const choose = (item: Found) => {
    close(false);
    if (item.type === "folder") {
      router.push(`/drive/folders/${item.id}`);
    } else if (isEditableName(item.name, item.mimeType)) {
      router.push(`/drive/files/${item.id}`);
    } else {
      setPreviewing(item);
    }
  };

  const list = searching ? results : recent;
  const items = list.data ?? [];

  return (
    <>
      <Button
        variant="outline"
        className="justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search />
        Search
        <ShortcutHint />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={close}
        title="Search"
        description="Search the names of your files and folders, and of everything shared with you."
      >
        {/* The server filters and orders the results, so cmdk mustn't. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={text}
            onValueChange={setText}
            placeholder="Search files and folders"
            aria-label="Search files and folders"
          />
          <CommandList>
            {list.isFetching && items.length === 0 ? (
              <div className="flex justify-center py-6">
                <Spinner aria-label="Searching" className="size-5 text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {list.isError
                  ? list.error.message
                  : searching
                    ? "Nothing found."
                    : text.trim().length > 0
                      ? `Type at least ${SEARCH_MIN} characters.`
                      : "Files you open show up here."}
              </CommandEmpty>
            )}
            {items.length > 0 && (
              <CommandGroup heading={searching ? "Results" : "Recent"}>
                {items.map((item) => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => choose(item)}>
                    {item.type === "folder" ? <Folder /> : <File />}
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.detail && (
                      <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
      <FilePreview file={previewing} onClose={() => setPreviewing(null)} />
    </>
  );
};

export default SearchPalette;
