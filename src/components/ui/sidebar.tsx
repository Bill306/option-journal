"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  List,
  BarChart3,
  CalendarCheck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trade/new", label: "New Trade", icon: PlusCircle },
  { href: "/trades", label: "Trades", icon: List },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/review/weekly", label: "Weekly Review", icon: CalendarCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative w-full md:fixed md:left-0 md:top-0 md:h-full md:w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">Option Journal</h1>
        <p className="text-xs text-gray-400 mt-1">Trading Analytics</p>
      </div>
      <nav className="grid grid-cols-2 sm:grid-cols-3 md:block md:flex-1 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 md:px-6 py-3 text-sm transition-colors",
                isActive
                  ? "bg-gray-800 text-white border-r-2 border-blue-500"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block p-4 border-t border-gray-700 text-xs text-gray-500">
        v1.0 MVP
      </div>
    </aside>
  );
}
