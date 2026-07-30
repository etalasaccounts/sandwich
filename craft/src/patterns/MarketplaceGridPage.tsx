import { Icon } from "@/components/ui/Icon";

const products = [
  { id: 1, brand: "Nordbyte Studio", name: "Ridge Wallet — Walnut", price: "$89.00", rating: 4, reviews: 128, icon: "solar:wallet-linear", liked: false },
  { id: 2, brand: "Halcyon Labs", name: "Weekender Bag — Black", price: "$220.00", rating: 5, reviews: 64, icon: "solar:bag-4-linear", liked: false },
  { id: 3, brand: "Meridian Studio", name: "Field Watch — Steel", price: "$340.00", rating: 3, reviews: 31, icon: "solar:watch-square-linear", liked: true },
  { id: 4, brand: "Ostara Group", name: "Ridge Wallet — Black", price: "$89.00", rating: 4, reviews: 92, icon: "solar:wallet-linear", liked: false },
  { id: 5, brand: "Fernpath", name: "Sun Frames — Tortoise", price: "$150.00", rating: 5, reviews: 210, icon: "solar:sunglasses-linear", liked: false },
  { id: 6, brand: "Vellum Health", name: "Full-Grain Belt — Tan", price: "$68.00", rating: 3, reviews: 18, icon: "solar:belt-linear", liked: false },
];

function renderStars(rating: number) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          icon="solar:star-linear"
          className={`text-xs ${star <= rating ? "text-zinc-900" : "text-zinc-300"}`}
        />
      ))}
    </div>
  );
}

export function MarketplaceGridPage() {
  return (
    <div className="bg-white min-h-full flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col flex-1 w-full">
        {/* NAV */}
        <nav className="flex items-center justify-between gap-4 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
            <Icon icon="solar:layers-minimalistic-linear" className="text-zinc-950 text-base" />
          </div>
          <span className="text-lg font-medium tracking-tight text-zinc-950 hidden sm:inline">Nordbyte</span>
        </div>

        <div className="flex items-center gap-2 bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-3.5 flex-1 max-w-md">
          <Icon icon="solar:magnifer-linear" className="text-zinc-400 text-sm" />
          <input
            type="text"
            placeholder="Search products..."
            className="bg-transparent border-none outline-none text-xs text-zinc-700 w-full placeholder-zinc-400 font-light"
          />
        </div>

        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Categories</a>
          <a href="#" className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Deals</a>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
            <Icon icon="solar:heart-linear" className="text-base" />
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-green-400 text-zinc-950 text-[9px] font-medium flex items-center justify-center">3</span>
          </button>
          <button className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500">
            <Icon icon="solar:cart-large-linear" className="text-base" />
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-green-400 text-zinc-950 text-[9px] font-medium flex items-center justify-center">2</span>
          </button>
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300 tracking-tight">AN</div>
        </div>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 py-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-light text-zinc-500">Home / Wallets &amp; Accessories</span>
          <span className="text-xl font-medium text-zinc-950 tracking-tight">Wallets &amp; Accessories</span>
        </div>
        <span className="text-xs font-light text-zinc-500 flex-shrink-0">142 products</span>
      </div>

      {/* BODY: filter rail + grid */}
      <div className="flex gap-8 pb-16">
        {/* FILTER RAIL */}
        <nav className="flex flex-col gap-6 w-56 flex-shrink-0 hidden md:flex border-r border-zinc-100 pr-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-950 tracking-tight">Filters</span>
            <button className="text-xs font-light text-zinc-500 hover:text-zinc-950 transition-colors">Clear all</button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Category</span>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <div className="w-4 h-4 rounded border border-zinc-950 bg-zinc-950 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:check-linear" className="text-white text-[10px]" />
              </div>
              <span className="text-xs font-light text-zinc-600">Wallets</span>
            </label>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <div className="w-4 h-4 rounded border border-zinc-950 bg-zinc-950 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:check-linear" className="text-white text-[10px]" />
              </div>
              <span className="text-xs font-light text-zinc-600">Bags</span>
            </label>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <div className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"></div>
              <span className="text-xs font-light text-zinc-600">Belts</span>
            </label>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <div className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"></div>
              <span className="text-xs font-light text-zinc-600">Accessories</span>
            </label>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-zinc-100">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Price</span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-light text-zinc-400">$</span>
                <input type="text" defaultValue="0" className="bg-zinc-50/80 border border-zinc-100 rounded-xl py-2 pl-6 pr-2 text-xs font-light text-zinc-900 outline-none w-full focus:border-green-400 transition-colors" />
              </div>
              <span className="text-xs font-light text-zinc-400">to</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-light text-zinc-400">$</span>
                <input type="text" defaultValue="150" className="bg-zinc-50/80 border border-zinc-100 rounded-xl py-2 pl-6 pr-2 text-xs font-light text-zinc-900 outline-none w-full focus:border-green-400 transition-colors" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-zinc-100">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">Rating</span>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <div className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"></div>
              <span className="text-xs font-light text-zinc-600">4 stars &amp; up</span>
            </label>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <div className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0"></div>
              <span className="text-xs font-light text-zinc-600">3 stars &amp; up</span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-normal">In stock only</span>
            <button className="w-10 h-6 rounded-full bg-green-400 p-0.5 flex items-center transition-colors" aria-pressed="true">
              <span className="w-5 h-5 rounded-full bg-white shadow-sm ml-auto"></span>
            </button>
          </div>
        </nav>

        {/* MAIN */}
        <div className="flex flex-col flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-end gap-2 pb-4 border-b border-zinc-100">
            <div className="relative">
              <select className="bg-white border border-zinc-100 rounded-xl py-2 pl-3.5 pr-9 text-xs font-light text-zinc-700 outline-none focus:border-green-400 transition-colors appearance-none">
                <option>Sort: Popular</option>
                <option>Sort: Price, low to high</option>
                <option>Sort: Price, high to low</option>
                <option>Sort: Newest</option>
              </select>
              <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none" />
            </div>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
                <Icon icon="solar:widget-2-linear" className="text-sm" />
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-400">
                <Icon icon="solar:list-linear" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 py-6">
            {products.map((product) => (
              <div key={product.id} className="flex flex-col gap-2.5">
                <div className="relative aspect-square rounded-xl bg-zinc-100 flex items-center justify-center">
                  <Icon icon={product.icon} className="text-zinc-300 text-3xl" />
                  <button className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                    <Icon icon="solar:heart-linear" className={`text-base ${product.liked ? "text-orange-500" : "text-zinc-500"}`} />
                  </button>
                </div>
                <span className="text-xs font-light text-zinc-400">{product.brand}</span>
                <span className="text-sm font-medium text-zinc-950 tracking-tight">{product.name}</span>
                <div className="flex items-center gap-1">
                  {renderStars(product.rating)}
                  <span className="text-xs font-light text-zinc-500">({product.reviews})</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-medium text-zinc-950">{product.price}</span>
                  <button className="w-8 h-8 rounded-full bg-zinc-950 hover:bg-zinc-800 flex items-center justify-center transition-colors">
                    <Icon icon="solar:cart-plus-linear" className="text-white text-sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <span className="text-xs font-light text-zinc-500">Showing 1–6 of 142</span>
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors text-zinc-600">
                <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
              </button>
              <button className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors text-zinc-600">
                <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
