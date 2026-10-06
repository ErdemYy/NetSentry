import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'NetSentry Web Frontend',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    phase: 'PHASE_0_FOUNDATION',
  });
}
