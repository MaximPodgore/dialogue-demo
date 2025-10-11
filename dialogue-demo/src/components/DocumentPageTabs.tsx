"use client";
import React from "react";

interface DocumentPageTabsProps {
  pageNames: string[];
  currentPage: string;
  onSelect: (pageName: string) => void;
}

export default function DocumentPageTabs({ pageNames, currentPage, onSelect }: DocumentPageTabsProps) {
  return (
    <div className="flex gap-2 mb-4">
      {pageNames.map((name) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={`px-4 py-2 rounded font-medium transition-all duration-150 ${
            currentPage === name
              ? "bg-gray-200 text-gray-800"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
        >
          {name.replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
}
