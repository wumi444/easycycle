
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Profile = {
  full_name: string;
  phone: string;
  role: string;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    phone: "",
    role: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const { data, error: profileError } =
          await supabase
            .from("profiles")
            .select("full_name, phone, role")
            .eq("id", user.id)
            .single();

        if (profileError) {
          throw profileError;
        }

        setProfile({
          full_name: data?.full_name ?? "",
          phone: data?.phone ?? "",
          role: data?.role ?? "",
        });
      } catch (err) {
        console.error("SETTINGS ERROR:", err);
        setError("Unable to load settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { error: updateError } =
        await supabase
          .from("profiles")
          .update({
            full_name: profile.full_name,
            phone: profile.phone,
          })
          .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error("SAVE SETTINGS ERROR:", err);
      setError("Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Settings
          </h1>

          <p className="mt-4 text-gray-700">
            Loading settings...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Settings
          </h1>

          <p className="mt-2 text-gray-700">
            Manage your administrator profile and system settings.
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 font-semibold text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Profile */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Administrator Profile
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Update the information associated with your administrator account.
            </p>
          </div>

          <div className="mt-6 space-y-6">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Full Name
              </label>

              <input
                type="text"
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    full_name: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                placeholder="Enter full name"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Phone Number
              </label>

              <input
                type="text"
                value={profile.phone}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    phone: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                placeholder="Enter phone number"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-bold text-gray-900">
                Role
              </label>

              <input
                type="text"
                value={profile.role}
                disabled
                className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 font-medium text-gray-600"
              />

              <p className="mt-2 text-sm text-gray-500">
                Your administrator role cannot be changed here.
              </p>
            </div>

            {/* Save */}
            <div className="pt-2">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="rounded-lg bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>

        </section>

        {/* System Information */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-gray-900">
              System Information
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Current system configuration.
            </p>
          </div>

          <div className="mt-6 divide-y divide-gray-200">

            <div className="flex items-center justify-between py-4">
              <span className="font-semibold text-gray-900">
                Currency
              </span>

              <span className="text-gray-700">
                ZMW — Zambian Kwacha
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="font-semibold text-gray-900">
                System
              </span>

              <span className="text-gray-700">
                Loan Management System
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="font-semibold text-gray-900">
                Access Level
              </span>

              <span className="font-semibold capitalize text-gray-900">
                {profile.role || "Administrator"}
              </span>
            </div>

          </div>

        </section>

      </div>
    </main>
  );
}

