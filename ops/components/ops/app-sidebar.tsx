"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useInstagramOps, useRecognitionOps } from "@/hooks/use-ops-data";
import { NAV } from "./nav";
import { StatusDot } from "./status-dot";

/** The console kit's sidebar: wordmark with an Internal badge, pill nav, the workspace at the foot. */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-5 pt-7 pb-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-tile outline-none focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-cobalt-300">
          <span className="font-heading text-[22px] leading-none font-black tracking-[-0.032em]">Stashh</span>
          <Badge variant="secondary">Internal</Badge>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-4 px-5 pb-6">
        <ServiceHealth />
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback className="bg-grey-300 font-heading text-[10px] font-bold text-muted-foreground">OP</AvatarFallback>
          </Avatar>
          <div className="grid">
            <span className="font-heading text-caption font-bold">pipeline-ops</span>
            <span className="micro-label">Local only</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/** One row per service, from whether its last ops request succeeded. */
function ServiceHealth() {
  const recognitions = useRecognitionOps();
  const instagram = useInstagramOps();
  const rows = [
    { name: "Backend", query: recognitions },
    { name: "Instagram", query: instagram },
  ];

  return (
    <div className="grid gap-2">
      <span className="micro-label">Services</span>
      {rows.map(({ name, query }) => (
        <div key={name} className="flex items-center gap-2 text-caption">
          <StatusDot state={query.isError ? "down" : query.isSuccess ? "up" : "unknown"} />
          <span className="font-medium">{name}</span>
          <span className="ml-auto text-muted-foreground">{query.isError ? "Unreachable" : query.isSuccess ? "Running" : "Waiting"}</span>
        </div>
      ))}
    </div>
  );
}
