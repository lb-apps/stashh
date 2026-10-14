import { Activity, LayoutDashboard, MessageCircle, ScanSearch, type LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: "/" | "/recognitions" | "/instagram" | "/api-health";
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Recognitions", href: "/recognitions", icon: ScanSearch },
  { title: "Instagram", href: "/instagram", icon: MessageCircle },
  { title: "API health", href: "/api-health", icon: Activity },
];
