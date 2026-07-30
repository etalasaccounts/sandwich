import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InputField } from "@/components/ui/InputField";

export function AuthPage() {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center p-4">
      <div className="flex rounded-2xl overflow-hidden shadow-xl max-w-[900px] w-full h-[600px]">
        {/* BRAND PANEL (dark) */}
        <aside className="bg-zinc-950 rounded-2xl p-8 flex-col justify-between w-[440px] flex-shrink-0 hidden md:flex overflow-y-auto">
          {/* brand row */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
              <Icon icon="solar:letter-linear" className="text-zinc-950 text-base" />
            </div>
            <span className="text-lg font-medium text-zinc-50 tracking-tight">Mail</span>
          </div>

          {/* middle: tagline + proof */}
          <div className="flex flex-col gap-6">
            <span className="text-3xl font-extralight text-zinc-100 tracking-tight leading-snug">
              Every conversation, one calm inbox.
            </span>

            <div className="flex gap-3 w-full">
              <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-zinc-400 font-light">Teams on Mail</span>
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                </div>
                <span className="text-3xl font-extralight text-zinc-100 tracking-tight">4,200</span>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-zinc-400 font-light">Avg. reply time</span>
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                </div>
                <span className="text-3xl font-extralight text-zinc-100 tracking-tight">12m</span>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-sm font-light text-zinc-400 leading-relaxed">
                "We moved the whole studio over in an afternoon. Nobody asked a single question — it just made sense."
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">
                  SL
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-normal text-zinc-50">Sarah Lin</span>
                  <span className="text-xs font-light text-zinc-500">Ops lead, Nordbyte</span>
                </div>
              </div>
            </div>
          </div>

          <span className="text-xs font-light text-zinc-600">© 2026 Nordbyte</span>
        </aside>

        {/* FORM PANEL */}
        <main className="bg-white rounded-2xl flex flex-col items-center justify-center flex-1 overflow-y-auto p-8">
          <div className="w-full max-w-[360px] flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xl font-medium text-zinc-950 tracking-tight">Welcome back</span>
              <span className="text-xs font-light text-zinc-500">Sign in to continue to your inbox.</span>
            </div>

            <Button variant="secondary" icon="solar:shield-keyhole-linear">
              <span className="text-xs font-normal">Continue with SSO</span>
            </Button>

            {/* divider */}
            <div className="flex items-center gap-3">
              <div className="h-px bg-zinc-100 flex-1"></div>
              <span className="text-xs font-light text-zinc-400">or</span>
              <div className="h-px bg-zinc-100 flex-1"></div>
            </div>

            <div className="flex flex-col gap-4">
              <InputField
                label="Email"
                type="email"
                placeholder="you@company.com"
              />
              <InputField
                label="Password"
                type="password"
                placeholder="Enter your password"
                labelAction={
                  <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">
                    Forgot password?
                  </a>
                }
              />
            </div>

            <Button variant="primary" icon="solar:login-2-linear">
              <span className="text-xs font-medium tracking-wide">Sign In</span>
            </Button>

            <span className="text-xs font-light text-zinc-500 text-center">
              Don't have an account?{" "}
              <a href="#" className="font-normal text-zinc-950 hover:underline">
                Create one
              </a>
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
