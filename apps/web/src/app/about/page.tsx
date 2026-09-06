"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

const BENEFITS = [
  {
    icon: "◆",
    title: "Four-way stretch",
    desc: "Lab-tested fabrics move with you through every rep, pose, and sprint — zero restriction, full range of motion.",
  },
  {
    icon: "◇",
    title: "Moisture-wicking",
    desc: "Sweat is pulled away from skin fast so you stay dry from warm-up through cool-down.",
  },
  {
    icon: "○",
    title: "Zero-distraction seams",
    desc: "Flat, smooth construction means nothing rubs or chafes when you're deep in a set or flow.",
  },
  {
    icon: "▣",
    title: "Built for compression",
    desc: "Supportive ribbed and compression pieces that hold shape session after session.",
  },
  {
    icon: "◎",
    title: "Train before sunrise",
    desc: "Gear engineered for athletes who show up early — durable, reliable, ready when you are.",
  },
  {
    icon: "✦",
    title: "Sustainable craft",
    desc: "Quality construction designed to last season after season, not one wear and done.",
  },
];

const PILLARS = [
  {
    title: "Performance first",
    text: "Every piece starts with how it performs under real training — not just how it looks on a hanger.",
  },
  {
    title: "Designed by athletes",
    text: "Feedback from trainers and everyday athletes shapes fit, fabric, and details you actually feel.",
  },
  {
    title: "Community driven",
    text: "THE CLOVER grows with the people who wear it — your sessions inform our next drop.",
  },
];

export default function AboutPage() {
  return (
    <div className="pb-20">
      <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 sm:pt-12 pb-10 sm:pb-12">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-soul-muted mb-3">
              About THE CLOVER
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] mb-6">
              Sportswear built for people who move
            </h1>
            <p className="text-soul-muted leading-relaxed mb-8">
              THE CLOVER makes premium gym sportswear and athleisure for training, recovery, and
              everyday life — designed to perform when you do.
            </p>
            <Link href="/shop" className="btn-soul--dark rounded-full inline-flex">
              Shop the collection
            </Link>
          </div>
          <GlassCard className="relative aspect-[4/5] overflow-hidden p-0">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src="/assets/hero-video.mp4"
              autoPlay
              muted
              loop
              playsInline
              aria-label="THE CLOVER performance gear in motion"
            />
          </GlassCard>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Why athletes choose us</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {BENEFITS.map((b) => (
            <GlassCard
              key={b.title}
              className="p-6 sm:p-8 hover:shadow-card-hover transition-shadow duration-300"
            >
              <span className="text-2xl text-black/30 mb-4 block" aria-hidden>
                {b.icon}
              </span>
              <h3 className="font-bold text-base mb-2">{b.title}</h3>
              <p className="text-sm text-soul-muted leading-relaxed">{b.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-center text-xl font-black tracking-tight mb-8">What we stand for</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {PILLARS.map((p) => (
            <div key={p.title} className="card-soul p-8 text-center">
              <h3 className="font-bold text-sm uppercase tracking-widest mb-3">{p.title}</h3>
              <p className="text-sm text-soul-muted leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
        <GlassCard className="p-10 sm:p-12">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/new-in" className="btn-soul--dark rounded-full">
              New In
            </Link>
            <Link href="/contact" className="btn-soul--glass rounded-full">
              Contact
            </Link>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
