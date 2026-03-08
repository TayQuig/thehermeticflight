export const prerender = false;

import type { APIRoute } from 'astro';
import { questions } from '../../lib/quiz-data';
import { classify, computeScores } from '../../lib/classifier';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, firstName, answers } = body;

    // 1. Validate required fields
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!answers || typeof answers !== 'object') {
      return new Response(JSON.stringify({ error: 'Answers required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Server-side classification (integrity check — don't trust client)
    const scores = computeScores(answers, questions);
    const archetype = classify(scores);

    // 3. Extract non-scored answers for segmentation
    const experienceLevel = answers['Q2'] || null;
    const painPoint = answers['Q3'] || null;
    const cardBackPref = answers['Q19'] || null;
    const productInterest = answers['Q20'] || null;

    // 4. Push to Loops.so
    const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
    if (!LOOPS_API_KEY) {
      console.error('LOOPS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const loopsRes = await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `quiz_${email}_${today}`,
      },
      body: JSON.stringify({
        email,
        eventName: 'quiz_completed',

        // Contact properties (saved permanently)
        firstName: firstName || '',
        archetype,
        source: 'quiz',
        ...(experienceLevel && { experienceLevel }),
        ...(painPoint && { painPoint }),
        ...(cardBackPref && { cardBackPref }),
        ...(productInterest && { productInterest }),

        // Event properties (temporary, available in triggered emails)
        eventProperties: {
          archetype,
          scoreA: scores.A,
          scoreB: scores.B,
          scoreC: scores.C,
          scoreD: scores.D,
        },
      }),
    });

    const loopsData = await loopsRes.json();

    if (!loopsData.success) {
      console.error('Loops.so event failed:', loopsData.message);
      return new Response(JSON.stringify({ error: 'Failed to register' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, archetype }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Quiz submit error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
