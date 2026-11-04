import { Activity, LayoutDashboard, Link2, MessageCircle, MessagesSquare, ScanSearch, type LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: "/" | "/recognitions" | "/recognize" | "/instagram" | "/assistant" | "/api-health";
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Recognitions", href: "/recognitions", icon: ScanSearch },
  { title: "Recognize a link", href: "/recognize", icon: Link2 },
  { title: "Instagram", href: "/instagram", icon: MessageCircle },
  { title: "Assistant", href: "/assistant", icon: MessagesSquare },
  { title: "API health", href: "/api-health", icon: Activity },
];
