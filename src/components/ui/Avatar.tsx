interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  src?: string | null;
}

const sizes = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-base",
};

export function Avatar({ name, size = "md", src }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter((part) => !part.endsWith("."))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand ${sizes[size]}`}
      aria-hidden="true"
    >
      {initials}
      {src && <img src={src} alt="" className="absolute inset-0 size-full object-cover" onError={(event) => { event.currentTarget.remove(); }} />}
    </span>
  );
}
