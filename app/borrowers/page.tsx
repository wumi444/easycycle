"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Borrower = {
  id: string;
  full_name: string;
  nrc_number: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  loan_count?: number;
};

export default function BorrowersPage() {
  const supabase = createClient();

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingBorrower, setEditingBorrower] =
    useState<Borrower | null>(null);

  const [fullName, setFullName] = useState("");
  const [nrcNumber, setNrcNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadBorrowers();
  }, []);

  async function loadBorrowers() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("borrowers")
      .select(`
        id,
        full_name,
        nrc_number,
        phone,
        address,
        notes,
        active,
        created_by,
        created_at,
        updated_at,
        loans (
          id
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "BORROWERS ERROR:",
        error
      );

      setError(error.message);
      setLoading(false);
      return;
    }

    const formattedBorrowers = (data ?? []).map(
      (borrower) => ({
        ...borrower,
        loan_count: Array.isArray(borrower.loans)
          ? borrower.loans.length
          : 0,
      })
    );

    setBorrowers(
      formattedBorrowers as unknown as Borrower[]
    );

    setLoading(false);
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setFullName("");
    setNrcNumber("");
    setPhone("");
    setAddress("");
    setNotes("");
    setEditingBorrower(null);
    setShowForm(false);
  }

  function openAddForm() {
    resetForm();
    clearMessages();
    setShowForm(true);
  }

  function startEdit(
    borrower: Borrower
  ) {
    setEditingBorrower(borrower);

    setFullName(
      borrower.full_name
    );

    setNrcNumber(
      borrower.nrc_number ?? ""
    );

    setPhone(
      borrower.phone ?? ""
    );

    setAddress(
      borrower.address ?? ""
    );

    setNotes(
      borrower.notes ?? ""
    );

    clearMessages();
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveBorrower(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    clearMessages();

    const trimmedName =
      fullName.trim();

    if (!trimmedName) {
      setError(
        "Full name is required."
      );
      return;
    }

    setSaving(true);

    if (editingBorrower) {
      const { error: updateError } =
        await supabase
          .from("borrowers")
          .update({
            full_name:
              trimmedName,
            nrc_number:
              nrcNumber.trim() ||
              null,
            phone:
              phone.trim() ||
              null,
            address:
              address.trim() ||
              null,
            notes:
              notes.trim() ||
              null,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            editingBorrower.id
          );

      if (updateError) {
        console.error(
          "UPDATE BORROWER ERROR:",
          updateError
        );

        setError(
          updateError.message
        );

        setSaving(false);
        return;
      }

      resetForm();

      setSuccess(
        "Borrower updated successfully."
      );

      await loadBorrowers();

      setSaving(false);
      return;
    }

    const {
      data: userData,
    } = await supabase.auth.getUser();

    if (!userData.user) {
      setError(
        "You must be logged in to add a borrower."
      );

      setSaving(false);
      return;
    }

    const {
      error: insertError,
    } = await supabase
      .from("borrowers")
      .insert({
        full_name:
          trimmedName,
        nrc_number:
          nrcNumber.trim() ||
          null,
        phone:
          phone.trim() ||
          null,
        address:
          address.trim() ||
          null,
        notes:
          notes.trim() ||
          null,
        active: true,
        created_by:
          userData.user.id,
      });

    if (insertError) {
      console.error(
        "ADD BORROWER ERROR:",
        insertError
      );

      setError(
        insertError.message
      );

      setSaving(false);
      return;
    }

    resetForm();

    setSuccess(
      "Borrower added successfully."
    );

    await loadBorrowers();

    setSaving(false);
  }

  async function toggleBorrowerStatus(
    borrower: Borrower
  ) {
    clearMessages();

    setChangingStatusId(
      borrower.id
    );

    const {
      error: updateError,
    } = await supabase
      .from("borrowers")
      .update({
        active:
          !borrower.active,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        borrower.id
      );

    if (updateError) {
      console.error(
        "TOGGLE BORROWER ERROR:",
        updateError
      );

      setError(
        updateError.message
      );

      setChangingStatusId(null);
      return;
    }

    setSuccess(
      borrower.active
        ? "Borrower deactivated successfully."
        : "Borrower activated successfully."
    );

    await loadBorrowers();

    setChangingStatusId(null);
  }

  async function deleteBorrower(
    borrower: Borrower
  ) {
    clearMessages();

    const confirmed =
      window.confirm(
        `Delete ${borrower.full_name}?\n\nThis action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      borrower.id
    );

    const {
      count: loanCount,
      error: loanCheckError,
    } = await supabase
      .from("loans")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "borrower_id",
        borrower.id
      );

    if (loanCheckError) {
      console.error(
        "CHECK BORROWER LOANS ERROR:",
        loanCheckError
      );

      setError(
        `Unable to check this borrower before deletion: ${loanCheckError.message}`
      );

      setDeletingId(null);
      return;
    }

    if (
      (loanCount ?? 0) > 0
    ) {
      setError(
        "This borrower has loan records and cannot be deleted. Deactivate the borrower instead."
      );

      setDeletingId(null);
      return;
    }

    const {
      error: deleteError,
    } = await supabase
      .from("borrowers")
      .delete()
      .eq(
        "id",
        borrower.id
      );

    if (deleteError) {
      console.error(
        "DELETE BORROWER ERROR:",
        deleteError
      );

      setError(
        `Unable to delete borrower: ${deleteError.message}`
      );

      setDeletingId(null);
      return;
    }

    setBorrowers(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            borrower.id
        )
    );

    setSuccess(
      `${borrower.full_name} was deleted successfully.`
    );

    setDeletingId(null);
  }

  const searchText =
    search
      .trim()
      .toLowerCase();

  const filteredBorrowers =
    borrowers.filter(
      (borrower) => {
        if (!searchText) {
          return true;
        }

        return (
          borrower.full_name
            .toLowerCase()
            .includes(
              searchText
            ) ||
          borrower.phone
            ?.toLowerCase()
            .includes(
              searchText
            ) ||
          borrower.nrc_number
            ?.toLowerCase()
            .includes(
              searchText
            ) ||
          borrower.address
            ?.toLowerCase()
            .includes(
              searchText
            )
        );
      }
    );

  const activeBorrowers =
    borrowers.filter(
      (borrower) =>
        borrower.active
    ).length;

  const inactiveBorrowers =
    borrowers.filter(
      (borrower) =>
        !borrower.active
    ).length;

  const totalLoans =
    borrowers.reduce(
      (total, borrower) =>
        total +
        Number(
          borrower.loan_count ??
            0
        ),
      0
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Borrowers
          </h1>

          <p className="mt-4 text-gray-600">
            Loading borrowers...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Borrowers
            </h1>

            <p className="mt-1 text-gray-600">
              Manage your loan borrowers.
            </p>
          </div>

          <button
            type="button"
            onClick={
              openAddForm
            }
            className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
          >
            + Add Borrower
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* Summary */}
        <section className="grid gap-6 md:grid-cols-4">

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Borrowers
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {borrowers.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Active Borrowers
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              {activeBorrowers}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Inactive Borrowers
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-600">
              {inactiveBorrowers}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Loans
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalLoans}
            </p>
          </div>

        </section>

        {/* Borrower Form */}
        {showForm && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingBorrower
                    ? "Edit Borrower"
                    : "Add Borrower"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {editingBorrower
                    ? "Update this borrower's information."
                    : "Enter the borrower's information below."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetForm
                }
                disabled={saving}
                className="text-2xl text-gray-500 hover:text-gray-900 disabled:opacity-50"
                aria-label="Close form"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                saveBorrower
              }
              className="mt-6 grid gap-4 md:grid-cols-2"
            >

              {/* Full Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name *
                </label>

                <input
                  type="text"
                  value={
                    fullName
                  }
                  onChange={(
                    event
                  ) =>
                    setFullName(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 outline-none focus:border-black"
                  placeholder="Enter full name"
                  required
                />
              </div>

              {/* NRC */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  NRC Number
                </label>

                <input
                  type="text"
                  value={
                    nrcNumber
                  }
                  onChange={(
                    event
                  ) =>
                    setNrcNumber(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 outline-none focus:border-black"
                  placeholder="Enter NRC number"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>

                <input
                  type="tel"
                  value={
                    phone
                  }
                  onChange={(
                    event
                  ) =>
                    setPhone(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 outline-none focus:border-black"
                  placeholder="Enter phone number"
                />
              </div>

              {/* Address */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Address
                </label>

                <input
                  type="text"
                  value={
                    address
                  }
                  onChange={(
                    event
                  ) =>
                    setAddress(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 outline-none focus:border-black"
                  placeholder="Enter address"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>

                <textarea
                  value={
                    notes
                  }
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target
                        .value
                    )
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 outline-none focus:border-black"
                  placeholder="Optional notes"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 md:col-span-2">

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-lg bg-black px-6 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingBorrower
                      ? "Update Borrower"
                      : "Save Borrower"}
                </button>

                <button
                  type="button"
                  onClick={
                    resetForm
                  }
                  disabled={
                    saving
                  }
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

              </div>

            </form>
          </section>
        )}

        {/* Search */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

          <input
            type="text"
            placeholder="Search by name, phone, NRC or address..."
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 outline-none focus:border-black"
          />

        </section>

        {/* Borrowers Table */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">

            <h2 className="text-xl font-semibold text-gray-900">
              All Borrowers
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {filteredBorrowers.length}{" "}
              {filteredBorrowers.length ===
              1
                ? "borrower"
                : "borrowers"}
              {searchText
                ? " matching your search"
                : ""}
            </p>

          </div>

          {filteredBorrowers.length ===
          0 ? (
            <div className="p-6 text-gray-500">
              {searchText
                ? "No borrowers match your search."
                : "No borrowers have been added yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr className="border-b border-gray-200 text-left">

                    <th className="p-4 text-gray-900">
                      Name
                    </th>

                    <th className="p-4 text-gray-900">
                      NRC
                    </th>

                    <th className="p-4 text-gray-900">
                      Phone
                    </th>

                    <th className="p-4 text-gray-900">
                      Loans
                    </th>

                    <th className="p-4 text-gray-900">
                      Address
                    </th>

                    <th className="p-4 text-gray-900">
                      Status
                    </th>

                    <th className="p-4 text-gray-900">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredBorrowers.map(
                    (borrower) => (
                      <tr
                        key={
                          borrower.id
                        }
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >

                        {/* Name */}
                        <td className="p-4">

                          <div className="font-medium text-gray-900">
                            {
                              borrower.full_name
                            }
                          </div>

                          {borrower.notes && (
                            <div className="mt-1 max-w-xs truncate text-xs text-gray-500">
                              {
                                borrower.notes
                              }
                            </div>
                          )}

                        </td>

                        {/* NRC */}
                        <td className="p-4 text-gray-600">
                          {
                            borrower.nrc_number ??
                            "—"
                          }
                        </td>

                        {/* Phone */}
                        <td className="p-4 text-gray-600">
                          {
                            borrower.phone ??
                            "—"
                          }
                        </td>

                        {/* Loans */}
                        <td className="p-4 font-medium text-gray-900">
                          {
                            borrower.loan_count ??
                            0
                          }
                        </td>

                        {/* Address */}
                        <td className="p-4 text-gray-600">
                          {
                            borrower.address ??
                            "—"
                          }
                        </td>

                        {/* Status */}
                        <td className="p-4">

                          <span
                            className={
                              borrower.active
                                ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                                : "rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
                            }
                          >
                            {borrower.active
                              ? "Active"
                              : "Inactive"}
                          </span>

                        </td>

                        {/* Actions */}
                        <td className="p-4">

                          <div className="flex flex-wrap gap-2">

                            <a
                              href={`/loans?borrower=${borrower.id}`}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:bg-gray-50"
                            >
                              View Loans
                            </a>

                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  borrower
                                )
                              }
                              disabled={
                                deletingId ===
                                  borrower.id ||
                                changingStatusId ===
                                  borrower.id
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleBorrowerStatus(
                                  borrower
                                )
                              }
                              disabled={
                                changingStatusId ===
                                  borrower.id ||
                                deletingId ===
                                  borrower.id
                              }
                              className={
                                borrower.active
                                  ? "rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  : "rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              }
                            >
                              {changingStatusId ===
                              borrower.id
                                ? "Updating..."
                                : borrower.active
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteBorrower(
                                  borrower
                                )
                              }
                              disabled={
                                deletingId ===
                                  borrower.id ||
                                changingStatusId ===
                                  borrower.id
                              }
                              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              borrower.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>
    </main>
  );
}

