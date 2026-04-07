import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SettingsTab = "profile" | "digest" | "billing" | "telegram" | "language";

const navItems: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "digest", label: "Digest Preferences" },
  { id: "billing", label: "Plan & Billing" },
  { id: "telegram", label: "Telegram" },
  { id: "language", label: "Language" },
];

const categoryCheckboxes: { id: string; label: string; defaultChecked: boolean }[] = [
  { id: "cat-ai", label: "AI & Machine Learning", defaultChecked: true },
  { id: "cat-dev", label: "Developer Tools", defaultChecked: true },
  { id: "cat-indie", label: "Indie Hackers & SaaS", defaultChecked: false },
  { id: "cat-mkt", label: "Marketing & Growth", defaultChecked: true },
  { id: "cat-vc", label: "Startup & VC", defaultChecked: true },
  { id: "cat-crypto", label: "Crypto & Web3", defaultChecked: false },
  { id: "cat-fin", label: "Finance & Markets", defaultChecked: false },
  { id: "cat-design", label: "Design & Product", defaultChecked: false },
  { id: "cat-creator", label: "Creator Economy", defaultChecked: false },
  { id: "cat-policy", label: "Tech Policy", defaultChecked: false },
];

function TelegramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="#2AABEE"
      className="mx-auto"
      aria-hidden
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.178.121.13.156.307.165.45-.001.051.018.51-.013.98z" />
    </svg>
  );
}

function FeatureRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2 text-sm", !ok && "text-slate-400")}>
      {ok ? (
        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
      ) : (
        <X className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" strokeWidth={2.5} />
      )}
      <span>{children}</span>
    </div>
  );
}

const MOBILE_TABS: SettingsTab[] = ["profile", "digest"];

const SettingsPage: React.FC = () => {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [activeTab, setActiveTab] = useState<SettingsTab>("digest");

  useEffect(() => {
    if (isMobile && !MOBILE_TABS.includes(activeTab)) {
      setActiveTab("digest");
    }
  }, [isMobile, activeTab]);

  const navButtonClass = (active: boolean) =>
    cn(
      "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
      active ? "font-bold text-slate-900" : "font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-50",
    );

  const mobileDesktopNote = (
    <p className="text-xs text-slate-400 text-center mt-8 mb-2">
      For billing and advanced settings, visit SignalFeed on desktop.
    </p>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen flex-col md:flex-row">
        {isMobile ? (
          <div className="w-full shrink-0 pt-4 px-4">
            <div className="flex border-b border-slate-100 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "profile"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-slate-400"
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("digest")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "digest"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-slate-400"
                }`}
              >
                Digest Preferences
              </button>
            </div>
          </div>
        ) : (
          <nav className="border-b border-slate-100 md:border-b-0 md:border-r w-full md:w-[200px] shrink-0 pt-4 md:pt-6 px-3 md:space-y-1 flex flex-col">
            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(navButtonClass(activeTab === item.id), "shrink-0")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        <div
          className={cn(
            "flex-1 max-w-2xl w-full min-w-0",
            isMobile ? "px-4 pb-8" : "p-8",
          )}
        >
            {activeTab === "profile" && (
              <section>
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-semibold text-slate-500">
                  U
                </div>
                <Input defaultValue="User" className="mt-4" />
                <p className="text-slate-400 text-sm mt-1">@username (read-only)</p>
                <Input placeholder="Add email for digest delivery" className="mt-4" type="email" />
                <p className="text-xs text-slate-400 mt-1">Optional — used for daily digest</p>
                <Button className="mt-6 rounded-full bg-slate-900 text-white px-6 font-bold hover:bg-slate-800">
                  Save changes
                </Button>
                {isMobile && mobileDesktopNote}
              </section>
            )}

            {activeTab === "digest" && (
              <section>
                <h2 className="text-sm font-bold text-slate-900 mb-3">Email Digest</h2>
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm text-slate-700">Daily digest email</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm text-slate-700">Send at 8:00 AM</span>
                  <Switch defaultChecked />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3 text-sm text-slate-700">
                  <p>⚠️ Free plan: digest delivered Monday, Wednesday, Friday only.</p>
                  <a href="#" className="text-blue-500 text-sm font-medium mt-1 inline-block">
                    Upgrade to Pro →
                  </a>
                </div>

                <h2 className="text-sm font-bold text-slate-900 mt-8 mb-0">My Categories</h2>
                <p className="text-sm text-slate-500 mb-3 mt-1">Receive signals from:</p>
                <div className="grid grid-cols-2 gap-3">
                  {categoryCheckboxes.map((c) => (
                    <label
                      key={c.id}
                      htmlFor={c.id}
                      className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
                    >
                      <Checkbox id={c.id} defaultChecked={c.defaultChecked} />
                      {c.label}
                    </label>
                  ))}
                </div>
                <Button className="mt-6 rounded-full bg-slate-900 text-white px-6 font-bold hover:bg-slate-800">
                  Save preferences
                </Button>
                {isMobile && mobileDesktopNote}
              </section>
            )}

            {activeTab === "billing" && (
              <section>
                <div className="border border-slate-200 rounded-2xl p-6 mb-4">
                  <Badge className="bg-slate-100 text-slate-600 rounded-full border-0 font-medium">
                    Free Plan
                  </Badge>
                  <p style={{ fontSize: 13, color: "#536471", marginTop: 4 }}>No expiry — free forever</p>
                  <div className="mt-4 space-y-2">
                    <FeatureRow ok>3 digests per week</FeatureRow>
                    <FeatureRow ok>All Sources view</FeatureRow>
                    <FeatureRow ok={false}>My Sources (Pro)</FeatureRow>
                    <FeatureRow ok={false}>Draft tweets (Pro)</FeatureRow>
                    <FeatureRow ok={false}>Daily digest (Pro)</FeatureRow>
                    <FeatureRow ok={false}>Telegram alerts (Power)</FeatureRow>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
                  <p className="text-lg font-semibold text-blue-500">Upgrade to Pro</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    $17<span className="text-sm font-normal text-slate-400"> / month</span>
                  </p>
                  <p className="text-xs text-slate-400">billed monthly · cancel anytime</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p>✓ Daily digest every morning</p>
                    <p>✓ My Sources list (up to 10 KOLs)</p>
                    <p>✓ Draft tweets for every signal</p>
                    <p>✓ Email digest at 8AM</p>
                    <p>✓ 30-day signal archive</p>
                  </div>
                  <Button className="w-full mt-4 rounded-full bg-blue-500 text-white py-3 font-bold hover:bg-blue-600">
                    Start free trial →
                  </Button>
                </div>

                <div>
                  <p className="font-semibold text-sm mb-3">Billing History</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                          <th className="px-4 py-2 font-medium">Date</th>
                          <th className="px-4 py-2 font-medium">Amount</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4} className="text-center text-slate-400 py-8">
                            No billing history yet
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    style={{ fontSize: 14, color: "#536471", textDecoration: "underline" }}
                  >
                    Manage subscription →
                  </a>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Cancel, pause, or update billing via Stripe portal
                  </p>
                </div>
              </section>
            )}

            {activeTab === "telegram" && (
              <section className="text-center max-w-sm mx-auto pt-4">
                <TelegramIcon />
                <p className="text-lg font-semibold mt-3 text-slate-900">Connect Telegram</p>
                <p className="text-sm text-slate-500 mt-2">Get real-time signal alerts on Telegram.</p>

                <div className="text-left mt-6 space-y-4">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span className="text-sm text-slate-700">Search @SignalFeedBot on Telegram</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span className="text-sm text-slate-700">Send /start to the bot</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span className="text-sm text-slate-700">Copy your token below and send it to the bot</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4 flex items-center gap-2 text-left">
                  <code className="text-sm text-slate-600 flex-1 break-all">sf_token_xxxxxx</code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-xs shrink-0"
                    type="button"
                    onClick={() => navigator.clipboard.writeText("sf_token_xxxxxx")}
                  >
                    Copy token
                  </Button>
                </div>

                <button
                  type="button"
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    display: "block",
                    margin: "16px auto 0",
                    padding: "12px 24px",
                    background: "#2AABEE",
                    color: "#fff",
                    border: "none",
                    borderRadius: 9999,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    toast("Token copied! Send it to @SignalFeedBot to connect.")
                  }
                >
                  Connect Telegram
                </button>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-left">
                  <p className="text-sm text-slate-700">⚡ Telegram alerts require Power plan ($30/mo)</p>
                  <a href="#" className="text-blue-500 text-sm font-medium mt-1 block">
                    Upgrade to Power →
                  </a>
                </div>
              </section>
            )}

            {activeTab === "language" && (
              <section>
                <p className="text-lg font-semibold mb-6 text-slate-900">Display Language</p>
                <RadioGroup defaultValue="en" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="en" id="lang-en" />
                    <Label htmlFor="lang-en" className="font-normal cursor-pointer">
                      🇺🇸 English
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="vi" id="lang-vi" />
                    <Label htmlFor="lang-vi" className="font-normal cursor-pointer">
                      🇻🇳 Tiếng Việt
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                    <RadioGroupItem value="ja" id="lang-ja" disabled />
                    <Label htmlFor="lang-ja" className="font-normal">
                      🇯🇵 日本語{" "}
                      <Badge variant="outline" className="text-xs ml-1 font-normal">
                        Coming soon
                      </Badge>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                    <RadioGroupItem value="ko" id="lang-ko" disabled />
                    <Label htmlFor="lang-ko" className="font-normal">
                      🇰🇷 한국어 — Coming soon
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                    <RadioGroupItem value="zh" id="lang-zh" disabled />
                    <Label htmlFor="lang-zh" className="font-normal">
                      🇨🇳 中文 — Coming soon
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                    <RadioGroupItem value="es" id="lang-es" disabled />
                    <Label htmlFor="lang-es" className="font-normal">
                      🇪🇸 Español — Coming soon
                    </Label>
                  </div>
                </RadioGroup>
                <Button className="mt-6 rounded-full bg-slate-900 text-white px-6 font-bold hover:bg-slate-800">
                  Save
                </Button>
              </section>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
