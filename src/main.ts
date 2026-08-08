import "./style.css";

const STORAGE_KEYS = {
  year: "licosha-display:year",
  exhibitionTitle: "licosha-display:exhibitionTitle",
  showDataMatrix: "licosha-display:showDataMatrix",
} as const;

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
const generateButton = document.querySelector<HTMLButtonElement>("#generate-button")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;

yearInput.value = localStorage.getItem(STORAGE_KEYS.year) ?? "";
titleInput.value = localStorage.getItem(STORAGE_KEYS.exhibitionTitle) ?? "";
showDataMatrixInput.checked = localStorage.getItem(STORAGE_KEYS.showDataMatrix) === "true";

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

  if (!file || !year || !exhibitionTitle) {
    setStatus("すべての項目を入力してください", "error");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.year, year);
  localStorage.setItem(STORAGE_KEYS.exhibitionTitle, exhibitionTitle);
  localStorage.setItem(STORAGE_KEYS.showDataMatrix, String(showDataMatrix));

  generateButton.disabled = true;
  try {
    setStatus("準備しています...", "progress");
    const { runGenerationPipeline } = await import("./lib/pipeline");
    const { zipBlob, zipFileName } = await runGenerationPipeline({
      file,
      year,
      exhibitionTitle,
      showDataMatrix,
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
