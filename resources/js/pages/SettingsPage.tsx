import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCategories, type Category } from "@/services/categoryService";
import { fetchSettings, type SettingsData, updateSettings } from "@/services/settingsService";

type SettingsTab = "profile" | "digest" | "billing" | "telegram" | "language";

const navItems: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "digest", label: "Digest Preferences" },
  { id: "billing", label: "Plan & Billing" },
  { id: "telegram", label: "Telegram" },
  { id: "language", label: "Language" },
];

const MOBILE_TABS: SettingsTab[] = ["profile", "digest"];

const FEATURE_LABELS: Record<string, string> = {
  "3_digests_per_week": "3 digests per week",
  all_sources_view: "All sources view",
  daily_digest: "Daily email digest every morning",
  my_kols_10: "My Sources list (up to 10 KOLs)",
  my_kols_50: "My Sources list (up to 50 KOLs)",
  draft_tweets: "Draft tweets for every signal",
  email_digest: "Email digest at 8:00 AM",
  telegram_alerts: "Real-time Telegram alerts",
  archive_30d: "30-day signal archive",
  archive_unlimited: "Unlimited signal archive",
};

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

function normalizeSettings(data: SettingsData): SettingsData {
  return {
    ...data,
    profile: {
      ...data.profile,
      display_name: data.profile.display_name ?? "",
      x_username: data.profile.x_username ?? "",
      email: data.profile.email ?? "",
      avatar_url: data.profile.avatar_url ?? null,
    },
    preferences: {
      ...data.preferences,
      my_categories: Array.isArray(data.preferences.my_categories) ? data.preferences.my_categories : [],
      email_digest_enabled: Boolean(data.preferences.email_digest_enabled),
      email_digest_time: data.preferences.email_digest_time || "08:00",
      locale: data.preferences.locale || "en",
    },
    telegram: {
      ...data.telegram,
      connected: Boolean(data.telegram.connected),
      chat_id: data.telegram.chat_id ?? null,
      connect_token: data.telegram.connect_token ?? "",
    },
    plan: {
      ...data.plan,
      current: data.plan.current ?? "free",
      features: Array.isArray(data.plan.features) ? data.plan.features : [],
    },
  };
}

const SettingsPage: React.FC = () => {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("digest");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [locale, setLocale] = useState("en");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (isMobile && !MOBILE_TABS.includes(activeTab)) {
      setActiveTab("digest");
    }
  }, [isMobile, activeTab]);

  useEffect(() => {
    async function loadSettingsAndCategories() {
      try {
        setLoading(true);
        setError(null);

        const [settingsData, categoryData] = await Promise.all([fetchSettings(), getCategories()]);
        setSettings(normalizeSettings(settingsData));
        setCategories(categoryData);
      } catch {
        setError("Could not load settings");
        toast({
          title: "Error",
          description: "Could not load settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    void loadSettingsAndCategories();
  }, [toast]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setDisplayName(settings.profile.display_name ?? "");
    setEmail(settings.profile.email ?? "");
    setEmailDigestEnabled(Boolean(settings.preferences.email_digest_enabled));
    setSelectedCategories(settings.preferences.my_categories ?? []);
    setLocale(settings.preferences.locale ?? "en");
  }, [settings]);

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

  const currentPlan = settings?.plan.current || user?.plan || "free";
  const normalizedPlan = (["free", "pro", "power"].includes(currentPlan) ? currentPlan : "free") as
    | "free"
    | "pro"
    | "power";
  const upgradeTarget = normalizedPlan === "free" ? "Pro" : normalizedPlan === "pro" ? "Power" : "Power";
  const upgradePrice = upgradeTarget === "Pro" ? "$15/month" : "$30/month";
  const planFeatures = useMemo(
    () => (settings?.plan.features ?? []).map((feature) => FEATURE_LABELS[feature] ?? feature.replaceAll("_", " ")),
    [settings?.plan.features],
  );

  async function handleSaveProfile() {
    try {
      setSaving(true);
      const updated = await updateSettings({
        display_name: displayName,
        email,
      });
      setSettings(normalizeSettings(updated));
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePreferences() {
    try {
      setSaving(true);
      const updated = await updateSettings({
        email_digest_enabled: emailDigestEnabled,
        email_digest_time: "08:00",
        my_categories: selectedCategories,
      });
      setSettings(normalizeSettings(updated));
      toast({
        title: "Success",
        description: "Preferences updated successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLanguage() {
    try {
      setSaving(true);
      const updated = await updateSettings({
        locale,
      });
      setSettings(normalizeSettings(updated));
      toast({
        title: "Success",
        description: "Language preference updated",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update language",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleToggleCategory(categoryId: number, checked: boolean) {
    setSelectedCategories((prev) => {
      if (checked) {
        if (prev.includes(categoryId)) {
          return prev;
        }

        return [...prev, categoryId];
      }

      return prev.filter((id) => id !== categoryId);
    });
  }

  async function handleCopyToken() {
    if (!settings?.telegram.connect_token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(settings.telegram.connect_token);
      toast({
        title: "Copied!",
        description: "Token copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not copy token",
        variant: "destructive",
      });
    }
  }

  function showComingSoonToast(description: string) {
    toast({
      title: "Coming Soon",
      description,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-700 font-medium">{error ?? "Could not load settings."}</p>
          <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }

  const avatarInitial = (displayName.trim().charAt(0) || "U").toUpperCase();
  const profileUsername = settings.profile.x_username ? `@${settings.profile.x_username}` : "@username";
  const languageChanged = locale !== settings.preferences.locale;

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
                  activeTab === "profile" ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400"
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("digest")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "digest" ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400"
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

        <div className={cn("flex-1 max-w-2xl w-full min-w-0", isMobile ? "px-4 pb-8" : "p-8")}>
          {activeTab === "profile" && (
            <section>
              {settings.profile.avatar_url ? (
                <img
                  src={settings.profile.avatar_url}
                  alt={displayName || "User avatar"}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-xl font-semibold text-white">
                  {avatarInitial}
                </div>
              )}
              <Input
                value={displayName}
                className="mt-4"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Display name"
              />
              <Input value={profileUsername} className="mt-3 bg-gray-100 cursor-not-allowed" disabled readOnly />
              <Input
                value={email}
                placeholder="Add email for digest delivery"
                className="mt-4"
                type="email"
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Optional — used for daily digest</p>
              <Button
                className="mt-6 rounded-full bg-slate-900 text-white px-6 font-bold hover:bg-slate-800"
                onClick={() => void handleSaveProfile()}
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save changes"
                )}
              </Button>
              {isMobile && mobileDesktopNote}
            </section>
          )}

          {activeTab === "digest" && (
            <section>
              <h2 className="text-sm font-bold text-slate-900 mb-3">Email Digest</h2>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-slate-700">Daily digest email</span>
                <Switch checked={emailDigestEnabled} onCheckedChange={setEmailDigestEnabled} />
              </div>

              {user?.plan === "free" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3 text-sm text-slate-700">
                  <p>Free plan: digest delivered Monday, Wednesday, Friday only. Upgrade to Pro for daily digests.</p>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      showComingSoonToast("Billing portal will be available in Sprint 3");
                    }}
                    className="text-blue-500 text-sm font-medium mt-1 inline-block"
                  >
                    Upgrade to Pro →
                  </a>
                </div>
              )}

              <h2 className="text-sm font-bold text-slate-900 mt-8 mb-0">My Categories</h2>
              <p className="text-sm text-slate-500 mb-3 mt-1">Receive signals from:</p>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    htmlFor={`cat-${category.id}`}
                    className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
                  >
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => handleToggleCategory(category.id, Boolean(checked))}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
              <Button
                className="mt-6 rounded-full bg-slate-900 text-white px-6 font-bold hover:bg-slate-800"
                onClick={() => void handleSavePreferences()}
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save preferences"
                )}
              </Button>
              {isMobile && mobileDesktopNote}
            </section>
          )}

          {activeTab === "billing" && (
            <section>
              <div className="border border-slate-200 rounded-2xl p-6 mb-4">
                <Badge className="bg-slate-100 text-slate-600 rounded-full border-0 font-medium">
                  {normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1)} Plan
                </Badge>
                <p style={{ fontSize: 13, color: "#536471", marginTop: 4 }}>Current active plan</p>
                <div className="mt-4 space-y-2">
                  {planFeatures.length > 0 ? (
                    planFeatures.map((feature) => (
                      <FeatureRow key={feature} ok>
                        {feature}
                      </FeatureRow>
                    ))
                  ) : (
                    <FeatureRow ok={false}>No features configured</FeatureRow>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
                <p className="text-lg font-semibold text-blue-500">Upgrade to {upgradeTarget}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {upgradePrice}
                  <span className="text-sm font-normal text-slate-400"> / month</span>
                </p>
                <p className="text-xs text-slate-400">billed monthly · cancel anytime</p>
                <Button
                  className="w-full mt-4 rounded-full bg-blue-500 text-white py-3 font-bold hover:bg-blue-600"
                  type="button"
                  onClick={() => showComingSoonToast("Billing portal will be available in Sprint 3")}
                >
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
                        <th className="px-4 py-2 font-medium">Description</th>
                        <th className="px-4 py-2 font-medium">Amount</th>
                        <th className="px-4 py-2 font-medium">Status</th>
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
                  onClick={(event) => {
                    event.preventDefault();
                    showComingSoonToast("Stripe billing management coming in Sprint 3");
                  }}
                  style={{ fontSize: 14, color: "#536471", textDecoration: "underline" }}
                >
                  Manage subscription →
                </a>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Stripe billing management coming in Sprint 3</p>
              </div>
            </section>
          )}

          {activeTab === "telegram" && (
            <section className="text-center max-w-sm mx-auto pt-4">
              <TelegramIcon />
              <p className="text-lg font-semibold mt-3 text-slate-900">Connect Telegram</p>
              <div className="mt-3">
                <Badge
                  className={cn(
                    "rounded-full border-0",
                    settings.telegram.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {settings.telegram.connected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-2">Get real-time signal alerts on Telegram.</p>

              <div className="text-left mt-6 space-y-4">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">1</span>
                  <span className="text-sm text-slate-700">Open Telegram and search for @SignalFeedBot</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">2</span>
                  <span className="text-sm text-slate-700">Copy your unique connection token below</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">3</span>
                  <span className="text-sm text-slate-700">
                    Send <code>/connect {settings.telegram.connect_token}</code> to the bot
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4 flex items-center gap-2 text-left">
                <Input value={settings.telegram.connect_token} readOnly className="text-sm text-slate-600 flex-1" />
                <Button variant="outline" size="sm" className="rounded-lg text-xs shrink-0" type="button" onClick={() => void handleCopyToken()}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy token
                </Button>
              </div>

              <Button asChild className="w-full mt-4 rounded-full bg-[#2AABEE] text-white py-3 font-bold hover:bg-[#229ed9]">
                <a href="https://t.me/SignalFeedBot" target="_blank" rel="noreferrer">
                  Open Telegram Bot →
                </a>
              </Button>

              {user?.plan !== "power" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-left">
                  <p className="text-sm text-slate-700">
                    ⚡ Telegram alerts require Power plan ($30/mo). Upgrade to unlock real-time notifications.
                  </p>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      showComingSoonToast("Upgrade to Power plan available in Sprint 3");
                    }}
                    className="text-blue-500 text-sm font-medium mt-1 block"
                  >
                    Upgrade to Power →
                  </a>
                </div>
              )}
            </section>
          )}

          {activeTab === "language" && (
            <section>
              <p className="text-lg font-semibold mb-6 text-slate-900">Display Language</p>
              <RadioGroup value={locale} onValueChange={setLocale} className="space-y-3">
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
                  <RadioGroupItem value="jp" id="lang-jp" disabled />
                  <Label htmlFor="lang-jp" className="font-normal">
                    🇯🇵 日本語{" "}
                    <Badge variant="outline" className="text-xs ml-1 font-normal">
                      Coming soon
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                  <RadioGroupItem value="kr" id="lang-kr" disabled />
                  <Label htmlFor="lang-kr" className="font-normal">
                    🇰🇷 한국어{" "}
                    <Badge variant="outline" className="text-xs ml-1 font-normal">
                      Coming soon
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                  <RadioGroupItem value="cn" id="lang-cn" disabled />
                  <Label htmlFor="lang-cn" className="font-normal">
                    🇨🇳 中文{" "}
                    <Badge variant="outline" className="text-xs ml-1 font-normal">
                      Coming soon
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                  <RadioGroupItem value="es" id="lang-es" disabled />
                  <Label htmlFor="lang-es" className="font-normal">
                    🇪🇸 Español{" "}
                    <Badge variant="outline" className="text-xs ml-1 font-normal">
                      Coming soon
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-3 opacity-50 pointer-events-none">
                  <RadioGroupItem value="fr" id="lang-fr" disabled />
                  <Label htmlFor="lang-fr" className="font-normal">
                    🇫🇷 Français{" "}
                    <Badge variant="outline" className="text-xs ml-1 font-normal">
                      Coming soon
                    </Badge>
                  </Label>
                </div>
              </RadioGroup>
              <Button
                className="mt-6 rounded-full bg-slate-900 text-white px-6 font-bold hover:bg-slate-800"
                onClick={() => void handleSaveLanguage()}
                disabled={saving || !languageChanged}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
