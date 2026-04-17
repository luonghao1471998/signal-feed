import React from "react";
import { useLocale } from "@/i18n";

const PipelineFooter: React.FC = () => {
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-[13px] text-slate-400">{t("pipelineFooter.text")}</span>
    </div>
  );
};

export default PipelineFooter;
