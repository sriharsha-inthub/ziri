const vscode = require('vscode');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ZiriClient {
  constructor() {
    this.ziriPath = 'npx ziri';
  }

  async search(query) {
    try {
      const { stdout } = await execAsync(`${this.ziriPath} query "${query}" --json`, {
        cwd: vscode.workspace.rootPath
      });
      
      const results = JSON.parse(stdout);
      return Array.isArray(results) ? results : [];
    } catch (error) {
      if (error.stderr && error.stderr.includes('No results found')) {
        return [];
      }
      throw new Error(`Failed to search: ${error.message}`);
    }
  }

  async indexRepository() {
    try {
      await execAsync(`${this.ziriPath} index --verbose`, {
        cwd: vscode.workspace.rootPath
      });
    } catch (error) {
      throw new Error(`Failed to index repository: ${error.message}`);
    }
  }

  async chat(question) {
    try {
      const { stdout } = await execAsync(`${this.ziriPath} chat "${question}"`, {
        cwd: vscode.workspace.rootPath
      });
      
      return stdout;
    } catch (error) {
      throw new Error(`Failed to chat: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      await execAsync(`${this.ziriPath} --version`);
      return true;
    } catch {
      return false;
    }
  }
}

async function activate(context) {
  console.log('Ziri extension activated');

  const ziriClient = new ZiriClient();

  const searchCommand = vscode.commands.registerCommand('ziri.search', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Enter your search query',
      placeHolder: 'e.g., authentication logic, database connection, etc.'
    });

    if (query) {
      try {
        const results = await ziriClient.search(query);
        showSearchResults(results, query);
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    }
  });

  const indexCommand = vscode.commands.registerCommand('ziri.index', async () => {
    const progress = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Indexing repository with Ziri...',
      cancellable: true
    }, async (progress, token) => {
      token.onCancellationRequested(() => {
        console.log('User canceled the indexing');
      });

      try {
        await ziriClient.indexRepository();
        vscode.window.showInformationMessage('Repository indexed successfully!');
      } catch (error) {
        vscode.window.showErrorMessage(`Indexing failed: ${error}`);
      }
    });
  });

  const chatCommand = vscode.commands.registerCommand('ziri.chat', async () => {
    const question = await vscode.window.showInputBox({
      prompt: 'Ask Ziri about your code',
      placeHolder: 'e.g., How does user authentication work?'
    });

    if (question) {
      try {
        const response = await ziriClient.chat(question);
        showChatResponse(question, response);
      } catch (error) {
        vscode.window.showErrorMessage(`Chat failed: ${error}`);
      }
    }
  });

  context.subscriptions.push(searchCommand, indexCommand, chatCommand);
}

function deactivate() {
  console.log('Ziri extension deactivated');
}

function showSearchResults(results, query) {
  const panel = vscode.window.createWebviewPanel(
    'ziriSearchResults',
    `Ziri Search: ${query}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  const htmlContent = generateSearchResultsHtml(results, query);
  panel.webview.html = htmlContent;
}

function showChatResponse(question, response) {
  const panel = vscode.window.createWebviewPanel(
    'ziriChat',
    'Ziri Chat',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  const htmlContent = generateChatHtml(question, response);
  panel.webview.html = htmlContent;
}

function generateSearchResultsHtml(results, query) {
  const resultsHtml = results.map((result) => `
    <div class="result-item">
      <div class="result-header">
        <span class="score">Score: ${(result.score * 100).toFixed(1)}%</span>
        <span class="file">${result.file}</span>
        <span class="lines">Lines ${result.lines}</span>
      </div>
      <div class="result-content">
        <pre><code class="language-${result.language}">${escapeHtml(result.context)}</code></pre>
      </div>
      <div class="result-meta">
        <span class="type">${result.type}</span>
        ${result.functionName ? `<span class="function">Function: ${result.functionName}</span>` : ''}
        ${result.className ? `<span class="class">Class: ${result.className}</span>` : ''}
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ziri Search Results</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .query {
          font-size: 1.2em;
          font-weight: bold;
          color: var(--vscode-textLink-foreground);
        }
        .result-item {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          background-color: var(--vscode-editorWidget-background);
        }
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .score {
          font-weight: bold;
          color: var(--vscode-textLink-foreground);
        }
        .file {
          font-family: monospace;
          color: var(--vscode-textLink-foreground);
        }
        .lines {
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
        }
        .result-content {
          margin: 10px 0;
        }
        .result-content pre {
          margin: 0;
          padding: 10px;
          border-radius: 3px;
          background-color: var(--vscode-textCodeBlock-background);
          overflow-x: auto;
        }
        .result-meta {
          display: flex;
          gap: 15px;
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
        }
        .type, .function, .class {
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 2px 6px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="query">Search Results for: "${escapeHtml(query)}"</div>
        <div class="count">${results.length} results found</div>
      </div>
      <div class="results">
        ${resultsHtml || '<div class="no-results">No results found</div>'}
      </div>
    </body>
    </html>
  `;
}

function generateChatHtml(question, response) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ziri Chat</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
        }
        .chat-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .message {
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 8px;
        }
        .user-message {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textLink-foreground);
        }
        .assistant-message {
          background-color: var(--vscode-editorWidget-background);
          border-left: 3px solid var(--vscode-charts-blue);
        }
        .message-header {
          font-weight: bold;
          margin-bottom: 8px;
        }
        .user-header {
          color: var(--vscode-textLink-foreground);
        }
        .assistant-header {
          color: var(--vscode-charts-blue);
        }
        .message-content {
          line-height: 1.5;
        }
        .message-content pre {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <div class="chat-container">
        <div class="message user-message">
          <div class="message-header user-header">You asked:</div>
          <div class="message-content">${escapeHtml(question)}</div>
        </div>
        <div class="message assistant-message">
          <div class="message-header assistant-header">Ziri Assistant:</div>
          <div class="message-content">${formatResponse(response)}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatResponse(response) {
  return response
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/\n/g, '<br>');
}

module.exports = { activate, deactivate };