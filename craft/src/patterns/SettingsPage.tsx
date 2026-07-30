import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InputField } from "@/components/ui/InputField";
import { Textarea } from "@/components/ui/Textarea";

export function SettingsPage() {
  const [emailDigest, setEmailDigest] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);

  return (
    <div className="bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[320px] flex-shrink-0 hidden lg:flex overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mt-1 px-1">
          <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
            <Icon icon="solar:letter-linear" className="text-zinc-950 text-base" />
          </div>
          <span className="text-lg font-medium text-zinc-50 tracking-tight">Mail</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col w-full gap-0.5 mt-2">
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:inbox-in-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Inbox</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 bg-zinc-900 cursor-pointer">
            <div className="flex items-center gap-3">
              <Icon icon="solar:settings-linear" className="text-green-400 text-base" />
              <span className="text-sm font-normal text-zinc-50 tracking-tight">Settings</span>
            </div>
          </div>
        </nav>

        <div className="flex-1" />

        {/* User Footer */}
        <div className="flex items-center gap-3 bg-zinc-900 rounded-2xl p-3 w-full">
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:user-circle-linear" className="text-zinc-400 text-lg" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-normal text-zinc-50 truncate">Avery Nolan</span>
            <span className="text-xs font-light text-zinc-500 truncate">avery@nordbyte.com</span>
          </div>
          <Button variant="icon" icon="solar:settings-linear" className="bg-zinc-800 hover:bg-zinc-700" />
        </div>
      </aside>

      {/* SETTINGS SUB-NAV */}
      <nav className="bg-zinc-50 rounded-2xl p-3 gap-1 flex-col w-56 flex-shrink-0 hidden md:flex overflow-y-auto">
        <div className="flex items-center gap-3 rounded-xl py-2 px-3 bg-white shadow-sm cursor-pointer">
          <Icon icon="solar:user-circle-linear" className="text-green-400 text-base" />
          <span className="text-sm font-normal text-zinc-950 tracking-tight">Profile</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl py-2 px-3 hover:bg-white/60 cursor-pointer transition-colors text-zinc-500">
          <Icon icon="solar:bell-linear" className="text-base" />
          <span className="text-sm font-light text-zinc-500">Notifications</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl py-2 px-3 hover:bg-white/60 cursor-pointer transition-colors text-zinc-500">
          <Icon icon="solar:wallet-linear" className="text-base" />
          <span className="text-sm font-light text-zinc-500">Billing</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl py-2 px-3 hover:bg-white/60 cursor-pointer transition-colors text-zinc-500">
          <Icon icon="solar:shield-keyhole-linear" className="text-base" />
          <span className="text-sm font-light text-zinc-500">Security</span>
        </div>
      </nav>

      {/* MAIN PANEL */}
      <main className="bg-white rounded-2xl flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-0.5 p-7 border-b border-zinc-100">
          <span className="text-xl font-medium text-zinc-950 tracking-tight">Profile</span>
          <span className="text-xs font-light text-zinc-500">How you appear to everyone else on the Nordbyte workspace.</span>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 p-7 overflow-y-auto w-full max-w-3xl mx-auto">
          {/* Profile card */}
          <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-sm font-medium text-zinc-950 tracking-tight">AN</div>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-sm font-medium text-zinc-950">Avery Nolan</span>
                <span className="text-xs font-light text-zinc-500">avery@nordbyte.com</span>
              </div>
              <Button variant="secondary" icon="solar:camera-linear">
                <span className="text-xs font-normal">Change photo</span>
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <InputField label="Full name" defaultValue="Avery Nolan" />
              <InputField label="Email" type="email" defaultValue="avery@nordbyte.com" />
            </div>

            <label className="flex flex-col gap-1.5 w-full">
              <span className="text-xs font-light text-zinc-500">Bio</span>
              <Textarea defaultValue="Ops lead at Nordbyte. I look after onboarding, billing and whatever else lands in the shared inbox." placeholder="A line or two about what you work on." />
            </label>
          </div>

          {/* Notifications card */}
          <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-5">
            <NotificationToggle
              title="Email digest"
              description="One summary of unread threads every weekday at 8am."
              checked={emailDigest}
              onChange={setEmailDigest}
            />
            <NotificationToggle
              title="Mentions"
              description="Notify me when a teammate mentions me in a note."
              checked={mentions}
              onChange={setMentions}
            />
            <NotificationToggle
              title="Product updates"
              description="Occasional notes about what shipped in Mail."
              checked={productUpdates}
              onChange={setProductUpdates}
            />
          </div>

          {/* Plan card */}
          <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex flex-col gap-2.5">
              <span className="bg-zinc-100 rounded-full py-0.5 px-3 text-xs font-light text-zinc-600 self-start">Pro</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extralight tracking-tight text-zinc-950">$24</span>
                <span className="text-xs font-light text-zinc-500">/mo</span>
              </div>
              <span className="text-xs font-light text-zinc-500">6 of 10 seats used. Renews on August 14, 2026.</span>
            </div>
            <Button variant="primary" icon="solar:wallet-linear">
              <span className="text-xs font-medium tracking-wide">Upgrade</span>
            </Button>
          </div>

          {/* Danger zone */}
          <div className="flex items-start gap-3 bg-zinc-50/80 border border-zinc-100 rounded-xl p-4">
            <Icon icon="solar:danger-triangle-linear" className="text-orange-500 text-base mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-950">Delete account</span>
              <span className="text-xs font-light text-zinc-500">This removes your profile and every thread you own. It cannot be undone.</span>
            </div>
            <Button variant="compact" className="bg-white border border-zinc-100 text-orange-500 hover:bg-zinc-50 ml-auto flex-shrink-0">
              Delete
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function NotificationToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-normal text-zinc-950">{title}</span>
        <span className="text-xs font-light text-zinc-500">{description}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-colors ${checked ? "bg-green-400" : "bg-zinc-200"}`}
        aria-pressed={checked}
      >
        <span className={`w-5 h-5 rounded-full bg-white shadow-sm ${checked ? "ml-auto" : ""}`} />
      </button>
    </div>
  );
}
