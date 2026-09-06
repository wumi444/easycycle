

"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("LOGOUT ERROR:", error);
      return;
    }

    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
    >
      <span className="mr-3 text-lg">↪</span>
      Logout
    </button>
  );
}

