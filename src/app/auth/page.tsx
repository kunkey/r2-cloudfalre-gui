"use client";

import { useState, useCallback } from "react";

export default function AuthPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    const res = await fetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("Invalid Password!");
    }
  }, [password]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.3),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_50%,rgba(139,92,246,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_80%,rgba(59,130,246,0.1),transparent)]" />
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/30 px-8 py-10">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              R2 CLOUDFLARE
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Enter your password to continue
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
            />
            <button
              type="submit"
              onClick={submit}
              className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
            >
              Login
            </button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          © 2026 Vũ Duy Lực
        </p>
      </div>
    </div>
  );
}
