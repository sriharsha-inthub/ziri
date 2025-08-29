import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileWalker } from '../../lib/repository/file-walker.js';

describe('FileWalker', () => {
    let tempDir;
    let fileWalker;

    beforeEach(async () => {
        // Create temporary test directory
        tempDir = path.join(process.cwd(), 'test-temp-' + Date.now());
        await fs.mkdir(tempDir, { recursive: true });
        fileWalker = new FileWalker();
    });

    afterEach(async () => {
        // Clean up temporary directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('discoverFiles', () => {
        it('should discover files in a directory', async () => {
            // Create test files
            await fs.writeFile(path.join(tempDir, 'test1.js'), 'console.log("test1");');
            await fs.writeFile(path.join(tempDir, 'test2.ts'), 'console.log("test2");');

            const files = [];
            for await (const file of fileWalker.discoverFiles(tempDir)) {
                files.push(file);
            }

            expect(files).toHaveLength(2);
            expect(files.some(f => f.relativePath === 'test1.js')).toBe(true);
            expect(files.some(f => f.relativePath === 'test2.ts')).toBe(true);
        });

        it('should discover files in nested directories', async () => {
            // Create nested structure
            await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
            await fs.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true });

            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, 'src', 'index.js'), 'export default {};');
            await fs.writeFile(path.join(tempDir, 'src', 'components', 'Button.jsx'), 'export const Button = () => {};');

            const files = [];
            for await (const file of fileWalker.discoverFiles(tempDir)) {
                files.push(file);
            }

            expect(files).toHaveLength(3);
            expect(files.some(f => f.relativePath === 'package.json')).toBe(true);
            expect(files.some(f => f.relativePath === 'src/index.js')).toBe(true);
            expect(files.some(f => f.relativePath === 'src/components/Button.jsx')).toBe(true);
        });

        it('should exclude files based on default patterns', async () => {
            // Create files that should be excluded
            await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
            await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });
            await fs.mkdir(path.join(tempDir, 'dist'), { recursive: true });

            await fs.writeFile(path.join(tempDir, 'index.js'), 'console.log("main");');
            await fs.writeFile(path.join(tempDir, 'node_modules', 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, '.git', 'config'), '');
            await fs.writeFile(path.join(tempDir, 'dist', 'bundle.js'), '');
            await fs.writeFile(path.join(tempDir, 'image.png'), '');

            const files = [];
            for await (const file of fileWalker.discoverFiles(tempDir)) {
                files.push(file);
            }

            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('index.js');
        });

        it('should exclude files based on custom patterns', async () => {
            await fs.writeFile(path.join(tempDir, 'keep.js'), 'console.log("keep");');
            await fs.writeFile(path.join(tempDir, 'exclude.test.js'), 'console.log("exclude");');
            await fs.writeFile(path.join(tempDir, 'also-exclude.spec.js'), 'console.log("exclude");');

            const customExclusions = ['**/*.test.js', '**/*.spec.js'];
            const files = [];
            for await (const file of fileWalker.discoverFiles(tempDir, customExclusions)) {
                files.push(file);
            }

            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('keep.js');
        });

        it('should include file metadata', async () => {
            const content = 'console.log("test");';
            const filePath = path.join(tempDir, 'test.js');
            await fs.writeFile(filePath, content);

            const files = [];
            for await (const file of fileWalker.discoverFiles(tempDir)) {
                files.push(file);
            }

            expect(files).toHaveLength(1);
            const file = files[0];

            expect(file.path).toBe(filePath);
            expect(file.relativePath).toBe('test.js');
            expect(file.extension).toBe('.js');
            expect(file.mimeType).toBe('application/javascript');
            expect(file.size).toBe(content.length);
            expect(file.hash).toBeDefined();
            expect(file.lastModified).toBeInstanceOf(Date);
        });

        it('should skip files larger than maxFileSize', async () => {
            const smallWalker = new FileWalker({ maxFileSize: 10 });

            await fs.writeFile(path.join(tempDir, 'small.js'), 'test');
            await fs.writeFile(path.join(tempDir, 'large.js'), 'this is a very long file content that exceeds the limit');

            const files = [];
            for await (const file of smallWalker.discoverFiles(tempDir)) {
                files.push(file);
            }

            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('small.js');
        });
    });

    describe('_globToRegex', () => {
        it('should convert simple glob patterns', () => {
            const regex1 = fileWalker._globToRegex('*.js');
            expect(regex1.test('test.js')).toBe(true);
            expect(regex1.test('test.ts')).toBe(false);
            expect(regex1.test('dir/test.js')).toBe(false);

            const regex2 = fileWalker._globToRegex('**/*.js');
            expect(regex2.test('test.js')).toBe(true);
            expect(regex2.test('dir/test.js')).toBe(true);
            expect(regex2.test('deep/nested/test.js')).toBe(true);
        });

        it('should handle directory patterns', () => {
            const regex = fileWalker._globToRegex('**/node_modules/**');
            expect(regex.test('node_modules/package.json')).toBe(true);
            expect(regex.test('src/node_modules/lib/index.js')).toBe(true);
            expect(regex.test('src/components/Button.js')).toBe(false);
        });
    });

    describe('_shouldExclude', () => {
        it('should exclude based on default patterns', () => {
            expect(fileWalker._shouldExclude('node_modules/package.json', [])).toBe(true);
            expect(fileWalker._shouldExclude('.git/config', [])).toBe(true);
            expect(fileWalker._shouldExclude('image.png', [])).toBe(true);
            expect(fileWalker._shouldExclude('src/index.js', [])).toBe(false);
        });

        it('should exclude based on custom patterns', () => {
            const customPatterns = ['**/*.test.js', 'temp/**'];
            expect(fileWalker._shouldExclude('src/component.test.js', customPatterns)).toBe(true);
            expect(fileWalker._shouldExclude('temp/file.js', customPatterns)).toBe(true);
            expect(fileWalker._shouldExclude('src/component.js', customPatterns)).toBe(false);
        });
    });

    describe('_getMimeType', () => {
        it('should return correct MIME types', () => {
            expect(fileWalker._getMimeType('.js')).toBe('application/javascript');
            expect(fileWalker._getMimeType('.ts')).toBe('application/typescript');
            expect(fileWalker._getMimeType('.py')).toBe('text/x-python');
            expect(fileWalker._getMimeType('.md')).toBe('text/markdown');
            expect(fileWalker._getMimeType('.unknown')).toBeUndefined();
        });
    });
});