"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Globe2, X } from "lucide-react";
import { isLanguageCode, languages, type LanguageCode } from "@/lib/languages";

const originalText = new WeakMap<Text, string>();
const cache = new Map<string, string>();
const excluded = "[data-no-translate], [data-language-selector], input, textarea, select, option, code, pre, script, style, svg, [contenteditable], .overview-profile-copy, .account-overview-avatar";

export default function LanguageSelector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("lang");
  const language: LanguageCode = isLanguageCode(code) ? code : "en";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LanguageCode>(language);
  const [error, setError] = useState(false);
  const generation = useRef(0);

  const translate = useCallback(async () => {
    const run = ++generation.current;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      if (!parent || parent.closest(excluded) || !node.textContent?.trim()) continue;
      const current = node.textContent;
      const known = originalText.get(node);
      if (!known || (current !== known && ![...languages].some((item) => cache.get(`${item.code}:${known}`) === current))) originalText.set(node, current);
      const source = originalText.get(node)!;
      // Keep account data and changing values out of the translation request.
      if (/@|\d|https?:\/\/|^[\w.-]+\.[a-z]{2,}$/i.test(source) || source.length > 500) continue;
      nodes.push(node);
    }
    if (language === "en") {
      for (const node of nodes) { const original = originalText.get(node); if (original && node.textContent !== original) node.textContent = original; }
      setError(false);
      return;
    }
    const needed = [...new Set(nodes.map((node) => originalText.get(node)!).filter((value) => !cache.has(`${language}:${value}`)))];
    for (let i = 0; i < needed.length; i += 80) {
      const batch = needed.slice(i, i + 80);
      try {
        const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: language, text: batch }) });
        if (!response.ok) throw new Error("Translation unavailable");
        const data = await response.json() as { translations: string[] };
        batch.forEach((value, index) => {
          const decoder = document.createElement("textarea");
          decoder.innerHTML = data.translations[index];
          cache.set(`${language}:${value}`, decoder.value);
        });
        setError(false);
      } catch { if (run === generation.current) setError(true); return; }
    }
    if (run !== generation.current) return;
    for (const node of nodes) {
      const translated = cache.get(`${language}:${originalText.get(node)}`);
      if (translated && node.isConnected && node.textContent !== translated) node.textContent = translated;
    }
  }, [language]);

  useEffect(() => {
    const timer = window.setTimeout(translate, 100);
    let pending = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(translate, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const currentGeneration = generation;
    return () => { window.clearTimeout(timer); window.clearTimeout(pending); observer.disconnect(); currentGeneration.current++; };
  }, [pathname, language, translate]);

  useEffect(() => {
    if (!code || !isLanguageCode(code)) return;
    const preserve = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.hash && url.pathname === window.location.pathname) return;
      if (url.searchParams.has("lang")) return;
      event.preventDefault();
      url.searchParams.set("lang", code);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", preserve, true);
    return () => document.removeEventListener("click", preserve, true);
  }, [code, router]);

  function applyLanguage() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", draft);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
    setOpen(false);
  }

  return <div data-language-selector className="language-control">
    <button type="button" className="language-trigger" onClick={() => { setDraft(language); setOpen(true); }} aria-label="Change language">
      <Globe2 size={17} aria-hidden="true" /> {languages.find((item) => item.code === language)?.label} <ChevronDown size={16} aria-hidden="true" />
    </button>
    {error && language !== "en" && <span className="language-error" role="status">Translation unavailable</span>}
    {open && <div className="language-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="language-dialog" role="dialog" aria-modal="true" aria-labelledby="language-title">
        <button type="button" className="language-close" onClick={() => setOpen(false)} aria-label="Close"><X size={23} /></button>
        <h2 id="language-title">Change language</h2>
        <label className="language-field" htmlFor="account-language"><span>Language</span>
          <select id="account-language" value={draft} onChange={(event) => setDraft(event.target.value as LanguageCode)}>
            {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select><ChevronDown size={18} aria-hidden="true" />
        </label>
        <div className="language-actions"><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="language-confirm" onClick={applyLanguage} disabled={draft === language}>Confirm</button></div>
      </section>
    </div>}
  </div>;
}
