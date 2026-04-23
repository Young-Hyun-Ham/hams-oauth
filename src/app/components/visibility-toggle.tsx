"use client";

import { useId, useState } from "react";

export function VisibilityToggle({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const inputId = useId();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-900">노출여부</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {checked ? "현재 ON" : "현재 OFF"}
        </span>
      </div>

      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100/80"
      >
        <input type="hidden" name={`${name}__present`} value="1" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            {checked ? "서비스 노출" : "서비스 숨김"}
          </p>
          <p className="text-xs text-slate-500">
            {checked
              ? "로그인 화면의 서비스 목록에 노출됩니다."
              : "로그인 화면의 서비스 목록에서 숨겨집니다."}
          </p>
        </div>

        <div className="relative shrink-0">
          <input
            id={inputId}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="sr-only"
          />
          <span
            className={`flex h-8 w-16 items-center rounded-full p-1 transition ${
              checked ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${
                checked ? "translate-x-8" : "translate-x-0"
              }`}
            />
          </span>
        </div>
      </label>
    </div>
  );
}
