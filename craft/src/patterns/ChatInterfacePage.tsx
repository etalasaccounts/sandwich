import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InputSearch } from "@/components/ui/InputSearch";

export function ChatInterfacePage() {
  return (
    <div className="bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[280px] flex-shrink-0 hidden lg:flex overflow-y-auto">
        {/* Brand & New chat */}
        <div className="flex items-center justify-between w-full mt-1 px-1">
          <span className="text-lg font-medium text-zinc-50 tracking-tight">Chat</span>
          <Button variant="compact" icon="solar:pen-new-square-linear">
            <span className="text-xs text-zinc-400 font-light">New chat</span>
          </Button>
        </div>

        {/* Search */}
        <InputSearch variant="dark" placeholder="Search chats..." />

        {/* Nav */}
        <nav className="flex flex-col w-full gap-0.5 mt-2">
          <div className="flex items-center justify-between rounded-xl py-2 px-3 bg-zinc-900 cursor-pointer">
            <div className="flex items-center gap-3">
              <Icon icon="solar:chat-round-dots-linear" className="text-green-400 text-base" />
              <span className="text-sm font-normal text-zinc-50 tracking-tight">All chats</span>
            </div>
            <span className="rounded-full py-0.5 px-2.5 text-xs font-normal bg-green-400 text-zinc-950">5</span>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:users-group-rounded-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Groups</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:archive-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Archived</span>
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

      {/* CONVERSATION LIST */}
      <section className="bg-zinc-50 rounded-2xl flex flex-col w-full md:w-[340px] flex-shrink-0 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 w-full border-b border-zinc-100">
          <div className="flex items-center justify-between w-full">
            <span className="text-lg font-medium text-zinc-950 tracking-tight">Chats</span>
            <Button variant="icon" icon="solar:tuning-square-2-linear" />
          </div>
          <div className="flex items-center gap-1 w-full">
            <button className="rounded-full py-1.5 px-4 text-xs bg-zinc-950 text-white font-normal transition-colors tracking-wide">All</button>
            <button className="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-200/50 font-light transition-colors tracking-wide">Unread</button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Conversation 1 (Selected) */}
          <div className="flex gap-3.5 p-4 bg-white border-l-2 border-zinc-950 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">SL</div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white absolute -bottom-0.5 -right-0.5"></div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium text-zinc-950">Sarah Lin</span>
                <span className="text-xs text-zinc-500 font-light">10:42 AM</span>
              </div>
              <span className="text-xs text-zinc-500 font-light truncate">Sounds good — I'll have the mocks ready by 2pm.</span>
            </div>
          </div>

          {/* Conversation 2 (Unread) */}
          <div className="flex gap-3.5 p-4 border-b border-zinc-100 cursor-pointer hover:bg-zinc-100/50 transition-colors border-l-2 border-transparent">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">MR</div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium text-zinc-950">Marcus Reid</span>
                <span className="text-xs text-zinc-500 font-light">9:15 AM</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-500 font-light truncate">Can we push the sync to tomorrow?</span>
                <span className="rounded-full w-5 h-5 flex-shrink-0 flex items-center justify-center text-[10px] font-normal bg-green-400 text-zinc-950">2</span>
              </div>
            </div>
          </div>

          {/* Conversation 3 (Group, read) */}
          <div className="flex gap-3.5 p-4 border-b border-zinc-100 cursor-pointer hover:bg-zinc-100/50 transition-colors border-l-2 border-transparent">
            <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-300 tracking-tight">
              <Icon icon="solar:users-group-rounded-linear" className="text-base" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-light text-zinc-600">Design Team</span>
                <span className="text-xs text-zinc-400 font-light">Yesterday</span>
              </div>
              <span className="text-xs text-zinc-400 font-light truncate">Tara: Loved the new button styles!</span>
            </div>
          </div>

          {/* Conversation 4 (read) */}
          <div className="flex gap-3.5 p-4 border-b border-zinc-100 cursor-pointer hover:bg-zinc-100/50 transition-colors border-l-2 border-transparent">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-orange-500 flex items-center justify-center text-xs font-medium text-white tracking-tight">JK</div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-light text-zinc-600">James Kim</span>
                <span className="text-xs text-zinc-400 font-light">Mon</span>
              </div>
              <span className="text-xs text-zinc-400 font-light truncate">Thanks, appreciate the quick turnaround.</span>
            </div>
          </div>

          {/* Conversation 5 (read) */}
          <div className="flex gap-3.5 p-4 cursor-pointer hover:bg-zinc-100/50 transition-colors border-l-2 border-transparent">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300 tracking-tight">TP</div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-light text-zinc-600">Tara Patel</span>
                <span className="text-xs text-zinc-400 font-light">Fri</span>
              </div>
              <span className="text-xs text-zinc-400 font-light truncate">See you at the sync tomorrow.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE THREAD */}
      <main className="bg-white rounded-2xl flex flex-col flex-1 overflow-hidden hidden md:flex">
        {/* Thread Header */}
        <div className="flex items-center justify-between gap-4 p-5 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-xs font-medium text-zinc-950 tracking-tight">SL</div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white absolute -bottom-0.5 -right-0.5"></div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-zinc-950">Sarah Lin</span>
              <span className="text-xs font-light text-green-500">Active now</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors">
              <Icon icon="solar:phone-linear" className="text-base" />
            </button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors">
              <Icon icon="solar:videocamera-linear" className="text-base" />
            </button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors">
              <Icon icon="solar:info-circle-linear" className="text-base" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex flex-col gap-3 p-7 flex-1 overflow-y-auto">
          {/* Date separator */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-px bg-zinc-100 flex-1"></div>
            <span className="text-xs font-light text-zinc-400">Today</span>
            <div className="h-px bg-zinc-100 flex-1"></div>
          </div>

          {/* Received */}
          <div className="flex items-end gap-2.5 max-w-[70%]">
            <div className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-zinc-950 tracking-tight">SL</div>
            <div className="flex flex-col gap-1">
              <div className="bg-zinc-100 rounded-2xl rounded-bl-sm py-2.5 px-3.5">
                <span className="text-sm font-light text-zinc-900">Hey! Do you have the updated mocks for the pricing page?</span>
              </div>
              <span className="text-xs font-light text-zinc-400 px-1">10:31 AM</span>
            </div>
          </div>

          {/* Sent */}
          <div className="flex flex-col gap-1 self-end max-w-[70%] items-end">
            <div className="bg-zinc-950 text-white rounded-2xl rounded-br-sm py-2.5 px-3.5">
              <span className="text-sm font-light">Almost — just tightening up the featured tier. Give me 20 minutes.</span>
            </div>
            <span className="text-xs font-light text-zinc-400 px-1">10:33 AM</span>
          </div>

          {/* Received */}
          <div className="flex items-end gap-2.5 max-w-[70%]">
            <div className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-zinc-950 tracking-tight">SL</div>
            <div className="flex flex-col gap-1">
              <div className="bg-zinc-100 rounded-2xl rounded-bl-sm py-2.5 px-3.5">
                <span className="text-sm font-light text-zinc-900">No rush, I'm reviewing the copy in the meantime.</span>
              </div>
              <span className="text-xs font-light text-zinc-400 px-1">10:34 AM</span>
            </div>
          </div>

          {/* Sent */}
          <div className="flex flex-col gap-1 self-end max-w-[70%] items-end">
            <div className="bg-zinc-950 text-white rounded-2xl rounded-br-sm py-2.5 px-3.5">
              <span className="text-sm font-light">Sounds good — I'll have the mocks ready by 2pm.</span>
            </div>
            <span className="text-xs font-light text-zinc-400 px-1">10:42 AM</span>
          </div>

          {/* Typing indicator */}
          <div className="flex items-end gap-2.5">
            <div className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-zinc-950 tracking-tight">SL</div>
            <div className="bg-zinc-100 rounded-2xl rounded-bl-sm py-3 px-4 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="p-7 pt-0 flex-shrink-0">
          <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-3 gap-2 flex items-center w-full">
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500 flex-shrink-0">
              <Icon icon="solar:paperclip-linear" className="text-base" />
            </button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500 flex-shrink-0">
              <Icon icon="solar:smile-circle-linear" className="text-base" />
            </button>
            <input type="text" placeholder="Message Sarah..." className="bg-transparent border-none outline-none text-sm font-light text-zinc-900 placeholder-zinc-400 flex-1" />
            <button className="w-9 h-9 rounded-full bg-zinc-950 hover:bg-zinc-800 transition-colors flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:plain-linear" className="text-white text-sm" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
