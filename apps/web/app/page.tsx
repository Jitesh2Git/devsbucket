import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import FeatureGrid from "@/components/home/feature-grid";
import FeatureMarquee from "@/components/home/feature-marquee";
import Hero from "@/components/home/hero";
import HomeActions from "@/components/home/home-actions";
import Reveal from "@/components/home/reveal";

export const metadata: Metadata = {
  description:
    "A file drive for developers: folders, Drive-style sharing, and live editing for every text file, with git-like history.",
};

const FACTS = [
  { value: "1 GB", text: "of space for each person" },
  { value: "100 MB", text: "per file, big ones upload in parts" },
  { value: "30 days", text: "in the trash before it's gone" },
  { value: "$0", text: "free, with no plans to charge" },
];

const STEPS = [
  {
    title: "Get an invite",
    text: "DevsBucket is invite-only. Ask someone who's already in for a code.",
  },
  {
    title: "Create your account",
    text: "Email and password, or continue with GitHub. You start with 1 GB.",
  },
  {
    title: "Drop your files in",
    text: "Upload a folder, open its README, and share it with your team.",
  },
];

const SectionTitle = ({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) => (
  <Reveal className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-3 text-center">
    <p className="font-mono text-xs tracking-wider text-primary-text uppercase">{eyebrow}</p>
    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
    {children && <p className="text-muted-foreground">{children}</p>}
  </Reveal>
);

// The homepage, for everyone: what DevsBucket does, shown with the app's
// own components, and the ways in (or, signed in, back to your drive).
const HomePage = () => {
  return (
    <div className="flex flex-col pb-16">
      <Hero />

      <div className="mx-auto flex w-full max-w-6xl flex-col px-4">
        <Reveal className="mt-20">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
            {FACTS.map((fact) => (
              <div key={fact.value} className="flex flex-col-reverse gap-1 bg-background p-5">
                <dt className="text-sm text-muted-foreground">{fact.text}</dt>
                <dd className="font-heading text-3xl font-semibold tracking-tight">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <section className="mt-28">
          <SectionTitle
            eyebrow="What's in the bucket"
            title="Everything a shared drive does, and the parts developers want"
          >
            Configs, notes, scripts, READMEs: the files that get lost in chat threads.
          </SectionTitle>
          <FeatureGrid />
          <div className="mt-4">
            <FeatureMarquee />
          </div>
        </section>

        <section className="mt-28">
          <SectionTitle eyebrow="Getting started" title="In your bucket in a minute" />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Reveal className="flex h-full flex-col gap-2 rounded-xl border bg-card p-6">
                  <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary-text">
                    {index + 1}
                  </span>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <Reveal className="relative isolate mt-28 overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center">
          <div aria-hidden className="home-glow absolute inset-0 -z-10" />
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your bucket is waiting.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free, with 1 GB to start. No card, no trial, no catch.
          </p>
          <div className="mt-8 flex min-h-11 flex-wrap justify-center gap-3">
            <Suspense>
              <HomeActions signUpLabel="Create your account" />
            </Suspense>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

export default HomePage;
