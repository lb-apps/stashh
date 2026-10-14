import { LayoutDashboard, MessageCircle, ScanSearch, type LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: "/" | "/recognitions" | "/instagram";
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Recognitions", href: "/recognitions", icon: ScanSearch },
  { title: "Instagram", href: "/instagram", icon: MessageCircle },
];

export function titleFor(pathname: string): string {
  return NAV.find((item) => item.href === pathname)?.title ?? "Stashh Ops";
}
