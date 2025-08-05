"use client";
import { dataUtils, debounce } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import NutritionGrid from "../common/NutritionGrid";
import ConcernsSummary from "../common/ConcernSummary";
import PaginationCTA from "./PaginationCTA";
import SearchBar from "./Searchbar";
import HealthBadge from "../common/HealthBage";

interface ScannedResult {
  timestamp: string;
  productName: string;
  expiryDate: string;
  healthScore: number;
  concerns: string[];
  recommendedPortion: any;
  nutritionPerPortion: any;
  scanId: string;
}

interface ApiResponse {
  results: ScannedResult[];
  total: number;
  hasMore: boolean;
  pagination: {
    limit: number;
    offset: number;
    currentPage: number;
    totalPages: number;
  };
}

interface ScannedResultsListProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const ScannedResultsList: React.FC<ScannedResultsListProps> = ({
  isOpen = true,
  onToggle,
}) => {
  const [results, setResults] = useState<ScannedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  // const [deleting, setDeleting] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 5;

  const fetchResults = async (page: number = 1, search: string = "") => {
    try {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * ITEMS_PER_PAGE;
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: offset.toString(),
      });

      if (search.trim()) {
        params.append("productName", search.trim());
      }

      const response = await fetch(`/api/analyze?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data: ApiResponse = await response.json();
      setResults(data.results);
      setTotalPages(data.pagination.totalPages);
      setTotalResults(data.total);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // const handleDelete = async (scanId: string) => {
  //   if (!confirm("Are you sure you want to delete this result?")) {
  //     return;
  //   }

  //   try {
  //     setDeleting(scanId);
  //     const response = await fetch(`/api/analyze?scanId=${scanId}`, {
  //       method: "DELETE",
  //     });

  //     if (!response.ok) {
  //       throw new Error("Failed to delete result");
  //     }

  //     // Refresh the current page
  //     await fetchResults(currentPage, searchTerm);
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : "Failed to delete result");
  //   } finally {
  //     setDeleting(null);
  //   }
  // };

  const handleSearch = useCallback(
    debounce((val: string) => {
      setSearchTerm(val);
      setCurrentPage(1);
      fetchResults(1, val);
    }, 500),
    [searchTerm]
  );

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
    fetchResults(1, "");
  };

  const handlePageChange = (page: number) => {
    fetchResults(page, searchTerm);
  };

  useEffect(() => {
    fetchResults();
  }, []);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          w-full h-[100dvh] max-w-sm bg-sidebar text-sidebar-foreground 
          fixed top-0 right-0 z-50 overflow-y-auto border-l
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="p-4 sticky top-0 bg-sidebar space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Scanned Food Products</h1>
              <p className="text-muted-foreground text-sm">
                All scanned food analysis history
              </p>
            </div>
            {/* Close Button */}
            {onToggle && (
              <button
                onClick={onToggle}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Close sidebar"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <SearchBar
            onSearchChange={(val) => {
              handleSearch(val);
            }}
            onClear={handleClearSearch}
            loading={loading}
          />

          {/* Results Summary */}
          {!loading && (
            <div className="flex justify-between items-center text-xs">
              <p className="text-muted-foreground">
                Showing {results.length} of {totalResults} results
                {searchTerm && (
                  <span className="font-medium"> for "{searchTerm}"</span>
                )}
              </p>
              <button
                onClick={() => fetchResults(currentPage, searchTerm)}
                className="text-primary hover:text-primary/80 font-medium"
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        <div className="px-4">
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-4">
            {results.length === 0 && !loading ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No results found
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "Try adjusting your search terms"
                    : "Start by scanning your first food product!"}
                </p>
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.scanId}
                  className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-xl transition-shadow text-sm"
                >
                  <div className="p-3 space-y-2">
                    <div className="flex flex-col items-start">
                      <div className="space-y-2">
                        <h3 className="text-base leading-none font-bold text-card-foreground mb-1">
                          {dataUtils.safeGet(
                            result.productName,
                            "Unknown Product"
                          )}
                        </h3>
                        <div className="flex justify-between">
                          <HealthBadge
                            score={dataUtils.getSafeHealthScore(
                              result.healthScore
                            )}
                          />
                          <p className="text-xs text-muted-foreground">
                            {dataUtils.formatDate(result.timestamp)}
                          </p>
                        </div>
                        {result.expiryDate !== "Not available" &&
                          result.expiryDate !== "Not visible" && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Expires: {result.expiryDate}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {/* Nutrition Info */}
                      <div>
                        <h4 className="font-semibold text-card-foreground mb-3 flex items-center">
                          <div className="w-2 h-4 bg-section-nutrition rounded-full mr-2"></div>
                          Recommended Portion:{" "}
                          {dataUtils.formatRecommendedPortion(
                            result.recommendedPortion
                          )}
                        </h4>
                        <NutritionGrid
                          nutritionData={result.nutritionPerPortion}
                          size="sm"
                        />
                      </div>

                      {/* Health Concerns */}
                      <div>
                        <h4 className="font-semibold text-card-foreground mb-3 flex items-center">
                          <div className="w-2 h-4 bg-section-concerns rounded-full mr-2"></div>
                          Health Concerns
                        </h4>
                        <ConcernsSummary concerns={result.concerns} />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="mt-8">
            <PaginationCTA
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default ScannedResultsList;
