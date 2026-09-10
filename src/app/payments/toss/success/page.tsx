import { PaymentConfirmation } from "./payment-confirmation";

export default async function TossPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === "string" ? params[key] : "";
  return (
    <PaymentConfirmation
      paymentKey={value("paymentKey")}
      orderId={value("orderId")}
      amount={value("amount")}
    />
  );
}
