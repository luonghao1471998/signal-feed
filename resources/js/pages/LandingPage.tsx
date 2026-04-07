import React, { useState } from "react";
import { Zap, ChevronDown, Filter, Layers, BarChart3, Users, FileText, List, Check } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-background border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-500" />
            <span className="text-lg font-black text-slate-900">SignalFeed</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign in</button>
            <button type="button" className="text-sm font-bold bg-slate-900 text-white rounded-full px-5 py-2 hover:bg-slate-800 transition-colors">Join waitlist</button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs font-medium bg-secondary text-muted-foreground rounded-full px-3 py-1 mb-6">
              Built for X power users
            </span>
            <h1 className="text-5xl font-bold leading-tight">
              Stop scrolling X.<br />
              <span className="text-primary">Get the signal.</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-4 max-w-md">
              Daily digest of what 500+ top KOLs are saying — filtered, clustered, ranked. Ready to read in 5 minutes.
            </p>
            <div className="flex mt-8">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                className="rounded-l-full border border-border px-4 py-3 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
              />
              <button type="button" className="rounded-r-full bg-slate-900 text-white px-6 py-3 text-sm font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                Join waitlist
              </button>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex -space-x-2">
                {["A", "B", "C"].map((l, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {l}
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Joined by 200+ professionals</span>
            </div>
          </div>

          {/* Signal card preview */}
          <div className="flex justify-center">
            <div className="bg-card border border-border rounded-2xl shadow-md p-5 max-w-sm w-full">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-medium rounded-full px-2 py-0.5" style={{ background: "hsl(263 90% 96%)", color: "hsl(263 70% 36%)" }}>AI & ML</span>
                <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-green-100 text-green-700">TRENDING</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">GPT-5 launched with voice and vision</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                OpenAI announced GPT-5 with native voice and vision capabilities, marking a significant leap in multimodal AI performance across all benchmarks.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex -space-x-1.5">
                  {["S", "K", "R"].map((l, i) => (
                    <div key={i} className="w-5 h-5 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[8px] font-bold text-muted-foreground">{l}</div>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">7 KOLs · 12 min ago</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs font-medium border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors">📋 Copy draft</button>
                <button className="text-xs font-medium bg-foreground text-background rounded-lg px-3 py-1.5 hover:opacity-90 transition-colors">Open in Twitter ↗</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-surface border-y border-border/50 py-8">
        <div className="max-w-3xl mx-auto flex items-center justify-center divide-x divide-border">
          {[
            { value: "~10", label: "signals per day" },
            { value: "500+", label: "KOLs tracked" },
            { value: "60s", label: "to post a draft" },
          ].map((stat, i) => (
            <div key={i} className="flex-1 text-center px-8">
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need to stay ahead</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Filter, title: "Filter noise", desc: "AI removes hot takes, engagement bait, and self-promo. Only signal reaches your feed." },
            { icon: Layers, title: "Cluster by event", desc: "We group all tweets about the same event into a single, readable summary." },
            { icon: BarChart3, title: "Ranked by importance", desc: "Signals are prioritized based on the number of KOLs and signal strength." },
            { icon: Users, title: "Source attribution", desc: "See exactly who said what, with links to the original tweets." },
            { icon: FileText, title: "Ready-to-post drafts", desc: "One-click copy a high-quality thread that you can actually publish." },
            { icon: List, title: "My Sources list", desc: "Follow your own selection of KOLs to tailor your daily signal feed." },
          ].map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6">
              <f.icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">3 steps. That's it.</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: 1, title: "Choose your categories", desc: "Select from Tech, Crypto, Finance, AI, and more or add your own signal sources." },
            { step: 2, title: "Get your daily digest", desc: "Every morning a fast, readable AI-curated briefing of what actually matters." },
            { step: 3, title: "Copy draft, post", desc: "Turn market insights into your own voice rapidly with AI-assisted drafting." },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4">{s.step}</div>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center">Start free. Upgrade when ready.</h2>
        <p className="text-muted-foreground text-center mt-2 mb-12">No credit card required</p>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
            <h3 className="font-bold text-foreground">FREE</h3>
            <div className="text-3xl font-bold text-foreground mt-2">$0<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 3 digests/week</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Up to 50 KOLs tracked</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 3 categories</li>
            </ul>
            <button className="mt-6 w-full border border-border rounded-full py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">Start free</button>
          </div>

          {/* Pro */}
          <div className="bg-card border-2 border-blue-500 rounded-2xl p-6 shadow-lg relative flex flex-col">
            <span className="absolute -top-3 right-4 bg-blue-500 text-white text-[10px] font-bold rounded-full px-3 py-1">MOST POPULAR</span>
            <h3 className="font-bold text-foreground">PRO</h3>
            <div className="text-3xl font-bold text-foreground mt-2">$17<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Unlimited daily digests</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Track 500+ KOLs (cap 10)</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> AI-assisted drafting</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Category clustering</li>
            </ul>
            <button type="button" className="mt-6 w-full bg-blue-500 text-white rounded-full py-2.5 text-sm font-bold hover:bg-blue-600 transition-colors">Start free trial</button>
          </div>

          {/* Power */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
            <h3 className="font-bold text-foreground">POWER</h3>
            <div className="text-3xl font-bold text-foreground mt-2">$30<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Everything in Pro</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Custom KOL list cap 50</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Telegram alerts</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> API access</li>
            </ul>
            <button className="mt-6 w-full border border-border rounded-full py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">Get Power</button>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Trusted by professionals</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { quote: "SignalFeed has literally saved me hours of doomscrolling every single morning. I get precisely the signal I need in minutes.", name: "Alex Rivera", title: "Indie Hacker", handle: "@alexr" },
            { quote: "The AI clustering is insane. It automatically clumped all tweets about a market event into a single digestible summary in three bullet points.", name: "Marcus Chen", title: "VC Analyst", handle: "@mchen" },
            { quote: "Closest to YC for solo devs. Best insight tool I've used for keeping a premium newsletter writing habit despite a busy product building schedule.", name: "Sarah Jenkins", title: "AI Researcher", handle: "@sjk" },
          ].map((t, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6">
              <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{t.name[0]}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.title} · {t.handle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Common questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: 'How do you define a "KOL"?', a: "A KOL (Key Opinion Leader) is any account on X with significant influence in their niche — typically 10K+ followers, consistent engagement, and domain expertise." },
            { q: "Can I add my own sources?", a: "Yes! Pro and Power plans let you add custom KOL lists so your digest is tailored to the voices you care about most." },
            { q: "Is there a mobile app?", a: "SignalFeed is a progressive web app (PWA) optimized for mobile. Add it to your home screen for an app-like experience." },
            { q: "How does the AI drafting work?", a: "Our AI reads the clustered signal, understands the key takeaway, and generates a tweet-length draft in your voice that you can copy and post instantly." },
            { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no lock-in. Cancel from your settings page and you'll keep access until the end of your billing cycle." },
          ].map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-sm font-medium text-foreground">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA BANNER */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <div className="bg-foreground rounded-2xl py-16 px-8 text-center">
          <h2 className="text-3xl font-bold text-background mb-3">Ready to cut through the noise?</h2>
          <p className="text-background/70 mb-8">Join 200+ professionals getting smarter in 5 minutes.</p>
          <button className="bg-background text-foreground rounded-full px-8 py-3 font-semibold hover:bg-background/90 transition-colors">Join waitlist free</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-background border-t border-border/50 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground">SignalFeed</span>
              </div>
              <p className="text-sm text-muted-foreground">Signal from X, without the noise.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
            © 2026 SignalFeed. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
