# 美股第一課：部署到 Cloudflare 的待辦清單

> 交接用。這份清單寫給**持有 Cloudflare 憑證**的工作階段執行。寫完清單的那個工作階段沒有憑證，所以沒有實際部署過。

## 背景

- 倉庫：`Vik1n9/One-Page-Beginners-Guide`
- 分支：`claude/us-stocks-cloudflare-paged`（PR #49）
- 目標網址：`https://voriens.dev/us-stocks/`
- 部署內容：`cloudflare-us-stocks/` 資料夾
  - 這是一個只有靜態檔案的 Worker（沒有 `main` 腳本）。
  - `wrangler.jsonc` 只登記兩條路由：`voriens.dev/us-stocks` 和 `voriens.dev/us-stocks/*`。根網域的其他路徑不受影響。
  - 頁面檔案放在 `public/us-stocks/`。原因是請求路徑會原樣對應到 `public/` 底下，所以檔案要放在同名子資料夾裡。
- 自動部署：PR 合併、推到 `main` 之後，`.github/workflows/deploy-us-stocks.yml` 會跑 `cloudflare/wrangler-action@v4`。這一步需要兩個 GitHub secrets。
- **先後順序很重要**：PR 一合併，GitHub Pages 上的舊頁 `us-stocks-guide.html` 就會轉址到 voriens.dev。所以要**先讓 voriens.dev/us-stocks 上線並驗證，再合併 PR**。

## 待辦

### 1. 確認 Cloudflare 帳號與網域

- [ ] `voriens.dev` 是這個 Cloudflare 帳號底下的 zone，狀態是 Active。
- [ ] 記下 Account ID。可以在 Dashboard 右側欄找到，或執行 `npx wrangler@4 whoami`。

### 2. 確認 DNS（路由生效的前提）

- [ ] `voriens.dev`（根網域）要有一筆 **Proxied（橘色雲朵）** 的 DNS 記錄。沒有的話，瀏覽器會出現 `ERR_NAME_NOT_RESOLVED`，Worker 根本收不到請求。
  - 根網域已經有網站：不用改。
  - 根網域目前沒有任何記錄：**先問擁有者根網域要顯示什麼，再新增記錄**。不要擅自決定，因為根網域其他路徑的回應由這筆記錄決定。

### 3. 建立 API Token

- [ ] Cloudflare → My Profile → API Tokens → Create Token，選範本 **Edit Cloudflare Workers**。
  - Account Resources：只勾這一個帳號。
  - Zone Resources：只勾 `voriens.dev`（路由要用 Workers Routes 的編輯權限）。
- [ ] 把 token 存好，下一步要用。不要把它寫進倉庫或任何檔案。

### 4. 先從 PR 分支手動部署（合併前）

```bash
git fetch origin claude/us-stocks-cloudflare-paged
git checkout claude/us-stocks-cloudflare-paged
cd cloudflare-us-stocks
export CLOUDFLARE_API_TOKEN=...   # 第 3 步建立的 token
export CLOUDFLARE_ACCOUNT_ID=...  # 第 1 步記下的 Account ID
npx wrangler@4 deploy --dry-run   # 應該列出兩條路由，並讀到 public/ 底下的 4 個檔案
npx wrangler@4 deploy
```

- [ ] 部署成功，輸出裡有兩條 `voriens.dev/us-stocks` 路由。
- 如果失敗：
  - Authentication error（10000）：token 權限不足，或沒有勾到 `voriens.dev` zone。
  - 路由已被其他 Worker 佔用：到 Dashboard → Workers Routes 看是誰在用這條路由，**問擁有者**要不要移除。

### 5. 驗證線上版本

```bash
curl -sI https://voriens.dev/us-stocks            # 預期 307，Location 指向 /us-stocks/
curl -sI https://voriens.dev/us-stocks/           # 預期 200，text/html
curl -sI https://voriens.dev/us-stocks/app.js     # 預期 200
curl -sI https://voriens.dev/us-stocks/styles.css # 預期 200
curl -sI https://voriens.dev/us-stocks/favicon.svg # 預期 200
curl -sI https://voriens.dev/                     # 預期維持原狀，不應由這個 Worker 回應
```

- [ ] 以上結果都符合預期。
- [ ] 用瀏覽器打開 `https://voriens.dev/us-stocks/`，逐項確認：
  - 封面正常。
  - 「開始閱讀」有轉場動畫。
  - 章末繼續往下捲會載入下一章。
  - 目錄面板可以開關。
  - 深色／淺色主題可以切換。
- [ ] 深連結 `https://voriens.dev/us-stocks/#時間與規則` 直接開在第 03 章。
- [ ] 手機寬度沒有左右溢出。

### 6. 設定 GitHub secrets（之後自動部署用）

- [ ] 到倉庫 Settings → Secrets and variables → Actions，新增：
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

  有 `gh` 的話也可以用指令：

  ```bash
  gh secret set CLOUDFLARE_API_TOKEN -R Vik1n9/One-Page-Beginners-Guide
  gh secret set CLOUDFLARE_ACCOUNT_ID -R Vik1n9/One-Page-Beginners-Guide
  ```

### 7. 合併 PR #49

- [ ] **要先得到倉庫擁有者同意才合併**。第 5 步全部通過之後再合併。
- [ ] 合併後，到 Actions 確認 **Deploy us-stocks to Cloudflare** 成功（綠色）。
- [ ] 等 GitHub Pages 重建完成（約 1–2 分鐘），確認舊網址會轉到新網址，而且章節錨點有保留：
  - `https://vik1n9.github.io/One-Page-Beginners-Guide/us-stocks-guide.html` → `https://voriens.dev/us-stocks/`
  - `…/us-stocks-guide.html#時間與規則` → `https://voriens.dev/us-stocks/#時間與規則`

### 8. 回報

- [ ] 回報以下內容：
  - 部署結果、線上網址。
  - 第 5 步的 curl 輸出摘要。
  - 有沒有遇到 DNS 或路由衝突，怎麼處理的。

## 部署後的內容追蹤（不屬於部署本身，列在這裡備忘）

- [ ] **2026/12/6 之後**：確認 Nasdaq／NYSE Arca 夜盤有沒有如期上線，再對照第 03 章的「交易時段」。
- [ ] **2027/1**：富邦定期定額優惠（0.1%、無低消）到 2026/12/31 為止，更新第 05 章的說明。
- [ ] **持續追蹤**：台美免雙重課稅法案（H.R. 33）。如果通過，第 06、10 章裡「股息預扣 30%」的段落要改。
