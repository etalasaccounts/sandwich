import { useState, useRef, useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface DropdownItem {
  label: string;
  icon?: IconName;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
}

interface DropdownMenuProps {
  items: DropdownItem[];
  children: ReactNode;
}

export function DropdownMenu({ items, children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{children}</div>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-zinc-100 shadow-lg py-1 w-40 z-10">
          {items.map((item, index) => {
            const content = (
              <div
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm font-light transition-colors ${
                  item.destructive
                    ? "text-red-600 hover:bg-red-50"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {item.icon && (
                  <Icon
                    icon={item.icon}
                    className={item.destructive ? "text-red-500" : "text-zinc-400"}
                  />
                )}
                {item.label}
              </div>
            );

            if (item.href) {
              return (
                <a key={index} href={item.href} onClick={() => setOpen(false)}>
                  {content}
                </a>
              );
            }

            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className="w-full text-left"
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
