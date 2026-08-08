import * as XLSX from "xlsx";

/**
 * Port of the Excel-reading helpers spread across
 * Integeration/functions.py, Tag/functions.py, QRcode/functions.py and
 * Description/functions.py in the original Python app. Each module in the
 * Python app re-read the .xlsx from disk independently; here we parse the
 * uploaded file once into an in-memory Workbook and every function below
 * operates on that shared state instead.
 */

const COL = {
  name: "お名前",
  title: "[写真の詳細] タイトル",
  description: "[写真の詳細] 説明",
  penname: "ペンネーム",
  instagram: "Instagramのアカウント",
  twitter: "Xのアカウント",
  permission: "来場者が撮影可能か",
  uuid: "uuid",
} as const;

export type CellValue = string | number | null;
export type Row = Record<string, CellValue>;

export interface Workbook {
  rows: Row[];
  headers: string[];
}

export class MissingColumnError extends Error {
  constructor(column: string) {
    super(
      `Excelの列名がずれています\n` +
        `「${column}」列が見つかりません。「お名前」,「[写真の詳細] タイトル」,` +
        `「[写真の詳細] 説明」,「ペンネーム」となっていることを確認してください`,
    );
    this.name = "MissingColumnError";
  }
}

function requireColumn(headers: string[], column: string): void {
  if (!headers.includes(column)) {
    throw new MissingColumnError(column);
  }
}

function isBlank(value: CellValue): boolean {
  return value === null || value === undefined || value === "";
}

/** Port of `toArray` (pipe-separated multi-value cell parsing). */
export function toArray(value: CellValue): string[] {
  if (isBlank(value)) return [""];
  return String(value).split("|");
}

export async function loadWorkbook(file: File): Promise<Workbook> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true });
  const [headerRow] = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    range: 0,
    blankrows: false,
  }) as unknown as string[][];
  return { rows, headers: (headerRow ?? []).map(String) };
}

/** Serializes the (possibly uuid-updated) workbook back to an .xlsx Blob. */
export function toXlsxBlob(wb: Workbook): Blob {
  const worksheet = XLSX.utils.json_to_sheet(wb.rows, { header: wb.headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export interface Plate {
  title: string;
  penname: string;
}

export type SnsKind = "instagram" | "twitter";

// ---------------------------------------------------------------------------
// Integeration/functions.py — used by the main Caption PDF
// ---------------------------------------------------------------------------

/**
 * Port of Integeration/functions.py `get_plates_list`. Also assigns/persists
 * a UUID per work directly onto `wb.rows` (mutates in place), mirroring the
 * Python version's `df.to_excel(excel_path)` round-trip — except here there
 * is no disk to round-trip through, so later reads of the "uuid" column
 * (see `integerationGetUuidList`) simply see the mutated in-memory rows.
 */
export function integerationGetPlatesList(wb: Workbook): {
  plates: Plate[];
  pennameToName: Record<string, string>;
} {
  requireColumn(wb.headers, COL.name);
  requireColumn(wb.headers, COL.title);
  requireColumn(wb.headers, COL.penname);
  if (!wb.headers.includes(COL.uuid)) {
    wb.headers = [...wb.headers, COL.uuid];
    for (const row of wb.rows) row[COL.uuid] = "";
  }

  const plates: Plate[] = [];
  const pennameToName: Record<string, string> = {};

  for (const row of wb.rows) {
    const titles = toArray(row[COL.title]);
    const worksNum = titles.length;
    const name = String(row[COL.name] ?? "");
    const penname = String(row[COL.penname] ?? "");

    const existingUuids = isBlank(row[COL.uuid]) ? "" : String(row[COL.uuid]);
    const existingUuidList = existingUuids ? existingUuids.split("|") : [];
    const newUuidCount = Math.max(0, worksNum - existingUuidList.length);
    const newUuids = Array.from({ length: newUuidCount }, () => crypto.randomUUID());
    const uuidList = [...existingUuidList, ...newUuids];

    for (let i = 0; i < worksNum; i++) {
      plates.push({ title: titles[i], penname });
      pennameToName[name] = penname;
    }

    row[COL.uuid] = uuidList.slice(0, worksNum).join("|");
  }

  return { plates, pennameToName };
}

/** Port of Integeration/functions.py `get_description_list`. */
export function integerationGetDescriptionList(wb: Workbook): string[] {
  requireColumn(wb.headers, COL.description);
  const list: string[] = [];
  for (const row of wb.rows) {
    const value = row[COL.description];
    if (isBlank(value)) {
      list.push("");
      continue;
    }
    for (const part of toArray(value)) {
      list.push(part);
    }
  }
  return list;
}

/**
 * Port of Integeration/functions.py `get_uuid_list`. Must be called after
 * `integerationGetPlatesList`, which is what actually generates/writes the
 * per-work UUIDs into `wb.rows`.
 */
export function integerationGetUuidList(wb: Workbook): string[] {
  const list: string[] = [];
  for (const row of wb.rows) {
    const value = row[COL.uuid];
    if (isBlank(value)) {
      list.push("");
    } else {
      for (const part of String(value).split("|")) list.push(part);
    }
  }
  return list;
}

/** Port of Integeration/functions.py `get_ids_dict`. */
export function integerationGetIdsDict(
  wb: Workbook,
  pennameToName: Record<string, string>,
): Record<string, [string, SnsKind][]> {
  requireColumn(wb.headers, COL.name);
  requireColumn(wb.headers, COL.instagram);
  requireColumn(wb.headers, COL.twitter);

  const idsDict: Record<string, [string, SnsKind][]> = {};
  for (const row of wb.rows) {
    const name = String(row[COL.name] ?? "");
    const penname = pennameToName[name];
    const ids: [string, SnsKind][] = [];
    if (!isBlank(row[COL.instagram])) ids.push([String(row[COL.instagram]), "instagram"]);
    if (!isBlank(row[COL.twitter])) ids.push([String(row[COL.twitter]), "twitter"]);
    idsDict[penname] = ids;
  }
  return idsDict;
}

/** Port of Integeration/functions.py `get_permission_dict`. */
export function integerationGetPermissionDict(wb: Workbook): Record<string, string> {
  requireColumn(wb.headers, COL.penname);
  requireColumn(wb.headers, COL.permission);
  const dict: Record<string, string> = {};
  for (const row of wb.rows) {
    dict[String(row[COL.penname] ?? "")] = String(row[COL.permission] ?? "");
  }
  return dict;
}

// ---------------------------------------------------------------------------
// Tag/functions.py — used by the Tag PDF
// ---------------------------------------------------------------------------

/**
 * Port of Tag/functions.py `get_plates_list`. Unlike the Integeration
 * version, this tries to split `penname` per-work too, falling back to the
 * whole-row penname when the split count doesn't match the number of works
 * ("pennameを記入してくれない問題児くんがいた時用" in the original comment).
 */
export function tagGetPlatesList(wb: Workbook): Plate[] {
  requireColumn(wb.headers, COL.name);
  requireColumn(wb.headers, COL.title);
  requireColumn(wb.headers, COL.penname);

  const plates: Plate[] = [];
  for (const row of wb.rows) {
    const titles = toArray(row[COL.title]);
    const worksNum = titles.length;
    const pennames = toArray(row[COL.penname]);
    for (let i = 0; i < worksNum; i++) {
      if (pennames.length !== worksNum) {
        plates.push({ title: titles[i], penname: String(row[COL.penname] ?? "") });
      } else {
        plates.push({ title: titles[i], penname: pennames[i] });
      }
    }
  }
  return plates;
}

// ---------------------------------------------------------------------------
// QRcode/functions.py — used by the QRcode sheet PDF
// ---------------------------------------------------------------------------

/**
 * Port of QRcode/functions.py `get_id_list`. The original read this by
 * fixed column *position* (`usecols=[2 or 3]`), which is exactly the kind
 * of positional fragility `gui_2.py` warns about ("Excelの列名がずれています").
 * We read by column name instead — same result for a correctly laid-out
 * sheet, without the positional footgun.
 */
export function qrcodeGetIdList(wb: Workbook, sns: SnsKind): [string, SnsKind][] {
  const column = sns === "instagram" ? COL.instagram : COL.twitter;
  requireColumn(wb.headers, column);
  const ids: [string, SnsKind][] = [];
  for (const row of wb.rows) {
    const value = row[column];
    if (!isBlank(value)) ids.push([String(value), sns]);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Description/functions.py — used by the Description PDF
// ---------------------------------------------------------------------------

/**
 * Port of Description/functions.py `get_description_list`. Unlike the
 * Integeration version, blank/NaN descriptions are dropped entirely rather
 * than padded with "" — this list is just "every non-empty description,
 * flattened", not index-aligned with the plates list.
 */
export function descriptionGetDescriptionList(wb: Workbook): string[] {
  requireColumn(wb.headers, COL.description);
  const list: string[] = [];
  for (const row of wb.rows) {
    const value = row[COL.description];
    if (isBlank(value)) continue;
    for (const part of toArray(value)) {
      if (part !== "") list.push(part);
    }
  }
  return list;
}
