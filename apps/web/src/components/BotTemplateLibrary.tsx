import { Trans, useLingui } from "@lingui/react/macro";
import {
  type BotTemplate,
  getAllBotTemplates,
  getBotTemplatesBySource,
} from "@bobbot/core/bot-templates";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@bobbot/ui-web";
import { Crown, ExternalLink, Filter, Search, ShoppingBag, Zap } from "lucide-react";
import { useMemo, useState } from "react";

export interface BotTemplateLibraryProps {
  templates?: BotTemplate[];
  onSelect?: (template: BotTemplate) => void;
  showSourceFilter?: boolean;
  showSearch?: boolean;
  compact?: boolean;
  className?: string;
}

export function BotTemplateLibrary({
  templates: providedTemplates,
  onSelect,
  showSourceFilter = true,
  showSearch = true,
  compact = false,
  className = "",
}: BotTemplateLibraryProps) {
  const { t } = useLingui();
  const templates = providedTemplates ?? getAllBotTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "builtin" | "marketplace" | "custom">(
    "all",
  );

  const filteredTemplates = useMemo(() => {
    let filtered = templates;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          template.title.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }
    if (sourceFilter !== "all") {
      filtered = filtered.filter((template) => template.source === sourceFilter);
    }
    return filtered;
  }, [templates, searchQuery, sourceFilter]);

  const builtinCount = templates.filter((t) => t.source === "builtin").length;
  const marketplaceCount = templates.filter((t) => t.source === "marketplace").length;
  const customCount = templates.filter((t) => t.source === "custom").length;

  function getSourceIcon(source: BotTemplate["source"]) {
    switch (source) {
      case "builtin":
        return <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />;
      case "marketplace":
        return <ShoppingBag className="h-4 w-4 text-purple-500" aria-hidden="true" />;
      case "custom":
        return <Zap className="h-4 w-4 text-green-500" aria-hidden="true" />;
    }
  }

  function getSourceLabel(source: BotTemplate["source"]) {
    switch (source) {
      case "builtin":
        return t`Built-in`;
      case "marketplace":
        return t`Marketplace`;
      case "custom":
        return t`Custom`;
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {(showSearch || showSourceFilter) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t`Search templates…`}
                className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t`Search templates`}
              />
            </div>
          )}
          {showSourceFilter && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
                className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t`Filter by source`}
              >
                <option value="all">
                  {t`All sources`} ({templates.length})
                </option>
                <option value="builtin">
                  {t`Built-in`} ({builtinCount})
                </option>
                <option value="marketplace">
                  {t`Marketplace`} ({marketplaceCount})
                </option>
                <option value="custom">
                  {t`Custom`} ({customCount})
                </option>
              </select>
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          compact
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
        )}
      >
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            <Trans>No templates match your filters</Trans>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                "relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50",
                compact && "p-3",
              )}
            >
              <CardHeader className={cn("pb-2", compact && "pb-1")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "rounded-xl flex items-center justify-center flex-shrink-0",
                        compact ? "size-10" : "size-12",
                        `bg-[${template.color}]/10`,
                      )}
                      style={{ borderColor: template.color }}
                    >
                      {template.icon ? (
                        <span className="text-2xl" style={{ color: template.color }}>
                          {template.icon}
                        </span>
                      ) : (
                        <span className="text-[16px] font-bold" style={{ color: template.color }}>
                          {template.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <CardTitle className={cn("text-sm font-semibold", compact && "text-xs")}>
                        {template.name}
                      </CardTitle>
                      <p
                        className={cn(
                          "text-xs text-muted-foreground truncate",
                          compact && "text-[11px]",
                        )}
                      >
                        {template.title}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                      compact && "px-1.5 py-0",
                    )}
                    style={{
                      backgroundColor: `${template.color}20`,
                      color: template.color,
                    }}
                  >
                    {getSourceIcon(template.source)}
                    {getSourceLabel(template.source)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className={cn("pt-0", compact && "pb-0")}>
                <p
                  className={cn(
                    "text-sm text-muted-foreground/80 line-clamp-2",
                    compact && "text-xs line-clamp-1",
                  )}
                >
                  {template.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.tags.slice(0, compact ? 2 : 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] rounded bg-muted/50 text-muted-foreground/80"
                    >
                      {tag}
                    </span>
                  ))}
                  {template.tags.length > (compact ? 2 : 4) && (
                    <span className="px-2 py-0.5 text-[10px] rounded bg-muted/50 text-muted-foreground/60">
                      +{template.tags.length - (compact ? 2 : 4)}
                    </span>
                  )}
                </div>
                {onSelect && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      className="w-full"
                      size={compact ? "sm" : "default"}
                      onClick={() => onSelect(template)}
                    >
                      <Trans>Use template</Trans>
                    </Button>
                  </div>
                )}
              </CardContent>
              {template.source === "marketplace" && (
                <div className="absolute bottom-1.5 right-1.5 p-1 rounded bg-primary/10 text-primary/80 text-[10px] font-medium">
                  <ExternalLink className="h-3 w-3 inline" aria-hidden="true" />
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
