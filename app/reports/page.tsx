
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Loan = {
  id: string;
  principal: number;
  interest_rate: number;
  overdue_interest_rate: number;
  status: string;
  created_at: string;
  borrower?: {
    full_name: string;
  } | null;
};

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
};

type PaymentSchedule = {
  loan_id: string;
  expected_amount: number;
  paid_amount: number;
};

type ReportStats = {
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  cancelledLoans: number;
  totalPrincipal: number;
  scheduledCollected: number;
  overdueInterestCollected: number;
  totalCollected: number;
  outstanding: number;
};

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats>({
    totalLoans: 0,
    activeLoans: 0,
    completedLoans: 0,
    cancelledLoans: 0,
    totalPrincipal: 0,
    scheduledCollected: 0,
    overdueInterestCollected: 0,
    totalCollected: 0,
    outstanding: 0,
  });

  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        // -----------------------------
        // LOAD LOANS
        // -----------------------------
        const { data: loanData, error: loansError } =
          await supabase
            .from("loans")
            .select(`
              id,
              principal,
              interest_rate,
              overdue_interest_rate,
              status,
              created_at,
              borrowers (
                full_name
              )
            `)
            .order("created_at", {
              ascending: false,
            });

        if (loansError) {
          throw loansError;
        }

        const allLoans = (loanData ?? []).map(
          (loan) => ({
            ...loan,
            borrower: Array.isArray(loan.borrowers)
              ? loan.borrowers[0] ?? null
              : loan.borrowers ?? null,
          })
        ) as Loan[];

        // -----------------------------
        // LOAD PAYMENTS
        // -----------------------------
        const {
          data: paymentData,
          error: paymentsError,
        } = await supabase
          .from("payments")
          .select(`
            id,
            amount,
            payment_date,
            payment_method,
            payment_type
          `)
          .order("payment_date", {
            ascending: false,
          });

        if (paymentsError) {
          throw paymentsError;
        }

        const allPayments =
          (paymentData ?? []) as Payment[];

        // -----------------------------
        // LOAD PAYMENT SCHEDULES
        // -----------------------------
        const {
          data: scheduleData,
          error: schedulesError,
        } = await supabase
          .from("payment_schedule")
          .select(`
            loan_id,
            expected_amount,
            paid_amount
          `);

        if (schedulesError) {
          throw schedulesError;
        }

        const allSchedules =
          (scheduleData ?? []) as PaymentSchedule[];

        // -----------------------------
        // LOAN COUNTS
        // -----------------------------
        const activeLoans = allLoans.filter(
          (loan) => loan.status === "active"
        );

        const completedLoans = allLoans.filter(
          (loan) => loan.status === "completed"
        );

        const cancelledLoans = allLoans.filter(
          (loan) => loan.status === "cancelled"
        );

        // -----------------------------
        // TOTAL PRINCIPAL
        // -----------------------------
        const totalPrincipal = allLoans
          .filter(
            (loan) => loan.status !== "cancelled"
          )
          .reduce(
            (total, loan) =>
              total + Number(loan.principal || 0),
            0
          );

        // -----------------------------
        // PAYMENT BREAKDOWN
        // -----------------------------
        const scheduledCollected =
          allPayments
            .filter(
              (payment) =>
                payment.payment_type ===
                "installment"
            )
            .reduce(
              (total, payment) =>
                total + Number(payment.amount || 0),
              0
            );

        const overdueInterestCollected =
          allPayments
            .filter(
              (payment) =>
                payment.payment_type ===
                "overdue_interest"
            )
            .reduce(
              (total, payment) =>
                total + Number(payment.amount || 0),
              0
            );

        const totalCollected =
          scheduledCollected +
          overdueInterestCollected;

        // -----------------------------
        // OUTSTANDING
        // -----------------------------
        // Outstanding is based on the actual
        // payment schedule, not principal.
        //
        // Example:
        // Total scheduled = ZMW 3,530
        // Paid schedules = ZMW 530
        // Outstanding = ZMW 3,000
        //
        // Cancelled loans are excluded.
        const activeLoanIds = new Set(
          allLoans
            .filter(
              (loan) => loan.status !== "cancelled"
            )
            .map((loan) => loan.id)
        );

        const outstanding = allSchedules
          .filter((schedule) =>
            activeLoanIds.has(schedule.loan_id)
          )
          .reduce(
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

        // -----------------------------
        // SET REPORT STATS
        // -----------------------------
        setStats({
          totalLoans: allLoans.length,
          activeLoans: activeLoans.length,
          completedLoans: completedLoans.length,
          cancelledLoans: cancelledLoans.length,
          totalPrincipal,
          scheduledCollected,
          overdueInterestCollected,
          totalCollected,
          outstanding,
        });

        setLoans(allLoans);
        setPayments(allPayments);
      } catch (err) {
        console.error(
          "REPORTS ERROR:",
          err
        );

        setError(
          "Unable to load reports."
        );
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  function formatMoney(amount: number) {
    return amount.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDate(date: string) {
    return new Date(
      date
    ).toLocaleDateString();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Reports
          </h1>

          <p className="mt-4 text-gray-700">
            Loading reports...
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
            Reports
          </h1>

          <p className="mt-2 text-gray-700">
            Overview of your loan portfolio and payments.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Main Statistics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {/* Total Loans */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Total Loans
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.totalLoans}
            </p>
          </div>

          {/* Active Loans */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Active Loans
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.activeLoans}
            </p>
          </div>

          {/* Completed Loans */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Completed Loans
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.completedLoans}
            </p>
          </div>

          {/* Total Principal */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Total Principal
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.totalPrincipal
              )}
            </p>
          </div>

          {/* Scheduled Collected */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Scheduled Payments Collected
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.scheduledCollected
              )}
            </p>
          </div>

          {/* Overdue Interest */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Overdue Interest Collected
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.overdueInterestCollected
              )}
            </p>
          </div>

          {/* Total Collected */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Total Money Collected
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.totalCollected
              )}
            </p>
          </div>

          {/* Outstanding */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Outstanding
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.outstanding
              )}
            </p>
          </div>

          {/* Cancelled */}
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Cancelled Loans
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.cancelledLoans}
            </p>
          </div>

        </div>

        {/* Loan Summary */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900">
              Loan Summary
            </h2>
          </div>

          {loans.length === 0 ? (
            <div className="p-6 text-gray-700">
              No loans found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Borrower
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Principal
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Interest
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Status
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Created
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {loans.map((loan) => (
                    <tr
                      key={loan.id}
                      className="border-b border-gray-200"
                    >

                      <td className="p-4 font-semibold text-gray-900">
                        {loan.borrower?.full_name ??
                          "Unknown"}
                      </td>

                      <td className="p-4 font-medium text-gray-900">
                        ZMW{" "}
                        {formatMoney(
                          Number(
                            loan.principal || 0
                          )
                        )}
                      </td>

                      <td className="p-4 font-medium text-gray-900">
                        {Number(
                          loan.interest_rate || 0
                        ).toFixed(2)}
                        %
                      </td>

                      <td className="p-4">
                        <span
                          className={`font-semibold capitalize ${
                            loan.status ===
                            "active"
                              ? "text-blue-700"
                              : loan.status ===
                                "completed"
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>

                      <td className="p-4 text-gray-900">
                        {formatDate(
                          loan.created_at
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* Payment Summary */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900">
              Recent Payments
            </h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-6 text-gray-700">
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Amount
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Type
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Method
                    </th>

                    <th className="p-4 text-sm font-bold text-gray-900">
                      Date
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {payments
                    .slice(0, 10)
                    .map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-gray-200"
                      >

                        <td className="p-4 font-semibold text-gray-900">
                          ZMW{" "}
                          {formatMoney(
                            Number(
                              payment.amount || 0
                            )
                          )}
                        </td>

                        <td className="p-4 font-semibold capitalize text-gray-900">
                          {payment.payment_type
                            ? payment.payment_type.replace(
                                "_",
                                " "
                              )
                            : "—"}
                        </td>

                        <td className="p-4 capitalize text-gray-900">
                          {payment.payment_method
                            ? payment.payment_method.replace(
                                "_",
                                " "
                              )
                            : "—"}
                        </td>

                        <td className="p-4 text-gray-900">
                          {formatDate(
                            payment.payment_date
                          )}
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

