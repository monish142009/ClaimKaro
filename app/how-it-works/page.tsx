import Link from "next/link";

const sectionClass = "rounded-2xl border border-navy/10 bg-white p-6 shadow-sm";

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">How ClaimKaro works</h1>
      <p className="max-w-2xl text-lg leading-relaxed text-navy/80">
        A four-step process that helps you prepare, then leaves the final application to the official portal.
      </p>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-navy">1. Describe your situation</h2>
        <p className="mt-2 text-navy/80">
          Tell us your situation in plain language. English, Telugu and Hindi selection is planned, but it is not fully
          available yet.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-navy">2. Likely eligibility</h2>
        <p className="mt-2 text-navy/80">
          &quot;Likely eligible&quot; means that scheme rules match what you told us. It is not a guarantee. The
          government decides whether you qualify.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-navy">3. Document checklist</h2>
        <p className="mt-2 text-navy/80">
          ClaimKaro will list the documents each scheme requires, so you can prepare them before you apply. Document
          checklists are not connected yet.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-navy">4. Apply on the official portal</h2>
        <p className="mt-2 text-navy/80">
          ClaimKaro links you to the official site. You complete the application there.
        </p>
        <p className="mt-3 font-medium text-navy">ClaimKaro does not submit applications on your behalf.</p>
        <p className="mt-2 text-navy/80">
          Application status is tracked manually; it is not verified against government systems.
        </p>
      </section>

      <div>
        <Link
          href="/discover"
          className="inline-flex items-center rounded-md bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal/90"
        >
          Discover schemes
        </Link>
      </div>
    </div>
  );
}
