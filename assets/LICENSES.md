# 同梱アセットのライセンス

## フォント (`fonts/`)

- `NotoSansJP-Regular.ttf`, `NotoSerifJP-Regular.ttf`
  Google Fonts "Noto Sans JP" / "Noto Serif JP"
  License: SIL Open Font License 1.1
  Source: https://github.com/notofonts/noto-cjk/releases
    (16_NotoSansJP.zip / 12_NotoSerifJP.zip, Regular weight, CFF-flavored .otf)

  Reprocessed in three steps before being committed here (see pdf/fonts.ts
  for why each is needed): subset to JIS X 0208 + Latin and strip GSUB/GPOS
  layout tables with `pyftsubset`, then convert from CFF to TrueType (glyf
  outlines) with `otf2ttf` (https://github.com/googlefonts/otf2ttf).
  Reproduce with:

  ```sh
  # unicode ranges: JIS X 0208 derived from Python's shift_jis codec,
  # plus Google Fonts' "latin" unicode-range for NotoSansJP.
  pyftsubset NotoSansJP-Regular.otf \
    --output-file=NotoSansJP-Regular.subset.otf \
    --unicodes="$(cat jisx0208_and_latin_unicodes.txt)" \
    --layout-features=''
  otf2ttf NotoSansJP-Regular.subset.otf -o NotoSansJP-Regular.ttf
  # (same for NotoSerifJP-Regular.otf)
  ```

## アイコン (`icons/`)

- `instagram.svg`, `x.svg`
  Simple Icons (brand logos)
  License: CC0 1.0 Universal
  Source: https://github.com/simple-icons/simple-icons
  ※ ブランドロゴ自体の商標権は各社に帰属する。SVG形状データのみCC0。

- `camera-off.svg`
  Lucide
  License: ISC
  Source: https://github.com/lucide-icons/lucide

旧版（Python/Tkinter版アプリ）で使用していたIcons8製アイコン（icons8-instagram, icons8-twitterx,
icons8-nocamera）は商用無償利用に帰属表示が必要なため、本リポジトリでは同梱していない。
