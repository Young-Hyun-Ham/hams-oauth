"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ServiceAccessLink({
  href,
  blockBeforeLogin,
  children,
  className,
}: {
  href: string;
  blockBeforeLogin: boolean;
  children: ReactNode;
  className: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      <a
        href={href || "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!href}
        onClick={(event) => {
          if (blockBeforeLogin) {
            event.preventDefault();
            setIsModalOpen(true);
          }
        }}
        className={className}
      >
        {children}
      </a>

      {isMounted && isModalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-login-modal-title"
            >
              <div className="w-full max-w-sm rounded-[2rem] border-2 border-primary/30 bg-background p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
                  🔒
                </div>
                <h3
                  id="service-login-modal-title"
                  className="mt-4 text-2xl font-semibold text-foreground"
                >
                  로그인이 필요합니다
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  이 서비스는 로그인 후 이동할 수 있습니다.
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setIsModalOpen(false)}
                  className="mt-6 w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/90"
                >
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
