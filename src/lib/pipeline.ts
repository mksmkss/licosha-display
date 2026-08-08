import {
  loadWorkbook,
  toXlsxBlob,
  integerationGetPlatesList,
  integerationGetDescriptionList,
  integerationGetUuidList,
  integerationGetIdsDict,
  integerationGetPermissionDict,
  tagGetPlatesList,
  qrcodeGetIdList,
  descriptionGetDescriptionList,
} from "./excel";
import { generateCaptionPdf } from "./pdf/caption";
import { generateTagPdf } from "./pdf/tag";
import { generateQrSheetPdf } from "./pdf/qrSheet";
import { generateDescriptionPdf } from "./pdf/description";
import { mergePdfs } from "./pdf/merge";
import { buildOutputZip } from "./zip";
import { loadIconSvg } from "./assets";

export interface GenerateParams {
  file: File;
  year: string;
  exhibitionTitle: string;
  showDataMatrix: boolean;
  /** Size (mm, square) of the SNS QR codes drawn in each Caption PDF card. */
  snsQrSizeMm: number;
  onProgress: (message: string) => void;
}

export interface GenerateResult {
  zipBlob: Blob;
  zipFileName: string;
}

/**
 * The full generation pipeline, ported from `gui_2.py`'s `Process()`
 * (which calls, in order: Integeration.generate_caption_pdf, then
 * Tag/QRcode/Description generation, then merge_pdfs). Kept in its own
 * module — separate from main.ts's form wiring — so Vite code-splits it
 * into a chunk that only loads once the user actually submits the form,
 * instead of bundling xlsx/pdf-lib/bwip-js/budoux/jszip into the initial
 * page load.
 */
export async function runGenerationPipeline(params: GenerateParams): Promise<GenerateResult> {
  const { file, year, exhibitionTitle, showDataMatrix, snsQrSizeMm, onProgress } = params;

  onProgress("Excelを読み込んでいます...");
  // Each module gets its own workbook parse, mirroring how the Python app's
  // modules each independently re-read the file from disk (only the uuid
  // persistence is intentionally shared state — see excel.ts).
  const [integerationWb, tagWb, qrcodeWb, descriptionWb] = await Promise.all([
    loadWorkbook(file),
    loadWorkbook(file),
    loadWorkbook(file),
    loadWorkbook(file),
  ]);

  onProgress("アイコンを読み込んでいます...");
  const [instagramSvg, xSvg, cameraOffSvg] = await Promise.all([
    loadIconSvg("instagram"),
    loadIconSvg("x"),
    loadIconSvg("cameraOff"),
  ]);

  onProgress("キャプションPDFを生成しています...");
  const { plates, pennameToName } = integerationGetPlatesList(integerationWb);
  const descriptions = integerationGetDescriptionList(integerationWb);
  const uuids = integerationGetUuidList(integerationWb);
  const idsDict = integerationGetIdsDict(integerationWb, pennameToName);
  const permissionDict = integerationGetPermissionDict(integerationWb);

  const captionResult = await generateCaptionPdf({
    plates,
    descriptions,
    idsDict,
    permissionDict,
    uuids,
    showDataMatrix,
    assets: { instagramSvg, xSvg, cameraOffSvg },
    snsQrSizeMm,
  });

  onProgress("名札PDFを生成しています...");
  const tagPlates = tagGetPlatesList(tagWb);
  const tagPages = await generateTagPdf(tagPlates);

  onProgress("QRコードシートPDFを生成しています...");
  const idList = [...qrcodeGetIdList(qrcodeWb, "instagram"), ...qrcodeGetIdList(qrcodeWb, "twitter")];
  const qrSheetResult = await generateQrSheetPdf(idList, { instagramSvg, xSvg });

  onProgress("説明PDFを生成しています...");
  const descriptionOnlyList = descriptionGetDescriptionList(descriptionWb);
  const descriptionPages = await generateDescriptionPdf(descriptionOnlyList);

  onProgress("PDFを結合しています...");
  const mergedCaptionPdf = await mergePdfs(captionResult.pages);
  const mergedFileName = `${year}_${exhibitionTitle}.pdf`;

  onProgress("Excel（uuid列更新済み）を書き出しています...");
  const updatedXlsx = toXlsxBlob(integerationWb);

  onProgress("ZIPにまとめています...");
  const zipBlob = await buildOutputZip({
    captionPages: captionResult.pages,
    tagPages,
    qrSheetPages: qrSheetResult.pages,
    descriptionPages,
    captionQrImages: captionResult.qrImages,
    qrSheetQrImages: qrSheetResult.qrImages,
    dataMatrixImages: captionResult.dataMatrixImages,
    mergedCaptionPdf,
    mergedFileName,
    updatedXlsx,
    xlsxFileName: file.name,
  });

  return { zipBlob, zipFileName: `${year}_${exhibitionTitle}.zip` };
}
