/**
 * Interactive REPL for Ziri CLI
 * Provides an interactive read-eval-print loop for querying and chatting
 */

import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { queryCommand } from './query.js';
import { chatCommand } from './chat.js';

/**
 * Ziri Interactive REPL
 */
export class ZiriRepl {
  constructor(configManager) {
    this.configManager = configManager;
    this.rl = null;
    this._history = [];
    this.mode = 'query'; // 'query' or 'chat'
  }

  /**
   * Get command history
   * @returns {string[]} Command history
   */
  get history() {
    // Return a proxy that enforces the 100-item limit on push operations
    const self = this;
    return new Proxy(this._history, {
      get(target, prop) {
        if (prop === 'push') {
          return function(...items) {
            const result = target[prop](...items);
            // Enforce limit after push
            while (self._history.length > 100) {
              self._history.shift();
            }
            return result;
          };
        }
        return target[prop];
      }
    });
  }

  /**
   * Set command history with automatic limiting
   * @param {string[]} history - New history array
   */
  set history(history) {
    this._history = history.slice(-100); // Keep only last 100 items
  }

  /**
   * Start the interactive REPL
   */
  async start() {
    console.log('🚀 Ziri Interactive Mode');
    console.log('Type your questions or commands. Type "help" for available commands.');
    console.log('');

    this.rl = readline.createInterface({ input, output });
    
    // Set up command completion
    this.rl.setPrompt('ziri> ');
    
    // Handle line input
    this.rl.on('line', async (line) => {
      await this.handleInput(line.trim());
    });
    
    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });
    
    // Show initial prompt
    this.rl.prompt();
  }

  /**
   * Handle user input
   * @param {string} input - User input
   */
  async handleInput(input) {
    if (!input) {
      this.rl.prompt();
      return;
    }

    // Add to history
    this._addToHistory(input);

    // Handle built-in commands
    if (input.startsWith('/')) {
      await this.handleCommand(input.substring(1));
    } else {
      // Handle query or chat based on current mode
      await this.handleQueryOrChat(input);
    }
    
    this.rl.prompt();
  }

  /**
   * Add command to history with proper limiting
   * @param {string} command - Command to add to history
   * @private
   */
  _addToHistory(command) {
    this._history.push(command);
    
    // Keep history limited to 100 items
    while (this._history.length > 100) {
      this._history.shift();
    }
  }

  /**
   * Handle built-in REPL commands
   * @param {string} command - Command without leading '/'
   */
  async handleCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
      case 'h':
        this.showHelp();
        break;
        
      case 'mode':
        if (args.length === 0) {
          console.log(`Current mode: ${this.mode}`);
          console.log('Available modes: query, chat');
        } else {
          const newMode = args[0].toLowerCase();
          if (newMode === 'query' || newMode === 'chat') {
            this.mode = newMode;
            console.log(`✅ Switched to ${newMode} mode`);
          } else {
            console.log('❌ Invalid mode. Use: query or chat');
          }
        }
        break;
        
      case 'history':
      case 'hist':
        console.log('Command History:');
        this.history.forEach((cmd, index) => {
          console.log(`  ${index + 1}: ${cmd}`);
        });
        break;
        
      case 'clear':
        console.clear();
        break;
        
      case 'config':
        if (args.length === 0) {
          const config = await this.configManager.getConfig();
          console.log('Current Configuration:');
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('Use "ziri config" command for configuration management');
        }
        break;
        
      case 'quit':
      case 'exit':
      case 'q':
        console.log('👋 Goodbye!');
        this.rl.close();
        process.exit(0);
        break;
        
      default:
        console.log(`❌ Unknown command: /${cmd}`);
        console.log('Type "/help" for available commands');
    }
  }

  /**
   * Handle query or chat based on current mode
   * @param {string} input - User input
   */
  async handleQueryOrChat(input) {
    try {
      switch (this.mode) {
        case 'query':
          await this.executeQuery(input);
          break;
        case 'chat':
          await this.executeChat(input);
          break;
        default:
          console.log('❌ Invalid mode');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  /**
   * Execute a query
   * @param {string} query - Search query
   */
  async executeQuery(query) {
    console.log(`🔍 Searching for: "${query}"`);
    
    // Create mock argv object for query command
    const argv = {
      _: ['query', query],
      k: '5', // Default to 5 results
      scope: 'repo' // Default to current repo
    };
    
    await queryCommand({ argv });
  }

  /**
   * Execute a chat
   * @param {string} question - Chat question
   */
  async executeChat(question) {
    console.log(`💬 Chatting about: "${question}"`);
    
    // Create mock argv object for chat command
    const argv = {
      _: ['chat', question],
      k: '5', // Default to 5 context results
      scope: 'repo' // Default to current repo
    };
    
    await chatCommand({ argv, configManager: this.configManager });
  }

  /**
   * Show REPL help
   */
  showHelp() {
    console.log(`
Ziri Interactive REPL Commands:
  /help, /h          Show this help message
  /mode [query|chat] Switch between query and chat modes
  /history, /hist    Show command history
  /clear             Clear the screen
  /config            Show current configuration
  /quit, /exit, /q   Exit the REPL

Modes:
  query - Search codebase for relevant snippets (default)
  chat  - Chat with AI using codebase context

Usage:
  Type your question directly to search or chat
  Switch modes with "/mode chat" or "/mode query"
  Use Ctrl+C or "/quit" to exit
`);
  }
}