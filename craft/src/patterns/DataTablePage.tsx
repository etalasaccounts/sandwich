import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InputSearch } from "@/components/ui/InputSearch";

export function DataTablePage() {
  return (
    <div className="bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[320px] flex-shrink-0 hidden lg:flex overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mt-1 px-1">
          <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
            <Icon icon="solar:layers-minimalistic-linear" className="text-zinc-950 text-base" />
          </div>
          <span className="text-lg font-medium text-zinc-50 tracking-tight">Nordbyte</span>
        </div>

        {/* Search */}
        <InputSearch variant="dark" placeholder="Search customers..." />

        {/* KPI Grid */}
        <div className="flex gap-3 w-full">
          <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-400 font-light">Active</span>
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
            </div>
            <span className="text-3xl font-extralight text-zinc-100 tracking-tight">1,284</span>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-400 font-light">Churn</span>
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            </div>
            <span className="text-3xl font-extralight text-zinc-100 tracking-tight">2.1%</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col w-full gap-0.5 mt-2">
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:home-2-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Overview</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 bg-zinc-900 cursor-pointer">
            <div className="flex items-center gap-3">
              <Icon icon="solar:users-group-rounded-linear" className="text-green-400 text-base" />
              <span className="text-sm font-normal text-zinc-50 tracking-tight">Customers</span>
            </div>
            <span className="rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950">42</span>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:document-text-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Invoices</span>
            </div>
            <span className="rounded-full py-0.5 px-2.5 text-xs font-light bg-zinc-800 text-zinc-400">3</span>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:chart-2-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Reports</span>
            </div>
          </div>
        </nav>

        <div className="flex-1"></div>

        {/* User Footer */}
        <div className="flex items-center gap-3 bg-zinc-900 rounded-2xl p-3 w-full">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:user-circle-linear" className="text-zinc-400 text-lg" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-normal text-zinc-50 truncate">Avery Nolan</span>
            <span className="text-xs font-light text-zinc-500 truncate">avery@nordbyte.com</span>
          </div>
          <button className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 hover:bg-zinc-700 transition-colors">
            <Icon icon="solar:settings-linear" className="text-zinc-400 text-sm" />
          </button>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="bg-white rounded-2xl flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-7 border-b border-zinc-100">
          <span className="text-xl font-medium text-zinc-950 tracking-tight">Customers</span>
          <Button variant="primary" icon="solar:user-plus-linear">
            <span className="text-xs font-medium tracking-wide">Add Customer</span>
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-7 py-4 border-b border-zinc-100">
          <div className="max-w-[280px] w-full">
            <InputSearch variant="light" placeholder="Search customers..." />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button className="rounded-full py-1.5 px-4 text-xs bg-zinc-950 text-white font-normal transition-colors tracking-wide">All</button>
              <button className="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-200/50 font-light transition-colors tracking-wide">Active</button>
              <button className="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-200/50 font-light transition-colors tracking-wide">Churned</button>
            </div>
            <Button variant="icon" icon="solar:sort-vertical-linear" />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-3">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Customer</th>
                <th className="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Status</th>
                <th className="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Plan</th>
                <th className="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal text-right">MRR</th>
                <th className="py-3 px-4 text-xs uppercase tracking-widest text-zinc-400 font-normal">Joined</th>
                <th className="py-3 px-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">AC</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Acme Corp</span>
                      <span className="text-xs font-light text-zinc-500">billing@acme.com</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-sm font-light text-zinc-600">Active</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Pro</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$2,400</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Mar 4, 2024</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>

              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">HL</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Halcyon Labs</span>
                      <span className="text-xs font-light text-zinc-500">ops@halcyonlabs.io</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-sm font-light text-zinc-600">Active</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Business</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$6,800</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Jan 18, 2024</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>

              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-xs font-medium text-white tracking-tight">MS</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Meridian Studio</span>
                      <span className="text-xs font-light text-zinc-500">hello@meridian.design</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-sm font-light text-zinc-600">Past due</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Pro</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$2,400</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Nov 2, 2023</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>

              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">OG</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Ostara Group</span>
                      <span className="text-xs font-light text-zinc-500">finance@ostara.co</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-sm font-light text-zinc-600">Active</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Pro</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$1,150</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Jun 21, 2024</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>

              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300 tracking-tight">FP</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Fernpath</span>
                      <span className="text-xs font-light text-zinc-500">accounts@fernpath.com</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-300"></div>
                    <span className="text-sm font-light text-zinc-600">Churned</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Starter</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$0</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Feb 9, 2023</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>

              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">VH</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Vellum Health</span>
                      <span className="text-xs font-light text-zinc-500">it@vellumhealth.com</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-sm font-light text-zinc-600">Active</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Business</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$5,600</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Apr 30, 2024</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>

              <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-xs font-medium text-white tracking-tight">KF</div>
                    <div className="flex flex-col">
                      <span className="text-sm font-normal text-zinc-950">Kestrel Freight</span>
                      <span className="text-xs font-light text-zinc-500">ap@kestrelfreight.com</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-sm font-light text-zinc-600">Past due</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-600">Pro</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-700 text-right">$1,150</td>
                <td className="py-3.5 px-4 text-sm font-light text-zinc-500">Aug 12, 2025</td>
                <td className="py-3.5 px-4">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
                    <Icon icon="solar:menu-dots-linear" className="text-base" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-zinc-100 mt-auto">
          <span className="text-xs font-light text-zinc-500">Showing 1–7 of 42</span>
          <div className="flex items-center gap-1.5">
            <Button variant="icon" icon="solar:alt-arrow-left-linear" />
            <Button variant="icon" icon="solar:alt-arrow-right-linear" />
          </div>
        </div>
      </main>
    </div>
  );
}
