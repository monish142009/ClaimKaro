import { Suspense } from "react";
import Link from "next/link";
import NavLinks from "@/components/nav-links";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="fill-teal"
          >
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 13.6-3.6-3.6 1.4-1.4 2.2 2.2 4.6-4.6 1.4 1.4-6 6Z" />
          </svg>
          <span className="text-xl font-bold tracking-tight text-navy">
            ClaimKaro
          </span>
        </Link>
        <div className="hidden md:block">
          <Suspense fallback={null}>
            <NavLinks />
          </Suspense>
        </div>
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-navy/20 px-3 py-2 text-sm font-semibold text-navy hover:bg-navy/5">
            Menu
          </summary>
          <div className="absolute right-0 z-50 mt-2 min-w-48 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
            <Suspense fallback={null}>
              <NavLinks mobile />
            </Suspense>
          </div>
        </details>
      </div>
    </header>
  );
}
