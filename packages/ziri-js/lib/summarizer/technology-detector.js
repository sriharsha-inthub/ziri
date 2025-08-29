/**
 * Technology Detector
 * Specialized class for detecting technologies, frameworks, and tools used in projects
 */

export class TechnologyDetector {
  constructor() {
    this.detectorVersion = '1.0.0';
    this.initializeDetectionRules();
  }

  /**
   * Initialize detection rules for various technologies
   */
  initializeDetectionRules() {
    this.filePatterns = {
      // Package managers and config files
      'npm': ['package.json', 'package-lock.json'],
      'yarn': ['yarn.lock', '.yarnrc'],
      'pnpm': ['pnpm-lock.yaml', '.pnpmrc'],
      'pip': ['requirements.txt', 'Pipfile', 'pyproject.toml'],
      'composer': ['composer.json', 'composer.lock'],
      'maven': ['pom.xml'],
      'gradle': ['build.gradle', 'gradle.properties'],
      'cargo': ['Cargo.toml', 'Cargo.lock'],
      'go-modules': ['go.mod', 'go.sum'],
      'bundler': ['Gemfile', 'Gemfile.lock'],

      // Build tools and bundlers
      'webpack': ['webpack.config.js', 'webpack.config.ts'],
      'vite': ['vite.config.js', 'vite.config.ts'],
      'rollup': ['rollup.config.js'],
      'parcel': ['.parcelrc'],
      'gulp': ['gulpfile.js'],
      'grunt': ['Gruntfile.js'],

      // Testing frameworks
      'jest': ['jest.config.js', 'jest.config.json'],
      'vitest': ['vitest.config.js', 'vitest.config.ts'],
      'mocha': ['.mocharc.json', 'mocha.opts'],
      'cypress': ['cypress.config.js', 'cypress.json'],
      'playwright': ['playwright.config.js', 'playwright.config.ts'],

      // Containerization and deployment
      'docker': ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
      'kubernetes': ['deployment.yaml', 'service.yaml', 'ingress.yaml'],
      'terraform': ['main.tf', 'variables.tf', 'outputs.tf'],

      // CI/CD
      'github-actions': ['.github/workflows'],
      'gitlab-ci': ['.gitlab-ci.yml'],
      'jenkins': ['Jenkinsfile'],
      'travis': ['.travis.yml'],

      // Linting and formatting
      'eslint': ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'],
      'prettier': ['.prettierrc', 'prettier.config.js'],
      'stylelint': ['.stylelintrc', 'stylelint.config.js'],

      // TypeScript
      'typescript': ['tsconfig.json', 'tsconfig.build.json'],

      // Databases
      'prisma': ['schema.prisma'],
      'sequelize': ['.sequelizerc'],
      'typeorm': ['ormconfig.json'],

      // Cloud platforms
      'vercel': ['vercel.json'],
      'netlify': ['netlify.toml', '_redirects'],
      'aws': ['serverless.yml', 'sam.yaml']
    };

    this.contentPatterns = {
      // Frontend frameworks
      'react': [
        /import.*react/i,
        /from ['"]react['"]/i,
        /React\./,
        /jsx/i
      ],
      'vue': [
        /import.*vue/i,
        /from ['"]vue['"]/i,
        /<template>/i,
        /Vue\./
      ],
      'angular': [
        /@angular/i,
        /@Component/i,
        /@Injectable/i,
        /import.*@angular/i
      ],
      'svelte': [
        /import.*svelte/i,
        /<script>/i,
        /\.svelte/i
      ],

      // Backend frameworks
      'express': [
        /require\(['"]express['"]\)/i,
        /import.*express/i,
        /app\.get\(/i,
        /app\.post\(/i
      ],
      'fastapi': [
        /from fastapi/i,
        /import FastAPI/i,
        /@app\./i
      ],
      'django': [
        /from django/i,
        /import django/i,
        /django\.conf/i
      ],
      'flask': [
        /from flask/i,
        /import Flask/i,
        /@app\.route/i
      ],
      'spring': [
        /@SpringBootApplication/i,
        /@RestController/i,
        /import org\.springframework/i
      ],

      // Databases
      'mongodb': [
        /mongodb/i,
        /mongoose/i,
        /MongoClient/i
      ],
      'postgresql': [
        /postgresql/i,
        /psycopg2/i,
        /pg\./i
      ],
      'mysql': [
        /mysql/i,
        /import mysql/i
      ],
      'redis': [
        /redis/i,
        /import redis/i
      ],

      // CSS frameworks
      'tailwind': [
        /tailwindcss/i,
        /tailwind\.config/i,
        /class=".*\b(bg-|text-|p-|m-|w-|h-)/i
      ],
      'bootstrap': [
        /bootstrap/i,
        /class=".*\b(btn|col-|row|container)/i
      ],
      'material-ui': [
        /@mui/i,
        /@material-ui/i,
        /import.*@mui/i
      ],

      // State management
      'redux': [
        /redux/i,
        /useSelector/i,
        /useDispatch/i
      ],
      'mobx': [
        /mobx/i,
        /@observable/i,
        /@action/i
      ],
      'zustand': [
        /zustand/i,
        /create\(/i
      ],

      // Testing libraries
      'jest': [
        /describe\(/i,
        /it\(/i,
        /test\(/i,
        /expect\(/i
      ],
      'cypress': [
        /cy\./i,
        /describe\(/i,
        /it\(/i
      ],

      // Cloud services
      'aws': [
        /aws-sdk/i,
        /import.*aws/i,
        /AWS\./i
      ],
      'gcp': [
        /google-cloud/i,
        /from google\.cloud/i
      ],
      'azure': [
        /azure/i,
        /import.*azure/i
      ]
    };

    this.dependencyPatterns = {
      // JavaScript/Node.js
      'react': ['react', 'react-dom'],
      'vue': ['vue', '@vue/cli'],
      'angular': ['@angular/core', '@angular/cli'],
      'express': ['express'],
      'next.js': ['next'],
      'nuxt.js': ['nuxt'],
      'gatsby': ['gatsby'],
      'svelte': ['svelte'],
      'solid': ['solid-js'],

      // Python
      'django': ['Django'],
      'flask': ['Flask'],
      'fastapi': ['fastapi'],
      'pandas': ['pandas'],
      'numpy': ['numpy'],
      'tensorflow': ['tensorflow'],
      'pytorch': ['torch'],

      // Java
      'spring-boot': ['spring-boot-starter'],
      'hibernate': ['hibernate-core'],

      // .NET
      'asp.net': ['Microsoft.AspNetCore'],
      'entity-framework': ['Microsoft.EntityFrameworkCore'],

      // PHP
      'laravel': ['laravel/framework'],
      'symfony': ['symfony/symfony'],

      // Ruby
      'rails': ['rails'],
      'sinatra': ['sinatra'],

      // Go
      'gin': ['github.com/gin-gonic/gin'],
      'echo': ['github.com/labstack/echo'],

      // Rust
      'actix': ['actix-web'],
      'rocket': ['rocket']
    };
  }

  /**
   * Detect technologies used in the project
   */
  detectTechnologies(analysis) {
    const detectedTechnologies = new Map();

    // Detect from file patterns
    this.detectFromFilePatterns(analysis.files, detectedTechnologies);

    // Detect from content patterns
    this.detectFromContentPatterns(analysis.files, detectedTechnologies);

    // Detect from package files
    this.detectFromPackageFiles(analysis.packageFiles, detectedTechnologies);

    // Detect from file extensions
    this.detectFromExtensions(analysis.files, detectedTechnologies);

    return this.rankTechnologies(detectedTechnologies);
  }

  /**
   * Detect technologies from file patterns
   */
  detectFromFilePatterns(files, detectedTechnologies) {
    for (const file of files) {
      const fileName = file.relativePath.toLowerCase();
      
      for (const [tech, patterns] of Object.entries(this.filePatterns)) {
        for (const pattern of patterns) {
          if (fileName.includes(pattern.toLowerCase()) || fileName.endsWith(pattern.toLowerCase())) {
            this.addTechnology(detectedTechnologies, tech, 'file-pattern', 0.8);
          }
        }
      }
    }
  }

  /**
   * Detect technologies from content patterns
   */
  detectFromContentPatterns(files, detectedTechnologies) {
    for (const file of files) {
      const content = file.content || '';
      
      for (const [tech, patterns] of Object.entries(this.contentPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            this.addTechnology(detectedTechnologies, tech, 'content-pattern', 0.7);
          }
        }
      }
    }
  }

  /**
   * Detect technologies from package files
   */
  detectFromPackageFiles(packageFiles, detectedTechnologies) {
    for (const file of packageFiles) {
      if (file.relativePath.endsWith('package.json')) {
        this.analyzePackageJson(file, detectedTechnologies);
      } else if (file.relativePath.endsWith('requirements.txt')) {
        this.analyzeRequirementsTxt(file, detectedTechnologies);
      } else if (file.relativePath.endsWith('Cargo.toml')) {
        this.analyzeCargoToml(file, detectedTechnologies);
      } else if (file.relativePath.endsWith('pom.xml')) {
        this.analyzePomXml(file, detectedTechnologies);
      }
    }
  }

  /**
   * Analyze package.json for technologies
   */
  analyzePackageJson(file, detectedTechnologies) {
    try {
      const content = JSON.parse(file.content || '{}');
      const allDeps = {
        ...content.dependencies,
        ...content.devDependencies,
        ...content.peerDependencies
      };

      for (const [tech, depPatterns] of Object.entries(this.dependencyPatterns)) {
        for (const pattern of depPatterns) {
          for (const dep of Object.keys(allDeps)) {
            if (dep.includes(pattern) || pattern.includes(dep)) {
              this.addTechnology(detectedTechnologies, tech, 'dependency', 0.9);
            }
          }
        }
      }

      // Detect build tools and frameworks from scripts
      const scripts = content.scripts || {};
      for (const script of Object.values(scripts)) {
        if (script.includes('webpack')) {
          this.addTechnology(detectedTechnologies, 'webpack', 'script', 0.8);
        }
        if (script.includes('vite')) {
          this.addTechnology(detectedTechnologies, 'vite', 'script', 0.8);
        }
        if (script.includes('jest')) {
          this.addTechnology(detectedTechnologies, 'jest', 'script', 0.8);
        }
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
  }

  /**
   * Analyze requirements.txt for Python technologies
   */
  analyzeRequirementsTxt(file, detectedTechnologies) {
    const lines = (file.content || '').split('\n');
    
    for (const line of lines) {
      const packageName = line.split('==')[0].split('>=')[0].split('~=')[0].trim().toLowerCase();
      
      for (const [tech, depPatterns] of Object.entries(this.dependencyPatterns)) {
        for (const pattern of depPatterns) {
          if (packageName === pattern.toLowerCase()) {
            this.addTechnology(detectedTechnologies, tech, 'dependency', 0.9);
          }
        }
      }
    }
  }

  /**
   * Analyze Cargo.toml for Rust technologies
   */
  analyzeCargoToml(file, detectedTechnologies) {
    const content = file.content || '';
    
    // Simple TOML parsing for dependencies
    const dependencySection = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
    if (dependencySection) {
      const deps = dependencySection[1];
      
      for (const [tech, depPatterns] of Object.entries(this.dependencyPatterns)) {
        for (const pattern of depPatterns) {
          if (deps.includes(pattern)) {
            this.addTechnology(detectedTechnologies, tech, 'dependency', 0.9);
          }
        }
      }
    }
  }

  /**
   * Analyze pom.xml for Java technologies
   */
  analyzePomXml(file, detectedTechnologies) {
    const content = file.content || '';
    
    for (const [tech, depPatterns] of Object.entries(this.dependencyPatterns)) {
      for (const pattern of depPatterns) {
        if (content.includes(pattern)) {
          this.addTechnology(detectedTechnologies, tech, 'dependency', 0.9);
        }
      }
    }
  }

  /**
   * Detect technologies from file extensions
   */
  detectFromExtensions(files, detectedTechnologies) {
    const extensionMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'react',
      '.tsx': 'react',
      '.vue': 'vue',
      '.py': 'python',
      '.java': 'java',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.rb': 'ruby',
      '.php': 'php',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'sass',
      '.less': 'less',
      '.sql': 'sql',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.dockerfile': 'docker'
    };

    for (const file of files) {
      const ext = file.extension.toLowerCase();
      if (extensionMap[ext]) {
        this.addTechnology(detectedTechnologies, extensionMap[ext], 'extension', 0.6);
      }
    }
  }

  /**
   * Add technology to detection results
   */
  addTechnology(detectedTechnologies, tech, source, confidence) {
    if (!detectedTechnologies.has(tech)) {
      detectedTechnologies.set(tech, {
        name: tech,
        confidence: 0,
        sources: [],
        detectionCount: 0
      });
    }

    const techData = detectedTechnologies.get(tech);
    techData.confidence = Math.max(techData.confidence, confidence);
    techData.sources.push(source);
    techData.detectionCount++;
  }

  /**
   * Rank technologies by confidence and detection frequency
   */
  rankTechnologies(detectedTechnologies) {
    const technologies = Array.from(detectedTechnologies.values());
    
    // Calculate final score based on confidence and detection frequency
    for (const tech of technologies) {
      tech.score = tech.confidence * (1 + Math.log(tech.detectionCount));
    }

    // Sort by score and return top technologies
    return technologies
      .sort((a, b) => b.score - a.score)
      .filter(tech => tech.confidence > 0.5) // Filter out low-confidence detections
      .map(tech => ({
        name: this.formatTechnologyName(tech.name),
        confidence: Math.round(tech.confidence * 100),
        sources: [...new Set(tech.sources)], // Remove duplicates
        detectionCount: tech.detectionCount
      }));
  }

  /**
   * Format technology name for display
   */
  formatTechnologyName(name) {
    const nameMap = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'react': 'React',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'python': 'Python',
      'java': 'Java',
      'csharp': 'C#',
      'cpp': 'C++',
      'go': 'Go',
      'rust': 'Rust',
      'ruby': 'Ruby',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'scala': 'Scala',
      'html': 'HTML',
      'css': 'CSS',
      'sass': 'Sass/SCSS',
      'less': 'LESS',
      'sql': 'SQL',
      'bash': 'Bash',
      'powershell': 'PowerShell',
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'aws': 'Amazon Web Services',
      'gcp': 'Google Cloud Platform',
      'azure': 'Microsoft Azure'
    };

    return nameMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Get technology categories
   */
  categorizeTechnologies(technologies) {
    const categories = {
      'Programming Languages': [],
      'Frontend Frameworks': [],
      'Backend Frameworks': [],
      'Databases': [],
      'Build Tools': [],
      'Testing': [],
      'DevOps': [],
      'Cloud Services': [],
      'Other': []
    };

    const categoryMap = {
      'JavaScript': 'Programming Languages',
      'TypeScript': 'Programming Languages',
      'Python': 'Programming Languages',
      'Java': 'Programming Languages',
      'C#': 'Programming Languages',
      'Go': 'Programming Languages',
      'Rust': 'Programming Languages',
      'React': 'Frontend Frameworks',
      'Vue.js': 'Frontend Frameworks',
      'Angular': 'Frontend Frameworks',
      'Express': 'Backend Frameworks',
      'Django': 'Backend Frameworks',
      'Flask': 'Backend Frameworks',
      'Spring': 'Backend Frameworks',
      'MongoDB': 'Databases',
      'PostgreSQL': 'Databases',
      'MySQL': 'Databases',
      'Redis': 'Databases',
      'Webpack': 'Build Tools',
      'Vite': 'Build Tools',
      'Jest': 'Testing',
      'Cypress': 'Testing',
      'Docker': 'DevOps',
      'Kubernetes': 'DevOps',
      'AWS': 'Cloud Services',
      'GCP': 'Cloud Services',
      'Azure': 'Cloud Services'
    };

    for (const tech of technologies) {
      const category = categoryMap[tech.name] || 'Other';
      categories[category].push(tech);
    }

    // Remove empty categories
    return Object.fromEntries(
      Object.entries(categories).filter(([, techs]) => techs.length > 0)
    );
  }
}