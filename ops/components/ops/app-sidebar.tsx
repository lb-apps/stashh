"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useInstagramOps, useRecognitionOps } from "@/hooks/use-ops-data";
import { NAV } from "./nav";
import { StatusDot } from "./status-dot";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  S
                </span>
                <span className="grid leading-tight">
                  <span className="font-heading font-semibold">Stashh Ops</span>
                  <span className="text-xs text-muted-foreground">Local only</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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

      <SidebarFooter>
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Services</SidebarGroupLabel>
          <SidebarGroupContent>
            <ServiceHealth />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}

/** One dot per service, from whether its last ops request succeeded. */
function ServiceHealth() {
  const recognitions = useRecognitionOps();
  const instagram = useInstagramOps();
  const rows = [
    { name: "Backend", query: recognitions },
    { name: "Instagram", query: instagram },
  ];

  return (
    <SidebarMenu>
      {rows.map(({ name, query }) => (
        <SidebarMenuItem key={name}>
          <SidebarMenuButton size="sm" className="pointer-events-none" tooltip={name}>
            <StatusDot state={query.isError ? "down" : query.isSuccess ? "up" : "unknown"} />
            <span>{name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {query.isError ? "Unreachable" : query.isSuccess ? "Running" : "Waiting"}
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
