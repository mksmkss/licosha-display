import JSZip from "jszip";

/**
 * Assembles the final downloadable ZIP. Mirrors the folder structure
 * `gui_2.py`'s `Process()` creates on disk (`mkdir_list`): QRcode,
 * Tag PDF, QRcode PDF, Description PDF, Caption PDF, Data Matrix — plus
 * the merged Caption PDF and the uuid-updated Excel file at the root
 * (the Python app overwrote the *input* Excel file in place instead,
 * which a browser can't do to a user-picked file; see excel.ts).
 */
export interface ZipInputs {
  captionPages: Map<string, Uint8Array>;
  tagPages: Map<string, Uint8Array>;
  qrSheetPages: Map<string, Uint8Array>;
  descriptionPages: Map<string, Uint8Array>;
  /** "mono white" QR PNGs from Caption generation, written first. */
  captionQrImages: Map<string, Uint8Array>;
  /**
   * "colored blue" QR PNGs from the QRcode-sheet generation. In the
   * original app this runs after Caption generation and overwrites the
   * same `QRcode/<sns>_<id>.png` paths — replicated here by merging this
   * map over `captionQrImages` for any matching filename.
   */
  qrSheetQrImages: Map<string, Uint8Array>;
  dataMatrixImages: Map<string, Uint8Array>;
  mergedCaptionPdf: Uint8Array;
  mergedFileName: string;
  updatedXlsx: Blob;
  xlsxFileName: string;
}

export async function buildOutputZip(inputs: ZipInputs): Promise<Blob> {
  const zip = new JSZip();

  const qrFolder = zip.folder("QRcode");
  if (!qrFolder) throw new Error("Failed to create QRcode/ folder in zip");
  for (const [name, bytes] of inputs.captionQrImages) qrFolder.file(name, bytes);
  for (const [name, bytes] of inputs.qrSheetQrImages) qrFolder.file(name, bytes);

  const folders: Array<[string, Map<string, Uint8Array>]> = [
    ["Caption PDF", inputs.captionPages],
    ["Tag PDF", inputs.tagPages],
    ["QRcode PDF", inputs.qrSheetPages],
    ["Description PDF", inputs.descriptionPages],
    ["Data Matrix", inputs.dataMatrixImages],
  ];
  for (const [folderName, files] of folders) {
    const folder = zip.folder(folderName);
    if (!folder) throw new Error(`Failed to create ${folderName}/ folder in zip`);
    for (const [name, bytes] of files) folder.file(name, bytes);
  }

  zip.file(inputs.mergedFileName, inputs.mergedCaptionPdf);
  zip.file(inputs.xlsxFileName, inputs.updatedXlsx);

  return zip.generateAsync({ type: "blob" });
}
