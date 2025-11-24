# PDF Image Processor

![PDF Image Processor](pdf2img.jpg)

A powerful web application for processing PDFs and images with advanced features like background removal, layout customization, and direct printing. All processing happens in your browser - your data never leaves your computer.

## ✨ Features

### 📄 File Processing
- **Multiple File Upload** - Upload multiple PDFs and images at once
- **Dual Mode** - Render Pages or Extract Images from PDFs
- **Image Extraction** - Pull individual images for QR code/watermark removal

### 🎨 Image Processing
- **🎯 Eyedropper Tool** - Click to pick and remove background colors
- **✨ Auto-Clean** - Automatically remove watermarks/QR codes (< 20% of main content)
- **Manual Controls** - Threshold, Brightness, Contrast sliders
- **Color Tolerance** - Fine-tune color matching sensitivity

### 📐 Layout & Printing
- **Multiple Layouts** - Vertical, Square Grid, A4 Grid, A3 Grid
- **Paper Orientation** - Portrait/Landscape for A4/A3
- **Flexible Grouping** - Pages per sheet control
- **Header/Footer** - Auto-fill with current domain or customize

### 🖨️ Export & Print
- **Direct Print** - Multi-page printing support
- **Multi-Page Preview** - View all generated sheets
- **Batch Download** - Download individual or all pages

### 🏷️ Optional Tools
- **Stamp Designer** - Create custom stamps (disabled by default)
- **Image Selection** - Filmstrip view with bulk actions

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deploy to Vercel

**Option 1: Using Vercel Website** (Recommended)
1. Push code to GitHub
2. Visit [vercel.com](https://vercel.com) and click "Add New Project"
3. Import your repository
4. Click "Deploy"
5. ✅ Done! Vercel auto-deploys on every push

**Option 2: Using Vercel CLI**
```bash
npm i -g vercel
vercel --prod
```

## 📖 Usage Guide

1. **Upload Files**
   - Click upload zone or drag & drop
   - Select multiple PDFs or images
   - Choose "Render Pages" or "Extract Images"

2. **Process Images**
   - Click **🎨 Eyedropper** → pick background color → auto-remove
   - Or click **✨ Auto Clean** to remove small images
   - Adjust brightness/contrast/threshold as needed

3. **Choose Layout**
   - Select grid layout (Square, A4, A3)
   - Pick orientation (Portrait/Landscape)
   - Set pages per sheet

4. **Add Header/Footer** (Optional)
   - Default: Current domain name
   - Customize text as needed

5. **Export**
   - Click **Print** for direct printing
   - Or **Download** for image files

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3
- **PDF Processing**: PDF.js
- **Icons**: Lucide React
- **Hosting**: Vercel

## 🔒 Privacy First

All processing happens in your browser. No files are uploaded to any server. No data leaves your computer.

## 📝 License

MIT

## 👤 Author

LufzzLiz

---

**Color Scheme**: Inspired by [Lumina Style Studio](https://lumina-style-studio.vercel.app/)
