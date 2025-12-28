import { NextResponse } from 'next/server'

/**
 * Debug endpoint to check environment variables and API key loading
 * Remove this in production!
 */
export async function GET() {
  // Check if API keys are loaded (don't expose the actual keys)
  const hasAlphaVantageKey = !!process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
  const hasFinnhubKey = !!process.env.NEXT_PUBLIC_FINNHUB_KEY
  const hasPolygonKey = !!process.env.NEXT_PUBLIC_POLYGON_KEY

  // Show partial keys for debugging (first 4 chars)
  const alphaVantageKeyPreview = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
    ? `${process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY.substring(0, 4)}...`
    : 'NOT SET'
  
  const finnhubKeyPreview = process.env.NEXT_PUBLIC_FINNHUB_KEY
    ? `${process.env.NEXT_PUBLIC_FINNHUB_KEY.substring(0, 4)}...`
    : 'NOT SET'

  return NextResponse.json({
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasAlphaVantageKey,
      hasFinnhubKey,
      hasPolygonKey,
      alphaVantageKeyPreview,
      finnhubKeyPreview,
    },
    message: 'Check if API keys are loaded from .env.local',
  })
}

