"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UseDebouncedSearchParamOptions = {
  paramName?: string;
  delayMs?: number;
};

export function useDebouncedSearchParam({
  paramName = "search",
  delayMs = 300,
}: UseDebouncedSearchParamOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const trimmedValue = value.trim();
      const currentValue = searchParams.get(paramName)?.trim() ?? "";

      if (trimmedValue === currentValue) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());

      if (trimmedValue) {
        params.set(paramName, trimmedValue);
      } else {
        params.delete(paramName);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, paramName, pathname, router, searchParams, value]);

  function clearValue() {
    setValue("");
  }

  return {
    value,
    setValue,
    clearValue,
    normalizedValue: value.trim(),
  };
}
