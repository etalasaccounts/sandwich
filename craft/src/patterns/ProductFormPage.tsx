import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { InputField } from "@/components/ui/InputField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export function ProductFormPage() {
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
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:users-group-rounded-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Customers</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 bg-zinc-900 cursor-pointer">
            <div className="flex items-center gap-3">
              <Icon icon="solar:box-linear" className="text-green-400 text-base" />
              <span className="text-sm font-normal text-zinc-50 tracking-tight">Products</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl py-2 px-3 hover:bg-zinc-900/50 cursor-pointer transition-colors text-zinc-500">
            <div className="flex items-center gap-3">
              <Icon icon="solar:cart-large-linear" className="text-base" />
              <span className="text-sm font-light text-zinc-400">Orders</span>
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
        <div className="flex items-center justify-between gap-4 p-7 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500 flex-shrink-0">
              <Icon icon="solar:arrow-left-linear" className="text-base" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-light text-zinc-400">Products</span>
              <span className="text-xl font-medium text-zinc-950 tracking-tight">Add product</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary">
              <span className="text-xs font-normal text-zinc-700">Save as draft</span>
            </Button>
            <Button variant="primary" icon="solar:cloud-upload-linear">
              <span className="text-xs font-medium tracking-wide">Publish product</span>
            </Button>
          </div>
        </div>

        {/* Content: two columns */}
        <div className="flex gap-4 p-7 overflow-y-auto flex-1">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            {/* Basic information */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Basic information</span>
              <InputField label="Product title" placeholder="e.g. Ridge wallet — walnut" />
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Description</span>
                <Textarea defaultValue="Hand-finished walnut card wallet with a single steel money clip. Holds 1–8 cards flat, no bulk." />
              </label>
            </div>

            {/* Media */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Media</span>
              <div className="border-2 border-dashed border-zinc-100 rounded-xl p-8 flex flex-col items-center gap-2 text-center hover:border-zinc-300 transition-colors cursor-pointer">
                <Icon icon="solar:gallery-add-linear" className="text-zinc-400 text-2xl" />
                <span className="text-sm font-light text-zinc-500">Drag images here or click to upload</span>
                <span className="text-xs font-light text-zinc-400">PNG or JPG, up to 10MB each</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-zinc-100 aspect-square bg-zinc-100 flex items-center justify-center">
                    <Icon icon="solar:gallery-linear" className="text-zinc-300 text-2xl" />
                    {i === 1 && (
                      <span className="absolute top-1.5 left-1.5 bg-zinc-950/80 text-white text-[10px] font-medium rounded-full py-0.5 px-2">Cover</span>
                    )}
                    <button className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-zinc-950/60 flex items-center justify-center hover:bg-zinc-950/80 transition-colors">
                      <Icon icon="solar:close-circle-linear" className="text-white text-xs" />
                    </button>
                  </div>
                ))}
                <div className="rounded-xl border-2 border-dashed border-zinc-100 aspect-square flex items-center justify-center hover:border-zinc-300 transition-colors cursor-pointer">
                  <Icon icon="solar:add-circle-linear" className="text-zinc-300 text-xl" />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Pricing</span>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 w-full">
                  <span className="text-xs font-light text-zinc-500">Price</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-light text-zinc-400">$</span>
                    <Input defaultValue="89.00" className="pl-7" />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 w-full">
                  <span className="text-xs font-light text-zinc-500">Compare-at price</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-light text-zinc-400">$</span>
                    <Input defaultValue="120.00" className="pl-7" />
                  </div>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 w-full">
                  <span className="text-xs font-light text-zinc-500">Cost per item</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-light text-zinc-400">$</span>
                    <Input defaultValue="35.00" className="pl-7" />
                  </div>
                </label>
                <div className="flex flex-col gap-1.5 w-full justify-end">
                  <span className="text-xs font-light text-zinc-500">Profit</span>
                  <span className="text-sm font-light text-zinc-700 py-2.5">$54.00 <span className="text-zinc-400">(61% margin)</span></span>
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-950 tracking-tight">Inventory</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-light text-zinc-500">Track quantity</span>
                  <button className="w-10 h-6 rounded-full bg-green-400 p-0.5 flex items-center transition-colors" aria-pressed="true">
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm ml-auto"></span>
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <InputField label="SKU (Stock Keeping Unit)" defaultValue="RW-WAL-001" />
                <InputField label="Barcode (ISBN, UPC, GTIN)" placeholder="Optional" />
              </div>
              <div className="w-full sm:w-1/2">
                <InputField label="Quantity available" type="number" defaultValue="48" />
              </div>
            </div>

            {/* Variants */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-950 tracking-tight">Variants</span>
                <button className="flex items-center gap-1.5 bg-white border border-zinc-100 rounded-full py-1.5 px-3.5 hover:bg-zinc-100 transition-colors">
                  <Icon icon="solar:add-circle-linear" className="text-zinc-500 text-sm" />
                  <span className="text-xs font-normal text-zinc-700">Add variant</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-light text-zinc-500">Size</span>
                <div className="flex items-center gap-1.5">
                  <button className="rounded-full py-1 px-3.5 text-xs bg-zinc-950 text-white font-normal transition-colors">Small</button>
                  <button className="rounded-full py-1 px-3.5 text-xs bg-zinc-100 text-zinc-600 font-light hover:bg-zinc-200 transition-colors">Medium</button>
                  <button className="rounded-full py-1 px-3.5 text-xs bg-zinc-100 text-zinc-600 font-light hover:bg-zinc-200 transition-colors">Large</button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-light text-zinc-500">Color</span>
                <div className="flex items-center gap-1.5">
                  <button className="rounded-full py-1 px-3.5 text-xs bg-zinc-950 text-white font-normal transition-colors">Walnut</button>
                  <button className="rounded-full py-1 px-3.5 text-xs bg-zinc-100 text-zinc-600 font-light hover:bg-zinc-200 transition-colors">Black</button>
                  <button className="rounded-full py-1 px-3.5 text-xs bg-zinc-100 text-zinc-600 font-light hover:bg-zinc-200 transition-colors">White</button>
                </div>
              </div>

              <table className="w-full text-left mt-1">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-2.5 px-2 text-xs uppercase tracking-widest text-zinc-400 font-normal">Variant</th>
                    <th className="py-2.5 px-2 text-xs uppercase tracking-widest text-zinc-400 font-normal">Price</th>
                    <th className="py-2.5 px-2 text-xs uppercase tracking-widest text-zinc-400 font-normal text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-100">
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700">Small / Walnut</td>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700">$89.00</td>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700 text-right">24</td>
                  </tr>
                  <tr className="border-b border-zinc-100">
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700">Medium / Walnut</td>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700">$89.00</td>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700 text-right">18</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700">Large / Black</td>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700">$94.00</td>
                    <td className="py-2.5 px-2 text-sm font-light text-zinc-700 text-right">6</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4 w-80 flex-shrink-0">
            {/* Status */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-3">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Status</span>
              <div className="flex items-center bg-zinc-100 rounded-full p-1 w-full">
                <button className="flex-1 rounded-full py-1.5 text-xs text-center text-zinc-500 font-light transition-colors">Draft</button>
                <button className="flex-1 rounded-full py-1.5 text-xs text-center bg-white text-zinc-950 font-normal shadow-sm transition-colors">Active</button>
              </div>
              <span className="text-xs font-light text-zinc-500">This product will be visible in your store immediately after publishing.</span>
            </div>

            {/* Organization */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Organization</span>
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Product category</span>
                <Select>
                  <option>Accessories</option>
                  <option>Bags &amp; wallets</option>
                  <option>Apparel</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Tags</span>
                <div className="flex flex-wrap items-center gap-1.5 p-2 border border-zinc-100 bg-white rounded-xl">
                  {["leather", "wallet", "gift-ready"].map((tag) => (
                    <span key={tag} className="bg-zinc-100 rounded-full py-1 px-2.5 text-xs font-light text-zinc-700 flex items-center gap-1.5">
                      {tag}
                      <Icon icon="solar:close-circle-linear" className="text-zinc-400 text-xs cursor-pointer" />
                    </span>
                  ))}
                  <input type="text" placeholder="Add tag…" className="bg-transparent outline-none text-xs font-light text-zinc-700 placeholder-zinc-400 flex-1 min-w-[60px]" />
                </div>
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-light text-zinc-500">Collections</span>
                <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                  <div className="w-4 h-4 rounded border border-zinc-950 bg-zinc-950 flex items-center justify-center flex-shrink-0">
                    <Icon icon="solar:check-linear" className="text-white text-[10px]" />
                  </div>
                  <span className="text-xs font-light text-zinc-600">Summer Sale</span>
                </label>
                <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                  <div className="w-4 h-4 rounded border border-zinc-950 bg-zinc-950 flex items-center justify-center flex-shrink-0">
                    <Icon icon="solar:check-linear" className="text-white text-[10px]" />
                  </div>
                  <span className="text-xs font-light text-zinc-600">New Arrivals</span>
                </label>
                <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                  <div className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"></div>
                  <span className="text-xs font-light text-zinc-600">Best Sellers</span>
                </label>
              </div>
            </div>

            {/* SEO */}
            <div className="bg-zinc-50/80 border border-zinc-100 rounded-2xl p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-zinc-950 tracking-tight">Search engine listing</span>
              <InputField label="Meta title" defaultValue="Ridge Wallet — Walnut | Nordbyte" description="32 / 60 characters" />
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-xs font-light text-zinc-500">Meta description</span>
                <Textarea defaultValue="Hand-finished walnut wallet with a steel money clip. Holds 1–8 cards flat." className="min-h-[70px]" />
                <span className="text-xs font-light text-zinc-400 text-right">76 / 160 characters</span>
              </label>
              <span className="text-xs font-light text-zinc-500">
                nordbyte.com/products/<span className="text-zinc-900 font-normal">ridge-wallet-walnut</span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
