"use client";

import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useServerFn } from "@tanstack/react-start";
import { X, ExternalLink, Newspaper } from "lucide-react";

import { getArticleContent, type NewsItem } from "@/lib/home-feeds.functions";
import { cn } from "@/lib/utils";

export function NewsArticleDialog({
  item,
  onClose,
}: {
  item: NewsItem | null;
  onClose: () => void;
}) {
  const open = Boolean(item);
  const fetchArticle = useServerFn(getArticleContent);

  const q = useQuery({
    queryKey: ["article-reader-v1", item?.link],
    queryFn: () => {
      if (!item) throw new Error("Berita tidak tersedia");
      return fetchArticle({ data: { url: item.link, headline: item.title, source: item.source } });
    },
    enabled: open && !!item,
    staleTime: Infinity,
  });

  const title = q.data?.title && q.data.title.trim() ? q.data.title : item?.title ?? "Berita";
  const sourceUrl = q.data?.sourceUrl || item?.link;
  const sourceDate = item?.date
    ? new Date(item.date).toLocaleDateString("id-ID", { dateStyle: "long" })
    : null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "rounded-2xl border border-border/60 bg-card/95 p-0 shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "focus:outline-none",
          )}
        >
          {/* Header */}
          <div className="relative shrink-0 border-b border-border/50 px-6 py-5">
            <div className="flex items-start gap-3 pr-8">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Newspaper className="size-4" />
              </div>
              <div className="min-w-0">
                <DialogPrimitive.Title
                  asChild
                  className="text-left text-lg font-semibold leading-snug tracking-tight"
                >
                  <h2 className="line-clamp-3">{title}</h2>
                </DialogPrimitive.Title>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item?.source ?? "Sumber"}
                  {sourceDate ? ` · ${sourceDate}` : ""}
                </p>
              </div>
            </div>

            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <X className="size-4" />
              <span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="space-y-4">
              {q.isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </div>
              ) : null}

              {!q.isLoading && q.data?.blocks.length === 0 ? (
                <div className="rounded-xl border border-border/40 bg-background/60 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Tidak dapat memuat isi artikel secara langsung.
                  </p>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                  >
                    Buka sumber asli <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ) : null}

              {q.data?.blocks.map((block, i) => {
                const isHeading = block.tag.startsWith("h");
                return isHeading ? (
                  <h3
                    key={i}
                    className="mt-5 text-base font-semibold leading-snug text-foreground first:mt-0"
                  >
                    {block.text}
                  </h3>
                ) : (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-foreground/90"
                  >
                    {block.text}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-border/50 px-6 py-4">
            <span className="text-xs text-muted-foreground">
              Ditampilkan dari {item?.source ?? "sumber berita"}
            </span>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Buka sumber <ExternalLink className="size-3.5" />
            </a>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
