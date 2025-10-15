import documentPagesData from '../../data/document-pages.json';

export interface ContentSegment {
  text: string;
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
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

// Convert DocumentPage directly to Tiptap JSON format
export const pageToTiptap = (page: DocumentPage) => {
  if (!page || !page.segments) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: []
        }
      ]
    };
  }

  const content: any[] = [];
  let currentParagraph: any = {
    type: 'paragraph',
    content: []
  };

  for (const segment of page.segments) {
    const text = segment.text;
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.length > 0) {
        const marks: any[] = [];
        
        if (segment.attributes) {
          if (segment.attributes.bold) marks.push({ type: 'bold' });
          if (segment.attributes.italic) marks.push({ type: 'italic' });
          if (segment.attributes.underline) marks.push({ type: 'underline' });
          if (segment.attributes.strike) marks.push({ type: 'strike' });
          if (segment.attributes.color) marks.push({ type: 'textStyle', attrs: { color: segment.attributes.color } });
          if (segment.attributes.background) marks.push({ type: 'highlight', attrs: { color: segment.attributes.background } });
          if (segment.attributes.header) {
            // Convert header to heading
            currentParagraph = {
              type: `heading${segment.attributes.header}`,
              content: []
            };
          }
        }
        
        currentParagraph.content.push({
          type: 'text',
          text: line,
          ...(marks.length > 0 && { marks })
        });
      }
      
      // Add line break or new paragraph
      if (i < lines.length - 1) {
        if (currentParagraph.content.length > 0) {
          content.push(currentParagraph);
        }
        currentParagraph = {
          type: 'paragraph',
          content: []
        };
      }
    }
  }
  
  if (currentParagraph.content.length > 0) {
    content.push(currentParagraph);
  }
  
  return {
    type: 'doc',
    content: content.length > 0 ? content : [
      {
        type: 'paragraph',
        content: []
      }
    ]
  };
};
