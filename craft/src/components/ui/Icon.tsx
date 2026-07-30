import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";

export interface IconProps {
  icon: string;
  className?: string;
}

export function Icon({ icon, className }: IconProps) {
  return <IconifyIcon icon={icon} className={cn("", className)} />;
}
