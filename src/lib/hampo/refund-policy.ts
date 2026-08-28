const KOREA_TIME_ZONE = "Asia/Seoul";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type ProratedRefundCalculation = {
  originalAmount: number;
  usedDays: number;
  daysInMonth: number;
  usedAmount: number;
  refundAmount: number;
};

function getCalendarDate(value: string | Date): CalendarDate | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

function toUtcDay(date: CalendarDate) {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function calculateProratedHampoRefund(
  amount: number,
  purchasedAt: string,
  completedAt: string | Date = new Date(),
): ProratedRefundCalculation {
  const originalAmount = Math.max(0, Math.floor(amount));
  const purchaseDate = getCalendarDate(purchasedAt);
  const completionDate = getCalendarDate(completedAt);

  if (!purchaseDate || !completionDate || originalAmount === 0) {
    return {
      originalAmount,
      usedDays: 0,
      daysInMonth: 0,
      usedAmount: originalAmount,
      refundAmount: 0,
    };
  }

  const daysInMonth = new Date(
    Date.UTC(purchaseDate.year, purchaseDate.month, 0),
  ).getUTCDate();
  const elapsedDays = Math.floor(
    (toUtcDay(completionDate) - toUtcDay(purchaseDate)) / 86_400_000,
  );
  const usedDays = Math.min(daysInMonth, Math.max(1, elapsedDays + 1));
  const refundAmount = Math.floor(
    (originalAmount * Math.max(0, daysInMonth - usedDays)) / daysInMonth,
  );

  return {
    originalAmount,
    usedDays,
    daysInMonth,
    usedAmount: originalAmount - refundAmount,
    refundAmount,
  };
}
