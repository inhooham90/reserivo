import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";

/**
 * Shared frame for sign-in, registration, password reset and email
 * confirmation: the page's own form on the left, a photograph on the right
 * from `lg` up. Below that the photograph is dropped so the form is the first
 * thing on a phone. Each page still renders its own <main>.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex h-16 items-center px-6">
          <Link href="/" className="font-heading text-xl tracking-tight">
            {LEGAL.product}
          </Link>
        </header>
        {children}
      </div>
      <div aria-hidden className="hidden p-3 lg:block">
        <div className="relative h-full min-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-xl">
          <Image src="/images/auth-salon.png" alt="" fill priority sizes="50vw" className="object-cover" />
        </div>
      </div>
    </div>
  );
}
