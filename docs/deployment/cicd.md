# Ziri CI/CD Integration Guide

This guide covers integrating Ziri into various CI/CD pipelines for automated code indexing, quality checks, and documentation generation.

## Overview

Ziri can be integrated into CI/CD pipelines to:

- **Automatically index repositories** on code changes
- **Generate project summaries** for documentation
- **Perform code quality checks** using semantic search
- **Create searchable knowledge bases** for teams
- **Monitor code complexity** and patterns over time

## GitHub Actions

### Basic Integration

```yaml
# .github/workflows/ziri.yml
name: Ziri Code Indexing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  index:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for better analysis
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install Ziri
      run: npm install -g ziri
    
    - name: Configure Ziri
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      run: |
        ziri config provider openai --api-key $OPENAI_API_KEY
        ziri config set performance.concurrency 2
        ziri config set performance.batchSize 25
        ziri config set performance.memoryLimit 512
    
    - name: Index repository
      run: |
        ziri index --verbose --stats
        echo "Indexing completed successfully"
    
    - name: Test queries
      run: |
        ziri query "main function" --k 5
        ziri query "error handling" --k 5
        ziri query "database connection" --k 5
    
    - name: Generate project summary
      run: |
        ziri summary > project-summary.md
        cat project-summary.md
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: ziri-index
        path: |
          .ziri/
          project-summary.md
        retention-days: 30
```

### Advanced Workflow with Caching

```yaml
# .github/workflows/ziri-advanced.yml
name: Advanced Ziri Integration

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

env:
  ZIRI_VERSION: '0.1.1'
  CACHE_VERSION: 'v1'

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      cache-key: ${{ steps.cache-key.outputs.key }}
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Generate cache key
      id: cache-key
      run: |
        # Create cache key based on file hashes
        find . -name "*.js" -o -name "*.ts" -o -name "*.py" | \
        head -100 | \
        xargs sha256sum | \
        sha256sum | \
        cut -d' ' -f1 > cache-key.txt
        echo "key=${{ env.CACHE_VERSION }}-$(cat cache-key.txt)" >> $GITHUB_OUTPUT

  index:
    runs-on: ubuntu-latest
    needs: setup
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Cache Ziri installation
      uses: actions/cache@v3
      with:
        path: ~/.npm
        key: ziri-${{ env.ZIRI_VERSION }}-${{ runner.os }}
    
    - name: Cache Ziri index
      uses: actions/cache@v3
      with:
        path: .ziri/
        key: ziri-index-${{ needs.setup.outputs.cache-key }}
        restore-keys: |
          ziri-index-${{ env.CACHE_VERSION }}-
    
    - name: Install Ziri
      run: npm install -g ziri@${{ env.ZIRI_VERSION }}
    
    - name: Configure Ziri
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        HUGGINGFACE_API_KEY: ${{ secrets.HUGGINGFACE_API_KEY }}
      run: |
        # Configure multiple providers for fallback
        ziri config provider openai --api-key $OPENAI_API_KEY
        ziri config provider huggingface --api-key $HUGGINGFACE_API_KEY
        ziri config set defaultProvider openai
        
        # Optimize for CI environment
        ziri config set performance.concurrency 2
        ziri config set performance.batchSize 30
        ziri config set performance.memoryLimit 1024
        ziri config set logging.level info
    
    - name: Health check
      run: ziri doctor
    
    - name: Index repository
      run: |
        # Use incremental indexing if cache exists
        if [ -d ".ziri/repositories" ]; then
          echo "Using incremental indexing"
          ziri index --verbose
        else
          echo "Performing full indexing"
          ziri index --force --verbose --stats
        fi
    
    - name: Validate index
      run: |
        # Test basic functionality
        ziri query "function" --k 1 > /dev/null
        echo "Index validation successful"
    
    - name: Generate reports
      run: |
        # Create comprehensive reports
        ziri summary --format markdown > reports/project-summary.md
        ziri stats --format json > reports/index-stats.json
        ziri benchmark --duration 30 --output reports/performance.json
    
    - name: Upload reports
      uses: actions/upload-artifact@v3
      with:
        name: ziri-reports-${{ github.sha }}
        path: reports/

  quality-check:
    runs-on: ubuntu-latest
    needs: index
    if: github.event_name == 'pull_request'
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Download index
      uses: actions/download-artifact@v3
      with:
        name: ziri-reports-${{ github.sha }}
        path: reports/
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Install Ziri
      run: npm install -g ziri@${{ env.ZIRI_VERSION }}
    
    - name: Code quality checks
      run: |
        # Check for common issues
        echo "## Code Quality Report" > quality-report.md
        echo "" >> quality-report.md
        
        # Check for TODO/FIXME items
        TODO_COUNT=$(ziri query "TODO FIXME" --k 50 | wc -l)
        echo "- **TODO/FIXME items**: $TODO_COUNT" >> quality-report.md
        
        # Check for error handling patterns
        ERROR_HANDLING=$(ziri query "try catch error handling" --k 20 | wc -l)
        echo "- **Error handling patterns**: $ERROR_HANDLING" >> quality-report.md
        
        # Check for security patterns
        SECURITY_PATTERNS=$(ziri query "authentication authorization security" --k 10 | wc -l)
        echo "- **Security patterns**: $SECURITY_PATTERNS" >> quality-report.md
        
        # Check for test coverage indicators
        TEST_PATTERNS=$(ziri query "test spec describe it" --k 30 | wc -l)
        echo "- **Test patterns**: $TEST_PATTERNS" >> quality-report.md
    
    - name: Comment PR
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const report = fs.readFileSync('quality-report.md', 'utf8');
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## Ziri Code Quality Report\n\n${report}`
          });
```

### Multi-Repository Workflow

```yaml
# .github/workflows/multi-repo.yml
name: Multi-Repository Indexing

on:
  workflow_dispatch:
    inputs:
      repositories:
        description: 'Comma-separated list of repositories'
        required: true
        default: 'frontend,backend,shared'

jobs:
  matrix-setup:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    
    steps:
    - name: Set up matrix
      id: set-matrix
      run: |
        REPOS="${{ github.event.inputs.repositories }}"
        MATRIX=$(echo $REPOS | jq -R -s -c 'split(",") | map(select(length > 0))')
        echo "matrix=$MATRIX" >> $GITHUB_OUTPUT

  index-repositories:
    runs-on: ubuntu-latest
    needs: matrix-setup
    strategy:
      matrix:
        repository: ${{ fromJson(needs.matrix-setup.outputs.matrix) }}
      fail-fast: false
    
    steps:
    - name: Checkout ${{ matrix.repository }}
      uses: actions/checkout@v4
      with:
        repository: ${{ github.repository_owner }}/${{ matrix.repository }}
        token: ${{ secrets.GITHUB_TOKEN }}
        path: ${{ matrix.repository }}
    
    - name: Setup and index
      working-directory: ${{ matrix.repository }}
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      run: |
        npm install -g ziri
        ziri config provider openai --api-key $OPENAI_API_KEY
        ziri index --verbose
        ziri summary > ../summary-${{ matrix.repository }}.md
    
    - name: Upload results
      uses: actions/upload-artifact@v3
      with:
        name: index-${{ matrix.repository }}
        path: |
          ${{ matrix.repository }}/.ziri/
          summary-${{ matrix.repository }}.md

  aggregate-results:
    runs-on: ubuntu-latest
    needs: index-repositories
    
    steps:
    - name: Download all artifacts
      uses: actions/download-artifact@v3
    
    - name: Aggregate summaries
      run: |
        echo "# Multi-Repository Summary" > combined-summary.md
        echo "" >> combined-summary.md
        
        for summary in summary-*.md; do
          if [ -f "$summary" ]; then
            repo=$(basename "$summary" .md | sed 's/summary-//')
            echo "## $repo" >> combined-summary.md
            cat "$summary" >> combined-summary.md
            echo "" >> combined-summary.md
          fi
        done
    
    - name: Upload combined results
      uses: actions/upload-artifact@v3
      with:
        name: combined-results
        path: combined-summary.md
```

## GitLab CI

### Basic Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - setup
  - index
  - analyze
  - deploy

variables:
  ZIRI_VERSION: "0.1.1"
  ZIRI_LOG_LEVEL: "info"

cache:
  key: ziri-$CI_COMMIT_REF_SLUG
  paths:
    - .ziri/
    - node_modules/

setup:
  stage: setup
  image: node:18-alpine
  script:
    - npm install -g ziri@$ZIRI_VERSION
    - ziri --version
  artifacts:
    reports:
      dotenv: build.env

index:
  stage: index
  image: node:18-alpine
  before_script:
    - npm install -g ziri@$ZIRI_VERSION
    - ziri config provider openai --api-key $OPENAI_API_KEY
    - ziri config set performance.concurrency 2
    - ziri config set performance.batchSize 25
  script:
    - ziri doctor
    - ziri index --verbose --stats
    - ziri summary --format json > project-summary.json
  artifacts:
    paths:
      - .ziri/
      - project-summary.json
    expire_in: 1 week
    reports:
      junit: ziri-report.xml
  only:
    - main
    - develop
    - merge_requests

analyze:
  stage: analyze
  image: node:18-alpine
  dependencies:
    - index
  before_script:
    - npm install -g ziri@$ZIRI_VERSION
  script:
    - |
      # Generate analysis report
      echo "Analyzing codebase patterns..."
      
      # Check for common patterns
      ziri query "TODO FIXME" --k 20 --format json > todos.json
      ziri query "deprecated" --k 10 --format json > deprecated.json
      ziri query "security vulnerability" --k 5 --format json > security.json
      
      # Generate metrics
      TODO_COUNT=$(jq length todos.json)
      DEPRECATED_COUNT=$(jq length deprecated.json)
      SECURITY_COUNT=$(jq length security.json)
      
      echo "TODO items: $TODO_COUNT"
      echo "Deprecated patterns: $DEPRECATED_COUNT"
      echo "Security concerns: $SECURITY_COUNT"
      
      # Create quality report
      cat > quality-report.json << EOF
      {
        "todos": $TODO_COUNT,
        "deprecated": $DEPRECATED_COUNT,
        "security": $SECURITY_COUNT,
        "timestamp": "$(date -Iseconds)"
      }
      EOF
  artifacts:
    paths:
      - quality-report.json
      - todos.json
      - deprecated.json
      - security.json
    reports:
      junit: quality-report.xml
  only:
    - main
    - merge_requests

deploy-docs:
  stage: deploy
  image: node:18-alpine
  dependencies:
    - index
    - analyze
  script:
    - |
      # Generate documentation
      mkdir -p public
      
      # Convert summaries to HTML
      npm install -g marked
      marked project-summary.json > public/summary.html
      
      # Create index page
      cat > public/index.html << 'EOF'
      <!DOCTYPE html>
      <html>
      <head>
          <title>Project Analysis</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; }
          </style>
      </head>
      <body>
          <h1>Project Analysis Dashboard</h1>
          <div class="metric">
              <h3>Code Quality Metrics</h3>
              <p>Generated on: $(date)</p>
          </div>
          <iframe src="summary.html" width="100%" height="600px"></iframe>
      </body>
      </html>
      EOF
  artifacts:
    paths:
      - public
  only:
    - main
```

### Advanced Pipeline with Multiple Environments

```yaml
# .gitlab-ci.yml (advanced)
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml

stages:
  - build
  - test
  - security
  - index
  - analyze
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  ZIRI_IMAGE: "ziri/ziri:latest"

.ziri_base: &ziri_base
  image: $ZIRI_IMAGE
  before_script:
    - ziri config provider openai --api-key $OPENAI_API_KEY
    - ziri config set performance.concurrency 2
    - ziri config set logging.level info

build:
  stage: build
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

test:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm test
    - npm run lint
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

index_development:
  <<: *ziri_base
  stage: index
  script:
    - ziri index --verbose
    - ziri summary --format markdown > dev-summary.md
  artifacts:
    paths:
      - .ziri/
      - dev-summary.md
    expire_in: 1 day
  environment:
    name: development
  only:
    - develop

index_staging:
  <<: *ziri_base
  stage: index
  script:
    - ziri index --force --verbose --stats
    - ziri summary --format json > staging-summary.json
    - ziri benchmark --duration 60 --output performance.json
  artifacts:
    paths:
      - .ziri/
      - staging-summary.json
      - performance.json
    expire_in: 1 week
  environment:
    name: staging
  only:
    - main

index_production:
  <<: *ziri_base
  stage: index
  script:
    - ziri index --verbose
    - ziri summary --format json > prod-summary.json
    - ziri stats --format json > prod-stats.json
  artifacts:
    paths:
      - .ziri/
      - prod-summary.json
      - prod-stats.json
    expire_in: 1 month
  environment:
    name: production
  only:
    - tags
  when: manual

analyze_code_quality:
  <<: *ziri_base
  stage: analyze
  dependencies:
    - index_staging
  script:
    - |
      # Comprehensive code analysis
      mkdir -p reports
      
      # Security analysis
      ziri query "password secret key token" --k 20 --format json > reports/security.json
      
      # Code complexity
      ziri query "nested loop complex algorithm" --k 15 --format json > reports/complexity.json
      
      # Documentation coverage
      ziri query "TODO FIXME HACK" --k 30 --format json > reports/documentation.json
      
      # Performance patterns
      ziri query "performance optimization cache" --k 10 --format json > reports/performance.json
      
      # Generate summary report
      python3 scripts/generate_quality_report.py reports/ > reports/quality-summary.html
  artifacts:
    paths:
      - reports/
    reports:
      junit: reports/quality-junit.xml
  only:
    - main
    - merge_requests

deploy_to_pages:
  stage: deploy
  dependencies:
    - analyze_code_quality
  script:
    - mkdir public
    - cp -r reports/* public/
    - cp staging-summary.json public/
  artifacts:
    paths:
      - public
  only:
    - main
```

## Jenkins

### Declarative Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        ZIRI_VERSION = '0.1.1'
        OPENAI_API_KEY = credentials('openai-api-key')
        ZIRI_LOG_LEVEL = 'info'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        retry(2)
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    // Install Ziri
                    sh '''
                        npm install -g ziri@${ZIRI_VERSION}
                        ziri --version
                    '''
                }
            }
        }
        
        stage('Configure') {
            steps {
                sh '''
                    ziri config provider openai --api-key ${OPENAI_API_KEY}
                    ziri config set performance.concurrency 3
                    ziri config set performance.batchSize 40
                    ziri config set performance.memoryLimit 768
                    ziri doctor
                '''
            }
        }
        
        stage('Index Repository') {
            steps {
                script {
                    def indexResult = sh(
                        script: 'ziri index --verbose --stats',
                        returnStdout: true
                    ).trim()
                    
                    echo "Index Result: ${indexResult}"
                    
                    // Store metrics
                    writeFile file: 'index-result.txt', text: indexResult
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: '.ziri/**/*', allowEmptyArchive: true
                    archiveArtifacts artifacts: 'index-result.txt', allowEmptyArchive: true
                }
            }
        }
        
        stage('Quality Analysis') {
            parallel {
                stage('Security Scan') {
                    steps {
                        sh '''
                            ziri query "password secret api key" --k 20 --format json > security-scan.json
                            python3 scripts/analyze_security.py security-scan.json
                        '''
                    }
                }
                
                stage('Code Complexity') {
                    steps {
                        sh '''
                            ziri query "complex nested deep" --k 15 --format json > complexity-scan.json
                            python3 scripts/analyze_complexity.py complexity-scan.json
                        '''
                    }
                }
                
                stage('Documentation Check') {
                    steps {
                        sh '''
                            ziri query "TODO FIXME HACK undocumented" --k 25 --format json > docs-scan.json
                            python3 scripts/analyze_documentation.py docs-scan.json
                        '''
                    }
                }
            }
        }
        
        stage('Generate Reports') {
            steps {
                sh '''
                    mkdir -p reports
                    ziri summary --format html > reports/project-summary.html
                    ziri stats --format json > reports/index-stats.json
                    ziri benchmark --duration 45 --output reports/performance.json
                    
                    # Generate combined report
                    python3 scripts/generate_combined_report.py reports/
                '''
            }
        }
        
        stage('Deploy Documentation') {
            when {
                branch 'main'
            }
            steps {
                script {
                    // Deploy to internal documentation server
                    sh '''
                        rsync -av reports/ ${DOCS_SERVER}:/var/www/project-docs/
                        curl -X POST ${SLACK_WEBHOOK} -d '{"text":"Project documentation updated: ${BUILD_URL}"}'
                    '''
                }
            }
        }
    }
    
    post {
        always {
            // Archive artifacts
            archiveArtifacts artifacts: 'reports/**/*', allowEmptyArchive: true
            archiveArtifacts artifacts: '*-scan.json', allowEmptyArchive: true
            
            // Publish test results if available
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports',
                reportFiles: 'project-summary.html',
                reportName: 'Ziri Analysis Report'
            ])
        }
        
        success {
            script {
                // Send success notification
                slackSend(
                    channel: '#dev-notifications',
                    color: 'good',
                    message: "✅ Ziri analysis completed successfully for ${env.JOB_NAME} #${env.BUILD_NUMBER}"
                )
            }
        }
        
        failure {
            script {
                // Send failure notification
                slackSend(
                    channel: '#dev-notifications',
                    color: 'danger',
                    message: "❌ Ziri analysis failed for ${env.JOB_NAME} #${env.BUILD_NUMBER}\nCheck: ${env.BUILD_URL}"
                )
            }
        }
        
        cleanup {
            // Clean up workspace
            cleanWs()
        }
    }
}
```

### Multibranch Pipeline

```groovy
// Jenkinsfile.multibranch
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ANALYSIS_DEPTH',
            choices: ['basic', 'standard', 'comprehensive'],
            description: 'Level of analysis to perform'
        )
        booleanParam(
            name: 'FORCE_REINDEX',
            defaultValue: false,
            description: 'Force complete re-indexing'
        )
    }
    
    environment {
        ANALYSIS_CONFIG = "${params.ANALYSIS_DEPTH}"
        FORCE_REINDEX = "${params.FORCE_REINDEX}"
    }
    
    stages {
        stage('Branch-specific Setup') {
            steps {
                script {
                    switch(env.BRANCH_NAME) {
                        case 'main':
                            env.ZIRI_PROVIDER = 'openai'
                            env.ZIRI_CONCURRENCY = '4'
                            env.ZIRI_BATCH_SIZE = '75'
                            break
                        case 'develop':
                            env.ZIRI_PROVIDER = 'ollama'
                            env.ZIRI_CONCURRENCY = '2'
                            env.ZIRI_BATCH_SIZE = '25'
                            break
                        default:
                            env.ZIRI_PROVIDER = 'ollama'
                            env.ZIRI_CONCURRENCY = '1'
                            env.ZIRI_BATCH_SIZE = '10'
                    }
                    
                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Provider: ${env.ZIRI_PROVIDER}"
                    echo "Concurrency: ${env.ZIRI_CONCURRENCY}"
                }
            }
        }
        
        stage('Dynamic Analysis') {
            steps {
                script {
                    def analysisSteps = [:]
                    
                    if (params.ANALYSIS_DEPTH in ['standard', 'comprehensive']) {
                        analysisSteps['Security Analysis'] = {
                            sh 'ziri query "security vulnerability exploit" --k 15 > security.txt'
                        }
                        analysisSteps['Performance Analysis'] = {
                            sh 'ziri query "performance bottleneck slow" --k 10 > performance.txt'
                        }
                    }
                    
                    if (params.ANALYSIS_DEPTH == 'comprehensive') {
                        analysisSteps['Architecture Analysis'] = {
                            sh 'ziri query "architecture pattern design" --k 20 > architecture.txt'
                        }
                        analysisSteps['Code Quality Analysis'] = {
                            sh 'ziri query "code smell refactor improve" --k 25 > quality.txt'
                        }
                    }
                    
                    parallel analysisSteps
                }
            }
        }
    }
}
```

## Azure DevOps

### Basic Pipeline

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
    - main
    - develop
  paths:
    exclude:
    - docs/*
    - README.md

pool:
  vmImage: 'ubuntu-latest'

variables:
  ZIRI_VERSION: '0.1.1'
  ZIRI_LOG_LEVEL: 'info'

stages:
- stage: Setup
  displayName: 'Setup Environment'
  jobs:
  - job: InstallZiri
    displayName: 'Install Ziri'
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '18.x'
      displayName: 'Install Node.js'
    
    - script: |
        npm install -g ziri@$(ZIRI_VERSION)
        ziri --version
      displayName: 'Install Ziri CLI'

- stage: Index
  displayName: 'Index Repository'
  dependsOn: Setup
  jobs:
  - job: IndexCode
    displayName: 'Index Codebase'
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '18.x'
    
    - script: npm install -g ziri@$(ZIRI_VERSION)
      displayName: 'Install Ziri'
    
    - task: AzureKeyVault@2
      inputs:
        azureSubscription: 'Azure-Service-Connection'
        KeyVaultName: 'project-keyvault'
        SecretsFilter: 'openai-api-key'
        RunAsPreJob: true
    
    - script: |
        ziri config provider openai --api-key $(openai-api-key)
        ziri config set performance.concurrency 3
        ziri config set performance.batchSize 50
        ziri doctor
      displayName: 'Configure Ziri'
      env:
        OPENAI_API_KEY: $(openai-api-key)
    
    - script: |
        ziri index --verbose --stats
        ziri summary --format json > $(Build.ArtifactStagingDirectory)/project-summary.json
      displayName: 'Index Repository'
    
    - task: PublishBuildArtifacts@1
      inputs:
        PathtoPublish: '$(Build.ArtifactStagingDirectory)'
        ArtifactName: 'ziri-index'
        publishLocation: 'Container'

- stage: Analyze
  displayName: 'Code Analysis'
  dependsOn: Index
  jobs:
  - job: QualityAnalysis
    displayName: 'Quality Analysis'
    steps:
    - task: DownloadBuildArtifacts@1
      inputs:
        buildType: 'current'
        downloadType: 'single'
        artifactName: 'ziri-index'
        downloadPath: '$(System.ArtifactsDirectory)'
    
    - task: NodeTool@0
      inputs:
        versionSpec: '18.x'
    
    - script: npm install -g ziri@$(ZIRI_VERSION)
      displayName: 'Install Ziri'
    
    - script: |
        # Perform quality checks
        ziri query "TODO FIXME" --k 30 --format json > todos.json
        ziri query "deprecated legacy" --k 15 --format json > deprecated.json
        ziri query "security auth password" --k 10 --format json > security.json
        
        # Generate quality metrics
        echo "Quality Analysis Results:" > quality-report.txt
        echo "TODOs found: $(jq length todos.json)" >> quality-report.txt
        echo "Deprecated patterns: $(jq length deprecated.json)" >> quality-report.txt
        echo "Security patterns: $(jq length security.json)" >> quality-report.txt
      displayName: 'Analyze Code Quality'
    
    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'quality-junit.xml'
        failTaskOnFailedTests: false
      condition: always()

- stage: Deploy
  displayName: 'Deploy Documentation'
  dependsOn: Analyze
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployDocs
    displayName: 'Deploy Documentation'
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: DownloadBuildArtifacts@1
            inputs:
              buildType: 'current'
              downloadType: 'single'
              artifactName: 'ziri-index'
              downloadPath: '$(Pipeline.Workspace)'
          
          - task: AzureStaticWebApp@0
            inputs:
              app_location: '$(Pipeline.Workspace)/ziri-index'
              api_location: ''
              output_location: ''
              azure_static_web_apps_api_token: $(deployment_token)
```

## Best Practices

### Performance Optimization

```yaml
# Performance-optimized configuration
performance_config: &performance_config
  environment:
    ZIRI_CONCURRENCY: "2"  # Conservative for CI
    ZIRI_BATCH_SIZE: "25"  # Smaller batches for stability
    ZIRI_MEMORY_LIMIT: "512"  # Limit memory usage
    ZIRI_LOG_LEVEL: "info"  # Reduce log verbosity

cache_config: &cache_config
  cache:
    key: ziri-${{ hashFiles('**/*.js', '**/*.ts', '**/*.py') }}
    paths:
      - .ziri/
      - node_modules/
    restore-keys: |
      ziri-
```

### Security Best Practices

```yaml
# Secure secrets management
security_setup: &security_setup
  steps:
    - name: Configure secrets
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        HUGGINGFACE_API_KEY: ${{ secrets.HUGGINGFACE_API_KEY }}
      run: |
        # Never log API keys
        set +x
        ziri config provider openai --api-key "$OPENAI_API_KEY"
        ziri config provider huggingface --api-key "$HUGGINGFACE_API_KEY"
        set -x
        
        # Verify configuration without exposing secrets
        ziri doctor | grep -v "api.*key"
```

### Error Handling

```yaml
# Robust error handling
error_handling: &error_handling
  steps:
    - name: Index with fallback
      run: |
        # Try primary provider first
        if ! ziri index --provider openai --timeout 300; then
          echo "Primary provider failed, trying fallback..."
          if ! ziri index --provider ollama --timeout 600; then
            echo "All providers failed, using legacy mode"
            ziri index --legacy --timeout 900
          fi
        fi
    
    - name: Validate results
      run: |
        # Ensure index was created successfully
        if [ ! -d ".ziri/repositories" ]; then
          echo "Error: No index created"
          exit 1
        fi
        
        # Test basic functionality
        if ! ziri query "test" --k 1 > /dev/null 2>&1; then
          echo "Error: Index validation failed"
          exit 1
        fi
        
        echo "Index validation successful"
```

This comprehensive CI/CD integration guide provides robust, production-ready configurations for integrating Ziri into various CI/CD platforms with proper error handling, security, and performance optimization.