"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useObjectStore } from "@/hooks/useObjectStore";

/**
 * Thanh phân trang — hiển thị số trang, nút trước/sau, và nhảy nhanh.
 *
 * Responsive:
 *   - Desktop: đầy đủ danh sách số trang + First/Last
 *   - Mobile: rút gọn — chỉ nút ‹ › + "Trang X / Y"
 */
export function Pagination() {
  const {
    page,
    totalPages,
    isLastPage,
    hasMore,
    isLoading,
    isLoadingMore,
    searchQuery,
    totalCount,
    gridLimit,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
  } = useObjectStore();

  const isSearching = !!(searchQuery || "").trim();
  // Đã biết chính xác tổng số trang khi: search hoặc đã đếm được tổng object
  const totalKnown = isLastPage || isSearching || totalCount !== null;

  // Không có gì để phân trang
  if (totalPages <= 1 && !hasMore) return null;

  /** Tạo danh sách số trang hiển thị (có "…" cho các trang bị ẩn). */
  const buildPages = (): (number | "gap")[] => {
    const total = totalPages;
    const cur = page;
    const out: (number | "gap")[] = [];

    const push = (n: number | "gap") => out.push(n);

    if (total <= 7) {
      for (let i = 1; i <= total; i++) push(i);
      return out;
    }

    // Luôn hiện: 1, total, và ±1 quanh trang hiện tại
    push(1);
    if (cur > 3) push("gap");
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) push(i);
    if (cur < total - 2) push("gap");
    push(total);
    return out;
  };

  const pages = buildPages();

  const btnBase =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const btnIdle =
    "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200";
  const btnActive =
    "bg-indigo-500 text-white hover:bg-indigo-600 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-600";

  const canPrev = page > 1 && !isLoading && !isLoadingMore;
  const canNext = (hasMore || page < totalPages) && !isLoading && !isLoadingMore;

  const rangeStart = (page - 1) * gridLimit + 1;
  const rangeEnd = isSearching
    ? Math.min(page * gridLimit, totalCount ?? 0)
    : page * gridLimit;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 pb-2">
      {/* Thông tin range */}
      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 order-2 sm:order-1 text-center sm:text-left">
        {isSearching ? (
          <>
            Hiển thị{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            trong tổng{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
              {(totalCount ?? 0).toLocaleString("de-DE")}
            </span>{" "}
            kết quả
          </>
        ) : (
          <>
            Trang{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
              {page}
            </span>{" "}
            {totalKnown ? (
              <>
                /{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                  {totalPages}
                </span>
              </>
            ) : (
              <>
                /{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">?</span>
                <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                  (đang tìm trang cuối…)
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Nút điều hướng */}
      <div className="flex items-center justify-center gap-1 order-1 sm:order-2">
        {/* First */}
        <button
          type="button"
          onClick={() => void firstPage()}
          disabled={!canPrev}
          className={`${btnBase} ${btnIdle} h-9 w-9 hidden sm:inline-flex`}
          title="Trang đầu"
          aria-label="Trang đầu"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Prev */}
        <button
          type="button"
          onClick={() => void prevPage()}
          disabled={!canPrev}
          className={`${btnBase} ${btnIdle} h-9 w-9`}
          title="Trang trước"
          aria-label="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Số trang — ẩn trên mobile, hiện từ sm trở lên */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === "gap" ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-sm text-gray-400 dark:text-gray-500 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => void goToPage(p)}
                disabled={isLoading || isLoadingMore}
                className={`${btnBase} h-9 min-w-9 px-2 tabular-nums ${
                  p === page ? btnActive : btnIdle
                }`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>

        {/* Nút next */}
        <button
          type="button"
          onClick={() => void nextPage()}
          disabled={!canNext}
          className={`${btnBase} ${btnIdle} h-9 w-9`}
          title="Trang sau"
          aria-label="Trang sau"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last */}
        <button
          type="button"
          onClick={() => void lastPage()}
          disabled={!canNext || !totalKnown}
          className={`${btnBase} ${btnIdle} h-9 w-9 hidden sm:inline-flex`}
          title="Trang cuối"
          aria-label="Trang cuối"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Nhãn trang cho mobile */}
      <div className="order-3 sm:order-3 flex sm:hidden items-center justify-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          Trang {page}
          {totalKnown ? ` / ${totalPages}` : ""}
        </span>
        {totalKnown && totalPages > 1 && (
          <button
            type="button"
            onClick={() => void lastPage()}
            disabled={!canNext || isLoading}
            className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer disabled:opacity-40 shrink-0"
            title="Tới trang cuối"
          >
            Cuối
          </button>
        )}
      </div>
    </div>
  );
}
