import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function usePagination(items = [], initialPageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const totalItems = Array.isArray(items) ? items.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  const startIndex = (safePage - 1) * pageSize;
  const paginatedItems = Array.isArray(items)
    ? items.slice(startIndex, startIndex + pageSize)
    : [];

  const handlePageChange = (page) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return {
    currentPage: safePage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    onPageChange: handlePageChange,
    onPageSizeChange: handlePageSizeChange,
    resetPage: () => setCurrentPage(1),
  };
}

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25],
  compact = false,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // If there are no items, or only 1 page in compact mode without size switcher, hide controls
  if (totalItems === 0 || (totalItems <= pageSize && !onPageSizeChange && compact)) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage, '...', totalPages];
  };

  return (
    <div className={`pagination-container ${compact ? 'pagination-compact' : ''} ${className}`}>
      <div className="pagination-info">
        Showing <span className="pagination-highlight">{startItem}</span>–<span className="pagination-highlight">{endItem}</span> of <span className="pagination-highlight">{totalItems}</span>
      </div>

      <div className="pagination-controls">
        {onPageSizeChange && pageSizeOptions?.length > 1 && (
          <div className="pagination-page-size">
            <span className="pagination-size-label">Rows:</span>
            <select
              className="form-select pagination-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Select rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}

        <div className="pagination-buttons">
          <button
            type="button"
            className="btn-pagination-nav"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            {!compact && <span className="pagination-nav-text">Prev</span>}
          </button>

          {!compact && (
            <div className="pagination-pages">
              {getPageNumbers().map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`pagination-page-btn ${p === currentPage ? 'active' : ''}`}
                    onClick={() => onPageChange(p)}
                    aria-current={p === currentPage ? 'page' : undefined}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          )}

          {compact && (
            <span className="pagination-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
          )}

          <button
            type="button"
            className="btn-pagination-nav"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            {!compact && <span className="pagination-nav-text">Next</span>}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

