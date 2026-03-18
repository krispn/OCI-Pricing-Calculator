# OCI Pricing Calculator

A local web app for estimating Oracle Cloud Infrastructure costs. Fetches live pricing from Oracle's public API — no more manually updating Excel formulas.

## Prerequisites

- **Python 3** (any version) — used only to run a simple local web server
- **curl** — needed only when updating prices (pre-installed on Windows 10+, macOS, and Linux)
- A modern web browser (Chrome, Edge, Firefox)

**Windows machines without Python/curl:** Right-click **`install-prerequisites.bat`** → "Run as administrator". It uses `winget` to install both.

## Quick Start

### Windows
1. Double-click **`start.bat`**
2. Open **http://localhost:8080** in your browser

### macOS / Linux
```bash
bash start.sh
```
Then open **http://localhost:8080** in your browser.

## Updating Prices

The app ships with a pricing snapshot. To refresh it with the latest prices from Oracle:

### Windows
Double-click **`update-prices.bat`**, then click **Refresh Prices** in the app.

### macOS / Linux
```bash
bash update-prices.sh
```
Then click **Refresh Prices** in the app.

## Usage

- **Compute tab** — Add rows for VM/BM instances. Pick a shape, OS, OCPU/memory, and storage options.
- **Storage tab** — Block volumes, object storage, file storage.
- **Database tab** — Base Database Service, Exadata, MySQL HeatWave.
- **Summary tab** — See totals by category with export options.

### Features
- Costs auto-calculate as you edit cells
- Duplicate rows with the copy button
- Export to Excel (.xlsx) or CSV
- Save/load estimates as JSON files to share with your team
- Works offline using cached pricing data

## File Structure

```
OCI Calculator/
├── index.html              App entry point
├── start.bat / start.sh    Launch local server
├── update-prices.bat/.sh   Fetch latest Oracle pricing
├── css/styles.css          Styling
├── js/
│   ├── app.js              App bootstrap and tabs
│   ├── pricing-service.js  Pricing data loader
│   ├── sku-catalog.js      Oracle part number registry
│   ├── compute-grid.js     Compute tab grid
│   ├── storage-grid.js     Storage tab grid
│   ├── database-grid.js    Database tab grid
│   └── export-service.js   CSV/Excel export
└── data/
    └── pricing-snapshot.json   Cached pricing data
```
