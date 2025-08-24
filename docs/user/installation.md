# Ziri Installation Guide

This guide provides comprehensive installation instructions for Ziri across different platforms and environments.

## Quick Installation

### Node.js (Recommended)

```bash
# Install globally via npm
npm install -g ziri

# Verify installation
ziri --version
ziri doctor
```

### Python

```bash
# Install via pipx (recommended)
pipx install ziri

# Or via pip
pip install ziri

# Verify installation
ziri --version
```

## Platform-Specific Installation

### Windows

#### Using npm (Node.js)
```powershell
# Install Node.js from https://nodejs.org
# Then install Ziri globally
npm install -g ziri

# Verify installation
ziri --version
ziri doctor
```

#### Using Python
```powershell
# Install Python from https://python.org
# Install pipx
python -m pip install pipx
python -m pipx ensurepath

# Install Ziri
pipx install ziri

# Verify installation
ziri --version
```

#### Using Chocolatey
```powershell
# Install Chocolatey first: https://chocolatey.org/install
# Then install Node.js and Ziri
choco install nodejs
npm install -g ziri
```

#### Using Scoop
```powershell
# Install Scoop first: https://scoop.sh
# Then install Node.js and Ziri
scoop install nodejs
npm install -g ziri
```

### macOS

#### Using npm (Node.js)
```bash
# Install Node.js via Homebrew
brew install node

# Install Ziri globally
npm install -g ziri

# Verify installation
ziri --version
ziri doctor
```

#### Using Python
```bash
# Install Python via Homebrew
brew install python

# Install pipx
python3 -m pip install pipx
python3 -m pipx ensurepath

# Install Ziri
pipx install ziri
```

#### Using Homebrew (when available)
```bash
# Add Ziri tap (when published)
brew tap ziri/ziri
brew install ziri
```

### Linux

#### Ubuntu/Debian
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Ziri
sudo npm install -g ziri

# Or using Python
sudo apt-get install python3-pip pipx
pipx install ziri
```

#### CentOS/RHEL/Fedora
```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo dnf install nodejs npm  # or yum for older versions

# Install Ziri
sudo npm install -g ziri

# Or using Python
sudo dnf install python3-pip
python3 -m pip install pipx
pipx install ziri
```

#### Arch Linux
```bash
# Install Node.js
sudo pacman -S nodejs npm

# Install Ziri
sudo npm install -g ziri

# Or using Python
sudo pacman -S python-pip
python -m pip install pipx
pipx install ziri
```

## Development Installation

### From Source (Node.js)

```bash
# Clone the repository
git clone https://github.com/ziri-ai/ziri.git
cd ziri

# Install dependencies
cd packages/ziri-js
npm install

# Build the project
npm run build

# Link for development
npm link

# Verify installation
ziri --version
```

### From Source (Python)

```bash
# Clone the repository
git clone https://github.com/ziri-ai/ziri.git
cd ziri

# Install in development mode
cd packages/ziri-py
pip install -e .

# Verify installation
ziri --version
```

### From Tarball

```bash
# Download and install from tarball (Node.js)
cd packages/ziri-js
npm pack
npm install -g ziri-0.1.1.tgz

# Or for Python
cd packages/ziri-py
python setup.py sdist
pip install dist/ziri-0.1.1.tar.gz
```

## Container Installation

### Docker

```dockerfile
# Dockerfile for Ziri
FROM node:18-alpine

# Install Ziri
RUN npm install -g ziri

# Set up working directory
WORKDIR /workspace

# Copy configuration if needed
COPY .ziri-config.json /root/.ziri/config.json

# Set environment variables
ENV ZIRI_LOG_LEVEL=info
ENV ZIRI_HOME=/root/.ziri

# Default command
CMD ["ziri", "--help"]
```

```bash
# Build and run
docker build -t ziri .
docker run -v $(pwd):/workspace ziri index
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  ziri:
    image: node:18-alpine
    working_dir: /workspace
    volumes:
      - .:/workspace
      - ziri-data:/root/.ziri
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ZIRI_LOG_LEVEL=info
    command: |
      sh -c "
        npm install -g ziri &&
        ziri index &&
        ziri query 'authentication logic'
      "

volumes:
  ziri-data:
```

```bash
# Run with Docker Compose
docker-compose up
```

## CI/CD Installation

### GitHub Actions

```yaml
# .github/workflows/ziri.yml
name: Ziri Indexing

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  index:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install Ziri
      run: npm install -g ziri
      
    - name: Configure Ziri
      run: |
        ziri config provider openai --api-key ${{ secrets.OPENAI_API_KEY }}
        ziri config set performance.concurrency 2
        ziri config set performance.batchSize 25
      
    - name: Index Repository
      run: ziri index --verbose
      
    - name: Test Query
      run: ziri query "main function" --k 5
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - index
  - query

variables:
  ZIRI_LOG_LEVEL: "info"

index_repository:
  stage: index
  image: node:18-alpine
  before_script:
    - npm install -g ziri
    - ziri config provider openai --api-key $OPENAI_API_KEY
  script:
    - ziri index --concurrency 2 --batch-size 25
  artifacts:
    paths:
      - .ziri/
    expire_in: 1 hour

test_query:
  stage: query
  image: node:18-alpine
  dependencies:
    - index_repository
  before_script:
    - npm install -g ziri
  script:
    - ziri query "authentication" --k 10
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        OPENAI_API_KEY = credentials('openai-api-key')
        ZIRI_LOG_LEVEL = 'info'
    }
    
    stages {
        stage('Install Ziri') {
            steps {
                sh 'npm install -g ziri'
                sh 'ziri --version'
            }
        }
        
        stage('Configure Ziri') {
            steps {
                sh 'ziri config provider openai --api-key $OPENAI_API_KEY'
                sh 'ziri config set performance.concurrency 2'
                sh 'ziri doctor'
            }
        }
        
        stage('Index Repository') {
            steps {
                sh 'ziri index --verbose --stats'
            }
        }
        
        stage('Test Queries') {
            steps {
                sh 'ziri query "error handling" --k 5'
                sh 'ziri query "database connection" --k 5'
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: '.ziri/logs/*.log', allowEmptyArchive: true
        }
    }
}
```

## Troubleshooting Installation

### Common Issues

#### Permission Errors (npm)
```bash
# Fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Or use npx instead
npx ziri --version

# Or use a Node version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g ziri
```

#### Python Path Issues
```bash
# Ensure pipx is in PATH
python3 -m pipx ensurepath
source ~/.bashrc  # or ~/.zshrc

# Or add manually
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Command Not Found
```bash
# Check installation
which ziri
npm list -g ziri  # for npm
pipx list  # for pipx

# Reinstall if needed
npm uninstall -g ziri && npm install -g ziri
```

#### Version Conflicts
```bash
# Check Node.js version (requires 16+)
node --version

# Check Python version (requires 3.8+)
python3 --version

# Update if needed
nvm install node  # for Node.js
pyenv install 3.11  # for Python
```

### Platform-Specific Issues

#### Windows PowerShell Execution Policy
```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass
powershell -ExecutionPolicy Bypass -Command "npm install -g ziri"
```

#### macOS Gatekeeper
```bash
# If blocked by Gatekeeper
sudo spctl --master-disable  # Temporarily disable
# Install Ziri
sudo spctl --master-enable   # Re-enable
```

#### Linux Missing Dependencies
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential python3-dev

# CentOS/RHEL
sudo dnf groupinstall "Development Tools"
sudo dnf install python3-devel
```

## Verification

### Post-Installation Checks

```bash
# Check version
ziri --version

# Check system health
ziri doctor

# Check storage locations
ziri where

# Test basic functionality
mkdir test-repo
cd test-repo
echo "console.log('Hello, world!')" > test.js
ziri config provider ollama  # or your preferred provider
ziri index
ziri query "hello world"
```

### Expected Output

```bash
$ ziri --version
ziri version 0.1.1

$ ziri doctor
✅ Ziri installation: OK
✅ Storage directory: /home/user/.ziri (writable)
✅ Configuration: /home/user/.ziri/config.json (valid)
✅ Default provider: ollama (configured)
✅ Provider connectivity: OK
✅ System resources: OK (8GB RAM, 4 CPU cores)

Recommendations:
- Consider increasing concurrency to 4 for better performance
- Ollama model 'nomic-embed-text' is optimal for your setup
```

## Uninstallation

### Remove Ziri

```bash
# npm installation
npm uninstall -g ziri

# pipx installation
pipx uninstall ziri

# pip installation
pip uninstall ziri
```

### Clean Up Data

```bash
# Remove all Ziri data (optional)
rm -rf ~/.ziri

# Or backup first
mv ~/.ziri ~/.ziri.backup
```

## Next Steps

After installation:

1. **Configure a provider**: `ziri config provider openai --api-key sk-your-key`
2. **Index your first repository**: `ziri index`
3. **Try a query**: `ziri query "your search terms"`
4. **Read the documentation**: Check out the [Quickstart Guide](quickstart.md)
5. **Optimize performance**: Run `ziri benchmark` to find optimal settings

For detailed usage instructions, see the [CLI Reference](cli-reference.md) and [Usage Examples](usage-examples.md).