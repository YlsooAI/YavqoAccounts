type AvatarProps = {
  avatarUrl: string | null;
  initial: string;
  className?: string;
};

export default function Avatar({
  avatarUrl,
  initial,
  className = "",
}: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center rounded-full bg-linear-to-br from-[#4f46e5] via-[#8b5cf6] to-[#06b6d4] text-white ${className}`}
    >
      {initial}
    </span>
  );
}
