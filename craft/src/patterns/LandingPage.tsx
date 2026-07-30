import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function LandingPage() {
  return (
    <>
    <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col">
      {/* NAV */}
      <nav className="flex items-center justify-between py-5 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
            <Icon icon="solar:letter-linear" className="text-zinc-950 text-base" />
          </div>
          <span className="text-lg font-medium tracking-tight text-zinc-950">Mail</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Product</a>
          <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Pricing</a>
          <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Changelog</a>
          <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Docs</a>
        </div>

        <Button variant="primary" icon="solar:login-2-linear">
          <span className="text-xs font-medium tracking-wide">Get Started</span>
        </Button>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center text-center gap-6 py-24 sm:py-28">
        <span className="bg-zinc-100 rounded-full py-0.5 px-3 text-xs font-light text-zinc-600">New — Mail 2.0</span>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extralight tracking-tight text-zinc-950 max-w-3xl leading-tight">Every conversation, one calm inbox.</h1>

        <p className="text-sm font-light text-zinc-500 leading-relaxed max-w-2xl">Mail keeps your team's threads, drafts and follow-ups in one quiet place. Shared inboxes, real search, and rules that clear the noise before you open your laptop.</p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Button variant="primary" icon="solar:letter-linear">
            <span className="text-xs font-medium tracking-wide">Start Free Trial</span>
          </Button>
          <Button variant="secondary" icon="solar:play-circle-linear">
            <span className="text-xs font-normal text-zinc-700">View demo</span>
          </Button>
        </div>

        {/* PRODUCT PREVIEW FRAME */}
        <div className="mt-8 w-full max-w-4xl rounded-2xl border border-zinc-100 shadow-sm overflow-hidden text-left">
          <div className="flex items-center gap-2 bg-zinc-50 border-b border-zinc-100 px-4 py-3">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200"></div>
          </div>
          <div className="flex bg-white h-[300px]">
            <div className="w-44 bg-zinc-950 p-3 gap-2 flex-col hidden sm:flex flex-shrink-0">
              <div className="flex items-center gap-2 px-1 mb-1">
                <div className="w-5 h-5 rounded-full bg-green-400"></div>
                <div className="h-2 w-10 rounded-full bg-zinc-700"></div>
              </div>
              <div className="rounded-lg bg-zinc-900 py-2 px-2.5 flex items-center gap-2">
                <Icon icon="solar:inbox-in-linear" className="text-green-400 text-xs" />
                <div className="h-1.5 w-12 rounded-full bg-zinc-600"></div>
              </div>
              <div className="rounded-lg py-2 px-2.5 flex items-center gap-2">
                <Icon icon="solar:plain-linear" className="text-zinc-600 text-xs" />
                <div className="h-1.5 w-10 rounded-full bg-zinc-800"></div>
              </div>
              <div className="rounded-lg py-2 px-2.5 flex items-center gap-2">
                <Icon icon="solar:document-text-linear" className="text-zinc-600 text-xs" />
                <div className="h-1.5 w-9 rounded-full bg-zinc-800"></div>
              </div>
            </div>
            <div className="w-52 bg-zinc-50 border-r border-zinc-100 p-3 gap-2 flex-col hidden md:flex flex-shrink-0">
              <div className="bg-white rounded-lg p-2.5 flex gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="w-6 h-6 rounded-full bg-green-400 flex-shrink-0"></div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-1.5 w-16 rounded-full bg-zinc-300"></div>
                  <div className="h-1.5 w-20 rounded-full bg-zinc-200"></div>
                </div>
              </div>
              <div className="p-2.5 flex gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-400 flex-shrink-0"></div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-1.5 w-14 rounded-full bg-zinc-200"></div>
                  <div className="h-1.5 w-20 rounded-full bg-zinc-100"></div>
                </div>
              </div>
              <div className="p-2.5 flex gap-2">
                <div className="w-6 h-6 rounded-full bg-zinc-300 flex-shrink-0"></div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-1.5 w-12 rounded-full bg-zinc-200"></div>
                  <div className="h-1.5 w-16 rounded-full bg-zinc-100"></div>
                </div>
              </div>
            </div>
            <div className="flex-1 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-40 rounded-full bg-zinc-200"></div>
                <div className="flex gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-100"></div>
                  <div className="w-5 h-5 rounded-full bg-zinc-100"></div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-1.5 w-full rounded-full bg-zinc-100"></div>
                <div className="h-1.5 w-11/12 rounded-full bg-zinc-100"></div>
                <div className="h-1.5 w-3/4 rounded-full bg-zinc-100"></div>
              </div>
              <div className="mt-auto bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-zinc-200"></div>
                <div className="w-6 h-6 rounded-full bg-zinc-950 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:plain-linear" className="text-white text-[10px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="flex flex-col items-center gap-4 py-8 border-t border-zinc-100">
        <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Trusted by teams at</span>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-3">
          <span className="text-sm font-light text-zinc-400">Vellum Health</span>
          <span className="text-sm font-light text-zinc-400">Halcyon Labs</span>
          <span className="text-sm font-light text-zinc-400">Meridian Studio</span>
          <span className="text-sm font-light text-zinc-400">Ostara</span>
          <span className="text-sm font-light text-zinc-400">Fernpath</span>
        </div>
      </section>

      {/* FEATURES */}
      <section className="flex flex-col gap-8 py-16 border-t border-zinc-100">
        <div className="flex flex-col items-center text-center gap-3">
          <h2 className="text-3xl font-extralight tracking-tight text-zinc-950">Everything triage needs, nothing it doesn't</h2>
          <p className="text-sm font-light text-zinc-500 leading-relaxed max-w-xl">Three things most teams end up building themselves, already built in.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
              <Icon icon="solar:inbox-in-linear" className="text-zinc-500 text-lg" />
            </div>
            <span className="text-sm font-medium text-zinc-950 tracking-tight">One shared inbox</span>
            <p className="text-xs font-light text-zinc-500 leading-relaxed">Every thread your team touches lives in one place. Assign an owner, leave a private note, and see who replied without forwarding a single message.</p>
          </div>
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
              <Icon icon="solar:magnifer-linear" className="text-zinc-500 text-lg" />
            </div>
            <span className="text-sm font-medium text-zinc-950 tracking-tight">Search that finds it</span>
            <p className="text-xs font-light text-zinc-500 leading-relaxed">Search across mail, attachments and notes in one field. Results come back in under 40ms, whether the thread is from this morning or four years ago.</p>
          </div>
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
              <Icon icon="solar:tuning-square-2-linear" className="text-zinc-500 text-lg" />
            </div>
            <span className="text-sm font-medium text-zinc-950 tracking-tight">Rules that run themselves</span>
            <p className="text-xs font-light text-zinc-500 leading-relaxed">Route invoices to finance, snooze newsletters until Friday, escalate anything waiting more than a day. Set a rule once and stop triaging by hand.</p>
          </div>
        </div>
      </section>
    </div>

    {/* STATS BAND (full-bleed) */}
    <section className="bg-zinc-950 py-16">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800">
        <div className="flex flex-col gap-2 px-6 first:pl-0 last:pr-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-400 font-light">Teams on Mail</span>
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
          </div>
          <span className="text-3xl font-extralight text-zinc-100 tracking-tight">4,200</span>
        </div>
        <div className="flex flex-col gap-2 px-6 first:pl-0 last:pr-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-400 font-light">Messages a day</span>
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
          </div>
          <span className="text-3xl font-extralight text-zinc-100 tracking-tight">1.8M</span>
        </div>
        <div className="flex flex-col gap-2 px-6 first:pl-0 last:pr-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-400 font-light">Uptime, 90 days</span>
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
          </div>
          <span className="text-3xl font-extralight text-zinc-100 tracking-tight">99.98%</span>
        </div>
        <div className="flex flex-col gap-2 px-6 first:pl-0 last:pr-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-400 font-light">Avg. reply time</span>
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          </div>
          <span className="text-3xl font-extralight text-zinc-100 tracking-tight">12m</span>
        </div>
      </div>
    </section>

    <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col">
      {/* TESTIMONIALS */}
      <section className="flex flex-col gap-8 py-16 border-b border-zinc-100">
        <div className="flex flex-col items-center text-center gap-3">
          <h2 className="text-3xl font-extralight tracking-tight text-zinc-950">Teams that stopped sorting</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-5">
            <p className="text-sm font-light text-zinc-700 leading-relaxed">"We moved the whole studio over in an afternoon. Nobody asked a single question — it just made sense."</p>
            <div className="flex items-center gap-2.5 mt-auto">
              <div className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight flex-shrink-0">SL</div>
              <div className="flex flex-col">
                <span className="text-sm font-normal text-zinc-950">Sarah Lin</span>
                <span className="text-xs font-light text-zinc-500">Ops lead, Nordbyte</span>
              </div>
            </div>
          </div>
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-5">
            <p className="text-sm font-light text-zinc-700 leading-relaxed">"Search alone paid for the subscription. We used to lose entire threads in someone's personal inbox."</p>
            <div className="flex items-center gap-2.5 mt-auto">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-xs font-medium text-white tracking-tight flex-shrink-0">JK</div>
              <div className="flex flex-col">
                <span className="text-sm font-normal text-zinc-950">James Kim</span>
                <span className="text-xs font-light text-zinc-500">Support lead, Halcyon Labs</span>
              </div>
            </div>
          </div>
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-5">
            <p className="text-sm font-light text-zinc-700 leading-relaxed">"The rules engine quietly does the triage three people used to do by hand every morning."</p>
            <div className="flex items-center gap-2.5 mt-auto">
              <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight flex-shrink-0">TP</div>
              <div className="flex flex-col">
                <span className="text-sm font-normal text-zinc-950">Tara Patel</span>
                <span className="text-xs font-light text-zinc-500">Founder, Meridian Studio</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="flex flex-col gap-10 py-16 border-b border-zinc-100">
        <div className="flex flex-col items-center text-center gap-3">
          <h2 className="text-3xl font-extralight tracking-tight text-zinc-950">Simple pricing, per seat</h2>
          <p className="text-sm font-light text-zinc-500 leading-relaxed max-w-xl">Every plan includes the shared inbox, search and rules. Move up when you need more history, more automation or SSO.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Starter */}
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Starter</span>
              <span className="text-xs font-light text-zinc-500">For one person keeping it tidy.</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extralight tracking-tight text-zinc-950">$0</span>
              <span className="text-xs font-light text-zinc-500">/mo</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">One inbox, one seat</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">90 days of history</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">3 automation rules</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">Community support</span>
              </div>
            </div>
            <Button variant="secondary">
              <span className="text-xs font-normal text-zinc-700">Start for free</span>
            </Button>
          </div>

          {/* Pro (dark, popular) */}
          <div className="bg-zinc-950 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-50 tracking-tight">Pro</span>
                <span className="rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950">Popular</span>
              </div>
              <span className="text-xs font-light text-zinc-400">For a team sharing the load.</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extralight tracking-tight text-zinc-100">$24</span>
              <span className="text-xs font-light text-zinc-500">/mo</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-400">Unlimited shared inboxes</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-400">Full history, full-text search</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-400">Unlimited rules and snoozes</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-400">Assignments and private notes</span>
              </div>
            </div>
            <button className="bg-green-400 text-zinc-950 rounded-xl py-2.5 w-full text-xs font-medium tracking-wide hover:bg-green-300 transition-colors mt-auto">Start 14-day trial</button>
          </div>

          {/* Business */}
          <div className="border border-zinc-100 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Business</span>
              <span className="text-xs font-light text-zinc-500">For companies with a policy.</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extralight tracking-tight text-zinc-950">$64</span>
              <span className="text-xs font-light text-zinc-500">/mo</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">Everything in Pro</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">SAML SSO and SCIM</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">Audit log and retention rules</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon icon="solar:check-circle-linear" className="text-green-400 text-sm" />
                <span className="text-xs font-light text-zinc-500">Named support engineer</span>
              </div>
            </div>
            <Button variant="secondary">
              <span className="text-xs font-normal text-zinc-700">Talk to sales</span>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="flex flex-col gap-8 py-16 border-b border-zinc-100">
        <div className="flex flex-col items-center text-center gap-3">
          <h2 className="text-3xl font-extralight tracking-tight text-zinc-950">Questions, answered</h2>
        </div>
        <div className="max-w-2xl mx-auto w-full flex flex-col">
          <div className="border-b border-zinc-100 py-5">
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Can I import from Gmail or Outlook?</span>
              <Icon icon="solar:alt-arrow-up-linear" className="text-zinc-500 text-base flex-shrink-0" />
            </div>
            <p className="text-xs font-light text-zinc-500 leading-relaxed mt-3 max-w-xl">Yes — connect your existing account and Mail pulls in the last 12 months of history by default, or everything if you'd rather start with the full archive.</p>
          </div>

          <div className="border-b border-zinc-100 py-5">
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">What happens when I hit my plan's seat limit?</span>
              <Icon icon="solar:alt-arrow-down-linear" className="text-zinc-400 text-base flex-shrink-0" />
            </div>
          </div>

          <div className="border-b border-zinc-100 py-5">
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Is there a limit on automation rules?</span>
              <Icon icon="solar:alt-arrow-down-linear" className="text-zinc-400 text-base flex-shrink-0" />
            </div>
          </div>

          <div className="border-b border-zinc-100 py-5">
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Do you support SAML SSO on every plan?</span>
              <Icon icon="solar:alt-arrow-down-linear" className="text-zinc-400 text-base flex-shrink-0" />
            </div>
          </div>

          <div className="py-5">
            <div className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Can I cancel anytime?</span>
              <Icon icon="solar:alt-arrow-down-linear" className="text-zinc-400 text-base flex-shrink-0" />
            </div>
          </div>
        </div>
      </section>
    </div>

    {/* FINAL CTA BAND (full-bleed) */}
    <section className="bg-zinc-50 py-16">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col items-center text-center gap-6">
        <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight text-zinc-950 max-w-xl">Ready for a calmer inbox?</h2>
        <p className="text-sm font-light text-zinc-500 max-w-md">Free for one seat, no card required. Upgrade whenever the team grows.</p>
        <Button variant="primary" icon="solar:letter-linear">
          <span className="text-xs font-medium tracking-wide">Start Free Trial</span>
        </Button>
      </div>
    </section>

    <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col">
      {/* FOOTER */}
      <footer className="flex flex-col gap-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
                <Icon icon="solar:letter-linear" className="text-zinc-950 text-base" />
              </div>
              <span className="text-lg font-medium tracking-tight text-zinc-950">Mail</span>
            </div>
            <p className="text-xs font-light text-zinc-500 leading-relaxed">A shared inbox for teams who would rather answer than sort. Built by Nordbyte in Oslo.</p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Product</span>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Shared inbox</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Search</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Rules</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Integrations</a>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Company</span>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">About Nordbyte</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Careers</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Changelog</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Press kit</a>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Resources</span>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Docs</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Migration guide</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Status</a>
            <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Privacy</a>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
          <span className="text-xs font-light text-zinc-400">© 2026 Nordbyte AS. All rights reserved.</span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
              <Icon icon="solar:letter-linear" className="text-base" />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
              <Icon icon="solar:chat-round-line-linear" className="text-base" />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
              <Icon icon="solar:global-linear" className="text-base" />
            </button>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
