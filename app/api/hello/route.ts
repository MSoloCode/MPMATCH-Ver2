import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Hello from API',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json(
    {
      message: 'Data received',
      data: body,
    },
    { status: 201 }
  );
}
