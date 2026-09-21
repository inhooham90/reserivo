import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Marketing landing for salon owners. Customers arrive via /{slug} links instead. */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
        Online booking your salon and your stylists will both love.
      </h1>
      <p className="max-w-md text-muted-foreground">
        Give every designer their own schedule and services, keep client contact details private, and manage it all
        from one place.
      </p>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/register" />}>Get started</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
          Sign in
        </Button>
      </div>
    </main>
  );
}
