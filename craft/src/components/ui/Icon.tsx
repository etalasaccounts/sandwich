import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";

export type IconName = string;

export interface IconProps {
  icon: IconName;
  className?: string;
}

export function Icon({ icon, className }: IconProps) {
  return <IconifyIcon icon={icon} className={cn("", className)} />;
}
