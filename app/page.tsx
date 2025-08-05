"use client";
import { useState } from "react";
import EatRi8 from "./components/EatRi8";
import ScannedResultsList from "./components/ScannedResults";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const openSidebar = () => {
    setSidebarOpen(true);
  };

  return (
    <div className="h-[100dvh] grid place-items-center relative bg-black/60">
      {/* Main Content Area */}
      <EatRi8 isOpen={sidebarOpen} />

      {/* Floating Action Button - Show when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={openSidebar}
          className="fixed top-4 right-4 z-30 bg-accent hover:bg-primary/90 hover:text-primary-foreground text-accent-foreground p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105 anim"
          aria-label="Open scanned results"
        >
          <svg
            className="w-6 h-6"
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
        </button>
      )}
      <div className="w-full h-full opacity-50 blur-md fixed left-0  bottom-0  -z-10 overflow-hidden">
        <img
          src={"/bg.png"}
          alt=""
          className="w-full h-full object-cover object-center "
        />
      </div>
      {/* Alternative: Bottom floating button */}
      {/* {!sidebarOpen && (
        <button
          onClick={openSidebar}
          className="fixed bottom-6 right-6 z-30 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
          aria-label="View scanned results"
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm font-medium">View Results</span>
        </button>
      )} */}

      {/* Sidebar */}
      <ScannedResultsList isOpen={sidebarOpen} onToggle={toggleSidebar} />
    </div>
  );
}
