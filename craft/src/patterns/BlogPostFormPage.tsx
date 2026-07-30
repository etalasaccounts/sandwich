import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { InputField } from "@/components/ui/InputField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export function BlogPostFormPage() {
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
              <Icon icon="solar:document-text-linear" className="text-green-400 text-base" />
              <span className="text-sm font-normal text-zinc-50 tracking-tight">Posts</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:copy-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Pages</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:chat-round-line-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Comments</span>
            </div>
            <span className="rounded-full py-0.5 px-2.5 text-xs font-light bg-zinc-800 text-zinc-400">6</span>
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
        <div className="flex items-center justify-between gap-4 p-7 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500 flex-shrink-0">
              <Icon icon="solar:arrow-left-linear" className="text-base" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-light text-zinc-400">Posts</span>
              <span className="text-xl font-medium text-zinc-950 tracking-tight">New post</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary">
              <span className="text-xs font-normal text-zinc-700">Save as draft</span>
            </Button>
            <Button variant="primary" icon="solar:plain-linear">
              <span className="text-xs font-medium tracking-wide">Publish post</span>
            </Button>
          </div>
        </div>

        {/* Content: two columns */}
        <div className="flex gap-4 p-7 overflow-y-auto flex-1">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            {/* Title */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-2">
              <input
                type="text"
                defaultValue="How we cut support tickets by 40% without hiring"
                className="w-full bg-transparent border-none outline-none text-2xl font-medium text-zinc-950 tracking-tight placeholder-zinc-300"
              />
              <span className="text-xs font-light text-zinc-500">
                nordbyte.com/blog/<span className="text-zinc-900 font-normal">how-we-cut-support-tickets-40</span>
              </span>
            </div>

            {/* Content editor */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-1 pb-3 border-b border-zinc-100">
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                  <Icon icon="solar:text-bold-linear" className="text-base" />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                  <Icon icon="solar:text-italic-linear" className="text-base" />
                </button>
                <div className="w-px h-5 bg-zinc-100 mx-1"></div>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                  <Icon icon="solar:link-linear" className="text-base" />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                  <Icon icon="solar:gallery-linear" className="text-base" />
                </button>
                <div className="w-px h-5 bg-zinc-100 mx-1"></div>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                  <Icon icon="solar:list-linear" className="text-base" />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 transition-colors">
                  <Icon icon="solar:quote-up-linear" className="text-base" />
                </button>
              </div>
              <Textarea
                defaultValue={`Three months ago our support queue was averaging 340 tickets a week. Most of them weren't bugs — they were the same five questions, asked in five different ways.

We didn't hire. We rewrote the onboarding flow, added inline hints to the three screens that generated the most confusion, and shipped a real changelog people actually read. Tickets dropped to 204 a week within a month, and they've stayed there since.

Here's exactly what we changed, in order of impact.`}
                placeholder="Write your post…"
                className="flex-1 min-h-[280px]"
              />
              <div className="pt-3 border-t border-zinc-100">
                <span className="text-xs font-light text-zinc-400">842 words · 4 min read</span>
              </div>
            </div>

            {/* Featured image */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Featured image</span>
              <div className="border-2 border-dashed border-zinc-100 rounded-xl aspect-video flex flex-col items-center justify-center gap-2 text-center hover:border-zinc-300 transition-colors cursor-pointer">
                <Icon icon="solar:gallery-add-linear" className="text-zinc-400 text-2xl" />
                <span className="text-sm font-light text-zinc-500">Drag an image here or click to upload</span>
                <span className="text-xs font-light text-zinc-400">Recommended: 1200×630px</span>
              </div>
              <InputField label="Alt text" placeholder="Describe the image for screen readers" />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4 w-80 flex-shrink-0">
            {/* Status */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-3">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Status</span>
              <div className="flex items-center bg-zinc-100 rounded-full p-1 w-full">
                <button className="flex-1 rounded-full py-1.5 text-xs text-center text-zinc-500 font-light transition-colors">Draft</button>
                <button className="flex-1 rounded-full py-1.5 text-xs text-center bg-white text-zinc-950 font-normal shadow-sm transition-colors">Scheduled</button>
                <button className="flex-1 rounded-full py-1.5 text-xs text-center text-zinc-500 font-light transition-colors">Published</button>
              </div>
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Publish on</span>
                <div className="relative">
                  <Icon icon="solar:calendar-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
                  <input
                    type="text"
                    defaultValue="Dec 15, 2026, 9:00 AM"
                    className="bg-white border border-zinc-100 rounded-xl py-2.5 pl-9 pr-3.5 text-sm font-light text-zinc-900 outline-none w-full focus:border-green-400 transition-colors"
                  />
                </div>
              </label>
              <span className="text-xs font-light text-zinc-500">This post will go live automatically at the scheduled time.</span>
            </div>

            {/* Organization */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Organization</span>
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Category</span>
                <Select>
                  <option>Company news</option>
                  <option>Engineering</option>
                  <option>Product updates</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Tags</span>
                <div className="flex flex-wrap items-center gap-1.5 p-2 border border-zinc-100 bg-white rounded-xl">
                  {["performance", "support", "case-study"].map((tag) => (
                    <span key={tag} className="bg-zinc-100 rounded-full py-1 px-2.5 text-xs font-light text-zinc-700 flex items-center gap-1.5">
                      {tag}
                      <Icon icon="solar:close-circle-linear" className="text-zinc-400 text-xs cursor-pointer" />
                    </span>
                  ))}
                  <input type="text" placeholder="Add tag…" className="bg-transparent outline-none text-xs font-light text-zinc-700 placeholder-zinc-400 flex-1 min-w-[60px]" />
                </div>
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-light text-zinc-500">Author</span>
                <div className="flex items-center gap-3 bg-white border border-zinc-100 rounded-xl p-3">
                  <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-950 tracking-tight">AN</div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-normal text-zinc-950 truncate">Avery Nolan</span>
                    <span className="text-xs font-light text-zinc-500 truncate">Author</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEO */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Search engine listing</span>
              <InputField label="Meta title" defaultValue="How We Cut Support Tickets by 40% | Nordbyte" description="45 / 60 characters" />
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Meta description</span>
                <Textarea
                  defaultValue="The three onboarding changes that dropped our weekly ticket volume from 340 to 204 — no new hires required."
                  className="min-h-[70px]"
                />
                <span className="text-xs font-light text-zinc-400 text-right">110 / 160 characters</span>
              </label>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
