"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";

const HIDDEN_PATHS = ["/"];

export function AppNavbar() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.includes(pathname)) return null;
  return <Navbar />;
}
