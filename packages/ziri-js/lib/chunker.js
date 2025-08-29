export function chunkText(text, opts={}){
  const target = opts.targetChars || 4000;
  const overlap = Math.floor(target*0.15);
  const out=[]; let i=0;
  while(i<text.length){ const end=Math.min(text.length,i+target); out.push(text.slice(i,end)); if(end===text.length) break; i=Math.max(0,end-overlap); }
  return out;
}

/**
 * Enhanced chunking with line number tracking
 */
export function chunkTextWithLines(text, opts = {}) {
  const target = opts.targetChars || 4000;
  const overlap = Math.floor(target * 0.15);
  const lines = text.split('\n');
  const chunks = [];
  
  let currentChunk = '';
  let currentStartLine = 1;
  let currentLineIndex = 0;
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] + '\n';
    
    // If adding this line would exceed target size, finalize current chunk
    if (currentChunk.length + line.length > target && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        startLine: currentStartLine,
        endLine: lineIndex,
        size: currentChunk.length
      });
      
      // Start new chunk with overlap
      const overlapLines = Math.max(1, Math.floor((lineIndex - currentStartLine) * 0.15));
      const newStartLine = Math.max(currentStartLine, lineIndex - overlapLines + 1);
      
      currentChunk = lines.slice(newStartLine - 1, lineIndex + 1).join('\n') + '\n';
      currentStartLine = newStartLine;
    } else {
      // Add line to current chunk
      if (currentChunk === '') {
        currentStartLine = lineIndex + 1;
      }
      currentChunk += line;
    }
  }
  
  // Add final chunk if there's content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startLine: currentStartLine,
      endLine: lines.length,
      size: currentChunk.length
    });
  }
  
  return chunks;
}
