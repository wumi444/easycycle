"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  role: "admin" | "worker";
};

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoadingProfile(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("PROFILE ERROR:", error);
          setLoadingProfile(false);
          return;
        }

        setProfile(data);
      } catch (error) {
        console.error("PROFILE LOAD ERROR:", error);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [supabase]);

  // Login page gets no sidebar or top bar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-screen">

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:flex lg:flex-col">

        {/* Logo / Brand */}
        <div className="border-b border-gray-200 px-6 py-6">
          <h1 className="text-xl font-bold text-gray-900">
            EasyCycle
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Loan Management System
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">

          <a
            href="/"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <span className="mr-3 text-lg">⌂</span>
            Dashboard
          </a>

          <a
            href="/borrowers"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <span className="mr-3 text-lg">👥</span>
            Borrowers
          </a>

          <a
            href="/loans"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <span className="mr-3 text-lg">💰</span>
            Loans
          </a>

          <a
            href="/payments"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <span className="mr-3 text-lg">💳</span>
            Payments
          </a>

          <a
            href="/payment-schedule"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <span className="mr-3 text-lg">📅</span>
            Payment Schedule
          </a>

          {/* Admin-only navigation */}
          {isAdmin && (
            <>
              <div className="my-4 border-t border-gray-200" />

              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Management
              </p>

              <a
                href="/reports"
                className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                <span className="mr-3 text-lg">📊</span>
                Reports
              </a>

              <a
                href="/settings"
                className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                <span className="mr-3 text-lg">⚙</span>
                Settings
              </a>
            </>
          )}

        </nav>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 p-4">
          <LogoutButton />
        </div>

      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">

        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">

          <div className="flex h-16 items-center justify-between px-6">

            <div>
              <p className="text-sm font-medium text-gray-500">
                EasyCycle Loan Management System
              </p>
            </div>

            <div className="flex items-center gap-3">

              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {loadingProfile
                    ? "Loading..."
                    : profile?.full_name || "User"}
                </p>

                <p className="text-xs capitalize text-gray-500">
                  {loadingProfile
                    ? ""
                    : profile?.role || ""}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {profile?.full_name
                  ? profile.full_name.charAt(0).toUpperCase()
                  : "U"}
              </div>

            </div>

          </div>

        </header>

        {/* Page */}
        <main className="flex-1">
          {children}
        </main>

      </div>

    </div>
  );
}

