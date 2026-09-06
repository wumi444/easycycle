
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Schedule = {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: string;
  paid_at: string | null;
  loans?: {
    principal: number;
    payment_frequency: string;
    borrowers?: {
      full_name: string;
      nrc_number: string;
    } | null;
  } | null;
};

export default function SchedulesPage() {
  const supabase = createClient();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("payment_schedule")
      .select(`
        id,
        loan_id,
        installment_number,
        due_date,
        expected_amount,
        paid_amount,
        status,
        paid_at,
        loans (
          principal,
          payment_frequency,
          borrowers (
            full_name,
            nrc_number
          )
        )
      `)
      .order("due_date", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSchedules((data as unknown as Schedule[]) ?? []);
    setLoading(false);
  }

  async function markDue(id: string) {
    const { error } = await supabase
      .from("payment_schedule")
      .update({ status: "due" })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadSchedules();
  }

  const today = new Date().toISOString().split("T")[0];

  const upcomingCount = schedules.filter(
    (schedule) =>
      schedule.status === "upcoming" &&
      schedule.due_date > today
  ).length;

  const dueCount = schedules.filter(
    (schedule) =>
      schedule.status === "due" &&
      schedule.due_date === today
  ).length;

  const overdueCount = schedules.filter(
    (schedule) =>
      schedule.status !== "paid" &&
      schedule.due_date < today &&
      Number(schedule.paid_amount || 0) <
        Number(schedule.expected_amount || 0)
  ).length;

  const paidCount = schedules.filter(
    (schedule) => schedule.status === "paid"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Payment Schedule
          </h1>

          <p className="mt-4 text-gray-600">
            Loading payment schedules...
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
            Payment Schedule
          </h1>

          <p className="mt-1 text-gray-600">
            Track upcoming, due, overdue and completed installments.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Upcoming
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {upcomingCount}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Due Today
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {dueCount}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Overdue
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {overdueCount}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Paid
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {paidCount}
            </p>
          </div>

        </section>

        {/* Schedule Table */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              All Installments
            </h2>
          </div>

          {schedules.length === 0 ? (
            <div className="p-6 text-gray-500">
              No payment schedules found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Borrower
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Installment
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Due Date
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Expected
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Paid
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Remaining
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Status
                    </th>

                    <th className="p-4 text-sm font-semibold text-gray-900">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {schedules.map((schedule) => {

                    const expected = Number(
                      schedule.expected_amount || 0
                    );

                    const paid = Number(
                      schedule.paid_amount || 0
                    );

                    const remaining = Math.max(
                      expected - paid,
                      0
                    );

                    const isOverdue =
                      schedule.status !== "paid" &&
                      schedule.due_date < today &&
                      remaining > 0;

                    const displayStatus = isOverdue
                      ? "overdue"
                      : schedule.status;

                    return (
                      <tr
                        key={schedule.id}
                        className="border-b border-gray-200"
                      >

                        {/* Borrower */}
                        <td className="p-4">

                          <div className="font-medium text-gray-900">
                            {schedule.loans?.borrowers?.full_name ??
                              "Unknown"}
                          </div>

                          <div className="text-sm text-gray-500">
                            {schedule.loans?.borrowers?.nrc_number ??
                              ""}
                          </div>

                        </td>

                        {/* Installment */}
                        <td className="p-4 text-gray-900">
                          #{schedule.installment_number}
                        </td>

                        {/* Due Date */}
                        <td className="p-4 text-gray-900">
                          {schedule.due_date}
                        </td>

                        {/* Expected */}
                        <td className="p-4 text-gray-900">
                          ZMW {expected.toFixed(2)}
                        </td>

                        {/* Paid */}
                        <td className="p-4 text-gray-900">
                          ZMW {paid.toFixed(2)}
                        </td>

                        {/* Remaining */}
                        <td className="p-4 font-medium text-gray-900">
                          ZMW {remaining.toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="p-4">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                              displayStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : displayStatus === "overdue"
                                ? "bg-red-100 text-red-700"
                                : displayStatus === "due"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {displayStatus.replace("_", " ")}
                          </span>

                        </td>

                        {/* Action */}
                        <td className="p-4">

                          {schedule.status === "upcoming" &&
                            schedule.due_date <= today && (
                              <button
                                type="button"
                                onClick={() =>
                                  markDue(schedule.id)
                                }
                                className="text-blue-600 hover:underline"
                              >
                                Mark Due
                              </button>
                            )}

                          {displayStatus === "overdue" && (
                            <span className="text-sm font-medium text-red-600">
                              Payment overdue
                            </span>
                          )}

                          {displayStatus === "paid" && (
                            <span className="text-sm text-green-600">
                              Completed
                            </span>
                          )}

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>
    </main>
  );
}
