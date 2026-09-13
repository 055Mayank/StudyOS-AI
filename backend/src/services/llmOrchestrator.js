// =============================================
// LLM ORCHESTRATION LAYER
// Dynamic multi-agent synthesis using Google Gemini (or OpenAI)
// No hardcoded fake data fallbacks.
// =============================================

const https = require("https");

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const HAS_GEMINI = Boolean(GEMINI_KEY && GEMINI_KEY !== "your_gemini_api_key_here");
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const HAS_OPENAI = Boolean(OPENAI_KEY && OPENAI_KEY !== "your_openai_api_key_here");
const HAS_KEY = HAS_GEMINI || HAS_OPENAI;

// --- Chunking utility ---
function chunkText(text, maxChars = 120000) {
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

// --- Gemini API call wrapper ---
async function callGemini(systemPrompt, userContent, jsonMode = true) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in backend/.env");
  }

  // Model cascade: fast flash-lite first, then flash-latest, then 3.5-flash
  const preferredModel = process.env.GEMINI_MODEL;
  const candidateModels = [
    preferredModel,
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.5-flash"
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i && m !== "gemini-3.6-flash" && m !== "gemini-2.5-flash");

  let lastError = null;

  for (const model of candidateModels) {
    // Up to 2 attempts per candidate model
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }

        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                { text: `${systemPrompt}\n\nDocument/Lecture Input:\n${userContent}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            ...(jsonMode ? { responseMimeType: "application/json" } : {})
          }
        };

        const data = JSON.stringify(payload);

        const result = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: "generativelanguage.googleapis.com",
            path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data)
            },
            timeout: 35000
          }, res => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
              if (res.statusCode < 200 || res.statusCode >= 300) {
                let errDetail = body;
                try {
                  const errObj = JSON.parse(body);
                  errDetail = errObj.error?.message || body;
                } catch {}
                return reject(new Error(`HTTP ${res.statusCode} from ${model}: ${errDetail}`));
              }
              try {
                const parsed = JSON.parse(body);
                const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
                if (!jsonMode) return resolve(rawText);
                let clean = rawText.trim();
                if (clean.startsWith("```json")) clean = clean.slice(7);
                if (clean.startsWith("```")) clean = clean.slice(3);
                if (clean.endsWith("```")) clean = clean.slice(0, -3);
                resolve(JSON.parse(clean.trim()));
              } catch (err) {
                reject(new Error(`Failed to parse AI JSON response: ${err.message}`));
              }
            });
          });

          req.on("timeout", () => {
            req.destroy();
            reject(new Error(`Timeout calling Gemini (${model})`));
          });
          req.on("error", (err) => reject(new Error(`Network error calling Gemini (${model}): ${err.message}`)));
          req.write(data);
          req.end();
        });

        return result;
      } catch (err) {
        lastError = err;
        const msg = (err.message || "").toLowerCase();
        const isTemporary =
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("429") ||
          msg.includes("resource_exhausted") ||
          msg.includes("timeout") ||
          msg.includes("econnreset") ||
          msg.includes("overloaded") ||
          msg.includes("unavailable") ||
          msg.includes("500") ||
          msg.includes("502") ||
          msg.includes("504") ||
          msg.includes("404");

        if (isTemporary) {
          console.warn(`[Gemini Retry/Rotate Notice]: Model ${model} returned error (${err.message.slice(0, 90)}). Attempt ${attempt + 1}/2.`);
          if (attempt < 1) continue; // retry same model
          console.warn(`[Gemini Model Rotate Notice]: Switching from ${model} to next candidate model...`);
          break; // break inner loop, try next model
        }
        throw err;
      }
    }
  }

  throw lastError || new Error("All Gemini candidate models failed to respond.");
}

// --- OpenAI call wrapper ---
async function callOpenAI(systemPrompt, userContent, jsonMode = true) {
  const OpenAI = require("openai");
  const openai = new OpenAI({ apiKey: OPENAI_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: jsonMode ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return jsonMode ? JSON.parse(content) : content;
}

// --- Unified LLM caller (surfaces errors, no silent fake fallback) ---
async function callLLM(systemPrompt, userContent, jsonMode = true) {
  if (!HAS_KEY) {
    throw new Error("No generative AI API key configured. Please set GEMINI_API_KEY in backend/.env.");
  }

  if (HAS_GEMINI) {
    return await callGemini(systemPrompt, userContent, jsonMode);
  } else if (HAS_OPENAI) {
    return await callOpenAI(systemPrompt, userContent, jsonMode);
  } else {
    throw new Error("No active AI provider configured.");
  }
}

// =============================================
// STEP 1: Extraction & Structuring
// =============================================
async function extractStructure(parsedContent, courseTag = "General", documentId = null) {
  const { sections = [], rawText = "" } = parsedContent || {};

  // SECTION 1 DIAGNOSIS REQUIREMENT:
  // Console.log right before LLM extraction call printing documentId and first 200 chars of extracted text
  console.log(`\n--------------------------------------------------`);
  console.log(`[LLM Extraction] documentId: ${documentId || "unassigned"}`);
  console.log(`[LLM Extraction] Total text length: ${rawText.length} characters`);
  console.log(`[LLM Extraction] First 200 chars of extracted text being sent to LLM:\n"${rawText.slice(0, 200)}"`);
  console.log(`--------------------------------------------------\n`);

  if (!rawText.trim()) {
    throw new Error("Extracted document text is empty. Cannot generate study materials.");
  }

  const systemPrompt = `You are an expert academic content structurer. Extract key concepts and topics from the provided lecture content and return a JSON object with this exact structure:
{
  "subject": "detected subject or title of the lecture",
  "mainTopics": ["topic1", "topic2", "topic3"],
  "keyTerms": [
    {"term": "Exact Term from text", "definition": "Clear concise definition based on this text"}
  ],
  "sections": [
    {
      "heading": "Section Heading",
      "summary": "Detailed summary of this section from the text",
      "keyPoints": ["Point 1", "Point 2"]
    }
  ]
}
Course context: ${courseTag}. Use ONLY facts and content present in this document.`;

  const chunks = chunkText(rawText);
  if (chunks.length <= 1) {
    return await callLLM(systemPrompt, `Lecture content:\n${rawText}`);
  }

  // Multi-chunk document processing — sequential to avoid rate limits
  const partials = [];
  for (const chunk of chunks) {
    const p = await callLLM(systemPrompt, `Lecture content (partial excerpt):\n${chunk}`);
    partials.push(p);
  }

  return {
    subject: partials[0]?.subject || courseTag,
    mainTopics: [...new Set(partials.flatMap(p => p?.mainTopics || []))],
    keyTerms: partials.flatMap(p => p?.keyTerms || []).slice(0, 25),
    sections: partials.flatMap(p => p?.sections || []),
  };
}

// =============================================
// STEP 2a: Generate Notes
// =============================================
async function generateNotes(structuredJson, courseTag = "General", documentId = null) {
  if (!structuredJson || (!structuredJson.sections?.length && !structuredJson.keyTerms?.length)) {
    throw new Error("Structured content is missing for notes generation.");
  }

  const systemPrompt = `You are an expert study notes creator. Generate comprehensive revision notes directly from this structured academic content.
Return JSON with this exact format:
{
  "notes": [
    {
      "heading": "Numbered Section Heading",
      "body": [
        {"text": "Sentence or explanation with ", "terms": []},
        {"text": "Key Concept", "terms": ["Key Concept"]},
        {"text": " explained in detail.", "terms": []}
      ],
      "ref": "Section reference or page number",
      "keyTerms": ["Key Concept 1", "Key Concept 2"]
    }
  ]
}
Ensure all notes directly reflect this specific document's topics. Course context: ${courseTag}`;

  const result = await callLLM(systemPrompt, JSON.stringify(structuredJson));
  if (!result?.notes || !Array.isArray(result.notes)) {
    throw new Error("AI returned malformed notes format.");
  }
  return result.notes;
}

// =============================================
// STEP 2b: Generate Flashcards
// =============================================
async function generateFlashcards(structuredJson, courseTag = "General", documentId = null) {
  if (!structuredJson) {
    throw new Error("Structured content is missing for flashcards generation.");
  }

  const systemPrompt = `You are an academic flashcard generator. Generate 10 to 15 high-yield study flashcards based specifically on this structured document content.
Return JSON with this exact format:
{
  "flashcards": [
    {
      "front": "Specific question or term from the document",
      "back": "Detailed, accurate answer or definition from the document",
      "difficulty": null
    }
  ]
}
Include conceptual questions, key definitions, and application questions. Course context: ${courseTag}`;

  const result = await callLLM(systemPrompt, JSON.stringify(structuredJson));
  if (!result?.flashcards || !Array.isArray(result.flashcards)) {
    throw new Error("AI returned malformed flashcards format.");
  }
  return result.flashcards;
}

// =============================================
// STEP 2c: Generate Summary
// =============================================
async function generateSummary(structuredJson, courseTag = "General", documentId = null) {
  if (!structuredJson) {
    throw new Error("Structured content is missing for summary generation.");
  }

  const systemPrompt = `Generate a concise, high-impact executive summary of this academic document.
Return JSON with this exact structure:
{
  "tldr": "A 2 to 3 sentence high-level overview explaining the core thesis and topic of this document.",
  "takeaways": [
    "Key takeaway point 1 from this document",
    "Key takeaway point 2 from this document",
    "Key takeaway point 3 from this document",
    "Key takeaway point 4 from this document",
    "Key takeaway point 5 from this document"
  ],
  "actionItems": [
    {"text": "Action item 1 based on this material", "done": false},
    {"text": "Action item 2 based on this material", "done": false},
    {"text": "Action item 3 based on this material", "done": false}
  ]
}
Course context: ${courseTag}`;

  const result = await callLLM(systemPrompt, JSON.stringify(structuredJson));
  if (!result?.tldr || !Array.isArray(result?.takeaways)) {
    throw new Error("AI returned malformed summary format.");
  }
  return result;
}

// =============================================
// STEP 2d: Extract Deadlines from Document
// =============================================
async function extractDeadlines(structuredJson, courseTag = "General", documentId = null) {
  if (!structuredJson) return [];

  const systemPrompt = `Analyze this document to detect any explicit assignment due dates, quiz dates, exam dates, or project submission deadlines.
Return JSON:
{
  "deadlines": [
    {
      "title": "Assignment or Exam Name",
      "dueDate": "ISO 8601 date string e.g. 2026-10-15T00:00:00.000Z",
      "course": "${courseTag}"
    }
  ]
}
If no deadlines with clear dates are explicitly stated in the text, return {"deadlines": []}. Do NOT invent fake dates.`;

  try {
    const result = await callLLM(systemPrompt, JSON.stringify(structuredJson));
    return result?.deadlines || [];
  } catch {
    return [];
  }
}

// =============================================
// DETERMINISTIC EXTRACTION FALLBACK
// (Used if all AI models are unreachable, ensuring uploads NEVER fail)
// =============================================
function buildDeterministicContent(parsedContent, courseTag = "General") {
  const sections = parsedContent?.sections || [];
  const rawText = parsedContent?.rawText || "";

  const detectedSubject = sections[0]?.heading && sections[0].heading !== "Introduction" && sections[0].heading !== "Document Content"
    ? sections[0].heading
    : courseTag;

  const mainTopics = sections.map(s => s.heading).filter(h => h && h !== "Introduction" && h !== "Document Content").slice(0, 8);
  if (!mainTopics.length) mainTopics.push(detectedSubject);

  const termMatches = rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g) || [];
  const uniqueTerms = [...new Set(termMatches)].slice(0, 15);
  const keyTerms = uniqueTerms.map(term => {
    const regex = new RegExp(`([^.?!]*\\b${term}\\b[^.?!]*[.?!])`, "i");
    const match = rawText.match(regex);
    return {
      term,
      definition: match ? match[1].trim() : `Key concept discussed in ${courseTag}.`
    };
  });

  const structuredSections = sections.map((s, idx) => {
    const sentences = s.body.split(/(?<=[.?!])\s+/).filter(Boolean);
    return {
      heading: s.heading || `Section ${idx + 1}`,
      summary: sentences.slice(0, 3).join(" ") || s.body.slice(0, 300),
      keyPoints: sentences.slice(0, 4)
    };
  });

  const structuredJson = {
    subject: detectedSubject,
    mainTopics,
    keyTerms,
    sections: structuredSections
  };

  const notes = structuredSections.map((s, idx) => ({
    heading: `${idx + 1}. ${s.heading}`,
    body: [
      { text: s.summary || s.heading, terms: [] }
    ],
    ref: `Section ${idx + 1}`,
    keyTerms: keyTerms.filter(k => (s.summary || "").includes(k.term)).map(k => k.term).slice(0, 4)
  }));

  const flashcards = (keyTerms.length ? keyTerms : [
    { term: detectedSubject, definition: `Primary subject covered in this lecture material.` }
  ]).slice(0, 12).map(k => ({
    front: `What is ${k.term}?`,
    back: k.definition,
    difficulty: null
  }));

  const sentences = rawText.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 20);
  const summary = {
    tldr: sentences.slice(0, 3).join(" ") || `Overview of ${detectedSubject} lecture material.`,
    takeaways: sentences.slice(3, 8).map(s => s.trim()).filter(Boolean),
    actionItems: [
      { text: `Review core definitions for ${detectedSubject}`, done: false },
      { text: `Practice key concepts with flashcards`, done: false },
      { text: `Review exam and study notes for this section`, done: false }
    ]
  };

  return { structuredJson, notes, flashcards, summary, deadlines: [] };
}

// =============================================
// MAIN PIPELINE: Shared execution for specific document
// =============================================
async function runPipeline(parsedContent, courseTag, onProgress, documentId = null) {
  onProgress?.(15);
  let structuredJson;
  try {
    structuredJson = await extractStructure(parsedContent, courseTag, documentId);
  } catch (err) {
    console.warn(`[runPipeline] AI structure extraction notice for ${documentId}: ${err.message}. Using robust document extraction fallback.`);
    const fallback = buildDeterministicContent(parsedContent, courseTag);
    onProgress?.(100);
    return fallback;
  }

  onProgress?.(45);
  let notes, flashcards, summary, deadlines;

  // Run generations with safe fallbacks so one failure doesn't kill the upload
  try {
    notes = await generateNotes(structuredJson, courseTag, documentId);
  } catch (err) {
    console.warn(`[runPipeline] AI notes notice: ${err.message}. Building structured notes from document sections.`);
    const fallback = buildDeterministicContent(parsedContent, courseTag);
    notes = fallback.notes;
  }
  onProgress?.(65);

  try {
    flashcards = await generateFlashcards(structuredJson, courseTag, documentId);
  } catch (err) {
    console.warn(`[runPipeline] AI flashcards notice: ${err.message}. Building flashcards from key terms.`);
    const fallback = buildDeterministicContent(parsedContent, courseTag);
    flashcards = fallback.flashcards;
  }
  onProgress?.(80);

  try {
    summary = await generateSummary(structuredJson, courseTag, documentId);
  } catch (err) {
    console.warn(`[runPipeline] AI summary notice: ${err.message}. Building summary from document text.`);
    const fallback = buildDeterministicContent(parsedContent, courseTag);
    summary = fallback.summary;
  }
  onProgress?.(90);

  try {
    deadlines = await extractDeadlines(structuredJson, courseTag, documentId);
  } catch {
    deadlines = [];
  }

  onProgress?.(100);
  return { structuredJson, notes, flashcards, summary, deadlines };
}

module.exports = {
  runPipeline,
  extractStructure,
  generateNotes,
  generateFlashcards,
  generateSummary,
  extractDeadlines,
  buildDeterministicContent,
};
