

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Borrower = {
  id: string;
  full_name: string;
  nrc_number: string;
  phone: string;
};

type Loan = {
  id: string;
  borrower_id: string;
  principal: number;
  interest_rate: number;
  overdue_interest_rate: number;
  payment_frequency: "weekly" | "monthly";
  payment_amount: number;
  number_of_installments: number;
  first_payment_date: string;
  grace_period_days: number;
  status: string;
  notes: string | null;
  created_at: string;
  borrowers?: {
    full_name: string;
    nrc_number: string;
  } | null;
};

export default function LoansPage() {
  const supabase = createClient();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [borrowerFilter, setBorrowerFilter] = useState("all");

  const [borrowerId, setBorrowerId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [overdueInterestRate, setOverdueInterestRate] = useState("");
  const [paymentFrequency, setPaymentFrequency] =
    useState<"weekly" | "monthly">("monthly");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [numberOfInstallments, setNumberOfInstallments] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState("1");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const [borrowersResult, loansResult] = await Promise.all([
      supabase
        .from("borrowers")
        .select("id, full_name, nrc_number, phone")
        .eq("active", true)
        .order("full_name"),

      supabase
        .from("loans")
        .select(`
          *,
          borrowers (
            full_name,
            nrc_number
          )
        `)
        .order("created_at", { ascending: false }),
    ]);

    if (borrowersResult.error) {
      setError(
        `Could not load borrowers: ${borrowersResult.error.message}`
      );
      setLoading(false);
      return;
    }

    if (loansResult.error) {
      setError(
        `Could not load loans: ${loansResult.error.message}`
      );
      setLoading(false);
      return;
    }

    setBorrowers(borrowersResult.data ?? []);
    setLoans((loansResult.data as Loan[]) ?? []);

    setLoading(false);
  }

  function resetForm() {
    setBorrowerId("");
    setPrincipal("");
    setInterestRate("");
    setOverdueInterestRate("");
    setPaymentFrequency("monthly");
    setPaymentAmount("");
    setNumberOfInstallments("");
    setFirstPaymentDate("");
    setGracePeriodDays("1");
    setNotes("");
  }

  async function addLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to create a loan.");
      setSaving(false);
      return;
    }

    if (!borrowerId) {
      setError("Please select a borrower.");
      setSaving(false);
      return;
    }

    const principalValue = Number(principal);
    const interestRateValue = Number(interestRate || 0);

    const overdueInterestRateValue = Number(
      overdueInterestRate || interestRate || 0
    );

    const paymentAmountValue = Number(paymentAmount);
    const installmentsValue = Number(numberOfInstallments);
    const gracePeriodValue = Number(gracePeriodDays || 1);

    if (!principal || !Number.isFinite(principalValue) || principalValue <= 0) {
      setError("Please enter a valid principal amount.");
      setSaving(false);
      return;
    }

    if (
      interestRateValue < 0 ||
      !Number.isFinite(interestRateValue)
    ) {
      setError("Please enter a valid interest rate.");
      setSaving(false);
      return;
    }

    if (
      overdueInterestRateValue < 0 ||
      !Number.isFinite(overdueInterestRateValue)
    ) {
      setError("Please enter a valid overdue interest rate.");
      setSaving(false);
      return;
    }

    if (
      !paymentAmount ||
      !Number.isFinite(paymentAmountValue) ||
      paymentAmountValue <= 0
    ) {
      setError("Please enter a valid payment amount.");
      setSaving(false);
      return;
    }

    if (
      !numberOfInstallments ||
      !Number.isInteger(installmentsValue) ||
      installmentsValue <= 0
    ) {
      setError("Please enter a valid number of installments.");
      setSaving(false);
      return;
    }

    if (!firstPaymentDate) {
      setError("Please select the first payment date.");
      setSaving(false);
      return;
    }

    if (
      !Number.isInteger(gracePeriodValue) ||
      gracePeriodValue < 0
    ) {
      setError("Grace period cannot be negative.");
      setSaving(false);
      return;
    }

    /*
     * The database trigger automatically creates
     * the payment schedule after this loan is inserted.
     *
     * DO NOT manually insert into payment_schedule here.
     */
    const loanData = {
      borrower_id: borrowerId,
      principal: principalValue,
      interest_rate: interestRateValue,
      overdue_interest_rate: overdueInterestRateValue,
      payment_frequency: paymentFrequency,
      payment_amount: paymentAmountValue,
      number_of_installments: installmentsValue,
      first_payment_date: firstPaymentDate,
      grace_period_days: gracePeriodValue,
      status: "active",
      notes: notes.trim() || null,
      created_by: user.id,
    };

    const {
      data: loan,
      error: loanError,
    } = await supabase
      .from("loans")
      .insert(loanData)
      .select()
      .single();

    if (loanError || !loan) {
      setError(
        loanError?.message ?? "Failed to create loan."
      );
      setSaving(false);
      return;
    }

    /*
     * Verify that the database trigger generated
     * exactly the requested number of schedules.
     */
    const {
      count: scheduleCount,
      error: scheduleCheckError,
    } = await supabase
      .from("payment_schedule")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("loan_id", loan.id);

    if (scheduleCheckError) {
      setError(
        `Loan was created, but the payment schedule could not be verified: ${scheduleCheckError.message}`
      );

      setSaving(false);
      await loadData();
      return;
    }

    if ((scheduleCount ?? 0) !== installmentsValue) {
      setError(
        `Loan was created, but the payment schedule is incomplete. Expected ${installmentsValue} installments but found ${scheduleCount ?? 0}.`
      );

      setSaving(false);
      await loadData();
      return;
    }

    resetForm();

    setSuccess(
      "Loan created successfully. Payment schedule generated automatically."
    );

    await loadData();

    setSaving(false);
  }

  async function cancelLoan(id: string) {
    setError("");
    setSuccess("");

    const loan = loans.find((item) => item.id === id);

    if (!loan) {
      setError("Loan could not be found.");
      return;
    }

    if (loan.status !== "active") {
      setError(
        `This loan cannot be cancelled because its current status is "${loan.status}".`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to cancel the loan for ${
        loan.borrowers?.full_name ?? "this borrower"
      }?\n\nExisting payments, schedules, and financial records will be preserved.`
    );

    if (!confirmed) {
      return;
    }

    setCancelling(id);

    const { error: cancelError } = await supabase
      .from("loans")
      .update({
        status: "cancelled",
      })
      .eq("id", id)
      .eq("status", "active");

    if (cancelError) {
      setError(
        `Could not cancel this loan: ${cancelError.message}`
      );
      setCancelling(null);
      return;
    }

    setSuccess("Loan cancelled successfully.");

    setCancelling(null);

    await loadData();
  }

  async function deleteLoan(loan: Loan) {
    setError("");
    setSuccess("");

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the loan for ${
        loan.borrowers?.full_name ?? "this borrower"
      }?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(loan.id);

    /*
     * Never delete loans that have payments.
     */
    const {
      count: paymentCount,
      error: paymentCheckError,
    } = await supabase
      .from("payments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("loan_id", loan.id);

    if (paymentCheckError) {
      setError(
        `Could not check payments for this loan: ${paymentCheckError.message}`
      );

      setDeleting(null);
      return;
    }

    if ((paymentCount ?? 0) > 0) {
      setError(
        "This loan cannot be deleted because it has payment records. Financial records should be preserved."
      );

      setDeleting(null);
      return;
    }

    /*
     * Never delete loans that have interest accrual records.
     */
    const {
      count: accrualCount,
      error: accrualCheckError,
    } = await supabase
      .from("interest_accruals")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("loan_id", loan.id);

    if (accrualCheckError) {
      setError(
        `Could not check interest records: ${accrualCheckError.message}`
      );

      setDeleting(null);
      return;
    }

    if ((accrualCount ?? 0) > 0) {
      setError(
        "This loan cannot be deleted because it has interest accrual records. Financial records should be preserved."
      );

      setDeleting(null);
      return;
    }

    /*
     * Never delete loans that have schedules.
     */
    const {
      count: scheduleCount,
      error: scheduleCheckError,
    } = await supabase
      .from("payment_schedule")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("loan_id", loan.id);

    if (scheduleCheckError) {
      setError(
        `Could not check the payment schedule: ${scheduleCheckError.message}`
      );

      setDeleting(null);
      return;
    }

    if ((scheduleCount ?? 0) > 0) {
      setError(
        "This loan cannot be deleted because it has a payment schedule. Financial records should be preserved."
      );

      setDeleting(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("loans")
      .delete()
      .eq("id", loan.id);

    if (deleteError) {
      console.error("DELETE LOAN ERROR:", deleteError);

      setError(
        `Could not delete this loan: ${deleteError.message}`
      );

      setDeleting(null);
      return;
    }

    setSuccess("Loan deleted successfully.");

    setDeleting(null);

    await loadData();
  }

  function getStatusClasses(status: string) {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";

      case "completed":
        return "bg-blue-100 text-blue-800";

      case "cancelled":
        return "bg-red-100 text-red-800";

      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  const filteredLoans = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return loans.filter((loan) => {
      const borrowerName =
        loan.borrowers?.full_name?.toLowerCase() ?? "";

      const borrowerNrc =
        loan.borrowers?.nrc_number?.toLowerCase() ?? "";

      const matchesSearch =
        !searchValue ||
        borrowerName.includes(searchValue) ||
        borrowerNrc.includes(searchValue);

      const matchesStatus =
        statusFilter === "all" ||
        loan.status === statusFilter;

      const matchesBorrower =
        borrowerFilter === "all" ||
        loan.borrower_id === borrowerFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBorrower
      );
    });
  }, [
    loans,
    search,
    statusFilter,
    borrowerFilter,
  ]);

  const totalLoans = loans.length;

  const activeLoans = loans.filter(
    (loan) => loan.status === "active"
  ).length;

  const completedLoans = loans.filter(
    (loan) => loan.status === "completed"
  ).length;

  const cancelledLoans = loans.filter(
    (loan) => loan.status === "cancelled"
  ).length;

  const totalPrincipal = loans
    .filter((loan) => loan.status !== "cancelled")
    .reduce(
      (total, loan) =>
        total + Number(loan.principal || 0),
      0
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Loans
        </h1>

        <p className="mt-4 text-gray-600">
          Loading loans...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Loans
          </h1>

          <p className="mt-1 text-gray-600">
            Create and manage borrower loans.
          </p>
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

        {/* Summary Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Loans
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalLoans}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Active Loans
            </p>

            <p className="mt-2 text-2xl font-bold text-green-700">
              {activeLoans}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Completed Loans
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-700">
              {completedLoans}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Cancelled Loans
            </p>

            <p className="mt-2 text-2xl font-bold text-red-700">
              {cancelledLoans}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Principal
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              ZMW {totalPrincipal.toFixed(2)}
            </p>
          </div>

        </section>

        {/* Create Loan */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Create New Loan
          </h2>

          <form
            onSubmit={addLoan}
            className="grid gap-4 md:grid-cols-2"
          >

            {/* Borrower */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Borrower
              </label>

              <select
                value={borrowerId}
                onChange={(event) =>
                  setBorrowerId(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                required
              >
                <option value="">
                  Select borrower
                </option>

                {borrowers.map((borrower) => (
                  <option
                    key={borrower.id}
                    value={borrower.id}
                  >
                    {borrower.full_name} —{" "}
                    {borrower.nrc_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Principal */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Principal
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={principal}
                onChange={(event) =>
                  setPrincipal(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="10000"
                required
              />
            </div>

            {/* Interest Rate */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Interest Rate (%)
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(event) =>
                  setInterestRate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="10"
                required
              />
            </div>

            {/* Overdue Interest */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Overdue Interest Rate (%)
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={overdueInterestRate}
                onChange={(event) =>
                  setOverdueInterestRate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="10"
              />

              <p className="mt-1 text-xs text-gray-500">
                If left blank, the normal interest rate will be used.
              </p>
            </div>

            {/* Frequency */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Payment Frequency
              </label>

              <select
                value={paymentFrequency}
                onChange={(event) =>
                  setPaymentFrequency(
                    event.target.value as
                      | "weekly"
                      | "monthly"
                  )
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
              >
                <option value="weekly">
                  Weekly
                </option>

                <option value="monthly">
                  Monthly
                </option>
              </select>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Payment Amount
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="1200"
                required
              />
            </div>

            {/* Installments */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Number of Installments
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={numberOfInstallments}
                onChange={(event) =>
                  setNumberOfInstallments(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="10"
                required
              />
            </div>

            {/* First Payment */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                First Payment Date
              </label>

              <input
                type="date"
                value={firstPaymentDate}
                onChange={(event) =>
                  setFirstPaymentDate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                required
              />
            </div>

            {/* Grace Period */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Grace Period (days)
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={gracePeriodDays}
                onChange={(event) =>
                  setGracePeriodDays(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Notes
              </label>

              <input
                type="text"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="Optional notes"
              />
            </div>

            {/* Submit */}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-black px-6 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Creating Loan..."
                  : "Create Loan"}
              </button>
            </div>

          </form>
        </section>

        {/* Loan List */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  All Loans
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Showing {filteredLoans.length} of {loans.length} loans.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3 sm:flex-row">

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search borrower or NRC..."
                  className="rounded-lg border border-gray-300 p-3 text-sm text-gray-900"
                />

                <select
                  value={borrowerFilter}
                  onChange={(event) =>
                    setBorrowerFilter(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 p-3 text-sm text-gray-900"
                >
                  <option value="all">
                    All Borrowers
                  </option>

                  {borrowers.map((borrower) => (
                    <option
                      key={borrower.id}
                      value={borrower.id}
                    >
                      {borrower.full_name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 p-3 text-sm text-gray-900"
                >
                  <option value="all">
                    All Statuses
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>

              </div>

            </div>

          </div>

          {filteredLoans.length === 0 ? (
            <div className="p-6 text-gray-500">
              {loans.length === 0
                ? "No loans have been created yet."
                : "No loans match your current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Borrower
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Principal
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Payment
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Frequency
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Installments
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      First Payment
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Status
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Created At
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredLoans.map((loan) => (
                    <tr
                      key={loan.id}
                      className="border-b border-gray-200 transition hover:bg-gray-50"
                    >

                      {/* Borrower */}
                      <td className="p-4 text-gray-900">

                        <a
                          href={`/loans/${loan.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {loan.borrowers?.full_name ??
                            "Unknown"}
                        </a>

                        <div className="text-sm text-gray-500">
                          {loan.borrowers?.nrc_number ?? ""}
                        </div>

                      </td>

                      {/* Principal */}
                      <td className="p-4 text-gray-900">
                        ZMW{" "}
                        {Number(
                          loan.principal
                        ).toFixed(2)}
                      </td>

                      {/* Payment */}
                      <td className="p-4 text-gray-900">
                        ZMW{" "}
                        {Number(
                          loan.payment_amount
                        ).toFixed(2)}
                      </td>

                      {/* Frequency */}
                      <td className="p-4 capitalize text-gray-900">
                        {loan.payment_frequency}
                      </td>

                      {/* Installments */}
                      <td className="p-4 text-gray-900">
                        {loan.number_of_installments}
                      </td>

                      {/* First Payment */}
                      <td className="p-4 text-gray-900">
                        {loan.first_payment_date}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-gray-900">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusClasses(
                            loan.status
                          )}`}
                        >
                          {loan.status}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(
                          loan.created_at
                        ).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-gray-900">

                        <div className="flex items-center gap-3">

                          {loan.status === "active" && (
                            <button
                              type="button"
                              disabled={
                                cancelling === loan.id
                              }
                              onClick={() =>
                                cancelLoan(loan.id)
                              }
                              className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {cancelling === loan.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          )}

                          {loan.status !== "active" && (
                            <button
                              type="button"
                              disabled={
                                deleting === loan.id
                              }
                              onClick={() =>
                                deleteLoan(loan)
                              }
                              className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deleting === loan.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>
    </main>
  );
}

