/**
 * Quiz Data — 6 Aerial Tarot Archetypes. Which Are You?
 *
 * Source: tally-quiz-extraction.md (form aQ5Gg9, production — 14 submissions)
 * Operator-confirmed corrections applied 2026-03-07:
 *   - Q5: Tally had shifted dimension assignments (A→B, B→C, C→D). Corrected to A=A, B=B, C=C, D=D.
 *   - Q6: Tally had B and C swapped. Corrected to B=B, C=C.
 *   - Q8-A: Tally was missing the conditional logic rule for option A; Air Weaver got +0. Corrected to A=A +4.
 *   - Q9-A: Tally's conditional logic fired twice (+8). Corrected to single Air Weaver +4.
 *   - Q9-D: Tally awarded +4 to all dimensions and Shadow Dancer fired twice (+8 total). Corrected to Shadow Dancer +4 only.
 */

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type Dimension = 'A' | 'B' | 'C' | 'D';

export interface ScoringWeight {
  dimension: Dimension;
  points: number;
}

export interface Answer {
  id: string;
  text: string;
  scoring: ScoringWeight[];
}

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];
  scored: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produces a single-dimension scoring weight of +4. */
function w(dimension: Dimension): ScoringWeight {
  return { dimension, points: 4 };
}

// ---------------------------------------------------------------------------
// Question data
// ---------------------------------------------------------------------------

export const questions: Question[] = [
  // -------------------------------------------------------------------------
  // Q1 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q1',
    number: 1,
    text: "1. You're awake at 2am with something weighing on you. What actually helps?",
    scored: true,
    answers: [
      {
        id: 'Q1-A',
        text: 'Making a list, researching options, or thinking it through logically.',
        scoring: [w('A')],
      },
      {
        id: 'Q1-B',
        text: 'Getting out of bed—walking, stretching, doing something physical.',
        scoring: [w('B')],
      },
      {
        id: 'Q1-C',
        text: 'Letting it go for now, trusting morning will bring clarity.',
        scoring: [w('C')],
      },
      {
        id: 'Q1-D',
        text: "Sitting with the discomfort, asking what this situation is really trying to show you.",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q2 — Non-scored. Experience segmentation. 3 answers (A-C).
  // -------------------------------------------------------------------------
  {
    id: 'Q2',
    number: 2,
    text: '2. When it comes to Tarot, I\'d describe myself as:',
    scored: false,
    answers: [
      {
        id: 'Q2-A',
        text: 'Curious, but just beginning.',
        scoring: [],
      },
      {
        id: 'Q2-B',
        text: 'Practicing, but still building confidence.',
        scoring: [],
      },
      {
        id: 'Q2-C',
        text: 'Experienced, but looking to deepen.',
        scoring: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q3 — Non-scored. Pain point segmentation. 6 answers (A-F).
  // -------------------------------------------------------------------------
  {
    id: 'Q3',
    number: 3,
    text: "3. What's been your biggest frustration with tarot so far?",
    scored: false,
    answers: [
      {
        id: 'Q3-A',
        text: 'Too many cards to memorize.',
        scoring: [],
      },
      {
        id: 'Q3-B',
        text: 'Court cards all seem the same.',
        scoring: [],
      },
      {
        id: 'Q3-C',
        text: "Decks I've tried feel cheap or hard to use.",
        scoring: [],
      },
      {
        id: 'Q3-D',
        text: "I can't read objectively for myself.",
        scoring: [],
      },
      {
        id: 'Q3-E',
        text: "I haven't found a deck that reflects who I am.",
        scoring: [],
      },
      {
        id: 'Q3-F',
        text: 'No frustrations yet!',
        scoring: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q4 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q4',
    number: 4,
    text: '4. You have an unexpected afternoon to yourself. You\'d most enjoy:',
    scored: true,
    answers: [
      {
        id: 'Q4-A',
        text: 'Learning a new skill or taking a workshop.',
        scoring: [w('A')],
      },
      {
        id: 'Q4-B',
        text: 'Moving your body; dancing, yoga, hiking, or aerial practice.',
        scoring: [w('B')],
      },
      {
        id: 'Q4-C',
        text: 'Quiet reflection; journaling, meditation, or daydreaming.',
        scoring: [w('C')],
      },
      {
        id: 'Q4-D',
        text: "Going deep—journaling, meaningful conversation, or exploring something you've been avoiding.",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q5 — Scored. CORRECTED: Tally had A→B, B→C, C→D (shifted pattern).
  // Operator-confirmed correction: A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q5',
    number: 5,
    text: '5. When someone offers guidance, your first instinct is to:',
    scored: true,
    answers: [
      {
        id: 'Q5-A',
        // Tally bug: scored Embodied Intuitive (B). Corrected to Air Weaver (A).
        text: "Evaluate whether it's logical and applicable to your situation.",
        scoring: [w('A')],
      },
      {
        id: 'Q5-B',
        // Tally bug: scored Ascending Seeker (C). Corrected to Embodied Intuitive (B).
        text: 'Check your gut—does this land in your body as true?',
        scoring: [w('B')],
      },
      {
        id: 'Q5-C',
        // Tally bug: scored Shadow Dancer (D). Corrected to Ascending Seeker (C).
        text: "Stay open—maybe there's something here worth exploring.",
        scoring: [w('C')],
      },
      {
        id: 'Q5-D',
        // Tally was already correct for D.
        text: "Look underneath—what's the real wisdom here, beyond the surface?",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q6 — Scored. CORRECTED: Tally had B and C swapped (B→C, C→B).
  // Operator-confirmed correction: B=B, C=C.
  // -------------------------------------------------------------------------
  {
    id: 'Q6',
    number: 6,
    text: '6. Which feels most true for you?',
    scored: true,
    answers: [
      {
        id: 'Q6-A',
        // Tally was correct for A.
        text: "'I need to understand how something works before I can trust it.'",
        scoring: [w('A')],
      },
      {
        id: 'Q6-B',
        // Tally bug: scored Ascending Seeker (C). Corrected to Embodied Intuitive (B).
        text: "'My body knows things my mind hasn't figured out yet.'",
        scoring: [w('B')],
      },
      {
        id: 'Q6-C',
        // Tally bug: scored Embodied Intuitive (B). Corrected to Ascending Seeker (C).
        text: "'The best insights come when I stop trying to force them.'",
        scoring: [w('C')],
      },
      {
        id: 'Q6-D',
        // Tally was correct for D.
        text: "'Growth happens in the uncomfortable places most people avoid.'",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q7 — Scored. 5 answers (A-E). Option E dual-scores A+D (Grounded Mystic detector).
  // -------------------------------------------------------------------------
  {
    id: 'Q7',
    number: 7,
    text: '7. You learn best when you have:',
    scored: true,
    answers: [
      {
        id: 'Q7-A',
        text: 'Clear frameworks, logical progressions, and reliable information.',
        scoring: [w('A')],
      },
      {
        id: 'Q7-B',
        text: 'Hands-on practice—learning by doing, not just reading.',
        scoring: [w('B')],
      },
      {
        id: 'Q7-C',
        text: 'Freedom to explore at your own pace without rigid rules.',
        scoring: [w('C')],
      },
      {
        id: 'Q7-D',
        text: 'Permission to go deep, even into difficult or complex territory.',
        scoring: [w('D')],
      },
      {
        id: 'Q7-E',
        // Intentional dual scoring: Grounded Mystic detector. +4 Air Weaver + +4 Shadow Dancer.
        text: 'Both structure AND room for mystery—I need the framework AND the freedom.',
        scoring: [w('A'), w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q8 — Scored. 5 answers (A-E). CORRECTED: Option A was missing scoring in Tally (+0).
  // Operator-confirmed correction: Q8-A scores Air Weaver +4.
  // Option E dual-scores A+D (Grounded Mystic detector).
  // -------------------------------------------------------------------------
  {
    id: 'Q8',
    number: 8,
    text: '8. When making an important decision you want:',
    scored: true,
    answers: [
      {
        id: 'Q8-A',
        // Tally bug: no conditional logic rule — option A was effectively dead (+0). Corrected to Air Weaver +4.
        text: 'Data, logic, and clear analysis.',
        scoring: [w('A')],
      },
      {
        id: 'Q8-B',
        text: 'To check what my body is telling me.',
        scoring: [w('B')],
      },
      {
        id: 'Q8-C',
        text: 'Time to sit with it and let the answer emerge.',
        scoring: [w('C')],
      },
      {
        id: 'Q8-D',
        text: 'To understand the deeper pattern or lesson underneath.',
        scoring: [w('D')],
      },
      {
        id: 'Q8-E',
        // Intentional dual scoring: Grounded Mystic detector. +4 Air Weaver + +4 Shadow Dancer.
        text: 'I need both the practical AND the mystical—one without the other feels incomplete.',
        scoring: [w('A'), w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q9 — Scored. CORRECTED (two bugs):
  //   Q9-A: Tally fired duplicate rule (+8 Air Weaver). Corrected to single +4.
  //   Q9-D: Tally awarded +4 to all dimensions and Shadow Dancer fired twice (+8 D).
  //          Corrected to Shadow Dancer +4 only.
  // -------------------------------------------------------------------------
  {
    id: 'Q9',
    number: 9,
    text: '9. Imagine watching someone perform something remarkable. What captivates you most?',
    scored: true,
    answers: [
      {
        id: 'Q9-A',
        // Tally bug: duplicate conditional logic rule fired twice (+8 Air Weaver). Corrected to +4 once.
        text: 'The precision—every movement intentional, nothing wasted.',
        scoring: [w('A')],
      },
      {
        id: 'Q9-B',
        text: "The physicality—you can almost feel what they're feeling in your own body.",
        scoring: [w('B')],
      },
      {
        id: 'Q9-C',
        text: "The flow—that effortless quality where everything just... works.",
        scoring: [w('C')],
      },
      {
        id: 'Q9-D',
        // Tally bug: awarded +4 to all dimensions with Shadow Dancer firing twice (+8 D total).
        // Corrected to Shadow Dancer +4 only.
        text: 'The transformation—watching them become something different than when they started.',
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q10 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q10',
    number: 10,
    text: '10. The idea that excites you most about tarot is:',
    scored: true,
    answers: [
      {
        id: 'Q10-A',
        text: 'Having a structured system for gaining clarity and making decisions.',
        scoring: [w('A')],
      },
      {
        id: 'Q10-B',
        text: "A tangible way to connect with intuition I can actually feel.",
        scoring: [w('B')],
      },
      {
        id: 'Q10-C',
        text: 'Exploring symbols and meanings without needing all the answers.',
        scoring: [w('C')],
      },
      {
        id: 'Q10-D',
        text: "Accessing deeper truths about patterns, cycles, and what's really going on.",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q11 — Non-scored. Flow state segmentation. 4 answers (A-D).
  // Note: answer options mirror dimension language but confirmed non-scored in Tally.
  // -------------------------------------------------------------------------
  {
    id: 'Q11',
    number: 11,
    text: "11. When everything clicks and you're fully engaged, it feels like:",
    scored: false,
    answers: [
      {
        id: 'Q11-A',
        text: 'Building something—each piece fitting into place, logic flowing.',
        scoring: [],
      },
      {
        id: 'Q11-B',
        text: 'My body knows what to do without me having to think about it.',
        scoring: [],
      },
      {
        id: 'Q11-C',
        text: "Time disappears and I'm just... present, open, receiving.",
        scoring: [],
      },
      {
        id: 'Q11-D',
        text: 'Something is being revealed—layers peeling back, truth emerging.',
        scoring: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q12 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q12',
    number: 12,
    text: "12. What tends to derail you when you're trying to grow or learn?",
    scored: true,
    answers: [
      {
        id: 'Q12-A',
        text: "Too much conflicting information—hard to know what's actually reliable.",
        scoring: [w('A')],
      },
      {
        id: 'Q12-B',
        text: 'Losing momentum when life gets busy or practice feels abstract.',
        scoring: [w('B')],
      },
      {
        id: 'Q12-C',
        text: "Worrying I'm 'doing it wrong' or not making progress fast enough.",
        scoring: [w('C')],
      },
      {
        id: 'Q12-D',
        text: 'Either going too deep too fast, or avoiding the shadow stuff entirely.',
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q13 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q13',
    number: 13,
    text: '13. What would make learning a symbolic system (like tarot) frustrating for you?',
    scored: true,
    answers: [
      {
        id: 'Q13-A',
        text: 'No logical framework—just memorize 78 random things.',
        scoring: [w('A')],
      },
      {
        id: 'Q13-B',
        text: 'Too abstract—I need to feel it or do something with it.',
        scoring: [w('B')],
      },
      {
        id: 'Q13-C',
        text: "Too many rigid rules about the 'right way' to do it.",
        scoring: [w('C')],
      },
      {
        id: 'Q13-D',
        text: 'Too shallow—surface keywords instead of real depth.',
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q14 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q14',
    number: 14,
    text: '14. Right now, you\'d most want tarot to help you:',
    scored: true,
    answers: [
      {
        id: 'Q14-A',
        text: 'Make clearer decisions with confidence.',
        scoring: [w('A')],
      },
      {
        id: 'Q14-B',
        text: 'Reconnect with intuition in a way that feels real and grounded.',
        scoring: [w('B')],
      },
      {
        id: 'Q14-C',
        text: 'Understand yourself without needing definitive answers.',
        scoring: [w('C')],
      },
      {
        id: 'Q14-D',
        text: "Navigate something you've been avoiding or transform a stuck pattern.",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q15 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q15',
    number: 15,
    text: '15. You feel most alive when:',
    scored: true,
    answers: [
      {
        id: 'Q15-A',
        text: 'Mastering something complex or solving a problem others couldn\'t.',
        scoring: [w('A')],
      },
      {
        id: 'Q15-B',
        text: 'Fully in your body—present, physical, sensation-aware.',
        scoring: [w('B')],
      },
      {
        id: 'Q15-C',
        text: 'In creative flow, following curiosity wherever it leads.',
        scoring: [w('C')],
      },
      {
        id: 'Q15-D',
        text: "Going through meaningful change, even when it's uncomfortable.",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q16 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q16',
    number: 16,
    text: '16. \'Defying gravity\' makes you think of:',
    scored: true,
    answers: [
      {
        id: 'Q16-A',
        text: 'Achieving something that seemed impossible through skill and effort.',
        scoring: [w('A')],
      },
      {
        id: 'Q16-B',
        text: 'The physical thrill of movement, lift, suspension.',
        scoring: [w('B')],
      },
      {
        id: 'Q16-C',
        text: "Letting go of what's weighing you down.",
        scoring: [w('C')],
      },
      {
        id: 'Q16-D',
        text: "Transcending old patterns—becoming who you're meant to be.",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q17 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q17',
    number: 17,
    text: "17. When someone says something that doesn't make logical sense, you:",
    scored: true,
    answers: [
      {
        id: 'Q17-A',
        text: "Try to understand their reasoning—there must be a framework I'm missing.",
        scoring: [w('A')],
      },
      {
        id: 'Q17-B',
        text: 'Notice how it lands in your body—does it feel true or off?',
        scoring: [w('B')],
      },
      {
        id: 'Q17-C',
        text: "Stay curious—maybe there's something here I don't understand yet.",
        scoring: [w('C')],
      },
      {
        id: 'Q17-D',
        text: "Look for what's underneath—what are they really trying to express?",
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q18 — Scored. Clean A=A, B=B, C=C, D=D.
  // -------------------------------------------------------------------------
  {
    id: 'Q18',
    number: 18,
    text: '18. If this quiz reveals something true about you, you\'ll want to:',
    scored: true,
    answers: [
      {
        id: 'Q18-A',
        text: 'Understand the practical implications—how do I use this?',
        scoring: [w('A')],
      },
      {
        id: 'Q18-B',
        text: "Feel it resonate in my body before I do anything with it.",
        scoring: [w('B')],
      },
      {
        id: 'Q18-C',
        text: 'Let it unfold over time, see where it leads.',
        scoring: [w('C')],
      },
      {
        id: 'Q18-D',
        text: 'Go deeper—what does this mean about my path and growth?',
        scoring: [w('D')],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q19 — Non-scored. Product research (card back preference). 2 answers (A-B).
  // -------------------------------------------------------------------------
  {
    id: 'Q19',
    number: 19,
    text: '19. Card Back Preference?',
    scored: false,
    answers: [
      {
        id: 'Q19-A',
        text: 'Fully Reversible',
        scoring: [],
      },
      {
        id: 'Q19-B',
        text: 'Distinct Top and Bottom',
        scoring: [],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Q20 — Non-scored. Product research (desired learning format). 5 answers (A-E).
  // -------------------------------------------------------------------------
  {
    id: 'Q20',
    number: 20,
    text: '20. If we created something to deepen your practice, what would actually serve you?',
    scored: false,
    answers: [
      {
        id: 'Q20-A',
        text: 'An Online Course (video lessons on reading with the deck)',
        scoring: [],
      },
      {
        id: 'Q20-B',
        text: 'A Live Virtual Workshop (interactive sessions with the deck creator)',
        scoring: [],
      },
      {
        id: 'Q20-C',
        text: 'An Expanded Guide Book (in depth card meanings, spreads and quality)',
        scoring: [],
      },
      {
        id: 'Q20-D',
        text: 'A Live Aerial Tarot Reading Show',
        scoring: [],
      },
      {
        id: 'Q20-E',
        text: 'Honestly, none of the above',
        scoring: [],
      },
    ],
  },
];
