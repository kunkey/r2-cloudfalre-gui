"use client";

import { useState, useCallback, useRef } from "react";
import { FormFriends, useFormFriends } from "@/components/form-friends";
import "@/components/form-friends/form-friends.css";
import { CloudflareLogo } from "@/components/CloudflareLogo";
import { Eye, EyeOff, Lock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

export default function AuthPage() {
  const friends = useFormFriends();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    if (!password) {
      setError("Please enter your password");
      friends.error();
      toast.warning("Password required", "Please enter your password to continue");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        friends.success();
        toast.success("Welcome back!", "Redirecting to your gallery...");
        setTimeout(() => {
          window.location.href = "/";
        }, 600);
      } else {
        friends.error();
        setError("Invalid Password!");
        toast.error("Authentication failed", "The password you entered is incorrect");
      }
    } catch {
      friends.error();
      setError("Connection error. Please try again.");
      toast.error("Error", "Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }, [password, friends]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 bg-[#0f172a] text-slate-100 relative overflow-hidden select-none">
      {/* Background radial effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(59,130,246,0.15),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(147,51,234,0.1),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_90%,rgba(245,158,11,0.08),transparent)] pointer-events-none" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-5xl flex items-center justify-between py-2 z-10">
        <div className="flex items-center gap-2.5">
          <CloudflareLogo className="w-7 h-7" />
          <span className="font-semibold text-lg tracking-tight text-white whitespace-nowrap">
            R2 Cloudflare
          </span>
        </div>
      </div>

      {/* Main Container: Form Friends on left/top, Auth Card on right/bottom */}
      <div className="relative z-10 w-full max-w-4xl my-auto grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-center">
        {/* Form Friends Scene */}
        <div
          ref={friends.sceneRef}
          className="relative bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 flex flex-col items-center justify-center overflow-hidden transition-all duration-300 hover:border-white/15"
          style={{ minHeight: "320px" }}
        >
          <div className="w-full max-w-[340px] aspect-[4/3] flex items-center justify-center">
            <FormFriends mood={friends.mood} />
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/5 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Interactive Form Companion</span>
          </div>
        </div>

        {/* Form Card */}
        <div
          ref={friends.formRef}
          className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/60 relative"
        >
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Sign In
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Enter your access password to open your R2 bucket gallery
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter bucket password..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  {...friends.passwordProps()}
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer transition select-none">
                <input
                  type="checkbox"
                  checked={showPassword}
                  {...friends.revealProps({
                    onChange: (e) => setShowPassword(e.target.checked),
                  })}
                  className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span>Show password</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center flex items-center justify-center gap-1.5 animate-shake">
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center z-10">
        <a
          href="https://github.com/kunkeypr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition inline-flex items-center gap-1.5"
        >
          <span>© 2026 - Vũ Duy Lực</span>
        </a>
      </footer>
    </div>
  );
}
