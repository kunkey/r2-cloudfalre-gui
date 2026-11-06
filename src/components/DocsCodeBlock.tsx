"use client";

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  code: string;
  lang?: 'bash' | 'javascript' | 'json';
};

export function CodeBlock({ code, lang = 'bash' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="relative group rounded-xl border border-black/5 dark:border-white/10 overflow-hidden bg-[#0F172A]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {lang === 'bash' ? 'cURL' : lang === 'json' ? 'JSON' : 'JavaScript'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Copy"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="font-mono text-slate-200 whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
