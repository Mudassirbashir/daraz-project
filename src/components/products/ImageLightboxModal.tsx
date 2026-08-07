"use client";

import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Image as ImageIcon } from "lucide-react";
import { ProductImage } from "./ProductImage";

interface ImageLightboxModalProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageLightboxModal({ images, initialIndex = 0, onClose }: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!images || images.length === 0) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoomLevel(1);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col items-center justify-between p-4 space-y-4">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between text-white border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-mono">
            <ImageIcon className="h-4 w-4 text-orange-500" />
            <span>
              Image {currentIndex + 1} of {images.length}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleZoomOut}
              className="rounded-lg p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <span className="text-xs font-mono text-slate-400">{Math.round(zoomLevel * 100)}%</span>

            <button
              onClick={handleZoomIn}
              className="rounded-lg p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 bg-red-600/80 text-white hover:bg-red-600 transition-colors ml-4"
              title="Close Gallery"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Display Area */}
        <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
          {images.length > 1 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 z-10 rounded-full p-2.5 bg-slate-900/80 text-white hover:bg-slate-800 transition-colors shadow-lg border border-slate-700"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div className="h-full w-full flex items-center justify-center p-2 overflow-auto">
            <div style={{ transform: `scale(${zoomLevel})` }} className="max-h-full max-w-full flex items-center justify-center transition-transform duration-200">
              <ProductImage
                src={images[currentIndex]}
                alt="High Resolution Preview"
                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                fallbackIconClassName="h-16 w-16 text-slate-500"
              />
            </div>
          </div>

          {images.length > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 rounded-full p-2.5 bg-slate-900/80 text-white hover:bg-slate-800 transition-colors shadow-lg border border-slate-700"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 pt-1 max-w-full">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoomLevel(1);
                }}
                className={`h-16 w-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                  currentIndex === idx
                    ? "border-orange-500 ring-4 ring-orange-500/30 scale-105"
                    : "border-slate-700 opacity-50 hover:opacity-100"
                }`}
              >
                <ProductImage src={imgUrl} alt="Thumbnail" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
