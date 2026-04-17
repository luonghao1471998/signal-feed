import React, { useState, useEffect } from "react";
import { useLocale } from "@/i18n";

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LoginPage: React.FC = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top wordmark — hidden in standalone */}
      {!isStandalone && (
        <p className="text-center text-sm font-bold tracking-widest text-slate-900 mt-8 mb-8">
          SIGNALFEED
        </p>
      )}

      {/* Standalone title */}
      {isStandalone && (
        <p className="text-xl font-bold text-foreground text-center mt-12">
          SignalFeed
        </p>
      )}

      {/* Login card */}
      <div className={`max-w-sm w-full mx-auto ${isStandalone ? "mt-8" : "mt-12"} bg-card rounded-2xl border border-border shadow-sm ${isStandalone ? "p-10" : "p-8"}`}>
        {/* X logo circle */}
        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto">
          <XIcon className="w-5 h-5 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-center mt-4 text-foreground">
          {t("login.title")}
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs mx-auto">
          {t("login.subtitle")}
        </p>

        <a
          href="/auth/twitter"
          target="_top"
          rel="noopener noreferrer"
          className={`mt-8 w-full bg-slate-900 text-white rounded-full ${isStandalone ? "py-4" : "py-3.5"} font-bold text-base flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors no-underline`}
        >
          <XIcon className="w-[18px] h-[18px]" />
          {t("login.continueWithX")}
        </a>

        <div className="border-t border-border/50 mt-6" />

        <p className="text-xs text-muted-foreground text-center mt-4">
          {t("login.agreementPrefix")}{" "}
          <a href="#" className="text-blue-500 underline font-medium">{t("login.terms")}</a> and{" "}
          <a href="#" className="text-blue-500 underline font-medium">{t("login.privacyPolicy")}</a>
        </p>
      </div>

      {/* Footer */}
      <div className="mt-auto pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          © 2026 SignalFeed · Privacy · Terms
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
