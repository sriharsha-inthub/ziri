/**
 * Project Summarizer Demo
 * Demonstrates the project summary generation functionality
 */

import { ProjectSummarizer } from '../lib/summarizer/project-summarizer.js';
import { SummaryAnalyzer } from '../lib/summarizer/summary-analyzer.js';
import { TechnologyDetector } from '../lib/summarizer/technology-detector.js';

// Mock dependencies for demonstration
class MockIndexStore {
  constructor() {
    this.metadata = new Map();
  }

  async getMetadata(repositoryId) {
    return this.metadata.get(repositoryId) || {
      repositoryPath: '/demo/project',
      fileHashes: new Map([
        ['src/App.js', 'hash1'],
        ['src/components/Button.js', 'hash2'],
        ['package.json', 'hash3'],
        ['README.md', 'hash4']
      ]),
      lastIndexed: new Date(),
      embeddingProvider: 'openai',
      version: '1.0.0'
    };
  }

  async updateMetadata(repositoryId, metadata) {
    this.metadata.set(repositoryId, metadata);
  }
}

class MockRepositoryParser {
  async* discoverFiles(repoPath, excludePatterns) {
    const mockFiles = [
      {
        path: '/demo/project/src/App.js',
        relativePath: 'src/App.js',
        extension: '.js',
        size: 1500,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/src/components/Button.js',
        relativePath: 'src/components/Button.js',
        extension: '.js',
        size: 800,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/src/components/Modal.jsx',
        relativePath: 'src/components/Modal.jsx',
        extension: '.jsx',
        size: 1200,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/src/utils/helpers.js',
        relativePath: 'src/utils/helpers.js',
        extension: '.js',
        size: 600,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/test/App.test.js',
        relativePath: 'test/App.test.js',
        extension: '.js',
        size: 400,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/package.json',
        relativePath: 'package.json',
        extension: '.json',
        size: 800,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/README.md',
        relativePath: 'README.md',
        extension: '.md',
        size: 300,
        lastModified: new Date('2023-12-01')
      },
      {
        path: '/demo/project/webpack.config.js',
        relativePath: 'webpack.config.js',
        extension: '.js',
        size: 500,
        lastModified: new Date('2023-12-01')
      }
    ];

    for (const file of mockFiles) {
      yield file;
    }
  }

  async* detectChanges(repoPath, lastIndex) {
    // Mock some changes
    yield { path: 'src/App.js', changeType: 'modified', hash: 'newhash1' };
    yield { path: 'src/NewComponent.js', changeType: 'added', hash: 'newhash2' };
  }
}

// Mock file system to provide sample file contents
const mockFileContents = {
  '/demo/project/src/App.js': `
import React, { useState, useEffect } from 'react';
import Button from './components/Button';
import Modal from './components/Modal';
import { fetchUserData, formatDate } from './utils/helpers';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [],
      loading: false,
      showModal: false
    };
  }

  async componentDidMount() {
    this.setState({ loading: true });
    try {
      const users = await fetchUserData();
      this.setState({ users, loading: false });
    } catch (error) {
      console.error('Failed to fetch users:', error);
      this.setState({ loading: false });
    }
  }

  handleShowModal = () => {
    this.setState({ showModal: true });
  }

  handleCloseModal = () => {
    this.setState({ showModal: false });
  }

  render() {
    const { users, loading, showModal } = this.state;
    
    if (loading) {
      return <div>Loading...</div>;
    }

    return (
      <div className="app">
        <h1>User Management</h1>
        <Button onClick={this.handleShowModal}>Add User</Button>
        
        <div className="user-list">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <h3>{user.name}</h3>
              <p>{user.email}</p>
              <small>Joined: {formatDate(user.createdAt)}</small>
            </div>
          ))}
        </div>

        {showModal && (
          <Modal onClose={this.handleCloseModal}>
            <h2>Add New User</h2>
            {/* Modal content */}
          </Modal>
        )}
      </div>
    );
  }
}

export default App;
  `,
  
  '/demo/project/src/components/Button.js': `
import React from 'react';
import PropTypes from 'prop-types';

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  ...props 
}) => {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger'
  };
  const sizeClasses = {
    small: 'btn-sm',
    medium: 'btn-md',
    large: 'btn-lg'
  };

  const className = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled ? 'btn-disabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool
};

export default Button;
  `,

  '/demo/project/package.json': JSON.stringify({
    name: 'demo-react-app',
    version: '1.0.0',
    description: 'A demo React application for testing project summarization',
    main: 'src/index.js',
    scripts: {
      start: 'webpack serve --mode development',
      build: 'webpack --mode production',
      test: 'jest',
      lint: 'eslint src/'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'prop-types': '^15.8.1',
      axios: '^1.4.0'
    },
    devDependencies: {
      webpack: '^5.88.0',
      'webpack-cli': '^5.1.0',
      'webpack-dev-server': '^4.15.0',
      '@babel/core': '^7.22.0',
      '@babel/preset-react': '^7.22.0',
      'babel-loader': '^9.1.0',
      jest: '^29.5.0',
      '@testing-library/react': '^13.4.0',
      eslint: '^8.43.0',
      'eslint-plugin-react': '^7.32.0'
    },
    keywords: ['react', 'demo', 'frontend'],
    author: 'Demo Author',
    license: 'MIT'
  }, null, 2)
};

// Mock fs.readFile to return our sample contents
import fs from 'fs/promises';
const originalReadFile = fs.readFile;
fs.readFile = async (filePath, encoding) => {
  if (mockFileContents[filePath]) {
    return mockFileContents[filePath];
  }
  // For other files, return empty content
  return '';
};

async function demonstrateProjectSummarizer() {
  console.log('🚀 Project Summarizer Demo\n');

  // Create instances
  const indexStore = new MockIndexStore();
  const repositoryParser = new MockRepositoryParser();
  const summarizer = new ProjectSummarizer(indexStore, repositoryParser);
  const analyzer = new SummaryAnalyzer();
  const detector = new TechnologyDetector();

  const repositoryId = 'demo-repo-123';

  try {
    console.log('📊 Generating project summary...\n');
    
    // Generate initial summary
    const summary = await summarizer.generateSummary(repositoryId);
    
    console.log('✅ Summary generated successfully!\n');
    console.log('📋 Project Overview:');
    console.log(`   ${summary.overview}\n`);
    
    console.log('🛠️  Technologies Detected:');
    summary.technologies.forEach(tech => {
      console.log(`   • ${tech}`);
    });
    console.log();
    
    console.log('🏗️  Project Structure:');
    printDirectoryStructure(summary.structure, 0);
    console.log();
    
    console.log('🔧 Key Components:');
    summary.keyComponents.slice(0, 5).forEach(component => {
      console.log(`   • ${component.name} (${component.type}) - ${component.filePath}`);
      console.log(`     ${component.description}`);
      if (component.linesOfCode) {
        console.log(`     Lines of code: ${component.linesOfCode}`);
      }
      console.log();
    });
    
    console.log('📈 Project Statistics:');
    console.log(`   • Files analyzed: ${summary.metadata.filesAnalyzed}`);
    console.log(`   • Total lines of code: ${summary.metadata.totalLinesOfCode}`);
    console.log(`   • Primary language: ${summary.metadata.primaryLanguage}`);
    console.log(`   • Complexity score: ${summary.metadata.complexityScore}/10`);
    console.log();

    // Demonstrate incremental updates
    console.log('🔄 Testing incremental updates...\n');
    
    const changes = [
      { path: 'src/App.js', changeType: 'modified', hash: 'newhash1' },
      { path: 'src/NewComponent.js', changeType: 'added', hash: 'newhash2' }
    ];
    
    const updatedSummary = await summarizer.updateSummary(repositoryId, changes);
    console.log('✅ Summary updated successfully!');
    console.log(`   Files analyzed: ${updatedSummary.metadata.filesAnalyzed}`);
    console.log(`   Last updated: ${updatedSummary.lastUpdated.toISOString()}\n`);

    // Demonstrate technology detection
    console.log('🔍 Detailed Technology Analysis...\n');
    
    const mockAnalysis = {
      files: [
        {
          relativePath: 'src/App.js',
          extension: '.js',
          content: mockFileContents['/demo/project/src/App.js']
        },
        {
          relativePath: 'package.json',
          extension: '.json',
          content: mockFileContents['/demo/project/package.json']
        }
      ],
      packageFiles: [
        {
          relativePath: 'package.json',
          content: mockFileContents['/demo/project/package.json']
        }
      ],
      languageDistribution: new Map([['JavaScript', 3000]])
    };

    const detectedTechnologies = detector.detectTechnologies(mockAnalysis);
    const categorizedTechs = detector.categorizeTechnologies(detectedTechnologies);
    
    for (const [category, techs] of Object.entries(categorizedTechs)) {
      if (techs.length > 0) {
        console.log(`${category}:`);
        techs.forEach(tech => {
          console.log(`   • ${tech.name} (${tech.confidence}% confidence)`);
        });
        console.log();
      }
    }

    // Demonstrate complexity analysis
    console.log('🧮 Code Complexity Analysis...\n');
    
    const complexityAnalysis = analyzer.analyzeComplexity(
      mockFileContents['/demo/project/src/App.js'],
      'JavaScript'
    );
    
    console.log('Complexity Metrics:');
    console.log(`   • Cyclomatic complexity: ${complexityAnalysis.cyclomaticComplexity}`);
    console.log(`   • Maximum nesting depth: ${complexityAnalysis.nestingDepth}`);
    console.log(`   • Function count: ${complexityAnalysis.functionCount}`);
    console.log(`   • Class count: ${complexityAnalysis.classCount}`);
    console.log(`   • Lines of code: ${complexityAnalysis.linesOfCode}`);
    console.log(`   • Overall complexity score: ${complexityAnalysis.complexityScore}/10\n`);

    const insights = analyzer.generateInsights(complexityAnalysis);
    if (insights.length > 0) {
      console.log('💡 Code Insights:');
      insights.forEach(insight => {
        console.log(`   • ${insight}`);
      });
      console.log();
    }

    // Demonstrate markdown generation
    console.log('📝 Generated Markdown Summary:\n');
    const markdown = summarizer.generateMarkdownSummary(summary);
    console.log(markdown.substring(0, 500) + '...\n');

    console.log('✨ Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    console.error(error.stack);
  }
}

function printDirectoryStructure(structure, depth = 0) {
  const indent = '  '.repeat(depth);
  const icon = getDirectoryIcon(structure.type);
  console.log(`${indent}${icon} ${structure.name}/ (${structure.type})`);
  
  if (structure.children && structure.children.length > 0) {
    structure.children.forEach(child => {
      printDirectoryStructure(child, depth + 1);
    });
  }
  
  if (structure.importantFiles && structure.importantFiles.length > 0) {
    structure.importantFiles.forEach(file => {
      console.log(`${indent}  📄 ${file}`);
    });
  }
}

function getDirectoryIcon(type) {
  const icons = {
    source: '📁',
    test: '🧪',
    documentation: '📚',
    configuration: '⚙️',
    build: '🔨',
    assets: '🎨',
    dependencies: '📦',
    other: '📂'
  };
  return icons[type] || '📂';
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateProjectSummarizer().catch(console.error);
}

export { demonstrateProjectSummarizer };