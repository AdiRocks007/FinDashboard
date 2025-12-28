# FinBoard - Finance Dashboard

A modern, production-ready finance dashboard built with Next.js 15. Connect to any financial API, visualize your data with beautiful charts and tables, and customize everything to fit your needs.

## ✨ Features

### Core Functionality
- **Drag & Drop Widgets** - Easily rearrange widgets by dragging from the header
- **Multiple Widget Types** - Tables, Cards, and Charts with full customization
- **Real-time Data** - Auto-refresh widgets with configurable intervals
- **Custom Formula Fields** - Create calculated fields using formulas (e.g., `price * 1.1`)
- **Field Renaming** - Double-click any field header or widget title to rename it
- **Time Period Selection** - For charts, switch between daily, weekly, monthly, and intraday data
- **Multi-Symbol Support** - Track multiple stocks in a single table widget

### Supported APIs
- **Alpha Vantage** - Market data with support for daily, weekly, monthly, and intraday time series
- **Finnhub** - Real-time stock quotes and market data
- **Polygon.io** - Financial market data
- **Custom APIs** - Connect to any REST API endpoint

### Widget Features

#### Table Widgets
- Sortable and filterable columns
- Search functionality
- Pagination
- Custom field labels
- Export to CSV
- Multi-symbol tracking

#### Chart Widgets
- Line, Area, and Bar charts
- Technical indicators (SMA, EMA, Volume)
- Time period selector (daily/weekly/monthly/intraday)
- Half-width layout (2 charts side by side)
- Interactive zoom and pan

#### Card Widgets
- Single card or grid layout
- Sparkline charts
- Real-time price updates
- Animated value changes

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   cd finboard
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env.local` file in the `finboard` directory:
   ```env
   NEXT_PUBLIC_ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
   NEXT_PUBLIC_FINNHUB_KEY=your_finnhub_key_here
   NEXT_PUBLIC_POLYGON_KEY=your_polygon_key_here
   ```

   > **Note:** You can get free API keys from:
   > - Alpha Vantage: https://www.alphavantage.co/support/#api-key
   > - Finnhub: https://finnhub.io/register
   > - Polygon.io: https://polygon.io/

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage Guide

### Adding a Widget

1. Click the **"Add Widget"** button on the dashboard
2. **Step 1 - API Configuration:**
   - Enter a widget name
   - Select widget type (Table, Card, or Chart)
   - Enter your API URL
   - For charts, you'll see helpful examples for Alpha Vantage endpoints
   - Click "Test Connection" to verify your API works
3. **Step 2 - Field Mapping:**
   - The system will auto-map common fields
   - Click "Map" next to any field to manually map it
   - Click on API response fields to map them
   - Add custom formula fields using the "Add Custom Formula Field" button
4. **Step 3 - Preview:**
   - Configure widget-specific settings
   - For charts: select chart type, time interval, and indicators
   - Click "Add Widget" to finish

### Working with Charts

Charts support multiple time periods:
- **Daily** - End-of-day prices (best for most use cases)
- **Weekly** - Weekly aggregated prices
- **Monthly** - Monthly aggregated prices  
- **Intraday** - Real-time intraday prices (requires interval parameter)

**Alpha Vantage URL Examples:**
- Daily: `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=YOUR_KEY`
- Weekly: `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=AAPL&apikey=YOUR_KEY`
- Monthly: `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=AAPL&apikey=YOUR_KEY`
- Intraday: `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=AAPL&interval=5min&apikey=YOUR_KEY`

After adding a chart, use the dropdown in the chart header to switch between time periods - the URL will automatically update!

### Creating Custom Formula Fields

1. In the Field Mapping step, click **"Add Custom Formula Field"**
2. Enter your formula using field names (e.g., `volume * 1.1` or `price / previousClose * 100`)
3. The system will validate your formula with actual data
4. Available fields are shown below the input
5. Save to add the calculated field to your widget

**Formula Examples:**
- `price * 1.1` - Calculate 10% markup
- `change / previousClose * 100` - Calculate percentage change
- `volume * price` - Calculate market cap approximation
- `(high + low) / 2` - Calculate mid-point

### Renaming Fields and Widgets

- **Rename Field Headers:** Double-click any column header in a table widget
- **Rename Widget Title:** Double-click the widget title in the header
- Press Enter to save, or Escape to cancel

### Dragging Widgets

- Hover over any widget header to see the drag cursor
- Click and drag from anywhere on the header (except buttons) to rearrange widgets
- The drag is super responsive - activates after just 1px of movement

### Multi-Symbol Tables

1. When adding a table widget, enter multiple symbols separated by commas in the "Stock Symbols" field
2. Use `{symbol}` placeholder in your API URL (e.g., `https://api.example.com/quote?symbol={symbol}`)
3. Each symbol will appear as a separate row in the table

## 🛠️ Development

### Project Structure

```
finboard/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes (proxy, debug)
│   │   └── page.tsx           # Main dashboard page
│   ├── components/
│   │   ├── widgets/           # Widget components (Table, Card, Chart)
│   │   ├── dashboard/         # Dashboard grid and controls
│   │   ├── modals/           # Modal dialogs
│   │   └── ui/               # Reusable UI components
│   ├── lib/
│   │   ├── store/            # Redux store and slices
│   │   ├── utils/            # Utility functions
│   │   ├── hooks/            # Custom React hooks
│   │   └── services/         # API and WebSocket services
│   └── types/                # TypeScript definitions
├── tests/                    # Test files
└── public/                  # Static assets
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
```

### Key Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Redux Toolkit** - State management
- **TanStack Table** - Powerful table component
- **Recharts** - Charting library
- **@dnd-kit** - Drag and drop functionality
- **Tailwind CSS** - Styling

## 🔒 Security

- Content Security Policy (CSP) headers
- Rate limiting on API endpoints
- API proxy for CORS handling
- Input validation and sanitization
- Safe formula evaluation (no eval)

## 📊 Widget Sizing

- **Charts:** Half-width (2 columns) - perfect for side-by-side comparison
- **Tables:** Full-width (4 columns) - maximum data visibility
- **Cards:** Single column - compact display

## 🎨 Customization

### Themes
The dashboard supports light and dark themes. Toggle using the theme switcher.

### Widget Settings
Each widget type has specific settings:
- **Tables:** Rows per page, sortable, filterable
- **Charts:** Chart type, time interval, indicators, color scheme
- **Cards:** Layout mode, sparkline display

## 🐛 Troubleshooting

### Widget Not Showing Data
- Check that your API URL is correct and accessible
- Verify your API key is set in `.env.local`
- Check browser console for error messages
- Ensure field mapping is correct

### Formula Fields Not Working
- Make sure referenced fields are mapped first
- Check that field names in formula match exactly
- Verify formula syntax (use operators: +, -, *, /, %)

### Charts Not Updating Time Period
- Ensure you're using an Alpha Vantage URL
- Check that the symbol parameter is in the URL
- Verify your API key is valid

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for the finance community**
