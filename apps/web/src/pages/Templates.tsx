import { Trans, useLingui } from "@lingui/react/macro";
import { getAllBotTemplates } from "@bobbot/core/bot-templates";
import { Button } from "@bobbot/ui-web";
import { ArrowLeft, Crown, Filter, Search, ShoppingBag, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BotTemplateLibrary } from "../components/BotTemplateLibrary";

export function TemplatesPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const templates = getAllBotTemplates();

  const builtinTemplates = templates.filter((t) => t.source === "builtin");
  const marketplaceTemplates = templates.filter((t) => t.source === "marketplace");
  const customTemplates = templates.filter((t) => t.source === "custom");

  function handleUseTemplate(template: (typeof templates)[0]) {
    // Navigate to bot creation with template pre-selected via URL param
    navigate(`/app?template=${template.id}`);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label={t`Back`}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t`Bot Templates`}</h1>
            <p className="text-sm text-muted-foreground">
              {t`Choose a starting point for your next bot`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            {builtinTemplates.length} {t`Built-in`}
          </span>
          <span className="flex items-center gap-1">
            <ShoppingBag className="h-3.5 w-3.5 text-purple-500" />
            {marketplaceTemplates.length} {t`Marketplace`}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-green-500" />
            {customTemplates.length} {t`Custom`}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <BotTemplateLibrary
          templates={templates}
          onSelect={handleUseTemplate}
          showSourceFilter={true}
          showSearch={true}
          compact={false}
        />
      </main>
    </div>
  );
}
