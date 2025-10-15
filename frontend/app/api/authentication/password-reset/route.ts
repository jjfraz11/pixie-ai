import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { action, email, token, newPassword } = body;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/authentication/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, email, token, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new NextResponse(JSON.stringify(data), { status: response.status });
    }

    return new NextResponse(JSON.stringify(data), { status: 200 });
  } catch (error) {
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
}
