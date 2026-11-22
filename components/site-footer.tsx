import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-navy/10 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">ClaimKaro</h2>
          <p className="text-sm text-white/80">
            An independent discovery tool that helps students understand which
            Telangana government schemes they may be likely eligible for.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Official sources</h2>
          <p className="text-sm text-white/80">
            Scheme information links to official government portals. Always
            confirm details there.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Privacy</h2>
          <p className="text-sm text-white/80">
            No Aadhaar, PAN, bank or password collection. Guest browsing stores
            nothing you have not chosen to save.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Disclaimer</h2>
          <p className="text-sm text-white/80">
            ClaimKaro is an independent discovery tool and is not affiliated
            with any government department. Likely eligibility is not a
            guarantee of approval.
          </p>
        </section>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-sm text-white/80 sm:px-6">
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/discover" className="hover:text-white">Discover Schemes</Link>
            <Link href="/how-it-works" className="hover:text-white">How It Works</Link>
            <Link href="/login" className="hover:text-white">Login</Link>
          </nav>
          <p>© ClaimKaro</p>
        </div>
      </div>
    </footer>
  );
}

