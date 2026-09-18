


"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DashboardStats = {
  borrowers: number;
  activeLoans: number;
  totalExpected: number;
  totalCollected: number;
  outstanding: number;
  overduePayments: number;
  dueTodayPayments: number;
  dueSoonPayments: number;
  overdueInterest: number;
};

type RecentPayment = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  payment_type: string | null;
  borrowerName: string;
};

type Schedule = {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: string;
  borrowerName: string;
};

export default function DashboardClient() {
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats>({
    borrowers: 0,
    activeLoans: 0,
    totalExpected: 0,
    totalCollected: 0,
    outstanding: 0,
    overduePayments: 0,
    dueTodayPayments: 0,
    dueSoonPayments: 0,
    overdueInterest: 0,
  });

  const [recentPayments, setRecentPayments] =
    useState<RecentPayment[]>([]);

  const [overduePayments, setOverduePayments] =
    useState<Schedule[]>([]);

  const [dueTodayPayments, setDueTodayPayments] =
    useState<Schedule[]>([]);

  const [dueSoonPayments, setDueSoonPayments] =
    useState<Schedule[]>([]);

  const [upcomingPayments, setUpcomingPayments] =
    useState<Schedule[]>([]);

  const [userName, setUserName] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  function getLocalDateString(date: Date = new Date()) {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function addDays(
    dateString: string,
    days: number
  ) {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    date.setDate(
      date.getDate() + days
    );

    return getLocalDateString(date);
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      /*
       * Current user
       */
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

      /*
       * Profile
       */
     const {
  data: profile,
  error: profileError,
} = await supabase
  .from("profiles")
  .select("full_name, role, active")
  .eq("id", user.id)
  .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setUserName(
        profile?.full_name ?? ""
      );

      /*
       * Dates
       *
       * We use the browser's local date instead
       * of UTC so Zambia date boundaries are
       * handled correctly.
       */
      const today =
        getLocalDateString();

      const sevenDaysFromToday =
        addDays(today, 7);

      /*
       * Load dashboard data
       */
      const [
        borrowersResult,
        loansResult,
        schedulesResult,
        paymentsResult,
        interestResult,
        interestPaymentsResult,
      ] = await Promise.all([
        /*
         * Active borrowers
         */
        supabase
          .from("borrowers")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("active", true),

        /*
         * Active loans
         */
        supabase
          .from("loans")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("status", "active"),

        /*
         * Payment schedules
         */
        supabase
          .from("payment_schedule")
          .select(`
            id,
            loan_id,
            installment_number,
            due_date,
            expected_amount,
            paid_amount,
            status,
            loans (
              borrowers (
                full_name,
                nrc_number
              )
            )
          `)
          .order("due_date", {
            ascending: true,
          }),

        /*
         * Recent payments
         */
        supabase
          .from("payments")
          .select(`
            id,
            amount,
            payment_method,
            payment_date,
            payment_type,
            loans (
              borrowers (
                full_name,
                nrc_number
              )
            )
          `)
          .order("payment_date", {
            ascending: false,
          })
          .limit(5),

        /*
         * Accrued overdue interest
         */
        supabase
          .from("interest_accruals")
          .select("interest_amount"),

        /*
         * Paid overdue interest
         */
        supabase
          .from("payments")
          .select("amount")
          .eq(
            "payment_type",
            "overdue_interest"
          ),
      ]);

      /*
       * Check errors
       */
      if (borrowersResult.error) {
        throw borrowersResult.error;
      }

      if (loansResult.error) {
        throw loansResult.error;
      }

      if (schedulesResult.error) {
        throw schedulesResult.error;
      }

      if (paymentsResult.error) {
        throw paymentsResult.error;
      }

      if (interestResult.error) {
        throw interestResult.error;
      }

      if (interestPaymentsResult.error) {
        throw interestPaymentsResult.error;
      }

      const schedules =
        schedulesResult.data ?? [];

      /*
       * Total expected
       */
      const totalExpected =
        schedules.reduce(
          (total, schedule) =>
            total +
            Number(
              schedule.expected_amount || 0
            ),
          0
        );

      /*
       * Scheduled outstanding
       */
      const scheduledOutstanding =
        schedules.reduce(
          (total, schedule) => {
            const expected =
              Number(
                schedule.expected_amount || 0
              );

            const paid =
              Number(
                schedule.paid_amount || 0
              );

            return (
              total +
              Math.max(
                expected - paid,
                0
              )
            );
          },
          0
        );

      /*
       * Unpaid schedules
       */
      const unpaidSchedules =
        schedules.filter(
          (schedule) => {
            const expected =
              Number(
                schedule.expected_amount || 0
              );

            const paid =
              Number(
                schedule.paid_amount || 0
              );

            return (
              expected > paid &&
              schedule.status !== "paid"
            );
          }
        );

      /*
       * OVERDUE
       *
       * Due date has already passed.
       */
      const overdue =
        unpaidSchedules.filter(
          (schedule) =>
            schedule.due_date < today
        );

      /*
       * DUE TODAY
       */
      const dueToday =
        unpaidSchedules.filter(
          (schedule) =>
            schedule.due_date === today
        );

      /*
       * DUE SOON
       *
       * Tomorrow through the next 7 days.
       */
      const dueSoon =
        unpaidSchedules.filter(
          (schedule) =>
            schedule.due_date > today &&
            schedule.due_date <=
              sevenDaysFromToday
        );

      /*
       * UPCOMING
       *
       * More than 7 days away.
       */
      const upcoming =
        unpaidSchedules.filter(
          (schedule) =>
            schedule.due_date >
            sevenDaysFromToday
        );

      /*
       * Total collected
       */
      const {
        data: allPayments,
        error: allPaymentsError,
      } = await supabase
        .from("payments")
        .select("amount");

      if (allPaymentsError) {
        throw allPaymentsError;
      }

      const totalCollected =
        (allPayments ?? []).reduce(
          (total, payment) =>
            total +
            Number(
              payment.amount || 0
            ),
          0
        );

      /*
       * Total accrued overdue interest
       */
      const totalOverdueInterest =
        (
          interestResult.data ?? []
        ).reduce(
          (total, row) =>
            total +
            Number(
              row.interest_amount || 0
            ),
          0
        );

      /*
       * Paid overdue interest
       */
      const paidOverdueInterest =
        (
          interestPaymentsResult.data ??
          []
        ).reduce(
          (total, payment) =>
            total +
            Number(
              payment.amount || 0
            ),
          0
        );

      /*
       * Unpaid overdue interest
       */
      const overdueInterestOutstanding =
        Math.max(
          totalOverdueInterest -
            paidOverdueInterest,
          0
        );

      /*
       * Final outstanding
       */
      const outstanding =
        scheduledOutstanding +
        overdueInterestOutstanding;

      /*
       * Recent payments
       */
      setRecentPayments(
        (
          paymentsResult.data ?? []
        ).map(
          (payment: any) => ({
            id: payment.id,

            amount: Number(
              payment.amount || 0
            ),

            payment_method:
              payment.payment_method,

            payment_date:
              payment.payment_date,

            payment_type:
              payment.payment_type,

            borrowerName:
              Array.isArray(
                payment.loans?.borrowers
              )
                ? payment.loans
                    .borrowers[0]
                    ?.full_name ??
                  "Unknown"
                : payment.loans?.borrowers
                    ?.full_name ??
                  "Unknown",
          })
        )
      );

      /*
       * Convert schedule into UI format
       */
      function mapSchedule(
        schedule: any
      ): Schedule {
        return {
          id: schedule.id,

          loan_id:
            schedule.loan_id,

          installment_number:
            schedule.installment_number,

          due_date:
            schedule.due_date,

          expected_amount:
            Number(
              schedule.expected_amount ||
                0
            ),

          paid_amount:
            Number(
              schedule.paid_amount ||
                0
            ),

          status:
            schedule.status,

          borrowerName:
            Array.isArray(
              schedule.loans?.borrowers
            )
              ? schedule.loans
                  .borrowers[0]
                  ?.full_name ??
                "Unknown"
              : schedule.loans
                  ?.borrowers
                  ?.full_name ??
                "Unknown",
        };
      }

      /*
       * Store dashboard payment groups
       */
      setOverduePayments(
        overdue
          .slice(0, 5)
          .map(mapSchedule)
      );

      setDueTodayPayments(
        dueToday
          .slice(0, 5)
          .map(mapSchedule)
      );

      setDueSoonPayments(
        dueSoon
          .slice(0, 5)
          .map(mapSchedule)
      );

      setUpcomingPayments(
        upcoming
          .slice(0, 5)
          .map(mapSchedule)
      );

      /*
       * Dashboard statistics
       */
      setStats({
        borrowers:
          borrowersResult.count ?? 0,

        activeLoans:
          loansResult.count ?? 0,

        totalExpected,

        totalCollected,

        outstanding,

        overduePayments:
          overdue.length,

        dueTodayPayments:
          dueToday.length,

        dueSoonPayments:
          dueSoon.length,

        overdueInterest:
          overdueInterestOutstanding,
      });
    } catch (err) {
      console.error(
        "DASHBOARD ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatMoney(
    amount: number
  ) {
    return amount.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatPaymentMethod(
    method: string
  ) {
    return method
      ? method.replace(
          /_/g,
          " "
        )
      : "—";
  }

  function getPaymentType(
    paymentType: string | null
  ) {
    if (
      paymentType ===
      "overdue_interest"
    ) {
      return "Overdue Interest";
    }

    return "Installment";
  }

  function getPaymentTypeClass(
    paymentType: string | null
  ) {
    if (
      paymentType ===
      "overdue_interest"
    ) {
      return "text-red-600";
    }

    return "text-gray-900";
  }

  function formatDate(
    dateString: string
  ) {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  function getRemaining(
    schedule: Schedule
  ) {
    return Math.max(
      schedule.expected_amount -
        schedule.paid_amount,
      0
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>

          <p className="mt-4 text-gray-600">
            Loading dashboard...
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
            Dashboard
          </h1>

          <p className="mt-1 text-gray-600">
            Welcome
            {userName
              ? `, ${userName}`
              : ""}
            .
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Statistics */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

          {/* Active Borrowers */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Active Borrowers
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.borrowers}
            </p>
          </div>

          {/* Active Loans */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Active Loans
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.activeLoans}
            </p>
          </div>

          {/* Total Expected */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Expected
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.totalExpected
              )}
            </p>
          </div>

          {/* Total Collected */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Collected
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.totalCollected
              )}
            </p>
          </div>

          {/* Outstanding */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Outstanding
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              ZMW{" "}
              {formatMoney(
                stats.outstanding
              )}
            </p>
          </div>

          {/* Overdue */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Overdue Installments
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${
                stats.overduePayments > 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}
            >
              {stats.overduePayments}
            </p>
          </div>

          {/* Due Today */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Due Today
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${
                stats.dueTodayPayments > 0
                  ? "text-orange-600"
                  : "text-gray-900"
              }`}
            >
              {stats.dueTodayPayments}
            </p>
          </div>

          {/* Due Soon */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Due Soon
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${
                stats.dueSoonPayments > 0
                  ? "text-yellow-600"
                  : "text-gray-900"
              }`}
            >
              {stats.dueSoonPayments}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Within the next 7 days
            </p>
          </div>

          {/* Overdue Interest */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Overdue Interest
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${
                stats.overdueInterest > 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}
            >
              ZMW{" "}
              {formatMoney(
                stats.overdueInterest
              )}
            </p>
          </div>

        </section>

        {/* Quick Actions */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="text-xl font-semibold text-gray-900">
            Quick Actions
          </h2>

          <div className="mt-5 flex flex-wrap gap-4">

            <a
              href="/borrowers"
              className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Manage Borrowers
            </a>

            <a
              href="/loans"
              className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Manage Loans
            </a>

            <a
              href="/payments"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              View Payments
            </a>

            <a
              href="/payment-schedule"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Payment Schedule
            </a>

          </div>

        </section>

        {/* Recent Payments */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Payments
            </h2>
          </div>

          {recentPayments.length === 0 ? (
            <div className="p-6 text-gray-500">
              No payments recorded yet.
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
                      Amount
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Type
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Method
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Date
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {recentPayments.map(
                    (payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-gray-200"
                      >

                        <td className="p-4 font-medium text-gray-900">
                          {payment.borrowerName}
                        </td>

                        <td className="p-4 font-medium text-gray-900">
                          ZMW{" "}
                          {payment.amount.toFixed(
                            2
                          )}
                        </td>

                        <td
                          className={`p-4 font-medium ${getPaymentTypeClass(
                            payment.payment_type
                          )}`}
                        >
                          {getPaymentType(
                            payment.payment_type
                          )}
                        </td>

                        <td className="p-4 capitalize text-gray-900">
                          {formatPaymentMethod(
                            payment.payment_method
                          )}
                        </td>

                        <td className="p-4 text-gray-900">
                          {new Date(
                            payment.payment_date
                          ).toLocaleString()}
                        </td>

                      </tr>
                    )
                  )}
                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* Urgency Sections */}
        <section className="grid gap-6 lg:grid-cols-2">

          {/* Overdue */}
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">

            <div className="border-b border-red-200 bg-red-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-red-700">
                    Overdue Payments
                  </h2>

                  <p className="mt-1 text-sm text-red-600">
                    Payments that have passed their due date
                  </p>
                </div>

                <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
                  {stats.overduePayments}
                </span>
              </div>
            </div>

            {overduePayments.length === 0 ? (
              <div className="p-6 text-gray-500">
                No overdue payments.
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
                        Due
                      </th>

                      <th className="p-4 text-sm font-semibold text-gray-900">
                        Remaining
                      </th>

                    </tr>
                  </thead>

                  <tbody>
                    {overduePayments.map(
                      (schedule) => (
                        <tr
                          key={schedule.id}
                          className="border-b border-gray-200"
                        >

                          <td className="p-4 font-medium text-gray-900">
                            {schedule.borrowerName}
                          </td>

                          <td className="p-4 text-red-600">
                            {formatDate(
                              schedule.due_date
                            )}
                          </td>

                          <td className="p-4 font-bold text-red-600">
                            ZMW{" "}
                            {getRemaining(
                              schedule
                            ).toFixed(2)}
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>

              </div>
            )}

          </div>

          {/* Due Today */}
          <div className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">

            <div className="border-b border-orange-200 bg-orange-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-orange-700">
                    Due Today
                  </h2>

                  <p className="mt-1 text-sm text-orange-600">
                    Payments that should be collected today
                  </p>
                </div>

                <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">
                  {stats.dueTodayPayments}
                </span>
              </div>
            </div>

            {dueTodayPayments.length === 0 ? (
              <div className="p-6 text-gray-500">
                No payments due today.
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
                        Installment
                      </th>

                      <th className="p-4 text-sm font-semibold text-gray-900">
                        Remaining
                      </th>

                    </tr>
                  </thead>

                  <tbody>
                    {dueTodayPayments.map(
                      (schedule) => (
                        <tr
                          key={schedule.id}
                          className="border-b border-gray-200"
                        >

                          <td className="p-4 font-medium text-gray-900">
                            {schedule.borrowerName}
                          </td>

                          <td className="p-4 text-gray-900">
                            #{schedule.installment_number}
                          </td>

                          <td className="p-4 font-bold text-orange-600">
                            ZMW{" "}
                            {getRemaining(
                              schedule
                            ).toFixed(2)}
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>

              </div>
            )}

          </div>

          {/* Due Soon */}
          <div className="overflow-hidden rounded-xl border border-yellow-200 bg-white shadow-sm">

            <div className="border-b border-yellow-200 bg-yellow-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-yellow-700">
                    Due Soon
                  </h2>

                  <p className="mt-1 text-sm text-yellow-700">
                    Payments due within the next 7 days
                  </p>
                </div>

                <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-white">
                  {stats.dueSoonPayments}
                </span>
              </div>
            </div>

            {dueSoonPayments.length === 0 ? (
              <div className="p-6 text-gray-500">
                No payments due within 7 days.
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
                        Due
                      </th>

                      <th className="p-4 text-sm font-semibold text-gray-900">
                        Remaining
                      </th>

                    </tr>
                  </thead>

                  <tbody>
                    {dueSoonPayments.map(
                      (schedule) => (
                        <tr
                          key={schedule.id}
                          className="border-b border-gray-200"
                        >

                          <td className="p-4 font-medium text-gray-900">
                            {schedule.borrowerName}
                          </td>

                          <td className="p-4 text-gray-900">
                            {formatDate(
                              schedule.due_date
                            )}
                          </td>

                          <td className="p-4 font-bold text-yellow-700">
                            ZMW{" "}
                            {getRemaining(
                              schedule
                            ).toFixed(2)}
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>

              </div>
            )}

          </div>

          {/* Upcoming */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="border-b border-gray-200 bg-gray-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Upcoming Payments
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Payments more than 7 days away
                  </p>
                </div>
              </div>
            </div>

            {upcomingPayments.length === 0 ? (
              <div className="p-6 text-gray-500">
                No upcoming payments.
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
                        Due
                      </th>

                      <th className="p-4 text-sm font-semibold text-gray-900">
                        Amount
                      </th>

                    </tr>
                  </thead>

                  <tbody>
                    {upcomingPayments.map(
                      (schedule) => (
                        <tr
                          key={schedule.id}
                          className="border-b border-gray-200"
                        >

                          <td className="p-4 font-medium text-gray-900">
                            {schedule.borrowerName}
                          </td>

                          <td className="p-4 text-gray-900">
                            {formatDate(
                              schedule.due_date
                            )}
                          </td>

                          <td className="p-4 font-medium text-gray-900">
                            ZMW{" "}
                            {getRemaining(
                              schedule
                            ).toFixed(2)}
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>

              </div>
            )}

          </div>

        </section>

      </div>
    </main>
  );
}