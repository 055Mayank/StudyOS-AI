// =============================================
// CLIENT WORKSPACE ENGINE
// Autonomous client-side parser, LLM generator,
// and localStorage persistence for static deployments (Vercel)
// =============================================

export const GOOGLE_CLIENT_ID = "341035745520-bmf13rfuu220g3r4gd326mcpchukkv99.apps.googleusercontent.com";

export function getStoredApiKey() {
  return localStorage.getItem("studyos_gemini_key") || import.meta.env?.VITE_GEMINI_API_KEY || "";
}

export function setStoredApiKey(key) {
  if (key) localStorage.setItem("studyos_gemini_key", key);
}

// --- Parse text from browser File ---
export async function parseFileClient(file) {
  const name = file.name.toLowerCase();

  let rawText = "";
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    rawText = await file.text();
  } else if (name.endsWith(".pdf") || file.type === "application/pdf") {
    rawText = await extractPdfText(file);
  } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
    rawText = await extractDocxText(file);
  } else {
    try {
      rawText = await file.text();
    } catch {
      rawText = "Document content extracted from " + file.name;
    }
  }

  // Clean rawText
  rawText = rawText.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!rawText || rawText.length < 20) {
    rawText = `Lecture and study notes for ${file.name}.\n\nKey topic introduction and fundamentals.\nCore definitions, principles, and revision points.`;
  }

  // Segment into sections
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const sections = [];
  let current = { heading: "Introduction", body: "" };

  for (const line of lines) {
    const isHeading =
      (line.length < 60 && /^[A-Z0-9\s:.-]{3,60}$/.test(line)) ||
      /^(Chapter|Unit|Section|\d+[\.\)])\s/i.test(line) ||
      line.startsWith("#");

    if (isHeading && current.body.length > 60) {
      sections.push({ ...current });
      current = { heading: line.replace(/^#+\s*/, "").trim(), body: "" };
    } else {
      current.body += (current.body ? " " : "") + line;
    }
  }
  if (current.body.trim()) sections.push(current);

  const finalSections = sections.length ? sections : [{ heading: file.name.replace(/\.[^/.]+$/, ""), body: rawText }];
  return { rawText, sections: finalSections };
}

// PDF text extractor in browser
async function extractPdfText(file) {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(buffer);

    const chunks = [];
    // Extract text in parentheses (standard PDF Tj / TJ string literal format)
    const parenMatches = raw.match(/\(([^)\\]{2,100})\)/g) || [];
    for (const pm of parenMatches) {
      const token = pm.slice(1, -1).replace(/\\([()\\])/g, "$1").trim();
      if (token.length > 1 && !token.startsWith("/") && !token.startsWith("Font") && !token.startsWith("ProcSet")) {
        chunks.push(token);
      }
    }

    const text = chunks.join(" ").trim();
    if (text.length > 120) return text;

    // Fallback: extract printable English words and sentences
    const readable = raw.match(/[A-Za-z0-9 ,.;:!?'"()-]{4,}/g) || [];
    return readable
      .filter(w => !w.includes("/Filter") && !w.includes("endobj") && !w.includes("xref") && !w.includes("stream") && !w.includes("/Length"))
      .join(" ");
  } catch (e) {
    console.warn("Client PDF extract notice:", e.message);
    return "Lecture notes extracted from PDF document.";
  }
}

// DOCX text extractor in browser
async function extractDocxText(file) {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    const raw = decoder.decode(buffer);
    const textMatches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    const texts = textMatches.map(m => m.replace(/<[^>]+>/g, "")).filter(Boolean);
    if (texts.length) return texts.join(" ");
    return (raw.match(/[A-Za-z0-9 ,.;:!?'"()-]{4,}/g) || []).join(" ");
  } catch {
    return "Document content extracted from DOCX.";
  }
}

// --- Call Gemini from Browser ---
async function callGeminiClient(systemPrompt, userContent, jsonMode = true) {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error("No Gemini API key configured in workspace");
  const models = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash"];

  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nInput Content:\n${userContent.slice(0, 50000)}` }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Client Gemini ${model}]: HTTP ${res.status}: ${errText.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      if (!jsonMode) return rawText;

      let clean = rawText.trim();
      if (clean.startsWith("```json")) clean = clean.slice(7);
      if (clean.startsWith("```")) clean = clean.slice(3);
      if (clean.endsWith("```")) clean = clean.slice(0, -3);
      return JSON.parse(clean.trim());
    } catch (e) {
      console.warn(`[Client Gemini ${model} Error]:`, e.message);
    }
  }

  throw new Error("All Gemini candidate models unavailable in client");
}

// --- Deterministic Extraction Fallback ---
export function buildDeterministicContentClient(parsed, courseTag = "General") {
  const sections = parsed.sections || [];
  const rawText = parsed.rawText || "";

  const subject = sections[0]?.heading && sections[0].heading !== "Introduction"
    ? sections[0].heading
    : courseTag;

  const mainTopics = sections.map(s => s.heading).filter(h => h && h !== "Introduction").slice(0, 8);
  if (!mainTopics.length) mainTopics.push(subject);

  const termMatches = rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g) || [];
  const uniqueTerms = [...new Set(termMatches)].slice(0, 15);
  const keyTerms = uniqueTerms.map(term => {
    const regex = new RegExp(`([^.?!]*\\b${term}\\b[^.?!]*[.?!])`, "i");
    const match = rawText.match(regex);
    return {
      term,
      definition: match ? match[1].trim() : `Key concept related to ${subject}.`,
    };
  });

  const structuredSections = sections.map((s, idx) => {
    const sentences = s.body.split(/(?<=[.?!])\s+/).filter(Boolean);
    return {
      heading: s.heading || `Section ${idx + 1}`,
      summary: sentences.slice(0, 3).join(" ") || s.body.slice(0, 300),
      keyPoints: sentences.slice(0, 4),
    };
  });

  const structuredJson = {
    subject,
    mainTopics,
    keyTerms,
    sections: structuredSections,
  };

  const notes = structuredSections.map((s, idx) => ({
    heading: `${idx + 1}. ${s.heading}`,
    body: [{ text: s.summary || s.heading, terms: [] }],
    ref: `Section ${idx + 1}`,
    keyTerms: keyTerms.filter(k => (s.summary || "").includes(k.term)).map(k => k.term).slice(0, 4),
  }));

  const flashcards = (keyTerms.length ? keyTerms : [{ term: subject, definition: `Primary subject covered in this lecture.` }])
    .slice(0, 12)
    .map(k => ({
      front: `What is ${k.term}?`,
      back: k.definition,
      difficulty: null,
    }));

  const sentences = rawText.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 20);
  const summary = {
    tldr: sentences.slice(0, 3).join(" ") || `Overview of ${subject} lecture material.`,
    takeaways: sentences.slice(3, 8).map(s => s.trim()).filter(Boolean),
    actionItems: [
      { text: `Review key definitions for ${subject}`, done: false },
      { text: `Practice flashcards on core concepts`, done: false },
      { text: `Review notes for revision`, done: false },
    ],
  };

  return { structuredJson, notes, flashcards, summary, deadlines: [] };
}

// --- Generate All Materials ---
export async function generateAllMaterialsClient(parsed, courseTag = "General") {
  try {
    const systemPrompt = `You are an expert academic content structurer. Extract key concepts and topics from the provided lecture content and return JSON:
{
  "subject": "detected lecture title or subject",
  "mainTopics": ["topic1", "topic2"],
  "keyTerms": [{"term": "Term Name", "definition": "Clear concise definition"}],
  "sections": [{"heading": "Section Heading", "summary": "Detailed summary", "keyPoints": ["Point 1", "Point 2"]}]
}
Course context: ${courseTag}. Use ONLY content present in this document.`;

    const structuredJson = await callGeminiClient(systemPrompt, parsed.rawText);

    // Generate Notes
    let notes;
    try {
      const notesRes = await callGeminiClient(
        `Generate comprehensive revision notes from this content. Return JSON:
{"notes": [{"heading": "Numbered Heading", "body": [{"text": "Content", "terms": []}], "ref": "Section", "keyTerms": ["Key Term"]}]}`,
        JSON.stringify(structuredJson)
      );
      notes = notesRes?.notes || [];
    } catch {
      notes = null;
    }

    // Generate Flashcards
    let flashcards;
    try {
      const fcRes = await callGeminiClient(
        `Generate 10 to 12 study flashcards from this content. Return JSON:
{"flashcards": [{"front": "Question or term", "back": "Clear answer or definition", "difficulty": null}]}`,
        JSON.stringify(structuredJson)
      );
      flashcards = fcRes?.flashcards || [];
    } catch {
      flashcards = null;
    }

    // Generate Summary
    let summary;
    try {
      const sumRes = await callGeminiClient(
        `Generate an executive summary. Return JSON:
{"tldr": "2 to 3 sentence high level overview", "takeaways": ["Point 1", "Point 2", "Point 3", "Point 4"], "actionItems": [{"text": "Review action", "done": false}]}`,
        JSON.stringify(structuredJson)
      );
      summary = sumRes?.tldr ? sumRes : null;
    } catch {
      summary = null;
    }

    const fallback = buildDeterministicContentClient(parsed, courseTag);
    return {
      structuredJson: structuredJson || fallback.structuredJson,
      notes: (notes && notes.length) ? notes : fallback.notes,
      flashcards: (flashcards && flashcards.length) ? flashcards : fallback.flashcards,
      summary: summary || fallback.summary,
      deadlines: [],
    };
  } catch (err) {
    console.warn("[generateAllMaterialsClient] Gemini notice, using deterministic extraction:", err.message);
    return buildDeterministicContentClient(parsed, courseTag);
  }
}

// --- LocalStorage persistence helpers ---
export function getLocalDocuments() {
  try {
    const raw = localStorage.getItem("studyos_documents");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalDocuments(docs) {
  try {
    localStorage.setItem("studyos_documents", JSON.stringify(docs));
  } catch (e) {
    console.warn("Could not save to localStorage:", e.message);
  }
}

export function getLocalDocumentData(docId, type) {
  try {
    const raw = localStorage.getItem(`studyos_${type}_${docId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalDocumentData(docId, type, data) {
  try {
    localStorage.setItem(`studyos_${type}_${docId}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not save doc data to localStorage:", e.message);
  }
}

// --- Google OAuth URL generator ---
export function getGoogleOAuthUrl(customRedirect) {
  // Use callback URL registered in Google Cloud Console
  const redirectUri = customRedirect || (
    window.location.origin.includes("vercel.app")
      ? `${window.location.origin}/auth/google/callback`
      : `${window.location.origin}/auth/google/callback`
  );
  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token%20id_token` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&nonce=${Date.now()}` +
    `&prompt=select_account`
  );
}

// --- Seed sample documents for first load ---
export function ensureSampleDocuments() {
  const existing = getLocalDocuments();
  if (existing && existing.length > 0) return existing;

  const sampleId = "doc-distributed-systems";
  const sampleDoc = {
    id: sampleId,
    filename: "Lecture-01-Distributed-Systems.pdf",
    displayName: "Lecture 01 - Distributed Systems",
    originalName: "Lecture-01-Distributed-Systems.pdf",
    status: "done",
    processingStatus: "done",
    courseTag: "CS 401",
    source: "sample",
    createdAt: new Date().toISOString(),
  };

  const sampleNotes = [
    {
      heading: "1. Foundations of Distributed Systems",
      body: [
        { text: "A distributed system is a collection of autonomous computing entities that communicate over a network to achieve a common goal. Key challenges include ", terms: [] },
        { text: "latency", terms: ["latency"] },
        { text: ", partial failure, and concurrency.", terms: [] }
      ],
      ref: "Slides 1-12",
      keyTerms: ["Distributed Systems", "Latency", "Concurrency", "Partial Failure"]
    },
    {
      heading: "2. The CAP Theorem & Consistency Models",
      body: [
        { text: "Brewer's CAP theorem states that any distributed data store can only provide at most two of the following three guarantees: Consistency, Availability, and Partition Tolerance.", terms: ["CAP Theorem"] },
        { text: " Modern cloud systems frequently adopt Eventual Consistency to prioritize high availability.", terms: [] }
      ],
      ref: "Slides 13-28",
      keyTerms: ["CAP Theorem", "Eventual Consistency", "Partition Tolerance"]
    },
    {
      heading: "3. Consensus Protocols & Fault Tolerance",
      body: [
        { text: "Reaching agreement in an untrusted or unreliable network requires robust algorithms such as Paxos or Raft to ensure state machine replication even during leader crashes.", terms: ["Paxos", "Raft"] }
      ],
      ref: "Slides 29-45",
      keyTerms: ["Paxos", "Raft", "Fault Tolerance", "State Machine"]
    }
  ];

  const sampleFlashcards = [
    { front: "What is the CAP Theorem?", back: "A theorem stating that distributed systems can guarantee at most two of: Consistency, Availability, and Partition Tolerance.", difficulty: null },
    { front: "What is Eventual Consistency?", back: "A consistency model guaranteeing that, in the absence of new updates, all replicas will eventually return the latest value.", difficulty: null },
    { front: "What is Raft consensus?", back: "A consensus algorithm designed for understandability that manages a replicated log through leader election and log replication.", difficulty: null },
    { front: "What is horizontal scaling vs vertical scaling?", back: "Vertical scaling increases CPU/RAM on a single machine; horizontal scaling adds more nodes to the cluster.", difficulty: null },
    { front: "What is a Byzantine fault?", back: "A condition where an arbitrary node may fail, maliciously alter, or send conflicting information to different parts of the system.", difficulty: null },
    { front: "Why is partition tolerance mandatory in distributed networks?", back: "Because physical network partitions (packet drops, link breaks) are inevitable across real-world networks.", difficulty: null }
  ];

  const sampleSummary = {
    tldr: "Overview of distributed computing principles, focusing on consistency models, consensus mechanisms (Paxos/Raft), and fault-tolerant architecture tradeoffs.",
    takeaways: [
      "Physical network partitions cannot be avoided; systems must decide between consistency and availability during partitions.",
      "Consensus protocols like Raft ensure reliable leader election and log replication across crashing nodes.",
      "Eventual consistency allows high-throughput distributed databases at the expense of temporary read staleness.",
      "Fault domains must be isolated to prevent catastrophic cascading failures across clusters."
    ],
    actionItems: [
      { text: "Review Raft leader election state machine transition diagram", done: false },
      { text: "Practice flashcards on CAP theorem tradeoffs", done: true },
      { text: "Complete Quiz 1 on distributed database consistency models", done: false }
    ]
  };

  saveLocalDocuments([sampleDoc]);
  saveLocalDocumentData(sampleId, "notes", sampleNotes);
  saveLocalDocumentData(sampleId, "flashcards", sampleFlashcards);
  saveLocalDocumentData(sampleId, "summary", sampleSummary);

  return [sampleDoc];
}
