import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt: string;
  className?: string;
};

export function PromptPreviewImage({ src, alt, className }: Props) {
  const fallback =
    "https://placehold.co/600x400/f9fafb/94a3b8?text=Prompt+Preview";

  return (
    <div className={cn("relative h-40 w-full overflow-hidden rounded-md bg-slate-100", className)}>
      <Image
        src={src || fallback}
        alt={alt}
        fill
        className="object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallback;
        }}
      />
    </div>
  );
}
