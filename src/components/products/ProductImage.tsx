"use client";

import React, { useState } from "react";
import { Package } from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackIconClassName?: string;
  onClick?: () => void;
}

export function ProductImage({
  src,
  alt,
  className = "h-full w-full object-cover",
  fallbackIconClassName = "h-6 w-6 text-slate-300",
  onClick,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  // Protocol & URL normalization
  let normalizedSrc = "";
  if (src && typeof src === "string" && src.trim()) {
    normalizedSrc = src.trim();
    if (normalizedSrc.startsWith("//")) {
      normalizedSrc = `https:${normalizedSrc}`;
    } else if (normalizedSrc.startsWith("http://")) {
      normalizedSrc = normalizedSrc.replace("http://", "https://");
    }
  }

  if (!normalizedSrc || hasError) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/60 p-2 text-center text-slate-400 ${className} ${
          onClick ? "cursor-pointer" : ""
        }`}
      >
        <Package className={fallbackIconClassName} />
        <span className="text-[10px] font-medium text-slate-400 mt-1">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={`${className} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      onError={(e) => {
        console.warn(`[ProductImage] Failed to load image URL: "${normalizedSrc}" for item "${alt}"`, e);
        setHasError(true);
      }}
    />
  );
}
