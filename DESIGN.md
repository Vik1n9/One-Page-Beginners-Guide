---
version: alpha
name: One-Page Beginners Guide Kami Document System
source: .claude/skills/kami/references/design.md
register: brand
---

# Design

## Design Intent

本專案的指南採用 **Kami 文件設計系統**：暖色 parchment 紙底、單一 ink-blue 強調色、serif 主導的層級，讀起來像一份排版講究的印刷文件，而不是一個網站頁面。目標是讓長篇教學在螢幕上好讀、在列印／存 PDF 時同樣成立。

規格來源是本倉庫內建的 Kami 技能：`.claude/skills/kami/references/design.md`（色票、字級、元件、減法規則）與 `.claude/skills/kami/assets/templates/long-doc.html`（長文模板）。修改視覺前請先讀該兩份檔案。

## Non-Negotiables

- 每份指南是**自包含單檔 HTML**：CSS 內嵌於該檔案的 `<style>`，不依賴外部樣式表，可單獨分享、列印、搬移。
- 保持靜態：HTML、CSS、JavaScript、GitHub Pages，無建置流程。
- `PRODUCT.md` 與 `DESIGN.md` 是後續改版前的必讀。
- 內容是產品。互動元件與樣式都不得延遲或遮擋內容。
- 只用一個彩色強調色（ink-blue），其餘為暖灰階。

## Colors

```css
--parchment: #f5f4ed;   /* 頁面底色，永遠不用純白 */
--ivory:     #faf9f5;   /* 安靜的填色：callout、prompt、表面 */
--inline-code-bg: #f0eee6;
--near-black:#141413;   /* 內文 */
--dark-warm: #3d3d3a;   /* 次級標題、導言 */
--olive:     #504e49;   /* 引文、說明 */
--stone:     #6b6a64;   /* 註解、圖說、頁碼 */
--brand:     #1B365D;   /* 唯一強調色，佔版面 ≤5% */
--border:    #e8e6dc;
--border-soft:#e5e3d8;
--tag-bg:    #E4ECF5;   /* tag 用實色，不用 rgba */
```

暖灰階只能是帶黃褐調的暖灰，禁止冷調藍灰。

## Typography

- 一頁只用一種 serif：`--serif: "Iansui", "TsangerJinKai02", "Source Han Serif SC", …, Georgia, serif`；`--sans` 直接等於 `--serif`。
- 繁中預設字體為 **Iansui（芫荽）**，本機未安裝時退到 CDN 的 TsangerJinKai02，再退到思源宋體系列。
- serif 字重只用 400 與 500，不用合成粗體，不用斜體。
- 字級（印刷 pt 基準）：封面標題 36pt／H1 22pt／H2 16pt／H3 13pt／內文 10.5pt／圖說與註解 9pt。
- 中文內文 `letter-spacing: 0.3pt`、`line-height: 1.55`。

## Layout

- 版面依 Kami long-doc：`.cover`（封面）→ `.toc`（目錄）→ 多個 `.chapter`。
- 每個 `.chapter` 以 `.chapter-num` eyebrow 開場，接 `h1`，再接 `.lead` 導言。
- 螢幕上以 `max-width: 210mm` 模擬 A4 置中；**必須另補 640px 以下的手機斷點**（Kami 原生模板沒有響應式規則，直接套用會讓手機左右各留 22mm）。
- `@page` 印刷規則保留：A4、頁碼、`string-set` 跑馬頁首，讓瀏覽器列印／存 PDF 仍成立。

## Components

- `.exec-summary`：首章的執行摘要框。
- `.callout`：ivory 填色說明框。`.takeaway`：章節結論框，配 `.takeaway-label`。
- `.prompt`：prompt／程式碼區塊，`figcaption` 在上、`pre` 在下、右上角 `.copy-button` 複製鈕（列印時隱藏）。
- `table`：表頭 0.6pt hairline、列間 0.25pt，表頭不填色；外層包 `.table-wrap` 以支援窄螢幕橫向捲動。
- `.tag`：實色 `--tag-bg` 背景的小標籤。`.hl`：ink-blue 行內強調。
- `figure` + `figcaption`：圖表與圖說，圖說置中 9pt stone。

## Do Not

- 不要純白背景、不要冷調灰。
- 不要 rgba 半透明填色的 tag（列印會出現雙重矩形）。
- 不要用 `::before` 假造項目符號，用原生 list marker。
- 不要在同一個元件上疊加品牌色線＋填色＋圓角＋外框。
- 不要用裝飾性短線、eyebrow 裝飾 tick、標題側邊線製造層級——層級來自字級、留白、對齊。
- 不要捲動進場動效或任何會讓內容延後可見的機制。

## 適用範圍與例外

本規格適用於以下七份指南，全部已轉為 Kami：`us-stocks-guide.html`、`guide.html`、`making-of.html`、`pcshop-ai-build-guide.html`、`beauty-manual-ai-guide.html`、`deeptutor-guide.html`、`mac-onboarding-guide.html`。

**例外**：大阪旅遊系列（`osaka-2026-trip-guide.html`、`osaka-2026-day1/3/4/5.html`、`osaka-2026-yakuza-nights.html`、`usj-vip-guide.html`）是自成一格的暖紙質旅遊手冊設計，各自內嵌樣式，**不在本規格範圍內**，也不要用本規格去改它們。

舊的黑白 Mission Manual 系統（`assets/tokens.css`、`assets/style.css`、`assets/deck.js`）已隨轉換完成刪除，需要時可從 git 歷史取回。

## 互動元件

Kami 文件模板本身沒有互動元件規範。本站保留的互動（美股頁的複利試算、漲跌色對照、交割時間軸、碎股試算、停損模擬；製作幕後與 PCShop 的前後對照切換）以下列原則納入 Kami：

- 面板用 `.panel`（ivory 底、無外框），滑桿 `accent-color` 用 ink-blue。
- SVG 圖表只用 ink-blue（線）＋暖灰（輔助線）＋白底，不引入新色階。
- 兩個語意性例外：漲跌顏色對照必須維持綠／紅（那是內容本身，不是裝飾）；停損觸發線用 Kami 已註冊的 `--breaking` 暖褐色系表示風險。
- 互動只增強理解，不得成為讀到內容的前提；列印時切換鈕隱藏、預設展開。
