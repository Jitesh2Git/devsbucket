import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAvatarProps = {
  name: string;
  image: string | null;
  className?: string;
};

// "Jitesh Mali" -> "JM", "demo" -> "D"
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// The user's picture (GitHub avatar for now), or their initials.
const UserAvatar = ({ name, image, className }: UserAvatarProps) => {
  return (
    <Avatar className={className}>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
