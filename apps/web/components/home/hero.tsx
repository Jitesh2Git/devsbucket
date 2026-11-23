import { Suspense } from "react";
import DriveMock from "@/components/home/drive-mock";
import HomeActions from "@/components/home/home-actions";
import LogoMark from "@/components/logo-mark";

// The top of the homepage: what DevsBucket is, the ways in (sign-up is
// invite-only; signed in, your drive), and the real drive as the picture. It fades in with CSS
// on load (no JavaScript needed), unlike the sections below it.
const Hero = () => {
  return (
    <section className="relative isolate overflow-hidden px-4 pt-20 pb-4 text-center">
      <div aria-hidden className="home-glow absolute inset-0 -z-10" />
      <div aria-hidden className="home-grid absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto flex max-w-4xl flex-col items-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
        <LogoMark className="size-16" />
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border bg-background py-0.5 pr-3 pl-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary-text">
            Invite-only
          </span>
          Free, with 1 GB for everyone
        </p>
        <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          One bucket for your files.{" "}
          <span className="text-muted-foreground">Room for your whole team.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
          A file drive built for developers. Upload and organise, share with Drive-style roles, and
          edit any text file together, live, with git-like history.
        </p>
        <div className="mt-8 flex min-h-11 flex-wrap justify-center gap-3">
          <Suspense>
            <HomeActions signUpLabel="Sign up with an invite" />
          </Suspense>
        </div>
      </div>
      <div className="mt-16 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:fill-mode-both motion-safe:[animation-delay:200ms] motion-safe:duration-1000">
        <DriveMock />
      </div>
    </section>
  );
};

export default Hero;
