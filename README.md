# MedicLens MVP

End-to-end Next.js MVP for medical-record PDF Q&A with citations and in-browser red evidence highlighting.

## Features

- Upload a single PDF (`POST /api/upload`)
- Parse PDF per page (text + span boxes)
- Build local file-based index (`/data/indexes/<fileId>.json`)
- Ask natural-language questions (`POST /api/ask`)
- Retrieve relevant page chunks using local cosine similarity over OpenAI embeddings
- Model returns strict JSON:

```json
{
  "answer": "string",
  "citations": [
    {
      "page": 1,
      "quote": "string",
      "confidence": 0.93
    }
  ]
}
```

- Render PDF in browser via `pdf.js`
- Auto-jump to first cited page
- Highlight citation quotes in red on matching page text spans
- Basic in-memory rate limiting for upload and ask endpoints
- PDF-only validation and 25MB file size limit
- UI disclaimer: **Not medical advice. For informational use only.**

## Stack

- Next.js (App Router) + TypeScript
- Backend routes in same repo (`app/api/...`)
- `pdfjs-dist` for PDF extraction/rendering
- OpenAI API for embeddings + answer generation
- Local filesystem storage only (`uploads/` + `data/indexes/`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
```

3. Run development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Upload a PDF medical record.
2. Wait for indexing to complete.
3. Ask a question.
4. View answer + citations.
5. Viewer jumps to first cited page and highlights quote evidence in red.

## API

### `POST /api/upload`

- Request: `multipart/form-data` with `file`
- Response:

```json
{ "fileId": "uuid" }
```

### `POST /api/ask`

- Request:

```json
{
  "fileId": "uuid",
  "question": "Who signed the discharge from PACU on April 6?"
}
```

- Response: strict answer schema above.

### `GET /api/file/:fileId`

- Streams uploaded PDF for browser viewer.

## Notes

- Questions/answers are not stored to disk in this MVP.
- PDF and parsed index are stored locally.
- If exact quote rectangle extraction is imperfect, highlights use robust multi-span substring matching over pdf.js text-layer spans.
