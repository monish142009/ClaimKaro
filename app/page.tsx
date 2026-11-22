import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import SituationInput from "@/components/situation-input";
import LanguageSelector from "@/components/language-selector";

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-IN");
}

async function FeaturedSchemes() {
  await connection();

  let schemes: Awaited<ReturnType<typeof prisma.scheme.findMany>> | null = null;
  try {
    schemes = await prisma.scheme.findMany({
      take: 4,
      orderBy: { name: "asc" },
      where: { verificationStatus: { not: "RETIRED" } },
    });
  } catch {
    schemes = null;
  }

  return schemes === null ? (
    <p className="mt-6 rounded-2xl border border-navy/10 bg-white p-4 text-navy/80">
      Scheme data is not available. Run npm run db:seed.
    </p>
  ) : (
    <>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {schemes.map((scheme) => (
          <article
            key={scheme.slug}
            className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-navy/10 px-2.5 py-1 text-navy">
                {scheme.level === "CENTRAL" ? "Central" : "State"}
              </span>
              {scheme.verificationStatus === "UNVERIFIED" && (
                <span className="rounded-full bg-saffron/20 px-2.5 py-1 text-amber-800">
                  Verification pending
                </span>
              )}
              {scheme.verificationStatus === "VERIFIED" && (
                <span className="rounded-full bg-teal/10 px-2.5 py-1 text-teal">
                  Verified
                  {scheme.lastVerifiedAt
                    ? ` · ${formatDate(scheme.lastVerifiedAt)}`
                    : ""}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-teal">
                {scheme.shortName}
              </p>
              <h3 className="text-lg font-bold leading-snug text-navy">
                {scheme.name}
              </h3>
              <p className="mt-1 text-sm text-navy/70">
                {scheme.department}
              </p>
            </div>
            {scheme.benefitSummary && (
              <p className="text-sm text-navy/80">
                {scheme.benefitSummary}
              </p>
            )}
            <p className="text-sm text-navy/80">
              {scheme.deadline
                ? `Deadline: ${formatDate(scheme.deadline)}`
                : "Deadline not verified — check the official portal"}
            </p>
            <Link
              href={`/schemes/${scheme.slug}`}
              className="mt-auto pt-2 text-sm font-semibold text-teal hover:underline"
            >
              View details →
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm text-navy/70">
        Sample records are drafts pending administrator verification and
        are not yet published.
      </p>
    </>
  );
}

export default async function Home() {
  const steps = [
    "Describe your situation",
    "Review likely matches with reasons",
    "Prepare the document checklist",
    "Apply on the official portal and track manually",
  ];

  return (
    <div className="flex flex-col">
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-navy sm:text-4xl">
              Find government schemes you may be likely eligible for
            </h1>
            <p className="text-lg leading-relaxed text-navy/80">
              ClaimKaro helps Telangana students understand likely eligibility,
              the documents they need and the official application steps. It
              does not guarantee approval.
            </p>
            <Link
              href="/how-it-works"
              className="self-start rounded-md border border-navy/20 px-5 py-2.5 font-semibold text-navy hover:bg-navy/5"
            >
              How It Works
            </Link>
          </div>
          <div className="flex flex-col gap-6">
            <SituationInput />
            <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
              <LanguageSelector />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy/5">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-navy">Featured schemes</h2>
          <Suspense
            fallback={
              <p className="mt-6 text-sm text-navy/70">Loading featured schemes…</p>
            }
          >
            <FeaturedSchemes />
          </Suspense>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-navy">How it works</h2>
          <ol className="mt-8 flex flex-col gap-6 md:flex-row">
            {steps.map((step, index) => (
              <li key={step} className="flex flex-1 items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="font-medium text-navy">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/how-it-works"
            className="mt-8 inline-block rounded-md bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal/90"
          >
            Read the full process
          </Link>
        </div>
      </section>

      <section className="border-y border-teal/20 bg-teal/5">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm font-medium text-navy sm:grid-cols-2 sm:px-6">
          <p>We never ask for Aadhaar, PAN, bank details, passwords or OTPs.</p>
          <p>Results are likely eligibility, not guaranteed approval.</p>
        </div>
      </section>
    </div>
  );
}
