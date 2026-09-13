// =============================================
// FILE PARSER SERVICE
// Extracts structured text from PDF, DOCX, PPTX.
// Output: { sections: [{heading, body}], rawText, isScanned }
// =============================================

const fs = require("fs");
const path = require("path");

/**
 * Normalize extracted content into shared format
 * @param {Array} sections - [{heading, body}]
 * @returns {{ sections, rawText }}
 */
function normalize(sections) {
  const rawText = sections.map(s => `${s.heading}\n${s.body}`).join("\n\n");
  return { sections, rawText };
}

/**
 * Parse PDF file
 * @param {string} filePath
 */
async function parsePDF(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    const text = data.text;

    // Heuristic: if very little text per page → likely scanned
    const avgCharsPerPage = text.length / Math.max(data.numpages, 1);
    const isScanned = avgCharsPerPage < 50;

    if (isScanned) {
      return {
        sections: [{ heading: "Document Content", body: "⚠️ This PDF appears to be scanned/image-based. OCR is required for full extraction. Showing partial content." }],
        rawText: text || "",
        isScanned: true,
      };
    }

    // Split into sections by detecting heading-like lines
    const lines = text.split("\n").filter(l => l.trim());
    const sections = [];
    let currentSection = { heading: "Introduction", body: "" };

    for (const line of lines) {
      const isHeading = /^[A-Z][A-Z\s\d]{2,40}$/.test(line.trim()) ||
                        /^\d+[\.\)]\s+[A-Z]/.test(line.trim()) ||
                        (line.trim().length < 60 && line === line.toUpperCase() && line.trim().length > 3);
      if (isHeading && currentSection.body.length > 50) {
        sections.push({ ...currentSection });
        currentSection = { heading: line.trim(), body: "" };
      } else {
        currentSection.body += line + " ";
      }
    }
    if (currentSection.body.trim()) sections.push(currentSection);

    return { ...normalize(sections.length ? sections : [{ heading: "Full Document", body: text }]), isScanned: false };
  } catch (err) {
    console.error("[FileParser] PDF parse error:", err.message);
    return { sections: [{ heading: "Error", body: "Failed to parse PDF." }], rawText: "", isScanned: false };
  }
}

/**
 * Parse DOCX file (preserves headings)
 * @param {string} filePath
 */
async function parseDOCX(filePath) {
  try {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });

    const lines = result.value.split("\n").filter(l => l.trim());
    const sections = [];
    let current = { heading: "Document", body: "" };

    for (const line of lines) {
      const isHeading = line.trim().length < 80 &&
        (line.startsWith("#") ||
         /^(Chapter|Section|\d+[\.\)])\s/i.test(line.trim()) ||
         (line.trim().length < 60 && !line.trim().includes(".")));
      if (isHeading && current.body.length > 30) {
        sections.push({ ...current });
        current = { heading: line.replace(/^#+\s*/, "").trim(), body: "" };
      } else {
        current.body += line + " ";
      }
    }
    if (current.body.trim()) sections.push(current);

    return { ...normalize(sections.length ? sections : [{ heading: "Document Content", body: result.value }]), isScanned: false };
  } catch (err) {
    console.error("[FileParser] DOCX parse error:", err.message);
    return { sections: [{ heading: "Error", body: "Failed to parse DOCX." }], rawText: "", isScanned: false };
  }
}

/**
 * Parse PPTX file (extracts slide text + speaker notes)
 * @param {string} filePath
 */
async function parsePPTX(filePath) {
  try {
    // Try to read raw XML from PPTX zip
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries().filter(e => e.entryName.match(/ppt\/slides\/slide\d+\.xml$/));

    const sections = [];
    for (let i = 0; i < entries.length; i++) {
      const xml = entries[i].getData().toString("utf8");
      // Extract text between <a:t> tags
      const textMatches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      const texts = textMatches.map(m => m.replace(/<[^>]+>/g, "")).filter(Boolean);
      const slideText = texts.join(" ").trim();
      if (slideText) {
        sections.push({ heading: `Slide ${i + 1}`, body: slideText });
      }
    }

    return { ...normalize(sections.length ? sections : [{ heading: "Presentation", body: "No text found." }]), isScanned: false };
  } catch (err) {
    console.error("[FileParser] PPTX parse error:", err.message);
    return { sections: [{ heading: "Error", body: "Failed to parse PPTX. Ensure adm-zip is installed." }], rawText: "", isScanned: false };
  }
}

/**
 * Parse plain text or markdown file
 * @param {string} filePath
 */
async function parseText(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split("\n").filter(l => l.trim());
    const sections = [];
    let current = { heading: "Introduction", body: "" };

    for (const line of lines) {
      const isHeading = line.startsWith("#") || /^[A-Z\s\d]{3,40}$/.test(line.trim());
      if (isHeading && current.body.length > 20) {
        sections.push({ ...current });
        current = { heading: line.replace(/^#+\s*/, "").trim(), body: "" };
      } else {
        current.body += line + " ";
      }
    }
    if (current.body.trim()) sections.push(current);

    return {
      ...normalize(sections.length ? sections : [{ heading: "Document Content", body: raw }]),
      rawText: raw,
      isScanned: false,
    };
  } catch (err) {
    console.error("[FileParser] Text parse error:", err.message);
    return { sections: [{ heading: "Error", body: "Failed to parse text file." }], rawText: "", isScanned: false };
  }
}

/**
 * Main parser entry point
 * @param {string} filePath
 * @param {string} mimeType
 */
async function parseFile(filePath, mimeType) {
  const lowerPath = filePath.toLowerCase();
  if (mimeType === "application/pdf" || lowerPath.endsWith(".pdf")) {
    return parsePDF(filePath);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerPath.endsWith(".docx")
  ) {
    return parseDOCX(filePath);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    lowerPath.endsWith(".pptx")
  ) {
    return parsePPTX(filePath);
  } else if (
    mimeType?.startsWith("text/") ||
    lowerPath.endsWith(".txt") ||
    lowerPath.endsWith(".md") ||
    lowerPath.endsWith(".markdown")
  ) {
    return parseText(filePath);
  } else {
    // Try reading as text before failing
    try {
      return parseText(filePath);
    } catch {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }
}

module.exports = { parseFile };
