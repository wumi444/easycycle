
"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Borrower = {
  id: string;
  full_name: string;
  nrc_number: string | null;
};

type Loan = {
  id: string;
  borrower_id: string;
  principal: number;
  payment_amount: number;
  payment_frequency: string;
  status: string;
  borrowers?: {
    full_name: string;
    nrc_number: string | null;
  } | null;
};

type Payment = {
  id: string;
  loan_id: string;
  schedule_id: string | null;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  payment_type: string | null;
  payment_date: string;
  notes: string | null;

  loans?: {
    principal: number;
    borrowers?:
      | {
          full_name: string;
          nrc_number: string | null;
        }
      | {
          full_name: string;
          nrc_number: string | null;
        }[]
      | null;
  } | null;
};

type Schedule = {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: string;
};

export default function PaymentsPage() {
  const supabase = createClient();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedBorrower, setSelectedBorrower] = useState("");
  const [selectedLoan, setSelectedLoan] = useState("");

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const [
      paymentsResult,
      borrowersResult,
      loansResult,
      schedulesResult,
    ] = await Promise.all([
      supabase
        .from("payments")
        .select(`
          id,
          loan_id,
          schedule_id,
          amount,
          payment_method,
          reference_number,
          payment_type,
          payment_date,
          notes,
          loans (
            principal,
            borrowers (
              full_name,
              nrc_number
            )
          )
        `)
        .order("payment_date", {
          ascending: false,
        }),

      supabase
        .from("borrowers")
        .select(
          "id, full_name, nrc_number"
        )
        .eq("active", true)
        .order("full_name"),

      supabase
        .from("loans")
        .select(`
          id,
          borrower_id,
          principal,
          payment_amount,
          payment_frequency,
          status,
          borrowers (
            full_name,
            nrc_number
          )
        `)
        .eq("status", "active")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("payment_schedule")
        .select(`
          id,
          loan_id,
          installment_number,
          due_date,
          expected_amount,
          paid_amount,
          status
        `)
        .order("installment_number", {
          ascending: true,
        }),
    ]);

    if (paymentsResult.error) {
      console.error(
        "PAYMENTS ERROR:",
        paymentsResult.error
      );

      setError(
        paymentsResult.error.message
      );

      setLoading(false);
      return;
    }

    if (borrowersResult.error) {
      console.error(
        "BORROWERS ERROR:",
        borrowersResult.error
      );

      setError(
        borrowersResult.error.message
      );

      setLoading(false);
      return;
    }

    if (loansResult.error) {
      console.error(
        "LOANS ERROR:",
        loansResult.error
      );

      setError(
        loansResult.error.message
      );

      setLoading(false);
      return;
    }

    if (schedulesResult.error) {
      console.error(
        "SCHEDULES ERROR:",
        schedulesResult.error
      );

      setError(
        schedulesResult.error.message
      );

      setLoading(false);
      return;
    }

    setPayments(
      (paymentsResult.data as unknown as Payment[]) ??
        []
    );

    setBorrowers(
      borrowersResult.data ?? []
    );

    setLoans(
      (loansResult.data as unknown as Loan[]) ??
        []
    );

    setAllSchedules(
      (schedulesResult.data as unknown as Schedule[]) ??
        []
    );

    setLoading(false);
  }

  async function loadSchedules(
    loanId: string
  ) {
    setSchedules([]);

    if (!loanId) {
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("payment_schedule")
      .select(`
        id,
        loan_id,
        installment_number,
        due_date,
        expected_amount,
        paid_amount,
        status
      `)
      .eq("loan_id", loanId)
      .order("installment_number", {
        ascending: true,
      });

    if (error) {
      console.error(
        "SCHEDULE ERROR:",
        error
      );

      setError(error.message);
      return;
    }

    setSchedules(data ?? []);
  }

  function resetForm() {
    setSelectedBorrower("");
    setSelectedLoan("");
    setAmount("");
    setPaymentMethod("cash");
    setReferenceNumber("");
    setNotes("");
    setSchedules([]);
    setError("");
  }

  async function recordPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedLoan) {
      setError(
        "Please select a loan."
      );
      return;
    }

    const numericAmount = Number(amount);

    if (
      !amount ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "Please enter a valid payment amount."
      );
      return;
    }

    const outstanding = schedules.reduce(
      (total, schedule) =>
        total +
        Math.max(
          Number(
            schedule.expected_amount || 0
          ) -
            Number(
              schedule.paid_amount || 0
            ),
          0
        ),
      0
    );

    if (outstanding <= 0) {
      setError(
        "This loan has no outstanding installments."
      );
      return;
    }

    if (numericAmount > outstanding) {
      setError(
        `Payment cannot exceed the outstanding scheduled balance of ZMW ${outstanding.toFixed(
          2
        )}.`
      );
      return;
    }

    setSaving(true);

    const {
      data: userData,
    } = await supabase.auth.getUser();

    if (!userData.user) {
      setError(
        "You must be logged in to record a payment."
      );

      setSaving(false);
      return;
    }

    /*
     * The record_loan_payment RPC handles:
     *
     * 1. Creating the payment record.
     * 2. Automatically allocating the payment.
     * 3. Starting with the oldest outstanding installment.
     * 4. Updating paid_amount.
     * 5. Updating schedule status.
     */
    const {
      error: paymentError,
    } = await supabase.rpc(
      "record_loan_payment",
      {
        p_loan_id: selectedLoan,
        p_amount: numericAmount,
        p_payment_method:
          paymentMethod,
        p_reference_number:
          referenceNumber.trim() || null,
        p_notes:
          notes.trim() || null,
      }
    );

    if (paymentError) {
      console.error(
        "RECORD PAYMENT ERROR:",
        paymentError
      );

      setError(
        paymentError.message
      );

      setSaving(false);
      return;
    }

    setSuccess(
      `Payment of ZMW ${numericAmount.toFixed(
        2
      )} recorded successfully.`
    );

    resetForm();

    await loadData();

    setSaving(false);
  }

  function getBorrowerName(
    payment: Payment
  ) {
    const borrower =
      payment.loans?.borrowers;

    if (Array.isArray(borrower)) {
      return (
        borrower[0]?.full_name ??
        "Unknown"
      );
    }

    return (
      borrower?.full_name ??
      "Unknown"
    );
  }

  function getBorrowerNrc(
    payment: Payment
  ) {
    const borrower =
      payment.loans?.borrowers;

    if (Array.isArray(borrower)) {
      return (
        borrower[0]?.nrc_number ??
        ""
      );
    }

    return (
      borrower?.nrc_number ??
      ""
    );
  }

  function getPaymentType(
    payment: Payment
  ) {
    if (
      payment.payment_type ===
      "overdue_interest"
    ) {
      return "Overdue Interest";
    }

    return "Installment";
  }

  function getPaymentTypeClass(
    payment: Payment
  ) {
    if (
      payment.payment_type ===
      "overdue_interest"
    ) {
      return "text-red-600";
    }

    return "text-gray-900";
  }

  function getInstallmentNumber(
    scheduleId: string | null
  ) {
    if (!scheduleId) {
      return null;
    }

    const schedule =
      allSchedules.find(
        (item) =>
          item.id === scheduleId
      );

    return (
      schedule?.installment_number ??
      null
    );
  }

  function formatPaymentMethod(
    method: string
  ) {
    if (!method) {
      return "—";
    }

    return method
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function formatDate(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleString();
  }

  const filteredLoans =
    loans.filter(
      (loan) =>
        loan.borrower_id ===
        selectedBorrower
    );

  const selectedLoanData =
    loans.find(
      (loan) =>
        loan.id === selectedLoan
    );

  const outstandingSchedules =
    schedules.filter(
      (schedule) =>
        Number(
          schedule.expected_amount
        ) >
        Number(
          schedule.paid_amount || 0
        )
    );

  const selectedLoanOutstanding =
    schedules.reduce(
      (total, schedule) =>
        total +
        Math.max(
          Number(
            schedule.expected_amount || 0
          ) -
            Number(
              schedule.paid_amount || 0
            ),
          0
        ),
      0
    );

  const totalCollected =
    payments.reduce(
      (total, payment) =>
        total +
        Number(
          payment.amount || 0
        ),
      0
    );

  const installmentPayments =
    payments
      .filter(
        (payment) =>
          payment.payment_type !==
          "overdue_interest"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(
            payment.amount || 0
          ),
        0
      );

  const overdueInterestPayments =
    payments
      .filter(
        (payment) =>
          payment.payment_type ===
          "overdue_interest"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(
            payment.amount || 0
          ),
        0
      );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Payments
          </h1>

          <p className="mt-4 text-gray-600">
            Loading payments...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Payments
          </h1>

          <p className="mt-1 text-gray-600">
            Record and track all loan payments.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* Record Payment */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Record Payment
          </h2>

          <form
            onSubmit={recordPayment}
            className="grid gap-5 md:grid-cols-2"
          >

            {/* Borrower */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Borrower
              </label>

              <select
                value={selectedBorrower}
                onChange={(event) => {
                  const borrowerId =
                    event.target.value;

                  setSelectedBorrower(
                    borrowerId
                  );

                  setSelectedLoan("");
                  setSchedules([]);
                  setError("");
                  setSuccess("");
                }}
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                required
              >
                <option value="">
                  Select borrower
                </option>

                {borrowers.map(
                  (borrower) => (
                    <option
                      key={borrower.id}
                      value={borrower.id}
                    >
                      {borrower.full_name}
                      {borrower.nrc_number
                        ? ` — ${borrower.nrc_number}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Loan */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Loan
              </label>

              <select
                value={selectedLoan}
                onChange={async (
                  event
                ) => {
                  const loanId =
                    event.target.value;

                  setSelectedLoan(
                    loanId
                  );

                  setError("");
                  setSuccess("");

                  await loadSchedules(
                    loanId
                  );
                }}
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                disabled={
                  !selectedBorrower
                }
                required
              >
                <option value="">
                  {selectedBorrower
                    ? "Select loan"
                    : "Select borrower first"}
                </option>

                {filteredLoans.map(
                  (loan) => (
                    <option
                      key={loan.id}
                      value={loan.id}
                    >
                      ZMW{" "}
                      {Number(
                        loan.principal
                      ).toFixed(2)}
                      {" — "}
                      {
                        loan.payment_frequency
                      }
                      {" — ZMW "}
                      {Number(
                        loan.payment_amount
                      ).toFixed(2)}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Selected loan summary */}
            {selectedLoan && (
              <div className="md:col-span-2 grid gap-4 md:grid-cols-3">

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">
                    Loan Principal
                  </p>

                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    ZMW{" "}
                    {Number(
                      selectedLoanData?.principal ||
                        0
                    ).toFixed(2)}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">
                    Payment Amount
                  </p>

                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    ZMW{" "}
                    {Number(
                      selectedLoanData?.payment_amount ||
                        0
                    ).toFixed(2)}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">
                    Outstanding
                  </p>

                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    ZMW{" "}
                    {selectedLoanOutstanding.toFixed(
                      2
                    )}
                  </p>
                </div>

              </div>
            )}

            {/* Outstanding installments */}
            <div className="md:col-span-2">

              <label className="mb-1 block text-sm font-medium text-gray-700">
                Outstanding Installments
              </label>

              {!selectedLoan ? (
                <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-500">
                  Select a loan to view outstanding installments.
                </div>
              ) : outstandingSchedules.length ===
                0 ? (
                <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-green-700">
                  No outstanding installments for this loan.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-300">

                  <table className="w-full">

                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left">

                        <th className="p-3 text-sm font-semibold text-gray-900">
                          Installment
                        </th>

                        <th className="p-3 text-sm font-semibold text-gray-900">
                          Due Date
                        </th>

                        <th className="p-3 text-sm font-semibold text-gray-900">
                          Expected
                        </th>

                        <th className="p-3 text-sm font-semibold text-gray-900">
                          Paid
                        </th>

                        <th className="p-3 text-sm font-semibold text-gray-900">
                          Remaining
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {outstandingSchedules.map(
                        (schedule) => {
                          const expected =
                            Number(
                              schedule.expected_amount
                            );

                          const paid =
                            Number(
                              schedule.paid_amount ||
                                0
                            );

                          const remaining =
                            Math.max(
                              expected -
                                paid,
                              0
                            );

                          return (
                            <tr
                              key={
                                schedule.id
                              }
                              className="border-b border-gray-200"
                            >

                              <td className="p-3 font-medium text-gray-900">
                                #
                                {
                                  schedule.installment_number
                                }
                              </td>

                              <td className="p-3 text-gray-900">
                                {
                                  schedule.due_date
                                }
                              </td>

                              <td className="p-3 text-gray-900">
                                ZMW{" "}
                                {expected.toFixed(
                                  2
                                )}
                              </td>

                              <td className="p-3 text-gray-900">
                                ZMW{" "}
                                {paid.toFixed(
                                  2
                                )}
                              </td>

                              <td className="p-3 font-medium text-gray-900">
                                ZMW{" "}
                                {remaining.toFixed(
                                  2
                                )}
                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>
              )}

              {selectedLoan && (
                <p className="mt-2 text-xs text-gray-500">
                  Payments are automatically allocated to the oldest outstanding installment first.
                </p>
              )}

            </div>

            {/* Amount */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Payment Amount
              </label>

              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder={
                  selectedLoanData
                    ? Number(
                        selectedLoanData.payment_amount
                      ).toFixed(2)
                    : "100.00"
                }
                required
              />

              {selectedLoan &&
                selectedLoanOutstanding >
                  0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum scheduled payment: ZMW{" "}
                    {selectedLoanOutstanding.toFixed(
                      2
                    )}
                  </p>
                )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Payment Method
              </label>

              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
              >
                <option value="cash">
                  Cash
                </option>

                <option value="mobile_money">
                  Mobile Money
                </option>

                <option value="bank_transfer">
                  Bank Transfer
                </option>

                <option value="card">
                  Card
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reference Number
              </label>

              <input
                type="text"
                value={referenceNumber}
                onChange={(event) =>
                  setReferenceNumber(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="Optional"
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
                  setNotes(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                placeholder="Optional"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 md:col-span-2">

              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedLoan ||
                  selectedLoanOutstanding <=
                    0
                }
                className="rounded-lg bg-black px-6 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving
                  ? "Recording Payment..."
                  : "Record Payment"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>

            </div>

          </form>
        </section>

        {/* Summary */}
        <section className="grid gap-6 md:grid-cols-3">

          {/* Total Payments */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <p className="text-sm font-medium text-gray-500">
              Total Payments
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {payments.length}
            </p>

          </div>

          {/* Installment Payments */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <p className="text-sm font-medium text-gray-500">
              Installment Payments
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              ZMW{" "}
              {installmentPayments.toFixed(
                2
              )}
            </p>

          </div>

          {/* Overdue Interest */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <p className="text-sm font-medium text-gray-500">
              Overdue Interest Collected
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              ZMW{" "}
              {overdueInterestPayments.toFixed(
                2
              )}
            </p>

          </div>

        </section>

        {/* Total Collected */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <p className="text-sm font-medium text-gray-500">
            Total Collected
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            ZMW{" "}
            {totalCollected.toFixed(
              2
            )}
          </p>

        </section>

        {/* Payment History */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">

            <h2 className="text-xl font-semibold text-gray-900">
              Payment History
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Complete record of installment and overdue-interest payments.
            </p>

          </div>

          {payments.length === 0 ? (
            <div className="p-6 text-gray-500">
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">

                    <th className="p-4 text-gray-900">
                      Borrower
                    </th>

                    <th className="p-4 text-gray-900">
                      Loan
                    </th>

                    <th className="p-4 text-gray-900">
                      Amount
                    </th>

                    <th className="p-4 text-gray-900">
                      Type
                    </th>

                    <th className="p-4 text-gray-900">
                      Method
                    </th>

                    <th className="p-4 text-gray-900">
                      Reference
                    </th>

                    <th className="p-4 text-gray-900">
                      Date
                    </th>

                    <th className="p-4 text-gray-900">
                      Schedule
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {payments.map(
                    (payment) => {
                      const installmentNumber =
                        getInstallmentNumber(
                          payment.schedule_id
                        );

                      return (
                        <tr
                          key={payment.id}
                          className="border-b border-gray-200"
                        >

                          {/* Borrower */}
                          <td className="p-4">

                            <div className="font-medium text-gray-900">
                              {getBorrowerName(
                                payment
                              )}
                            </div>

                            <div className="text-sm text-gray-500">
                              {getBorrowerNrc(
                                payment
                              )}
                            </div>

                          </td>

                          {/* Loan */}
                          <td className="p-4">

                            <div className="text-sm text-gray-600">
                              Principal: ZMW{" "}
                              {Number(
                                payment
                                  .loans
                                  ?.principal ||
                                  0
                              ).toFixed(2)}
                            </div>

                            <a
                              href={`/loans/${payment.loan_id}`}
                              className="mt-1 inline-block font-medium text-blue-600 hover:underline"
                            >
                              View Loan
                            </a>

                          </td>

                          {/* Amount */}
                          <td className="p-4 font-medium text-gray-900">
                            ZMW{" "}
                            {Number(
                              payment.amount ||
                                0
                            ).toFixed(2)}
                          </td>

                          {/* Type */}
                          <td
                            className={`p-4 font-medium ${getPaymentTypeClass(
                              payment
                            )}`}
                          >
                            {getPaymentType(
                              payment
                            )}
                          </td>

                          {/* Method */}
                          <td className="p-4 text-gray-900">
                            {formatPaymentMethod(
                              payment.payment_method
                            )}
                          </td>

                          {/* Reference */}
                          <td className="p-4 text-gray-900">
                            {payment.reference_number ??
                              "—"}
                          </td>

                          {/* Date */}
                          <td className="p-4 text-gray-900">
                            {formatDate(
                              payment.payment_date
                            )}
                          </td>

                          {/* Schedule */}
                          <td className="p-4 text-gray-900">

                            {payment.payment_type ===
                            "overdue_interest" ? (
                              <span className="text-red-600">
                                Interest
                                {installmentNumber
                                  ? ` — #${installmentNumber}`
                                  : ""}
                              </span>
                            ) : installmentNumber ? (
                              <span>
                                Installment #
                                {
                                  installmentNumber
                                }
                              </span>
                            ) : (
                              <span className="text-gray-500">
                                Not linked
                              </span>
                            )}

                          </td>

                        </tr>
                      );
                    }
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



