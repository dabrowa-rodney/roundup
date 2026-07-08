"use client";

// The public marketing one-pager (design_handoff_marketing_page).
// Marketing-specific colours are intentionally inline — this page has its own
// slightly different palette (#EEF0F8 canvas, #475069 body) from the app.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Calendar,
  FileText,
  Inbox,
  Pencil,
  RotateCcw,
  Users,
} from "lucide-react";

const STEPS = [
  {
    num: "STEP 1",
    color: "#2F9E63",
    tint: "#E7F5EE",
    Icon: Pencil,
    title: "File",
    body: "Each team lead answers a short set of questions — custom to their part of the business. Good things, bad things, risks, FYIs — before the weekly deadline you set.",
  },
  {
    num: "STEP 2",
    color: "#4368FA",
    tint: "#EAEEFE",
    Icon: Inbox,
    title: "Gather",
    body: "Roundup collects every update in one place and folds in the data you connect — a Google Sheet per report is all it takes.",
  },
  {
    num: "STEP 3",
    color: "#E39A2E",
    tint: "#FBF2E3",
    Icon: FileText,
    title: "Summarise",
    body: "One weekly Roundup report lands with your senior team — the material stuff, readable in minutes, with every source update a click away.",
  },
];

const FEATURES = [
  {
    tag: "Reports",
    Icon: Users,
    title: "Assigned, not chased",
    body: "Each update section is assigned to a person, not a mailbox. Teams change, the report stays consistent — reassign in one click.",
  },
  {
    tag: "Rhythm",
    Icon: Calendar,
    title: "A real deadline",
    body: "You choose when reports close each week — then they reopen fresh for the new week. Everyone edits as much as they like inside the window.",
  },
  {
    tag: "Data",
    Icon: BarChart3,
    title: "Your numbers, alongside",
    body: "Connect a data source to any report and the week's figures sit next to the words — context without copy-pasting.",
  },
  {
    tag: "History",
    Icon: RotateCcw,
    title: "Every week, kept",
    body: "Past submissions are stored and searchable, and feed context into future reports — trends surface instead of disappearing.",
  },
];

const FAQS = [
  {
    q: "Who writes the updates?",
    a: "Team leads or senior members of each team. Admins create the report templates and assign each one to an individual, so ownership is always clear.",
  },
  {
    q: "What happens at the deadline?",
    a: "You set the weekly deadline for your workspace. When it passes, reports close and a clean, empty report opens for the new week. During the open window, contributors can add and edit as much as they like.",
  },
  {
    q: "How do people sign in?",
    a: "With Google, or an emailed sign-in link. Joining an existing team just needs an administrator to invite your email.",
  },
  {
    q: "What roles are there?",
    a: "Contributors complete reports; Administrators manage users, reports and settings (and can contribute too); and recipients simply receive the weekly Roundup report.",
  },
  {
    q: "Are past updates saved?",
    a: "Yes — every individual report is stored, so you have a full history and richer context for every future Roundup.",
  },
];

/** One-shot fade-up reveal on viewport entry (no-op with reduced motion). */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(22px)",
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-3">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-[14px] border border-[#E3E6F0] bg-white transition-shadow hover:border-[#D5D9E8] hover:shadow-[0_12px_32px_rgba(39,50,94,0.1)]"
          >
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="text-[16px] font-semibold text-[#27325E]">
                {f.q}
              </span>
              <span className="text-[20px] leading-none text-[#6B7390]" aria-hidden>
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen && (
              <div className="fade-up px-6 pb-5 text-[15px] leading-[1.65] text-[#475069]">
                {f.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CTA =
  "inline-block rounded-full bg-accent px-8 py-4 text-[17px] font-semibold text-white shadow-[0_8px_24px_rgba(67,104,250,0.35)] transition-all duration-[180ms] hover:-translate-y-0.5 hover:bg-accent-hover";

export function MarketingPage() {
  return (
    <div
      className="min-h-screen bg-[#EEF0F8] font-body text-[#27325E]"
      style={{ scrollBehavior: "smooth" }}
    >
      {/* Sticky nav */}
      <nav className="sticky top-0 z-40 border-b border-[#D5D9E8]/50 bg-[#EEF0F8]/[0.82] backdrop-blur-[12px]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-3 px-[clamp(20px,5vw,32px)] py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/roundup-icon.svg" alt="" className="h-10 w-10" />
            <span className="font-head text-[24px] font-bold tracking-[-0.01em]">
              Roundup
            </span>
          </div>
          <div className="ml-auto flex items-center gap-5">
            <Link
              href="/login"
              className="text-[15px] font-semibold text-[#475069] hover:text-accent"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-white transition-all duration-[180ms] hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_8px_24px_rgba(67,104,250,0.35)]"
            >
              Create a workspace
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1120px] px-[clamp(20px,5vw,32px)]">
        {/* Hero */}
        <section className="mx-auto max-w-[820px] pb-[clamp(48px,7vw,64px)] pt-[clamp(56px,9vw,88px)] text-center">
          <h1
            className="fade-up font-head text-[clamp(38px,7.5vw,64px)] font-bold leading-[1.1] tracking-[-0.02em]"
            style={{ textWrap: "balance" }}
          >
            Your team&apos;s week, in one place.
          </h1>
          <p
            className="fade-up mx-auto mt-6 max-w-[620px] text-[20px] leading-[1.6] text-[#475069]"
            style={{ animationDelay: "0.12s" }}
          >
            Each lead files a short weekly update. Roundup gathers them, folds
            in your data, and writes the summary your senior team actually
            reads.
          </p>
          <div
            className="fade-up mt-9 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "0.24s" }}
          >
            <Link href="/login" className={CTA}>
              Create a workspace
            </Link>
            <a
              href="#how"
              className="inline-block rounded-full border-[1.5px] border-[#D5D9E8] bg-white px-8 py-4 text-[17px] font-semibold text-[#27325E] transition-colors duration-[180ms] hover:border-accent hover:text-accent"
            >
              See how it works
            </a>
          </div>
          <p
            className="fade-up mt-6 text-[14px] text-[#6B7390]"
            style={{ animationDelay: "0.45s" }}
          >
            Sign in with Google · Set up your organisation in under a minute
          </p>
        </section>

        {/* Product mock */}
        <Reveal delay={0.35} className="pb-[clamp(64px,10vw,96px)]">
          <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_24px_64px_rgba(16,24,40,0.12)]">
            <div className="flex items-center gap-2 border-b border-[#EDEFF6] px-5 py-3.5">
              <span className="h-3 w-3 rounded-full bg-[#E3E6F0]" />
              <span className="h-3 w-3 rounded-full bg-[#E3E6F0]" />
              <span className="h-3 w-3 rounded-full bg-[#E3E6F0]" />
              <span className="ml-3 text-[13px] text-[#6B7390]">
                roundup.work
              </span>
            </div>
            <div className="overflow-x-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marketing-app.png"
                alt="The Roundup dashboard: a weekly summary with metrics, a trend chart, per-team updates and a needs-attention flag"
                className="block w-full min-w-[880px]"
              />
            </div>
          </div>
        </Reveal>

        {/* How it works */}
        <section id="how" className="pb-[clamp(64px,10vw,96px)]">
          <h2 className="text-center font-head text-[clamp(30px,5.5vw,40px)] font-bold tracking-[-0.02em]">
            How it works
          </h2>
          <p className="mt-2 text-center text-[17px] text-[#475069]">
            Three steps, once a week.
          </p>
          <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08}>
                <div
                  className="h-full rounded-card border border-[#E3E6F0] bg-white px-7 py-8 transition-shadow duration-[220ms] hover:shadow-[0_12px_32px_rgba(39,50,94,0.1)]"
                  style={{ borderLeft: `5px solid ${s.color}` }}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                      style={{ background: s.tint }}
                    >
                      <s.Icon size={24} strokeWidth={2} style={{ color: s.color }} />
                    </span>
                    <span
                      className="font-head text-[15px] font-extrabold tracking-[0.08em]"
                      style={{ color: s.color }}
                    >
                      {s.num}
                    </span>
                  </div>
                  <h3 className="mt-5 font-head text-[24px] font-bold">{s.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-[1.65] text-[#475069]">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="pb-[clamp(64px,10vw,96px)]">
          <h2 className="text-center font-head text-[clamp(30px,5.5vw,40px)] font-bold tracking-[-0.02em]">
            Built for a weekly rhythm
          </h2>
          <p className="mt-2 text-center text-[17px] text-[#475069]">
            Everything the report needs, nothing your leads don&apos;t.
          </p>
          <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.tag} delay={i * 0.06}>
                <div className="h-full rounded-card border border-[#E3E6F0] bg-white p-8 transition-all duration-[220ms] hover:border-[#D5D9E8] hover:shadow-[0_12px_32px_rgba(39,50,94,0.1)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent-soft">
                      <f.Icon size={24} strokeWidth={2} className="text-accent" />
                    </span>
                    <span className="rounded-full bg-[#EEF0F8] px-3.5 py-1.5 text-[13px] font-semibold text-accent">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="mt-5 font-head text-[22px] font-bold">{f.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-[1.65] text-[#475069]">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-[clamp(64px,10vw,96px)]">
          <h2 className="text-center font-head text-[clamp(30px,5.5vw,40px)] font-bold tracking-[-0.02em]">
            Questions
          </h2>
          <div className="mt-10">
            <Faq />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#27325E] text-white">
        <div className="mx-auto max-w-[1120px] px-[clamp(20px,5vw,32px)] pb-10 pt-[clamp(56px,9vw,80px)]">
          <div className="text-center">
            <h2 className="font-head text-[clamp(30px,5.5vw,40px)] font-bold tracking-[-0.02em]">
              Start this week&apos;s Roundup.
            </h2>
            <p className="mt-3 text-[17px] text-[#A5ACC4]">
              Create a workspace for your organisation in under a minute.
            </p>
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-block rounded-full bg-accent px-8 py-4 text-[17px] font-semibold text-white shadow-[0_8px_24px_rgba(67,104,250,0.45)] transition-all duration-[180ms] hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                Create a workspace
              </Link>
            </div>
          </div>
          <div className="mt-[clamp(48px,8vw,72px)] flex flex-wrap items-center gap-4 border-t border-[#2A3247] pt-7">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/roundup-icon-white.svg" alt="" className="h-6 w-6" />
              <span className="font-head text-[17px] font-bold">Roundup</span>
            </div>
            <span className="ml-auto text-[13px] text-[#A5ACC4]">
              © 2026 Roundup · roundup.work
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
