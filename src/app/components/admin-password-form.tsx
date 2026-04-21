"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { changeAdminPassword } from "@/app/actions/admin";

function PasswordField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={4}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          placeholder={placeholder}
        />
        {value ? (
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
            aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        ) : null}
      </div>
    </label>
  );
}

export function AdminPasswordForm() {
  return (
    <form action={changeAdminPassword} className="mt-6 grid gap-4 md:grid-cols-2">
      <PasswordField
        name="nextAdminPassword"
        label="새 관리자 비밀번호"
        placeholder="4자 이상"
      />
      <PasswordField
        name="confirmAdminPassword"
        label="비밀번호 확인"
        placeholder="한 번 더 입력"
      />
      <div className="md:col-span-2">
        <button
          type="submit"
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          관리자 비밀번호 저장
        </button>
      </div>
    </form>
  );
}
