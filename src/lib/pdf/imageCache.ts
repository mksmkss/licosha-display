import type { PDFDocument, PDFImage } from "pdf-lib";

/** Avoids re-embedding the same PNG bytes multiple times within one PDFDocument. */
export class PngImageCache {
  private cache = new Map<string, Promise<PDFImage>>();
  private doc: PDFDocument;

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  get(key: string, bytes: Uint8Array): Promise<PDFImage> {
    let cached = this.cache.get(key);
    if (!cached) {
      cached = this.doc.embedPng(bytes);
      this.cache.set(key, cached);
    }
    return cached;
  }
}
