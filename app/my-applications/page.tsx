import Link from "next/link";

export default function MyApplicationsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">My applications</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-navy/80">
        Keep track of the schemes you have applied for on the official portals.
      </p>

      <section className="mt-8 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-8 text-center">
        <p className="text-lg font-medium text-navy">You haven&apos;t tracked any applications yet.</p>
        <p className="mt-2 text-navy/70">
          Application tracking will be available once accounts or guest profiles are connected.
        </p>
        <div className="mt-6">
          <Link
            href="/discover"
            className="inline-flex items-center rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal/90"
          >
            Discover schemes
          </Link>
        </div>
      </section>
    </div>
  );
}
