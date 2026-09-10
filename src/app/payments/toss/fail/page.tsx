import Link from "next/link";

export default async function TossPaymentFailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message =
    typeof params.message === "string"
      ? params.message
      : "카드 결제가 취소되었거나 실패했습니다.";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 text-center shadow-xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-destructive">
          PAYMENT FAILED
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          결제를 완료하지 못했습니다
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground"
        >
          로그인 화면으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
