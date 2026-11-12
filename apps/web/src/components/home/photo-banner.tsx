import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { softPill } from "@/lib/v3";

/**
 * A full-width photo card from the website board: headline and a "Get started"
 * pill over the left of the photo, and a few booking "chips" floating on it.
 *
 * The photos are reconstructed from the designer's flattened boards, and the
 * spots where a chip was baked into both sources were painted in. Each chip
 * here is placed over one of those spots, so the photo always shows at its own
 * 2:1 ratio (never cropped by `object-cover`) and the chips are positioned and
 * sized in units of the card's width (`cqw`). They then land on the same pixels
 * at every width. Under `md` the copy moves below the photo rather than
 * shrinking over it.
 */
export type BannerChip = {
  label: string;
  /** Left and top edge, in percent of the photo. */
  x: number;
  y: number;
  /** The translucent glass chip on the first photo; the rest are white. */
  glass?: boolean;
};

export function PhotoBanner({
  id,
  src,
  title,
  body,
  cta,
  chips,
  priority = false,
}: {
  id: string;
  src: string;
  title: ReactNode;
  body?: ReactNode;
  cta: string;
  chips: BannerChip[];
  priority?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="@container overflow-hidden rounded-[28px] bg-mona-ink">
      <div className="relative aspect-[2/1]">
        <Image src={src} alt="" fill priority={priority} sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
        {/* Darkens the left third so white copy clears 4.5:1 over the light bakery wall. */}
        <div aria-hidden className="absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-black/55 via-black/30 to-transparent md:block" />
        <ul aria-hidden className="absolute inset-0">
          {chips.map((chip) => (
            <li
              key={chip.label}
              style={{ left: `${chip.x}%`, top: `${chip.y}%` } as CSSProperties}
              className={cn(
                "absolute flex h-[5.2cqw] items-center gap-[0.9cqw] rounded-[0.45cqw] pr-[1.9cqw] pl-[1.6cqw] font-display text-[1.75cqw] whitespace-nowrap shadow-[0_0.3cqw_1.2cqw_rgb(0_0_0/0.18)]",
                chip.glass ? "bg-white/55 text-mona-ink backdrop-blur-md" : "bg-white text-mona-ink",
              )}
            >
              <span className={cn("grid size-[2.2cqw] place-items-center rounded-full bg-lisa text-white", chip.glass && "opacity-75")}>
                <Check className="size-[1.3cqw]" strokeWidth={2.5} />
              </span>
              {chip.label}
            </li>
          ))}
        </ul>
        <div className="absolute inset-y-0 left-0 hidden w-[46%] flex-col justify-center gap-[1.6cqw] pl-[6.2cqw] md:flex">
          <Copy id={id} title={title} body={body} cta={cta} />
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6 md:hidden">
        <Copy id={`${id}-sm`} title={title} body={body} cta={cta} />
      </div>
    </section>
  );
}

function Copy({ id, title, body, cta }: { id: string; title: ReactNode; body?: ReactNode; cta: string }) {
  // Rendered twice (over the photo from md, below it on a phone) and only one
  // is ever displayed; `display: none` keeps the other out of the
  // accessibility tree, so a screen reader meets one heading and one link.
  return (
    <>
      <h2
        id={id}
        className="font-brand text-[32px] leading-[1.05] font-semibold text-balance tracking-[-0.01em] text-white md:text-[clamp(1.75rem,4.1cqw,3.5rem)]"
      >
        {title}
      </h2>
      {body ? <p className="max-w-[30ch] font-display text-lg leading-snug text-white md:text-[clamp(1rem,1.6cqw,1.375rem)]">{body}</p> : null}
      <div className="md:mt-[0.8cqw]">
        <Button
          nativeButton={false}
          render={<Link href="/register" />}
          className={cn(softPill, "focus-visible:ring-white")}
        >
          {cta}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </>
  );
}
