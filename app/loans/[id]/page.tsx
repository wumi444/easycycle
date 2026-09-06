

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Loan = {
  id: string;
  borrower_id: string;
  principal: number;
  interest_rate: number;
  overdue_interest_rate: number;
  payment_frequency: string;
  payment_amount: number;
  first_payment_date: string;
  grace_period_days: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  number_of_installments: number;
  borrowers?: {
    full_name: string;
    nrc_number: string;
    phone: string | null;
    address: string | null;
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
  paid_at: string | null;
};

type Payment = {
  id: string;
  loan_id: string;
  schedule_id: string | null;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  payment_date: string;
  notes: string | null;
  payment_type: string | null;
};

type InterestAccrual = {
  id: string;
  loan_id: string;
  schedule_id: string | null;
  accrual_date: string;
  balance_before: number;
  interest_rate: number;
  interest_amount: number;
};

export default function LoanDetailsPage() {
  const params = useParams();
  const loanId = params.id as string;

  const supabase = createClient();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [interestAccruals, setInterestAccruals] = useState<
    InterestAccrual[]
  >([]);

  const [totalOverdueInterest, setTotalOverdueInterest] =
    useState(0);

  const [paidOverdueInterest, setPaidOverdueInterest] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingInterestPayment, setSavingInterestPayment] =
    useState(false);

  const [error, setError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [selectedInterestScheduleId, setSelectedInterestScheduleId] =
    useState("");

  const [interestPaymentAmount, setInterestPaymentAmount] =
    useState("");

  const [interestPaymentMethod, setInterestPaymentMethod] =
    useState("cash");

  const [interestReferenceNumber, setInterestReferenceNumber] =
    useState("");

  const [interestPaymentNotes, setInterestPaymentNotes] =
    useState("");

  useEffect(() => {
    if (loanId) {
      loadLoan();
    }
  }, [loanId]);

  async function loadLoan() {
    setLoading(true);
    setError("");

    const [
      loanResult,
      scheduleResult,
      paymentResult,
      interestResult,
    ] = await Promise.all([
      supabase
        .from("loans")
        .select(`
          id,
          borrower_id,
          principal,
          interest_rate,
          overdue_interest_rate,
          payment_frequency,
          payment_amount,
          first_payment_date,
          grace_period_days,
          status,
          notes,
          created_at,
          updated_at,
          number_of_installments,
          borrowers (
            full_name,
            nrc_number,
            phone,
            address
          )
        `)
        .eq("id", loanId)
        .single(),

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
          paid_at
        `)
        .eq("loan_id", loanId)
        .order("installment_number"),

      supabase
        .from("payments")
        .select(`
          id,
          loan_id,
          schedule_id,
          amount,
          payment_method,
          reference_number,
          payment_date,
          notes,
          payment_type
        `)
        .eq("loan_id", loanId)
        .order("payment_date", {
          ascending: false,
        }),

      supabase
        .from("interest_accruals")
        .select(`
          id,
          loan_id,
          schedule_id,
          accrual_date,
          balance_before,
          interest_rate,
          interest_amount
        `)
        .eq("loan_id", loanId)
        .order("accrual_date"),
    ]);

    if (loanResult.error) {
      console.error("LOAN ERROR:", loanResult.error);
      setError(loanResult.error.message);
      setLoading(false);
      return;
    }

    if (scheduleResult.error) {
      console.error(
        "SCHEDULE ERROR:",
        scheduleResult.error
      );
      setError(scheduleResult.error.message);
      setLoading(false);
      return;
    }

    if (paymentResult.error) {
      console.error(
        "PAYMENT ERROR:",
        paymentResult.error
      );
      setError(paymentResult.error.message);
      setLoading(false);
      return;
    }

    if (interestResult.error) {
      console.error(
        "INTEREST ERROR:",
        interestResult.error
      );
      setError(interestResult.error.message);
      setLoading(false);
      return;
    }

    const loadedLoan =
      loanResult.data as unknown as Loan;

    const loadedSchedules =
      (scheduleResult.data ?? []) as unknown as Schedule[];

    const loadedPayments =
      (paymentResult.data ?? []) as unknown as Payment[];

    const loadedInterest =
      (interestResult.data ?? []) as unknown as InterestAccrual[];

    setLoan(loadedLoan);
    setSchedules(loadedSchedules);
    setPayments(loadedPayments);
    setInterestAccruals(loadedInterest);

    const totalInterest = loadedInterest.reduce(
      (total, interest) =>
        total + Number(interest.interest_amount || 0),
      0
    );

    const interestPayments = loadedPayments
      .filter(
        (payment) =>
          payment.payment_type === "overdue_interest"
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0
      );

    setTotalOverdueInterest(
      Number(totalInterest.toFixed(2))
    );

    setPaidOverdueInterest(
      Number(interestPayments.toFixed(2))
    );

    setLoading(false);
  }

  const totalExpected = schedules.reduce(
    (total, schedule) =>
      total +
      Number(schedule.expected_amount || 0),
    0
  );

  const totalPaid = schedules.reduce(
    (total, schedule) =>
      total +
      Number(schedule.paid_amount || 0),
    0
  );

  const scheduledOutstanding = Math.max(
    totalExpected - totalPaid,
    0
  );

  const overdueInterestOutstanding = Math.max(
    Number(
      (
        totalOverdueInterest -
        paidOverdueInterest
      ).toFixed(2)
    ),
    0
  );

  const outstanding =
    scheduledOutstanding +
    overdueInterestOutstanding;

  function getInterestForSchedule(
    scheduleId: string
  ) {
    return interestAccruals
      .filter(
        (interest) =>
          interest.schedule_id === scheduleId
      )
      .reduce(
        (total, interest) =>
          total +
          Number(
            interest.interest_amount || 0
          ),
        0
      );
  }

  function getInterestPaidForSchedule(
    scheduleId: string
  ) {
    return payments
      .filter(
        (payment) =>
          payment.payment_type ===
            "overdue_interest" &&
          payment.schedule_id === scheduleId
      )
      .reduce(
        (total, payment) =>
          total +
          Number(payment.amount || 0),
        0
      );
  }

  function getOutstandingInterestForSchedule(
    scheduleId: string
  ) {
    const accrued =
      getInterestForSchedule(scheduleId);

    const paid =
      getInterestPaidForSchedule(scheduleId);

    return Math.max(
      Number((accrued - paid).toFixed(2)),
      0
    );
  }

  const selectedInterestOutstanding =
    selectedInterestScheduleId
      ? getOutstandingInterestForSchedule(
          selectedInterestScheduleId
        )
      : 0;

  /*
   * ============================================================
   * RECORD INSTALLMENT PAYMENT
   * ============================================================
   *
   * IMPORTANT:
   *
   * We no longer insert directly into the payments table.
   *
   * We call record_loan_payment(), which handles allocation.
   *
   * Example:
   *
   * Payment = ZMW 150
   *
   * Installment #1 = ZMW 100 remaining
   * Installment #2 = ZMW 100 remaining
   *
   * The database function allocates:
   *
   * #1 -> ZMW 100
   * #2 -> ZMW 50
   *
   * This is exactly what we want to test.
   */

 async function recordPayment(
  event: FormEvent<HTMLFormElement>
){
    event.preventDefault();

    setSavingPayment(true);
    setError("");
    setPaymentSuccess("");

    try {
      if (loan?.status === "cancelled") {
        setError(
          "Payments cannot be recorded for a cancelled loan."
        );
        return;
      }

      const amount = Number(
        Number(paymentAmount).toFixed(2)
      );

      if (!amount || amount <= 0) {
        setError(
          "Please enter a valid payment amount."
        );
        return;
      }

      if (scheduledOutstanding <= 0) {
        setError(
          "There is no outstanding installment balance for this loan."
        );
        return;
      }

      /*
       * Prevent paying more than the total outstanding
       * installment balance.
       *
       * IMPORTANT:
       * We DO NOT compare against one installment anymore.
       *
       * Therefore ZMW 150 is allowed when:
       *
       * #1 = 100 outstanding
       * #2 = 100 outstanding
       *
       * Total = 200 outstanding.
       */
      if (amount > scheduledOutstanding) {
        setError(
          `Payment cannot be greater than the total outstanding installment balance of ZMW ${scheduledOutstanding.toFixed(
            2
          )}.`
        );
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "AUTH USER ERROR:",
          userError
        );

        setError(userError.message);
        return;
      }

      if (!user) {
        setError(
          "You must be logged in to record a payment."
        );
        return;
      }

      console.log(
        "Recording installment payment through allocation function:",
        {
          loan_id: loanId,
          amount,
          payment_method: paymentMethod,
          reference_number:
            referenceNumber.trim() || null,
          notes:
            paymentNotes.trim() || null,
        }
      );

      /*
       * Call the database allocation function.
       *
       * The function will:
       *
       * 1. Find the oldest unpaid installment.
       * 2. Allocate as much as possible.
       * 3. Move to the next installment if money remains.
       * 4. Update paid_amount.
       * 5. Update installment status.
       * 6. Complete the loan if everything is paid.
       */
      const {
        data: paymentId,
        error: paymentError,
      } = await supabase.rpc(
        "record_loan_payment",
        {
          p_loan_id: loanId,
          p_amount: amount,
          p_payment_method: paymentMethod,
          p_reference_number:
            referenceNumber.trim() || null,
          p_notes:
            paymentNotes.trim() || null,
        }
      );

      if (paymentError) {
        console.error(
          "RECORD LOAN PAYMENT ERROR:",
          paymentError
        );

        setError(
          `Could not record payment: ${paymentError.message}`
        );

        return;
      }

      console.log(
        "PAYMENT ALLOCATION SUCCESS:",
        paymentId
      );

      /*
       * Refresh all loan information from the database.
       */
      await loadLoan();

      setPaymentAmount("");
      setPaymentMethod("cash");
      setReferenceNumber("");
      setPaymentNotes("");

      setPaymentSuccess(
        `Payment of ZMW ${amount.toFixed(
          2
        )} recorded successfully and allocated to the oldest outstanding installments.`
      );
    } catch (err) {
      console.error(
        "UNEXPECTED PAYMENT ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while recording the payment."
      );
    } finally {
      setSavingPayment(false);
    }
  }

  /*
   * ============================================================
   * RECORD OVERDUE INTEREST PAYMENT
   * ============================================================
   */

 async function recordInterestPayment(
  event: FormEvent<HTMLFormElement>
) {
    event.preventDefault();

    setSavingInterestPayment(true);
    setError("");
    setPaymentSuccess("");

    try {
      if (loan?.status === "cancelled") {
        setError(
          "Payments cannot be recorded for a cancelled loan."
        );
        return;
      }

      if (!selectedInterestScheduleId) {
        setError(
          "Please select an installment for the interest payment."
        );
        return;
      }

      const selectedSchedule =
        schedules.find(
          (schedule) =>
            schedule.id ===
            selectedInterestScheduleId
        );

      if (!selectedSchedule) {
        setError(
          "Selected installment could not be found."
        );
        return;
      }

      const outstandingForSchedule =
        Number(
          getOutstandingInterestForSchedule(
            selectedInterestScheduleId
          ).toFixed(2)
        );

      const amount = Number(
        Number(
          interestPaymentAmount
        ).toFixed(2)
      );

      if (!amount || amount <= 0) {
        setError(
          "Please enter a valid interest payment amount."
        );
        return;
      }

      if (
        outstandingForSchedule <= 0
      ) {
        setError(
          "There is no outstanding overdue interest for this installment."
        );
        return;
      }

      if (
        amount >
        outstandingForSchedule
      ) {
        setError(
          `Payment cannot be greater than the outstanding overdue interest of ZMW ${outstandingForSchedule.toFixed(
            2
          )}.`
        );

        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "AUTH USER ERROR:",
          userError
        );

        setError(
          userError.message
        );

        return;
      }

      if (!user) {
        setError(
          "You must be logged in to record a payment."
        );

        return;
      }

      console.log(
        "Recording overdue interest payment:",
        {
          loan_id: loanId,
          schedule_id:
            selectedInterestScheduleId,
          amount,
          outstandingForSchedule,
          payment_method:
            interestPaymentMethod,
        }
      );

      const {
        data: insertedPayment,
        error: paymentError,
      } = await supabase
        .from("payments")
        .insert({
          loan_id: loanId,
          schedule_id:
            selectedInterestScheduleId,
          amount,
          payment_method:
            interestPaymentMethod,
          reference_number:
            interestReferenceNumber.trim() ||
            null,
          payment_date:
            new Date().toISOString(),
          notes:
            interestPaymentNotes.trim() ||
            null,
          collected_by: user.id,
          payment_type:
            "overdue_interest",
        })
        .select()
        .single();

      if (paymentError) {
        console.error(
          "OVERDUE INTEREST PAYMENT ERROR:",
          paymentError
        );

        setError(
          `Could not record overdue interest payment: ${paymentError.message}`
        );

        return;
      }

      console.log(
        "OVERDUE INTEREST PAYMENT RECORDED:",
        insertedPayment
      );

      setInterestPaymentAmount("");
      setSelectedInterestScheduleId("");
      setInterestPaymentMethod("cash");
      setInterestReferenceNumber("");
      setInterestPaymentNotes("");

      setPaymentSuccess(
        `Overdue interest payment of ZMW ${amount.toFixed(
          2
        )} recorded successfully.`
      );

      await loadLoan();
    } catch (err) {
      console.error(
        "UNEXPECTED INTEREST PAYMENT ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while recording the interest payment."
      );
    } finally {
      setSavingInterestPayment(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <p className="text-gray-600">
          Loading loan details...
        </p>
      </main>
    );
  }

  if (error && !loan) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </main>
    );
  }

  if (!loan) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <p className="text-gray-600">
          Loan not found.
        </p>
      </main>
    );
  }

  const isCancelled =
    loan.status === "cancelled";

  const overdueInterestSchedules =
    schedules.filter(
      (schedule) =>
        getOutstandingInterestForSchedule(
          schedule.id
        ) > 0
    );

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div>
          <a
            href="/loans"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Loans
          </a>

          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            Loan Details
          </h1>

          <p className="mt-1 text-gray-600">
            {loan.borrowers?.full_name ??
              "Unknown borrower"}
          </p>
        </div>

        {/* Cancelled */}
        {isCancelled && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-800">
              Loan Cancelled
            </h2>

            <p className="mt-2 text-red-700">
              This loan has been cancelled.
              Payments cannot be recorded
              against a cancelled loan.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Success */}
        {paymentSuccess && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-700">
            {paymentSuccess}
          </div>
        )}

        {/* Borrower + Loan Information */}
        <section className="grid gap-6 md:grid-cols-2">

          {/* Borrower Information */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-gray-900">
              Borrower Information
            </h2>

            <div className="mt-5 space-y-3">

              <div>
                <p className="text-sm text-gray-500">
                  Full Name
                </p>

                <p className="font-medium text-gray-900">
                  {loan.borrowers?.full_name ??
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  NRC Number
                </p>

                <p className="font-medium text-gray-900">
                  {loan.borrowers?.nrc_number ??
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Phone
                </p>

                <p className="font-medium text-gray-900">
                  {loan.borrowers?.phone ??
                    "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Address
                </p>

                <p className="font-medium text-gray-900">
                  {loan.borrowers?.address ??
                    "—"}
                </p>
              </div>

            </div>
          </div>

          {/* Loan Information */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-gray-900">
              Loan Information
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <div>
                <p className="text-sm text-gray-500">
                  Principal
                </p>

                <p className="text-lg font-semibold text-gray-900">
                  ZMW{" "}
                  {Number(
                    loan.principal
                  ).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Interest Rate
                </p>

                <p className="font-medium text-gray-900">
                  {Number(
                    loan.interest_rate
                  ).toFixed(2)}
                  %
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Overdue Interest
                </p>

                <p className="font-medium text-gray-900">
                  {Number(
                    loan.overdue_interest_rate
                  ).toFixed(2)}
                  %
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Grace Period
                </p>

                <p className="font-medium text-gray-900">
                  {loan.grace_period_days}{" "}
                  day
                  {loan.grace_period_days ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Frequency
                </p>

                <p className="font-medium capitalize text-gray-900">
                  {loan.payment_frequency}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Payment Amount
                </p>

                <p className="font-medium text-gray-900">
                  ZMW{" "}
                  {Number(
                    loan.payment_amount
                  ).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Installments
                </p>

                <p className="font-medium text-gray-900">
                  {loan.number_of_installments}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  First Payment
                </p>

                <p className="font-medium text-gray-900">
                  {loan.first_payment_date}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Status
                </p>

                <p className="font-medium capitalize text-gray-900">
                  {loan.status}
                </p>
              </div>

            </div>
          </div>

        </section>

        {/* Financial Summary */}
        <section className="grid gap-6 md:grid-cols-4">

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Expected
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              ZMW{" "}
              {totalExpected.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Paid
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              ZMW{" "}
              {totalPaid.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Overdue Interest
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              ZMW{" "}
              {overdueInterestOutstanding.toFixed(
                2
              )}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Outstanding
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              ZMW{" "}
              {outstanding.toFixed(2)}
            </p>
          </div>

        </section>

        {/* Record Installment Payment */}
        {!isCancelled && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-gray-900">
              Record Installment Payment
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Payments are automatically allocated
              to the oldest outstanding installments.
            </p>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-semibold">
                Automatic payment allocation
              </p>

              <p className="mt-1">
                A payment can cover multiple
                installments. For example, if
                installment #1 has ZMW 100 outstanding
                and you enter ZMW 150, the system will
                allocate ZMW 100 to #1 and ZMW 50 to #2.
              </p>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Total installment balance remaining
                </span>

                <span className="font-semibold text-gray-900">
                  ZMW{" "}
                  {scheduledOutstanding.toFixed(2)}
                </span>
              </div>
            </div>

            <form
              onSubmit={recordPayment}
              className="mt-6 grid gap-4 md:grid-cols-2"
            >

              {/* Payment Amount */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment Amount
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={
                    scheduledOutstanding > 0
                      ? scheduledOutstanding
                      : undefined
                  }
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                  placeholder="150"
                  required
                />

                <p className="mt-1 text-xs text-gray-500">
                  Maximum payment: ZMW{" "}
                  {scheduledOutstanding.toFixed(2)}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment Method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                  required
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
                  onChange={(e) =>
                    setReferenceNumber(
                      e.target.value
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
                  value={paymentNotes}
                  onChange={(e) =>
                    setPaymentNotes(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                  placeholder="Optional payment notes"
                />
              </div>

              {/* Submit */}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={
                    savingPayment ||
                    scheduledOutstanding <= 0
                  }
                  className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
                >
                  {savingPayment
                    ? "Recording Payment..."
                    : "Record Installment Payment"}
                </button>
              </div>

            </form>

          </section>
        )}

        {/* Pay Overdue Interest */}
        {!isCancelled &&
          overdueInterestSchedules.length > 0 && (
            <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">

              <h2 className="text-xl font-semibold text-gray-900">
                Pay Overdue Interest
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Total outstanding overdue interest:{" "}
                <span className="font-semibold text-red-600">
                  ZMW{" "}
                  {overdueInterestOutstanding.toFixed(
                    2
                  )}
                </span>
              </p>

              <form
                onSubmit={
                  recordInterestPayment
                }
                className="mt-6 grid gap-4 md:grid-cols-2"
              >

                {/* Interest Installment */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Installment
                  </label>

                  <select
                    value={
                      selectedInterestScheduleId
                    }
                    onChange={(e) => {
                      setSelectedInterestScheduleId(
                        e.target.value
                      );

                      setInterestPaymentAmount(
                        ""
                      );

                      setError("");
                      setPaymentSuccess("");
                    }}
                    className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                    required
                  >
                    <option value="">
                      Select overdue installment
                    </option>

                    {overdueInterestSchedules.map(
                      (schedule) => {
                        const interestOutstanding =
                          getOutstandingInterestForSchedule(
                            schedule.id
                          );

                        return (
                          <option
                            key={schedule.id}
                            value={schedule.id}
                          >
                            #
                            {
                              schedule.installment_number
                            }{" "}
                            —{" "}
                            {schedule.due_date}{" "}
                            — Interest ZMW{" "}
                            {interestOutstanding.toFixed(
                              2
                            )}
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>

                {/* Interest Amount */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Interest Payment Amount
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={
                      selectedInterestScheduleId
                        ? Number(
                            selectedInterestOutstanding.toFixed(
                              2
                            )
                          )
                        : undefined
                    }
                    value={
                      interestPaymentAmount
                    }
                    onChange={(e) => {
                      setInterestPaymentAmount(
                        e.target.value
                      );

                      setError("");
                      setPaymentSuccess("");
                    }}
                    className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                    placeholder={
                      selectedInterestScheduleId
                        ? selectedInterestOutstanding.toFixed(
                            2
                          )
                        : "0.00"
                    }
                    required
                  />

                  {selectedInterestScheduleId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Maximum payment: ZMW{" "}
                      {selectedInterestOutstanding.toFixed(
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
                    value={
                      interestPaymentMethod
                    }
                    onChange={(e) =>
                      setInterestPaymentMethod(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                    required
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
                    value={
                      interestReferenceNumber
                    }
                    onChange={(e) =>
                      setInterestReferenceNumber(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                    placeholder="Optional"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Notes
                  </label>

                  <input
                    type="text"
                    value={
                      interestPaymentNotes
                    }
                    onChange={(e) =>
                      setInterestPaymentNotes(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                    placeholder="Optional interest payment notes"
                  />
                </div>

                {/* Submit */}
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={
                      savingInterestPayment
                    }
                    className="rounded-lg bg-red-600 px-6 py-3 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {savingInterestPayment
                      ? "Recording Interest Payment..."
                      : "Pay Overdue Interest"}
                  </button>
                </div>

              </form>

            </section>
          )}

        {/* Payment Schedule */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">

          <div className="border-b p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Payment Schedule
            </h2>
          </div>

          {schedules.length === 0 ? (
            <div className="p-6 text-gray-500">
              No payment schedule found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-4 text-gray-900">
                      Installment
                    </th>

                    <th className="p-4 text-gray-900">
                      Due Date
                    </th>

                    <th className="p-4 text-gray-900">
                      Expected
                    </th>

                    <th className="p-4 text-gray-900">
                      Paid
                    </th>

                    <th className="p-4 text-gray-900">
                      Remaining
                    </th>

                    <th className="p-4 text-gray-900">
                      Overdue Interest
                    </th>

                    <th className="p-4 text-gray-900">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {schedules.map(
                    (schedule) => {

                      const remaining =
                        Math.max(
                          Number(
                            schedule.expected_amount
                          ) -
                            Number(
                              schedule.paid_amount ||
                                0
                            ),
                          0
                        );

                      const interestOutstanding =
                        getOutstandingInterestForSchedule(
                          schedule.id
                        );

                      return (
                        <tr
                          key={schedule.id}
                          className="border-b"
                        >

                          <td className="p-4 text-gray-900">
                            #
                            {
                              schedule.installment_number
                            }
                          </td>

                          <td className="p-4 text-gray-900">
                            {schedule.due_date}
                          </td>

                          <td className="p-4 text-gray-900">
                            ZMW{" "}
                            {Number(
                              schedule.expected_amount
                            ).toFixed(2)}
                          </td>

                          <td className="p-4 text-gray-900">
                            ZMW{" "}
                            {Number(
                              schedule.paid_amount ||
                                0
                            ).toFixed(2)}
                          </td>

                          <td className="p-4 text-gray-900">
                            ZMW{" "}
                            {remaining.toFixed(2)}
                          </td>

                          <td className="p-4 text-gray-900">
                            ZMW{" "}
                            {interestOutstanding.toFixed(
                              2
                            )}
                          </td>

                          <td className="p-4 capitalize text-gray-900">
                            {schedule.status}
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

        {/* Payment History */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">

          <div className="border-b p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Payment History
            </h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-6 text-gray-500">
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-4 text-gray-900">
                      Amount
                    </th>

                    <th className="p-4 text-gray-900">
                      Type
                    </th>

                    <th className="p-4 text-gray-900">
                      Installment
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

                  </tr>
                </thead>

                <tbody>

                  {payments.map(
                    (payment) => {

                      const paymentSchedule =
                        schedules.find(
                          (schedule) =>
                            schedule.id ===
                            payment.schedule_id
                        );

                      return (
                        <tr
                          key={payment.id}
                          className="border-b"
                        >

                          <td className="p-4 font-medium text-gray-900">
                            ZMW{" "}
                            {Number(
                              payment.amount
                            ).toFixed(2)}
                          </td>

                          <td className="p-4 capitalize text-gray-900">
                            {payment.payment_type ===
                            "overdue_interest"
                              ? "Overdue Interest"
                              : "Installment"}
                          </td>

                          <td className="p-4 text-gray-900">
                            {paymentSchedule
                              ? `#${paymentSchedule.installment_number}`
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
                            {payment.reference_number ??
                              "—"}
                          </td>

                          <td className="p-4 text-gray-900">
                            {new Date(
                              payment.payment_date
                            ).toLocaleString()}
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

        {/* Notes */}
        {loan.notes && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-gray-900">
              Notes
            </h2>

            <p className="mt-3 text-gray-600">
              {loan.notes}
            </p>

          </section>
        )}

      </div>
    </main>
  );
}

