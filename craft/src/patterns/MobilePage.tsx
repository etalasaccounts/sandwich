import { Icon } from "@/components/ui/Icon";

const emails = [
  { id: 1, name: "Marcus Reid", initials: "MR", color: "bg-green-400", textColor: "text-zinc-950", subject: "Q3 Proposal — Final Review", preview: "I've attached the final version of the proposal. Let me know if you need changes.", time: "10:42 AM", unread: true },
  { id: 2, name: "Sarah Lin", initials: "SL", color: "bg-cyan-400", textColor: "text-zinc-950", subject: "Re: Onboarding Schedule", preview: "The new onboarding flow is ready for review. Can we sync tomorrow at 2pm?", time: "9:15 AM", unread: true },
  { id: 3, name: "James Kim", initials: "JK", color: "bg-orange-500", textColor: "text-white", subject: "Invoice #2024-089 Due", preview: "A reminder that invoice #2024-089 for $4,200 is due on Friday, March 8th.", time: "Yesterday", unread: false },
  { id: 4, name: "Tara Patel", initials: "TP", color: "bg-zinc-800", textColor: "text-zinc-300", subject: "Design System Feedback", preview: "Loved the new button styles — the ghost button feels a touch subtle on dark.", time: "Mon", unread: false },
  { id: 5, name: "Priya Raman", initials: "PR", color: "bg-green-400", textColor: "text-zinc-950", subject: "Renewal terms for Ostara", preview: "They want to move to annual billing from June. Numbers are in the sheet.", time: "Sun", unread: false },
];

export function MobilePage() {
  return (
    <div className="bg-white rounded-3xl p-2 w-full max-w-[390px] h-[780px] shadow-sm overflow-hidden flex flex-col gap-2">
      {/* CONTENT PANEL */}
      <div className="bg-zinc-50 rounded-2xl flex flex-col flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-950 tracking-tight">AN</div>
            <div className="flex flex-col">
              <span className="text-xs font-light text-zinc-500">Good morning</span>
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Avery Nolan</span>
            </div>
          </div>
          <div className="relative">
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
              <Icon icon="solar:bell-linear" className="text-base" />
            </button>
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400"></div>
          </div>
        </div>

        {/* KPI row */}
        <div className="flex gap-3 px-5">
          <div className="bg-white border border-zinc-100 rounded-2xl p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-500 font-light">Unreads</span>
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
            </div>
            <span className="text-3xl font-extralight text-zinc-950 tracking-tight">6</span>
          </div>
          <div className="bg-white border border-zinc-100 rounded-2xl p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-500 font-light">Updates</span>
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            </div>
            <span className="text-3xl font-extralight text-zinc-950 tracking-tight">22</span>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-2">
          <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Recent</span>
          <span className="text-xs font-light text-zinc-500">View all</span>
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`flex gap-3.5 p-4 rounded-2xl mx-3 cursor-pointer transition-colors ${
                email.unread
                  ? "bg-white border-l-0"
                  : "hover:bg-zinc-100/50"
              }`}
            >
              <div className={`w-10 h-10 rounded-full ${email.color} flex items-center justify-center flex-shrink-0 text-xs font-medium ${email.textColor} tracking-tight`}>
                {email.initials}
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0 py-0.5">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${email.unread ? "font-medium text-zinc-950" : "font-light text-zinc-600"}`}>{email.name}</span>
                    {email.unread && <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>}
                  </div>
                  <span className={`text-xs ${email.unread ? "text-zinc-500 font-light" : "text-zinc-400 font-light"}`}>{email.time}</span>
                </div>
                <span className={`text-sm ${email.unread ? "font-medium text-zinc-950 tracking-tight" : "font-light text-zinc-700 tracking-tight"} truncate`}>
                  {email.subject}
                </span>
                <span className={`text-xs ${email.unread ? "text-zinc-500 font-light" : "text-zinc-400 font-light"} truncate`}>
                  {email.preview}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <nav className="bg-zinc-950 rounded-2xl p-2 flex items-center justify-around flex-shrink-0">
        <button className="w-11 h-11 rounded-full bg-zinc-900 flex items-center justify-center">
          <Icon icon="solar:home-2-linear" className="text-green-400 text-xl" />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center">
          <Icon icon="solar:magnifer-linear" className="text-zinc-500 text-xl hover:text-zinc-300 transition-colors" />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center">
          <Icon icon="solar:pen-new-square-linear" className="text-zinc-500 text-xl hover:text-zinc-300 transition-colors" />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center">
          <Icon icon="solar:bell-linear" className="text-zinc-500 text-xl hover:text-zinc-300 transition-colors" />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center">
          <Icon icon="solar:user-circle-linear" className="text-zinc-500 text-xl hover:text-zinc-300 transition-colors" />
        </button>
      </nav>
    </div>
  );
}
