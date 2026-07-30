import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function DetailPage() {
  return (
    <div className="bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[280px] flex-shrink-0 hidden lg:flex overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mt-1 px-1">
          <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
            <Icon icon="solar:layers-minimalistic-linear" className="text-zinc-950 text-base" />
          </div>
          <span className="text-lg font-medium text-zinc-50 tracking-tight">Nordbyte</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col w-full gap-0.5 mt-4">
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
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
              <Icon icon="solar:alt-arrow-left-linear" className="text-base" />
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-light text-zinc-400">Customers</span>
              <span className="text-xl font-medium text-zinc-950 tracking-tight">Acme Corp</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="solar:pen-linear">
              <span className="text-xs font-normal">Edit</span>
            </Button>
            <Button variant="primary" icon="solar:trash-bin-trash-linear" className="bg-red-600 hover:bg-red-700">
              <span className="text-xs font-medium tracking-wide">Delete</span>
            </Button>
          </div>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main: field groups */}
          <div className="flex-1 p-7 overflow-y-auto">
            <div className="flex flex-col gap-6 max-w-2xl">
              {/* Contact info */}
              <div className="flex flex-col gap-4">
                <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Contact</span>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-light text-zinc-500">Email</span>
                    <span className="text-sm font-light text-zinc-900">billing@acme.com</span>
                  </div>
                  <div className="flex items-start justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-light text-zinc-500">Phone</span>
                    <span className="text-sm font-light text-zinc-900">+1 (555) 123-4567</span>
                  </div>
                  <div className="flex items-start justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-light text-zinc-500">Address</span>
                    <span className="text-sm font-light text-zinc-900 text-right max-w-[300px]">123 Market Street, Suite 400<br />San Francisco, CA 94105</span>
                  </div>
                </div>
              </div>

              {/* Billing info */}
              <div className="flex flex-col gap-4">
                <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Billing</span>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-light text-zinc-500">Plan</span>
                    <span className="text-sm font-light text-zinc-900">Pro</span>
                  </div>
                  <div className="flex items-start justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-light text-zinc-500">MRR</span>
                    <span className="text-sm font-light text-zinc-900">$2,400</span>
                  </div>
                  <div className="flex items-start justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-light text-zinc-500">Billing cycle</span>
                    <span className="text-sm font-light text-zinc-900">Monthly</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-4">
                <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Notes</span>
                <p className="text-sm font-light text-zinc-700 leading-relaxed">
                  Enterprise customer since 2023. Primary contact for quarterly business reviews.
                  Interested in expanding to the Business tier for additional team members.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="w-80 border-l border-zinc-100 p-5 flex flex-col gap-5 overflow-y-auto">
            {/* Status card */}
            <div className="bg-zinc-50/80 rounded-2xl p-4 flex flex-col gap-3">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-sm font-light text-zinc-600">Active</span>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Metadata</span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-light text-zinc-500">Created</span>
                  <span className="text-xs font-light text-zinc-600">Mar 4, 2024</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-light text-zinc-500">Updated</span>
                  <span className="text-xs font-light text-zinc-600">Jul 18, 2025</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-light text-zinc-500">ID</span>
                  <button className="text-xs font-light text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1">
                    cus_n8k2m9x4
                    <Icon icon="solar:copy-linear" className="text-zinc-400 text-xs" />
                  </button>
                </div>
              </div>
            </div>

            {/* Related: recent invoices */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Recent invoices</span>
                <button className="text-xs font-light text-green-600 hover:text-green-700 transition-colors">View all</button>
              </div>
              <div className="flex flex-col gap-2">
                <button className="flex items-center justify-between py-2 px-3 bg-zinc-50/80 rounded-xl hover:bg-zinc-100 transition-colors text-left w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-light text-zinc-900">#2024-089</span>
                    <span className="text-xs font-light text-zinc-500">Jul 1</span>
                  </div>
                  <span className="text-xs font-light text-zinc-600">$2,400</span>
                </button>
                <button className="flex items-center justify-between py-2 px-3 bg-zinc-50/80 rounded-xl hover:bg-zinc-100 transition-colors text-left w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-light text-zinc-900">#2024-060</span>
                    <span className="text-xs font-light text-zinc-500">Jun 1</span>
                  </div>
                  <span className="text-xs font-light text-zinc-600">$2,400</span>
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-3 pt-2">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Quick actions</span>
              <div className="flex flex-col gap-2">
                <button className="flex items-center gap-2 py-2 px-3 bg-zinc-50/80 rounded-xl hover:bg-zinc-100 transition-colors text-left">
                  <Icon icon="solar:letter-linear" className="text-zinc-400 text-base" />
                  <span className="text-xs font-light text-zinc-700">Send invoice</span>
                </button>
                <button className="flex items-center gap-2 py-2 px-3 bg-zinc-50/80 rounded-xl hover:bg-zinc-100 transition-colors text-left">
                  <Icon icon="solar:refresh-linear" className="text-zinc-400 text-base" />
                  <span className="text-xs font-light text-zinc-700">Reset password</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
