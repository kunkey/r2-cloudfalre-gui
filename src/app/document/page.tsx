"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ArrowLeft,
  KeyRound,
  Globe,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  API_DOCS,
  API_GROUPS,
  type ApiDoc,
  type FieldDoc,
} from '@/lib/api-docs';
import { CodeBlock } from '@/components/DocsCodeBlock';

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide ${METHOD_STYLE[method] ?? ''}`}
    >
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: ApiDoc['auth'] }) {
  if (auth === 'none') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <Globe className="w-3 h-3" /> Public
      </span>
    );
  }
  if (auth === 'cookie') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <ShieldCheck className="w-3 h-3" /> Cookie
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90">
      <KeyRound className="w-3 h-3" /> Bearer token
    </span>
  );
}

function FieldTable({
  fields,
  title,
}: {
  fields: FieldDoc[];
  title: string;
}) {
  if (!fields.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h4>
      <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] dark:bg-white/[0.03]">
            <tr>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-xs w-[26%]">
                Field
              </th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-xs w-[22%]">
                Type
              </th>
              <th className="px-4 py-2.5 font-medium text-slate-500 text-xs">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {fields.map((f) => (
              <tr key={f.name} className="align-top">
                <td className="px-4 py-3">
                  <code className="font-mono text-[13px] text-indigo-400">
                    {f.name}
                  </code>
                  {f.required && (
                    <span className="ml-2 text-[10px] uppercase text-rose-400 font-semibold">
                      required
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <code className="font-mono text-[12px] text-slate-400">
                    {f.type}
                  </code>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {f.description}
                  {f.example && (
                    <div className="mt-1 text-[12px] text-slate-500">
                      <span className="text-slate-500">e.g. </span>
                      <code className="font-mono text-slate-400">
                        {f.example}
                      </code>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointCard({ doc }: { doc: ApiDoc }) {
  const [open, setOpen] = useState(false);
  const anchor = `${doc.method.toLowerCase()}-${doc.path
    .replace(/^\/api\//, '')
    .replace(/[/?=&]/g, '-')
    .replace(/\/+$/, '')}`;

  return (
    <div
      id={anchor}
      className="scroll-mt-24 rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-900/60 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0">
          <MethodBadge method={doc.method} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-sm text-slate-800 dark:text-slate-100 font-medium">
              {doc.path}
            </code>
            <AuthBadge auth={doc.auth} />
          </div>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {doc.title}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-500 leading-relaxed">
            {doc.summary}
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-6 pt-1 space-y-5 border-t border-black/5 dark:border-white/10">
          {doc.note && (
            <div className="flex gap-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 p-3.5">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-sky-100/90 dark:text-sky-200/90 leading-relaxed">
                {doc.note}
              </p>
            </div>
          )}

          {doc.body && <FieldTable fields={doc.body} title="Request body" />}
          {doc.query && <FieldTable fields={doc.query} title="Query parameters" />}

          {doc.errors && doc.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Errors
              </h4>
              <ul className="space-y-1.5">
                {doc.errors.map((e) => (
                  <li key={e.status} className="flex items-start gap-2.5 text-[13px]">
                    <span className="shrink-0 font-mono text-[12px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
                      {e.status}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {e.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.response && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Response
              </h4>
              <CodeBlock code={doc.response} lang="json" />
            </div>
          )}

          {doc.curl && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Example — cURL
              </h4>
              <CodeBlock code={doc.curl} lang="bash" />
            </div>
          )}

          {doc.js && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Example — JavaScript
              </h4>
              <CodeBlock code={doc.js} lang="javascript" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentPage() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return API_DOCS;
    return API_DOCS.filter(
      (d) =>
        d.path.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.method.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    return API_GROUPS.map((group) => ({
      group,
      docs: filtered.filter((d) => d.group === group),
    })).filter((g) => g.docs.length > 0);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại Gallery
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">
              API Documentation
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl">
              Tài liệu đầy đủ cho {API_DOCS.length} endpoint của R2 Gallery
              Gallery. Dùng header{' '}
              <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-indigo-500">
                Authorization: Bearer &lt;APP_PASSWORD&gt;
              </code>{' '}
              cho các endpoint yêu cầu xác thực.
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-900/60 p-5 mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Xác thực
          </h2>
          <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            Gửi mật khẩu ứng dụng qua header{' '}
            <code className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-indigo-500">
              Authorization
            </code>
            . Giá trị lấy từ biến môi trường{' '}
            <code className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-indigo-500">
              APP_PASSWORD
            </code>
            .
          </p>
          <CodeBlock
            code={`curl "{{BASE}}/api/objects" \\
  -H "Authorization: Bearer 123123123@@"`}
            lang="bash"
          />
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm endpoint… (ví dụ: upload, folders, signed-get)"
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-black/5 dark:border-white/10 text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition placeholder:text-slate-400"
          />
        </div>

        {/* Endpoint list */}
        {grouped.length === 0 ? (
          <p className="text-center text-slate-500 py-16 text-sm">
            Không tìm thấy endpoint nào khớp “{query}”.
          </p>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ group, docs }) => (
              <section key={group}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                  {group}
                </h2>
                <div className="space-y-3">
                  {docs.map((doc) => (
                    <EndpointCard key={doc.id} doc={doc} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-16 pt-6 border-t border-black/5 dark:border-white/10 text-center text-xs text-slate-400">
          R2 Gallery API · {API_DOCS.length} endpoints ·{" "}
          <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-200">
            Quay lại Gallery
          </Link>
        </footer>
      </div>
    </div>
  );
}
