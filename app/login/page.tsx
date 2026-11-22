import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">Log in</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-navy/80">
        Accounts are not available yet. You can still browse schemes as a guest.
      </p>

      <section className="mt-8 max-w-md rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-navy/80">
          Login is not implemented yet, so there is no account system and no fake sign-in.
        </p>
        <div className="mt-6">
          <Link
            href="/discover"
            className="inline-flex items-center rounded-md border border-navy/20 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
          >
            Continue as guest (browse only)
          </Link>
        </div>
      </section>
    </div>
  );
}
