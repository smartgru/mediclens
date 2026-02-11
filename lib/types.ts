export type TextSpan = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageIndex = {
  pageNumber: number;
  text: string;
  spans: TextSpan[];
};

export type ChunkIndex = {
  id: string;
  page: number;
  text: string;
  embedding: number[];
};

export type FileIndex = {
  fileId: string;
  filename: string;
  createdAt: string;
  pages: PageIndex[];
  chunks: ChunkIndex[];
};

export type Citation = {
  page: number;
  quote: string;
  confidence: number;
};

export type AskResponse = {
  answer: string;
  citations: Citation[];
};
