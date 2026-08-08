import "./style.css";

const STORAGE_KEYS = {
  year: "licosha-display:year",
  exhibitionTitle: "licosha-display:exhibitionTitle",
  showDataMatrix: "licosha-display:showDataMatrix",
  snsQrSizeMm: "licosha-display:snsQrSizeMm",
} as const;

// Mirrors DEFAULT_SNS_QR_SIZE_MM in lib/pdf/caption.ts (kept here as a
// literal rather than imported, so this lightweight module doesn't pull the
// heavy pdf-lib-based pipeline into the eagerly-loaded main chunk).
const DEFAULT_SNS_QR_SIZE_MM = 12;
const SNS_QR_SIZE_MIN_MM = 6;
const SNS_QR_SIZE_MAX_MM = 20;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app root element not found");

app.innerHTML = `
  <main class="container">
    <h1>Licosha Display Web</h1>
    <p class="lead">
      展示用Excelを読み込んで、キャプション・名札・SNS用QRコードシート・作品説明カードのPDFを一式生成します。
      入力内容はブラウザ内で完結し、どこにも送信されません。
    </p>

    <form id="generate-form">
      <label class="field">
        <span>使用するExcelファイル</span>
        <input type="file" id="excel-file" accept=".xlsx,.xls" required />
      </label>

      <div class="field-row">
        <label class="field">
          <span>年度</span>
          <input type="text" id="year" placeholder="2026" required />
        </label>
        <label class="field">
          <span>展示名</span>
          <input type="text" id="exhibition-title" placeholder="早稲田祭" required />
        </label>
      </div>

      <label class="checkbox-field">
        <input type="checkbox" id="show-datamatrix" />
        <span>アンケート用のDataMatrixを表示する</span>
      </label>

      <label class="field">
        <span>
          キャプションPDFのSNS QRコードのサイズ
          (<span id="sns-qr-size-value">${DEFAULT_SNS_QR_SIZE_MM}</span>mm)
        </span>
        <input
          type="range"
          id="sns-qr-size"
          min="${SNS_QR_SIZE_MIN_MM}"
          max="${SNS_QR_SIZE_MAX_MM}"
          step="1"
          value="${DEFAULT_SNS_QR_SIZE_MM}"
        />
      </label>

      <button type="submit" id="generate-button">生成する</button>
    </form>

    <div id="status" class="status" role="status" aria-live="polite"></div>

    <p class="privacy-note">
      アップロードしたExcelや生成物は一切サーバーへ送信されません。すべてこの端末内（ブラウザ）で処理されます。
    </p>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#generate-form")!;
const excelInput = document.querySelector<HTMLInputElement>("#excel-file")!;
const yearInput = document.querySelector<HTMLInputElement>("#year")!;
const titleInput = document.querySelector<HTMLInputElement>("#exhibition-title")!;
const showDataMatrixInput = document.querySelector<HTMLInputElement>("#show-datamatrix")!;
const snsQrSizeInput = document.querySelector<HTMLInputElement>("#sns-qr-size")!;
const snsQrSizeValueEl = document.querySelector<HTMLSpanElement>("#sns-qr-size-value")!;
const generateButton = document.querySelector<HTMLButtonElement>("#generate-button")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;

yearInput.value = localStorage.getItem(STORAGE_KEYS.year) ?? "";
titleInput.value = localStorage.getItem(STORAGE_KEYS.exhibitionTitle) ?? "";
showDataMatrixInput.checked = localStorage.getItem(STORAGE_KEYS.showDataMatrix) === "true";
snsQrSizeInput.value = localStorage.getItem(STORAGE_KEYS.snsQrSizeMm) ?? String(DEFAULT_SNS_QR_SIZE_MM);
snsQrSizeValueEl.textContent = snsQrSizeInput.value;

snsQrSizeInput.addEventListener("input", () => {
  snsQrSizeValueEl.textContent = snsQrSizeInput.value;
});

function setStatus(message: string, kind: "progress" | "error" | "success"): void {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = excelInput.files?.[0];
  const year = yearInput.value.trim();
  const exhibitionTitle = titleInput.value.trim();
  const showDataMatrix = showDataMatrixInput.checked;
  const snsQrSizeMm = Number(snsQrSizeInput.value);

  if (!file || !year || !exhibitionTitle) {
    setStatus("すべての項目を入力してください", "error");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.year, year);
  localStorage.setItem(STORAGE_KEYS.exhibitionTitle, exhibitionTitle);
  localStorage.setItem(STORAGE_KEYS.showDataMatrix, String(showDataMatrix));
  localStorage.setItem(STORAGE_KEYS.snsQrSizeMm, String(snsQrSizeMm));

  generateButton.disabled = true;
  try {
    setStatus("準備しています...", "progress");
    const { runGenerationPipeline } = await import("./lib/pipeline");
    const { zipBlob, zipFileName } = await runGenerationPipeline({
      file,
      year,
      exhibitionTitle,
      showDataMatrix,
      snsQrSizeMm,
      onProgress: (message) => setStatus(message, "progress"),
    });

    triggerDownload(zipBlob, zipFileName);
    setStatus("処理が完了しました。ZIPファイルをダウンロードしました。", "success");
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`エラーが発生しました\n${message}`, "error");
  } finally {
    generateButton.disabled = false;
  }
});
