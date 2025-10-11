import documentPagesData from '../data/document-pages.json';

export interface ContentSegment {
  text: string;
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: string;
    color?: string;
    background?: string;
    header?: 1 | 2 | 3;
  };
}

export interface DocumentPage {
  title: string;
  segments: ContentSegment[];
}

export interface DocumentPages {
  [pageName: string]: DocumentPage;
}

export interface Document {
  title: string;
  description: string;
  pages: DocumentPages;
}

export interface DocumentPagesData {
  [docName: string]: Document;
}

export const getDocument = (docName: string): Document | null => {
  const data = documentPagesData as DocumentPagesData;
  return data[docName] || null;
};

export const getPage = (docName: string, pageName: string): DocumentPage | null => {
  const doc = getDocument(docName);
  return doc?.pages[pageName] || null;
};

export const getPageNames = (docName: string): string[] => {
  const doc = getDocument(docName);
  return doc ? Object.keys(doc.pages) : [];
};

export const pageToDelta = (page: DocumentPage) => {
  const ops = page.segments.map(segment => {
    const attributes: any = {};
    if (segment.attributes) {
      if (segment.attributes.bold) attributes.bold = true;
      if (segment.attributes.italic) attributes.italic = true;
      if (segment.attributes.underline) attributes.underline = true;
      if (segment.attributes.size) attributes.size = segment.attributes.size;
      if (segment.attributes.color) attributes.color = segment.attributes.color;
      if (segment.attributes.background) attributes.background = segment.attributes.background;
      if (segment.attributes.header) attributes.header = segment.attributes.header;
    }
    return {
      insert: segment.text,
      ...(Object.keys(attributes).length > 0 && { attributes })
    };
  });
  return { ops };
};
