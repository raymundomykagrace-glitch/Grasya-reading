'use strict';

/**
 * Section blueprints derived from the "We Level Up" SOP reference document.
 * Each SOP type has its own architecture, word-count target, and focus —
 * mirroring the real content specs (Addiction, Mental Health/Condition,
 * Levels-of-Care, Program Modality, Therapy Modality) instead of one
 * generic template reused for everything.
 */
const SOP_BLUEPRINTS = {
  'Addiction': {
    label: 'Addiction / Substance Use Disorder (SUD)',
    wordCount: '1,800–2,400',
    focus:
      'Educate the reader about a substance or addiction topic: what it is, who is at risk, ' +
      'how it takes hold, how it is treated, and how someone decides to get help. This mirrors ' +
      'a clinical-education-to-admissions journey, not a marketing brochure.',
    sections: [
      'Opening definition — what this addiction/substance is, in plain language, including common names or forms if relevant',
      'Who is most at risk (risk factors, vulnerable groups, contraindications, or situations that raise risk)',
      'Signs and symptoms of addiction (bulleted list, 6–8 concrete, observable signs)',
      'Why it becomes addictive — brain and body mechanisms explained in plain language, not jargon',
      'The importance of medically supervised detox or safe withdrawal (dangers of stopping alone, what supervision provides)',
      'How this kind of addiction is treated — overview of evidence-based therapies, each with a one- to two-sentence plain-language explanation',
      'Levels of care explained (e.g., medical detox, residential, PHP, IOP, outpatient, telehealth) as short, distinct paragraphs',
      'The role of mental health and co-occurring disorders (dual diagnosis, why treating both together matters)',
      'The importance of a strong support network (peer support, alumni-style community, family involvement)',
      'Is treatment right for you or a loved one? (qualifying, self-reflective questions — not diagnostic claims)',
      'Getting started: assessment and insurance basics, written generically (no invented facility names, phone numbers, or accreditation claims)',
      'Closing: hopeful, action-oriented next step'
    ]
  },
  'Mental Health': {
    label: 'Mental Health (Condition-Specific)',
    wordCount: '2,000–2,600',
    focus:
      'Educate the reader about a specific mental health condition: what it is, how it presents, ' +
      'how it is diagnosed and treated, and how it connects to substance use. This is a ' +
      'research-mode education page that should build trust before pointing toward care.',
    sections: [
      'Opening — define the condition, note how common it is in general terms, and connect it to why treatment matters',
      'What is [condition]? — clear clinical definition in plain language, distinguishing it from normal everyday stress or emotion',
      '[Condition] and related conditions — how it overlaps with mood, trauma, or other common co-occurring issues',
      'Common types or presentations of [condition] (bulleted, 4–6 items, each with a one-sentence description)',
      'Common symptoms of [condition] (bulleted, 6–10 concrete, everyday-language symptoms)',
      'How [condition] is diagnosed — what a professional evaluation involves, in plain language',
      'Evidence-based treatment approaches — talk therapy, medication support (when appropriate), and integrated/dual-diagnosis care',
      'What treatment looks like day to day (bulleted list of typical activities: individual sessions, group work, skill-building, check-ins)',
      'Co-occurring disorders and [condition] — a short table or list pairing this condition with how it commonly intersects with substance use',
      'Levels of care for [condition] treatment — brief overview of inpatient, outpatient, and telehealth options and who tends to fit each',
      'How long does treatment usually take? — explain that it varies and what affects that timeline',
      'Taking the next step — empathetic, non-alarmist closing with a clear call to action'
    ]
  },
  'Levels-of-Care': {
    label: 'Levels of Care',
    wordCount: '1,300–1,700',
    focus:
      'Explain ONE specific level of care (e.g., medical detox, residential, PHP, IOP, outpatient, ' +
      'or telehealth) in enough depth that a reader in decision-mode can tell whether it fits their ' +
      'situation and how it compares to the levels above and below it.',
    sections: [
      'What this level of care means — plain-language definition and how it contrasts with the level above and below it',
      'Who is a good fit — concrete indicators someone might see in themselves or a loved one',
      'What happens during treatment at this level — daily structure, supervision, and clinical involvement',
      'Conditions commonly addressed at this level of care',
      'Therapies and services typically included',
      'Benefits of this level of care (bulleted, 5–7 items)',
      'How this level compares to other levels of care — a clear-eyed comparison, not a sales pitch',
      'How long this level of care typically lasts, and what affects that',
      'What happens after — how people usually step down or transition to continued care',
      'Starting the process — what an assessment and admission generally involves, described generically',
      'Is this level right for you or a loved one? — reflective, non-diagnostic self-check questions'
    ]
  },
  'Program': {
    label: 'Program Modality',
    wordCount: '1,300–1,900',
    focus:
      'Explain ONE specific program or therapeutic track (e.g., 12-Step, aftercare, faith-based, ' +
      'trauma-focused, relapse prevention, family programs) — what it is, how it works, and how it ' +
      'fits inside a broader treatment plan, without claiming it is the only path to recovery.',
    sections: [
      'What this program is — plain-language definition and, if genuinely relevant, a brief note on its origin or background',
      'Understanding how the program works — core principles and what participation actually looks like',
      'How it compares to related approaches (only if a natural comparison exists — do not force one)',
      'How this program fits into a fuller treatment plan alongside clinical care',
      'Benefits of this program (bulleted, 5–8 items)',
      'Who tends to benefit most from this program',
      'Types or variations of this program, if relevant (bulleted)',
      'What to expect when someone first starts',
      'Common questions people have before committing',
      'Taking the next step — encouraging, non-pressuring closing'
    ]
  },
  'Therapy': {
    label: 'Therapy Modality',
    wordCount: '1,900–2,500',
    focus:
      'Explain ONE specific evidence-based therapy (e.g., CBT, DBT, EMDR, family therapy, ' +
      'motivational interviewing) — what problem it solves, how a session actually works, and what ' +
      'conditions it is used for, grounded in concrete, relatable examples.',
    sections: [
      'Opening — the everyday challenge or pattern this therapy is designed to address',
      'Understanding this therapy — plain-language definition, core philosophy, and (if genuinely known) brief origin',
      'What to expect: how the therapy works (bulleted, 4–5 steps or components of a typical process)',
      'How this therapy helps in real situations (2–4 short, concrete, relatable scenarios — not clinical abstractions)',
      'Benefits of this therapy (bulleted, 6–8 items)',
      'How this therapy is used in practice — specific techniques or tools someone might actually do',
      'Conditions and concerns this therapy can help with (bulleted, grouped naturally, e.g., substance use vs. mental health)',
      'How this therapy compares to a closely related approach (only if a natural, well-known comparison exists)',
      'What a typical session or typical course of treatment looks like',
      'Getting started with this kind of therapy — encouraging, practical closing'
    ]
  }
};

const AUDIENCE_GUIDANCE = {
  'Research-mode': {
    label: 'Research-mode',
    guidance:
      'The reader is early in their journey and mostly wants to understand the topic. Lead with ' +
      'education and context. Keep calls to action gentle and infrequent — one soft mention near the ' +
      'end is enough. Avoid urgency language.'
    },
  'Decision-mode': {
    label: 'Decision-mode',
    guidance:
      'The reader already understands the basics and is comparing options. Lean into clear ' +
      'comparisons, concrete specifics, and "who this is right for" framing. A moderate, confident ' +
      'call to action near the end is appropriate.'
  },
  'Action-mode': {
    label: 'Action-mode',
    guidance:
      'The reader is close to reaching out for help. Keep education tight, foreground practical next ' +
      'steps (what an assessment looks like, what to expect calling in), and close with a clear, ' +
      'warm, direct call to action. Do not be pushy or use fear-based urgency.'
  }
};

function escapeForPrompt(value) {
  return String(value ?? '').trim();
}

function buildPrompt({ title, primaryKeywords, secondaryKeywords, sopType, audience, pageUrl }) {
  const blueprint = SOP_BLUEPRINTS[sopType];
  if (!blueprint) {
    throw new Error(`Unknown sopType "${sopType}". Expected one of: ${Object.keys(SOP_BLUEPRINTS).join(', ')}`);
  }

  const audienceInfo = AUDIENCE_GUIDANCE[audience];
  if (!audienceInfo) {
    throw new Error(`Unknown audience "${audience}". Expected one of: ${Object.keys(AUDIENCE_GUIDANCE).join(', ')}`);
  }

  const cleanTitle = escapeForPrompt(title);
  const primaryList = escapeForPrompt(primaryKeywords)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const secondaryList = escapeForPrompt(secondaryKeywords)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const cleanUrl = escapeForPrompt(pageUrl);

  let origin = 'https://example.com';
  let urlPath = '/page';
  if (cleanUrl) {
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
      origin = `${parsed.protocol}//${parsed.host}`;
      urlPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/page';
    } catch (err) {
      // fall back to placeholders if the URL doesn't parse
    }
  }

  const sectionList = blueprint.sections.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const system = `You are an expert medical/behavioral-health content writer who specializes in ` +
    `writing original, human-sounding web content for addiction and mental health treatment ` +
    `websites. You follow strict internal Standard Operating Procedures (SOPs) for structure, ` +
    `readability, and SEO. You never plagiarize, never reuse boilerplate paragraphs between ` +
    `sections, and never fabricate statistics, studies, citations, facility names, accreditations, ` +
    `phone numbers, or addresses that were not given to you.

HARD RULES — violating any of these makes the output unusable:

1. READABILITY (Grade 6):
   - Average sentence length 16–20 words. Vary it — mix some shorter punchy sentences with the ` +
    `longer ones so it doesn't feel mechanical, but keep the average in that range.
   - Use simple, everyday words. If you must use a clinical term (e.g., "benzodiazepine," ` +
    `"tolerance," "dual diagnosis"), define it in the same sentence or the next one.
   - Paragraphs are 3–4 sentences MAX. No exceptions. Break longer thoughts into multiple ` +
    `paragraphs.
   - Minimize passive voice. Write like you're explaining this to a smart, worried friend, not ` +
    `presenting a clinical abstract.

2. UNIQUENESS AND VARIETY:
   - Every section must sound like it was written fresh for THIS topic. Do not reuse generic ` +
    `filler phrases like "In today's world," "It's important to note," "When it comes to," or ` +
    `similar template language.
   - Vary the shape of sections: some should open with a short scenario or relatable moment, some ` +
    `with a direct definition, some with a question, some with a bulleted list intro. Do not let ` +
    `every section follow the identical "topic sentence + three supporting sentences" pattern.
   - Use specific, concrete details and examples instead of vague generalities. Instead of ` +
    `"many people struggle with this," give a believable, specific illustration of what that looks ` +
    `like day to day.
   - Never repeat the same sentence structure, phrase, or transition word more than twice across ` +
    `the whole piece.

3. KEYWORDS:
   - Primary keywords: ${primaryList.length ? primaryList.join(', ') : '(none provided)'}
   - Secondary keywords: ${secondaryList.length ? secondaryList.join(', ') : '(none provided)'}
   - Weave these in naturally across multiple sections — never force a keyword into a sentence ` +
    `where it reads awkwardly, and never keyword-stuff. Each primary keyword should appear several ` +
    `times across the piece; secondary keywords should appear at least once or twice, only where ` +
    `they fit naturally.

4. FACTUAL HONESTY:
   - Do not invent statistics, named studies, citation numbers, or named organizations' findings. ` +
    `You may reference well-known, general public knowledge (e.g., "millions of people in the ` +
    `U.S. experience anxiety each year") without a fabricated citation, but do not attach a fake ` +
    `percentage, fake study name, or fake year to it.
   - Do not invent a facility name, phone number, physical address, license/accreditation, staff ` +
    `name, or "number of locations" claim. If the content needs to reference "the treatment team" ` +
    `or "admissions," write it generically (e.g., "our admissions team," "a treatment provider") ` +
    `without inventing specifics.
   - Never present this content as medical advice or a diagnosis. Encourage professional ` +
    `evaluation where relevant.

5. STRUCTURE — this page is a "${blueprint.label}" SOP page. ${blueprint.focus}
   Target word count for the main content: ${blueprint.wordCount} words (not counting the FAQ or ` +
    `schema JSON).
   Use ${blueprint.sections.length} distinct sections. Use the list below as your structural ` +
    `guide — adapt the wording of each heading naturally to the actual topic (do not just copy the ` +
    `bracketed placeholder text verbatim), keep the sections in this order, and give each one its ` +
    `own "##" Markdown heading:
${sectionList}

   Where a section calls for a bulleted list, use Markdown "-" bullets. Keep bullets tight — one ` +
    `line each, no sub-paragraphs inside bullets.

6. AUDIENCE MODE: ${audienceInfo.label}. ${audienceInfo.guidance}

7. TONE: Warm, human, and conversational, but credible — like a knowledgeable person who cares, ` +
    `not a brochure. Avoid alarmist or fear-based language. Avoid stigmatizing language about ` +
    `addiction or mental illness (e.g., never say "addict" or "junkie" — say "a person with ` +
    `addiction" or similar person-first language).

8. FAQ: End the main content with a "## Frequently Asked Questions" section containing 5–6 ` +
    `question-and-answer pairs relevant to this specific topic and audience mode. Format each as ` +
    `"**Question text**" on its own line followed by a 2–4 sentence answer paragraph.

OUTPUT FORMAT — follow this exactly, in this order, with nothing before or after it:

1. A line starting with "# " followed by an H1 headline for the page (include the primary ` +
    `keyword naturally).
2. A line "Meta Title: " followed by a meta title under 60 characters.
3. A line "Meta Description: " followed by a meta description under 155 characters that includes ` +
    `a soft call to action.
4. A blank line, then the full Markdown content: all ${blueprint.sections.length} sections as "## ` +
    `" headings with their content, followed by the "## Frequently Asked Questions" section.
5. Then, on its own line, the exact literal marker: ===SCHEMA_JSON===
6. Immediately after that marker, a SINGLE valid JSON object (no Markdown code fences, no ` +
    `commentary, nothing else) with exactly these four keys:
   - "metaTitle": the same meta title from step 2
   - "metaDescription": the same meta description from step 3
   - "faqSchema": a complete schema.org FAQPage JSON-LD object built from the FAQ you wrote ` +
    `(https://schema.org/FAQPage, with "mainEntity" as an array of Question/Answer pairs)
   - "organizationSchema": a schema.org Organization JSON-LD object. Since no real business ` +
    `details were provided, use the placeholder string "[Organization Name]" for "name", ` +
    `"${origin}" for "url", "[Phone Number]" for "telephone", and a "PostalAddress" object with ` +
    `"[Street Address]", "[City]", "[State]", "[ZIP]" placeholders — do not invent real-looking ` +
    `values.
   - "breadcrumbSchema": a schema.org BreadcrumbList JSON-LD object with three items: "Home" ` +
    `pointing to "${origin}", a middle item named "${blueprint.label}" pointing to ` +
    `"${origin}${urlPath.replace(/\/$/, '')}", and a final item named after the page's H1 pointing ` +
    `to "${cleanUrl || origin + urlPath}".

Do not wrap the JSON in triple backticks. Do not add any text after the JSON object. The JSON ` +
    `must be syntactically valid — it will be parsed programmatically.`;

  const user = `Generate a complete "${blueprint.label}" page.

Page Title: ${cleanTitle}
Page URL: ${cleanUrl || '(not provided — use placeholder domain in schemas)'}
Primary Keywords: ${primaryList.join(', ') || '(none provided)'}
Secondary Keywords: ${secondaryList.join(', ') || '(none provided)'}
SOP Type: ${blueprint.label}
Audience Mode: ${audienceInfo.label}

Write the complete page now, following every rule and the exact output format from your ` +
    `instructions. Remember: fresh, specific, human-sounding writing in every section — no ` +
    `templated filler, no invented facts.`;

  return { system, user };
}

module.exports = { buildPrompt, SOP_BLUEPRINTS, AUDIENCE_GUIDANCE };
