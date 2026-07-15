import Link from "next/link";

export interface NavbarProps {
  title?: string;
  links?: { href: string; label: string }[];
}

export function Navbar({ title = "Wireframes", links = [] }: NavbarProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-base font-semibold text-gray-900">
          {title}
        </Link>
        <nav className="flex gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-gray-600 hover:text-gray-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
