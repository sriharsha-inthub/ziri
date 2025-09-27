/**
 * Ziri-specific generators for property-based testing
 */

import { gen } from './property.js';

/**
 * Generate random code chunk data
 * @param {Object} options - Generation options
 * @returns {Function} Generator function
 */
export function codeChunk(options = {}) {
  const languages = options.languages || ['javascript', 'python', 'java', 'typescript'];
  const maxLines = options.maxLines || 1000;
  const maxLineLength = options.maxLineLength || 120;
  
  return (rng) => {
    const language = gen.oneOf(languages)(rng);
    const startLine = gen.int(1, maxLines)(rng);
    const lineCount = gen.int(1, Math.min(50, maxLines - startLine + 1))(rng);
    const endLine = startLine + lineCount - 1;
    
    // Generate content based on language
    let content = '';
    for (let i = 0; i < lineCount; i++) {
      content += generateLineContent(language, rng, maxLineLength) + '\n';
    }
    
    return {
      content: content.trim(),
      language,
      startLine,
      endLine,
      relativePath: `src/file${rng.int(1, 100)}.${getExtension(language)}`
    };
  };
}

/**
 * Generate a line of content for a specific language
 * @param {string} language - Programming language
 * @param {Random} rng - Random number generator
 * @param {number} maxLength - Maximum line length
 * @returns {string} Generated line content
 */
function generateLineContent(language, rng, maxLength) {
  const lineTypes = ['code', 'comment', 'blank'];
  const lineType = gen.oneOf(lineTypes)(rng);
  
  switch (lineType) {
    case 'code':
      return generateCodeLine(language, rng, maxLength);
    case 'comment':
      return generateCommentLine(language, rng, maxLength);
    case 'blank':
      return '';
    default:
      return generateCodeLine(language, rng, maxLength);
  }
}

/**
 * Generate a line of code for a specific language
 * @param {string} language - Programming language
 * @param {Random} rng - Random number generator
 * @param {number} maxLength - Maximum line length
 * @returns {string} Generated code line
 */
function generateCodeLine(language, rng, maxLength) {
  const identifiers = ['data', 'user', 'config', 'result', 'value', 'item', 'list', 'map'];
  const functions = ['get', 'set', 'update', 'delete', 'create', 'find', 'filter', 'map'];
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return `const ${gen.oneOf(identifiers)(rng)} = ${gen.oneOf(functions)(rng)}(${gen.int(1, 100)(rng)});`;
    case 'python':
      return `${gen.oneOf(identifiers)(rng)} = ${gen.oneOf(functions)(rng)}(${gen.int(1, 100)(rng)})`;
    case 'java':
      return `${gen.oneOf(['int', 'String', 'boolean'])} ${gen.oneOf(identifiers)(rng)} = ${gen.oneOf(functions)(rng)}(${gen.int(1, 100)(rng)});`;
    default:
      return `${gen.oneOf(identifiers)(rng)} = ${gen.oneOf(functions)(rng)}(${gen.int(1, 100)(rng)});`;
  }
}

/**
 * Generate a comment line for a specific language
 * @param {string} language - Programming language
 * @param {Random} rng - Random number generator
 * @param {number} maxLength - Maximum line length
 * @returns {string} Generated comment line
 */
function generateCommentLine(language, rng, maxLength) {
  const comments = ['TODO: Implement this', 'FIXME: Bug here', 'NOTE: Important', 'HACK: Temporary fix'];
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return `// ${gen.oneOf(comments)(rng)}`;
    case 'python':
      return `# ${gen.oneOf(comments)(rng)}`;
    case 'java':
      return `// ${gen.oneOf(comments)(rng)}`;
    default:
      return `// ${gen.oneOf(comments)(rng)}`;
  }
}

/**
 * Get file extension for a language
 * @param {string} language - Programming language
 * @returns {string} File extension
 */
function getExtension(language) {
  const extensions = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java'
  };
  return extensions[language] || 'txt';
}

/**
 * Generate term frequency data
 * @param {Object} options - Generation options
 * @returns {Function} Generator function
 */
export function termFreqData(options = {}) {
  const maxTerms = options.maxTerms || 50;
  const maxFreq = options.maxFreq || 100;
  
  return (rng) => {
    const termCount = gen.int(1, maxTerms)(rng);
    const terms = {};
    
    for (let i = 0; i < termCount; i++) {
      const term = gen.string({ minLength: 2, maxLength: 20 })(rng);
      terms[term] = gen.int(1, maxFreq)(rng);
    }
    
    return {
      terms,
      documentLength: gen.int(100, 10000)(rng)
    };
  };
}

/**
 * Generate vector data
 * @param {number} size - Vector size
 * @returns {Function} Generator function
 */
export function vector(size) {
  return (rng) => {
    return Array.from({ length: size }, () => rng.float(-1, 1));
  };
}

/**
 * Generate file system structure
 * @param {Object} options - Generation options
 * @returns {Function} Generator function
 */
export function fileSystem(options = {}) {
  const maxDepth = options.maxDepth || 5;
  const maxFiles = options.maxFiles || 20;
  const maxDirs = options.maxDirs || 10;
  
  return function generateFileSystem(rng, depth = 0) {
    if (depth > maxDepth) {
      return [];
    }
    
    const entries = [];
    const fileCount = gen.int(0, maxFiles)(rng);
    const dirCount = depth < maxDepth - 1 ? gen.int(0, maxDirs)(rng) : 0;
    
    // Generate files
    for (let i = 0; i < fileCount; i++) {
      const extensions = ['.js', '.ts', '.py', '.java', '.md', '.json'];
      const name = gen.string({ minLength: 3, maxLength: 15 })(rng) + gen.oneOf(extensions)(rng);
      entries.push({
        type: 'file',
        name,
        size: gen.int(100, 10000)(rng)
      });
    }
    
    // Generate directories
    for (let i = 0; i < dirCount; i++) {
      const name = gen.string({ minLength: 3, maxLength: 15 })(rng);
      entries.push({
        type: 'directory',
        name,
        children: generateFileSystem(rng, depth + 1)
      });
    }
    
    return entries;
  };
}