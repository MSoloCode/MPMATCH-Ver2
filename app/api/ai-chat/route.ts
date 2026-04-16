import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { trackMessage } from '@/lib/rate-limit';
import { db } from '@/lib/db';

/**
 * POST /api/ai-chat
 * Handle AI chat messages for pregnancy and ANC questions
 *
 * Authentication: Required (Bearer token in Authorization header)
 * Authorization: Any authenticated role
 *
 * Request body:
 * {
 *   "message": "What are danger signs in pregnancy?",
 *   "history": [
 *     { "role": "user", "content": "..." },
 *     { "role": "assistant", "content": "..." }
 *   ]
 * }
 *
 * Response on success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Danger signs in pregnancy include..."
 *   }
 * }
 *
 * Response on unauthorized (401):
 * { "success": false, "error": "Unauthorized - invalid or expired token" }
 *
 * Response on rate limited (429):
 * { "success": false, "error": "Rate limit exceeded: 20 messages per hour. Try again at [timestamp]" }
 *
 * Response on server error (500):
 * { "success": false, "error": "Internal server error" }
 */

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  message: string;
  history: Message[];
}

const SYSTEM_PROMPT = `You are an AI assistant for MPMATCH LINKS AFRICA, a maternal health platform in Uganda and Africa. Answer questions about pregnancy, antenatal care, danger signs, nutrition, and appointments. Always recommend seeking professional care for emergencies. Be concise, warm, and culturally appropriate for East African mothers. Never give a clinical diagnosis.`;

export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATE REQUEST
    // ========================================================================
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return auth.response;
    }

    // ========================================================================
    // 2. CHECK RATE LIMIT
    // ========================================================================
    const userId = auth.payload?.userId;
    if (!userId) {
      console.error('Unable to extract userId from auth payload');
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication error: unable to identify user',
        },
        { status: 500 }
      );
    }

    const userIdString = String(userId);
    const rateLimitResult = trackMessage(userIdString);
    if (!rateLimitResult.allowed) {
      const resetAtMs = rateLimitResult.resetTime;
      const resetAtISO = new Date(resetAtMs).toISOString();
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded: 20 messages per hour. Try again at ${resetAtISO}.`,
        },
        { status: 429 }
      );
    }

    // ========================================================================
    // 3. PARSE AND VALIDATE REQUEST BODY
    // ========================================================================
    const body: RequestBody = await request.json();

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Message is required and must be a string',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.history)) {
      return NextResponse.json(
        {
          success: false,
          error: 'History must be an array',
        },
        { status: 400 }
      );
    }

    const userMessage = body.message.trim();
    if (userMessage.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message cannot be empty',
        },
        { status: 400 }
      );
    }

    if (userMessage.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message is too long (max 2000 characters)',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 4. BUILD CONVERSATION FOR OpenAI
    // ========================================================================
    const messages: Message[] = [
      ...body.history,
      { role: 'user', content: userMessage },
    ];

    // ========================================================================
    // 5. CALL OpenAI API
    // ========================================================================
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'AI service is not configured',
        },
        { status: 500 }
      );
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: 500,
          top_p: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        
        if (response.status === 401) {
          return NextResponse.json(
            {
              success: false,
              error: 'AI service authentication failed',
            },
            { status: 500 }
          );
        }

        if (response.status === 429) {
          return NextResponse.json(
            {
              success: false,
              error: 'AI service is temporarily unavailable. Please try again later.',
            },
            { status: 503 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to get AI response',
          },
          { status: 500 }
        );
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        console.error('Unexpected OpenAI response format:', data);
        return NextResponse.json(
          {
            success: false,
            error: 'Unexpected response from AI service',
          },
          { status: 500 }
        );
      }

      const assistantMessage =
        data.choices[0].message?.content?.trim() ||
        'I encountered an issue processing your request. Please try again.';

      // ========================================================================
      // 6. LOG TO AiChatLog (non-blocking)
      // ========================================================================
      try {
        await db.aiChatLog.create({
          data: {
            userId,
            messageCount: body.history.length + 1,
          },
        });
      } catch (logError) {
        console.error('Failed to write AiChatLog:', logError);
        // Don't fail the response if logging fails
      }

      // ========================================================================
      // 7. RETURN SUCCESS RESPONSE
      // ========================================================================
      return NextResponse.json(
        {
          success: true,
          data: {
            message: assistantMessage,
          },
        },
        { status: 200 }
      );
    } catch (apiError) {
      console.error('Error calling OpenAI API:', apiError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to reach AI service',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in AI chat endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
