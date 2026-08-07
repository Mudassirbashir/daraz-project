"use client";

import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Image as ImageIcon } from "lucide-react";
import { ProductImage } from "./ProductImage";

interface ImageGalleryModalProps {
  images: string[];
  initialIndex?: number;
  productTitle: string;
  onClose: () => void;
}

export function ImageGalleryModal({
  images = [],
  initialIndex = 0,
  productTitle,
  onClose,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(
    initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0
  );
  const [isZoomed, setIsZoomed] = useState(false);

  if (!images || images.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setIsZoomed(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setIsZoomed(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 select-none">
      {/* Top Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 text-white">
        <div className="flex items-center space-x-2">
          <ImageIcon className="h-5 w-5 text-orange-400" />
          <span className="font-bold text-sm truncate max-w-md">{productTitle}</span>
          <span className="text-xs text-slate-400 font-mono">
            ({currentIndex + 1} of {images.length})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            title={isZoomed ? "Zoom Out" : "Zoom In"}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
          >
            {isZoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </button>

          <button
            onClick={onClose}
            title="Close Lightbox"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative flex items-center justify-center w-full max-w-4xl h-[75vh] px-12">
        {images.length > 1 && (
          <button
            onClick={handlePrev}
            title="Previous Image"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div
          className={`relative max-h-full max-w-full flex items-center justify-center transition-transform duration-200 ${
            isZoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in"
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <ProductImage
            src={images[currentIndex]}
            alt={`${productTitle} - Image ${currentIndex + 1}`}
            className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl"
            fallbackIconClassName="h-16 w-16 text-slate-500"
          />
        </div>

        {images.length > 1 && (
          <button
            onClick={handleNext}
            title="Next Image"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Thumbnails Navigation */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 overflow-x-auto max-w-full px-4 py-2 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-md">
          {images.map((imgUrl, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setIsZoomed(false);
              }}
              className={`h-12 w-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                currentIndex === idx ? "border-orange-500 scale-105" : "border-slate-700 opacity-50 hover:opacity-100"
              }`}
            >
              <ProductImage src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
