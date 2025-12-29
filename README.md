# AnyMusic Tools Suite

一個多功能的網頁工具集，包含音訊處理、PDF 編輯、QR Code 產生等實用功能。

## 功能特色

### 🎵 音訊工具
- YouTube/影片下載為 MP3
- 播放清單批量下載
- 音訊切割工具
- 音訊格式轉換 (WAV, FLAC, OGG, M4A 等轉 MP3)

### 📄 PDF 編輯器
- 合併多個 PDF
- 分割/擷取 PDF 頁面
- 旋轉 PDF 頁面
- 刪除指定頁面

### 📱 QR Code & 短網址
- QR Code 產生器
- URL 縮短器 (使用 TinyURL)

### 🛠️ 更多工具
- 圖片去背 (AI 驅動)
- 敏感資訊遮蓋 (Email、電話、身分證、信用卡)

## 安裝與使用

### 環境需求
- Python 3.8+
- FFmpeg (用於音訊處理)

### 安裝步驟

1. 克隆專案
```bash
git clone https://github.com/YOUR_USERNAME/anymusic-tools.git
cd anymusic-tools
```

2. 安裝依賴
```bash
pip install -r requirements.txt
```

3. 啟動應用
```bash
python app.py
```

4. 開啟瀏覽器訪問 `http://localhost:5000`

## 技術架構

- **後端**: Python Flask
- **前端**: HTML/CSS/JavaScript
- **音訊處理**: yt-dlp + FFmpeg
- **PDF 處理**: PyPDF2
- **圖片去背**: rembg (AI)
- **QR Code**: qrcode

## 頁面導航

| 頁面 | 網址 | 功能 |
|------|------|------|
| 首頁 | `/` | 音訊下載與切割 |
| PDF 編輯 | `/pdf` | PDF 處理工具 |
| QR Code | `/qrcode` | QR Code 與短網址 |
| 更多工具 | `/tools` | 圖片去背、敏感資訊遮蓋 |

## 授權

MIT License
