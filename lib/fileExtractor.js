/**
 * lib/fileExtractor.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Extracts plain text from uploaded PPTX, DOCX, and PDF files.
 * Returns a { text, slideCount, title } object ready to pass into summariseText().
 *
 * All functions accept a Node.js Buffer (from the upload route).
 * ──────────────────────────────────────────────────────────────────────────────
 */

import JSZip    from 'jszip'
import mammoth  from 'mammoth'
import pdfParse from 'pdf-parse'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * extractFile
 * Detects file type from the MIME type or filename extension and routes
 * to the appropriate extractor.
 *
 * @param {Buffer} buffer
 * @param {string} filename   - original filename (used for extension fallback)
 * @param {string} mimeType   - MIME type from the upload
 * @returns {Promise<{ text: string, slideCount: number, title: string }>}
 */
export async function extractFile(buffer, filename, mimeType) {
  const ext = filename.split('.').pop().toLowerCase()

  // PPTX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === 'pptx'
  ) {
    return extractPptx(buffer, filename)
  }

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return extractDocx(buffer, filename)
  }

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return extractPdf(buffer, filename)
  }

  throw new Error(
    `Unsupported file type: ${ext}. Please upload a .pptx, .docx, or .pdf file.`
  )
}

// ─── PPTX extractor ───────────────────────────────────────────────────────────
// A PPTX file is a ZIP archive. Each slide lives at ppt/slides/slideN.xml.
// Text content is stored in <a:t> elements inside the slide XML.

async function extractPptx(buffer, filename) {
  const zip = await JSZip.loadAsync(buffer)

  // Find all slide files, sorted by slide number
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)[1])
      const numB = parseInt(b.match(/slide(\d+)/)[1])
      return numA - numB
    })

  if (!slideFiles.length) {
    throw new Error('No slides found in the uploaded PPTX file.')
  }

  // Extract text from each slide
  const slideTexts = []
  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async('string')
    const text = extractTextFromXml(xml)
    if (text.trim()) slideTexts.push(text.trim())
  }

  // Try to get the presentation title from app.xml
  let title = filename.replace(/\.pptx$/i, '')
  try {
    const appXml = await zip.files['docProps/app.xml']?.async('string')
    if (appXml) {
      const match = appXml.match(/<TitlesOfParts>[\s\S]*?<vt:lpstr>([^<]+)<\/vt:lpstr>/)
      if (match) title = match[1].trim()
    }
  } catch { /* ignore */ }

  return {
    text:       slideTexts.join('\n\n---\n\n'),  // --- separates slides
    slideCount: slideFiles.length,
    title,
  }
}

// Extract all text from <a:t> tags in slide XML, preserving paragraph breaks
function extractTextFromXml(xml) {
  const paragraphs = []
  // Match paragraph blocks <a:p>...</a:p>
  const paraMatches = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) || []

  for (const para of paraMatches) {
    // Get all text runs within the paragraph
    const textMatches = para.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
    const paraText = textMatches
      .map((t) => t.replace(/<[^>]+>/g, ''))
      .join('')
      .trim()
    if (paraText) paragraphs.push(paraText)
  }

  return paragraphs.join('\n')
}

// ─── DOCX extractor ───────────────────────────────────────────────────────────
// Uses mammoth to convert DOCX → plain text. Mammoth handles complex
// formatting, tables, and nested structures cleanly.

async function extractDocx(buffer, filename) {
  const result = await mammoth.extractRawText({ buffer })

  if (!result.value || result.value.trim().length === 0) {
    throw new Error('The uploaded DOCX file appears to be empty or unreadable.')
  }

  // Count approximate "pages" by splitting on multiple blank lines
  const sections = result.value.split(/\n{3,}/).filter((s) => s.trim())

  return {
    text:       result.value.trim(),
    slideCount: sections.length,
    title:      filename.replace(/\.docx$/i, ''),
  }
}

// ─── PDF extractor ────────────────────────────────────────────────────────────
// Uses pdf-parse to extract text from all pages.
// Note: pdf-parse is loaded dynamically to avoid Next.js build issues
// with its test file auto-loading behaviour.

async function extractPdf(buffer, filename) {
  const data = await pdfParse(buffer)

  if (!data.text || data.text.trim().length === 0) {
    throw new Error('The uploaded PDF appears to be image-based or unreadable. Please use a text-based PDF.')
  }

  return {
    text:       data.text.trim(),
    slideCount: data.numpages,
    title:      filename.replace(/\.pdf$/i, ''),
  }
}
