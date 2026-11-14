"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { getMuteState, setItemMute } from "@/app/drive/mute-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { muteQueryKey } from "@/lib/query-keys";

// "Mute notifications" in an item's menu (decision 0010). Asked for when the
// menu opens (menus render their items only while open). Muted by a folder
// above: shown, but changed on that folder.
const MuteMenuItem = ({ item }: { item: { id: string; name: string } }) => {
  const queryClient = useQueryClient();
  const state = useQuery({
    queryKey: muteQueryKey(item.id),
    queryFn: async () => {
      const result = await getMuteState({ itemId: item.id });
      if (result.error !== null) throw new Error(result.error);
      return result;
    },
    staleTime: 0,
  });

  if (!state.data) {
    return (
      <DropdownMenuItem disabled>
        <BellOff />
        Mute notifications
      </DropdownMenuItem>
    );
  }
  if (state.data.mutedAbove) {
    return (
      <DropdownMenuItem disabled>
        <BellOff />
        Muted by a folder above
      </DropdownMenuItem>
    );
  }
  const { muted } = state.data;
  return (
    <DropdownMenuItem
      onSelect={async () => {
        const result = await setItemMute({ itemId: item.id, muted: !muted });
        if (result.error !== null) {
          toast.error(result.error);
          return;
        }
        toast.success(muted ? `Unmuted "${item.name}"` : `Muted "${item.name}"`);
        // Everything inside it may have changed too.
        await queryClient.invalidateQueries({ queryKey: ["mute"] });
      }}
    >
      {muted ? <Bell /> : <BellOff />}
      {muted ? "Unmute notifications" : "Mute notifications"}
    </DropdownMenuItem>
  );
};

export default MuteMenuItem;
