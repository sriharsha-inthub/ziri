/**
 * Advanced Configuration Management UI for Ziri
 * Web-based interface for managing Ziri configuration
 */

/**
 * Configuration UI Application
 */
export class ConfigUI {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.templates = options.templates || {};
    this.onChange = options.onChange || (() => {});
    this.onSave = options.onSave || (() => {});
  }

  /**
   * Initialize the configuration UI
   */
  async init() {
    console.log('Initializing Ziri Configuration UI...');
    
    // Load current configuration
    await this.loadConfig();
    
    // Render UI
    this.render();
    
    console.log('Configuration UI initialized');
  }

  /**
   * Load current configuration
   */
  async loadConfig() {
    try {
      // In a real implementation, this would fetch from the backend API
      // For now, we'll use a mock configuration
      this.config = {
        general: {
          defaultProvider: 'ollama',
          concurrency: 5,
          batchSize: 100,
          memoryLimit: 512
        },
        indexing: {
          chunkSize: 4000,
          overlapRatio: 0.15,
          excludePatterns: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**'
          ],
          parallelWalk: {
            enabled: false,
            concurrency: 4
          }
        },
        query: {
          defaultResults: 8,
          ranking: {
            bm25: {
              enabled: true,
              k1: 1.5,
              b: 0.75,
              weights: {
                vector: 0.7,
                bm25: 0.2,
                structural: 0.1
              }
            }
          }
        },
        advanced: {
          caching: {
            enabled: true,
            maxSize: 1000
          },
          memory: {
            gcInterval: 30000
          },
          performance: {
            profiling: false
          }
        }
      };
      
      console.log('Configuration loaded');
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  /**
   * Render the configuration UI
   */
  render() {
    // In a real implementation, this would render a web-based UI
    // For now, we'll just log the configuration structure
    console.log('Rendering Configuration UI...');
    console.log('Current Configuration:', JSON.stringify(this.config, null, 2));
    
    // Display available sections
    console.log('\nAvailable Configuration Sections:');
    console.log('1. General Settings');
    console.log('2. Indexing Configuration');
    console.log('3. Query Processing');
    console.log('4. Advanced Features');
    
    // Display available actions
    console.log('\nAvailable Actions:');
    console.log('- View current configuration');
    console.log('- Edit configuration values');
    console.log('- Save configuration changes');
    console.log('- Load configuration template');
    console.log('- Export configuration');
  }

  /**
   * Update configuration value
   * @param {string} path - Dot-separated path to configuration value
   * @param {*} value - New value
   */
  updateConfig(path, value) {
    // Split path into components
    const parts = path.split('.');
    let current = this.config;
    
    // Navigate to the target location
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    // Set the value
    const key = parts[parts.length - 1];
    current[key] = value;
    
    // Notify listeners
    this.onChange(path, value);
    
    console.log(`Updated configuration: ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * Save configuration
   */
  async saveConfig() {
    try {
      // In a real implementation, this would save to the backend
      console.log('Saving configuration...');
      console.log('Configuration saved:', JSON.stringify(this.config, null, 2));
      
      // Notify listeners
      this.onSave(this.config);
      
      return true;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return false;
    }
  }

  /**
   * Load configuration template
   * @param {string} templateName - Name of template to load
   */
  loadTemplate(templateName) {
    // Define templates
    const templates = {
      'developer-workstation': {
        general: {
          defaultProvider: 'ollama',
          concurrency: 4,
          batchSize: 100,
          memoryLimit: 512
        },
        indexing: {
          chunkSize: 4000,
          overlapRatio: 0.15,
          parallelWalk: {
            enabled: false,
            concurrency: 4
          }
        },
        query: {
          defaultResults: 8,
          ranking: {
            bm25: {
              enabled: true,
              k1: 1.5,
              b: 0.75
            }
          }
        }
      },
      'enterprise-server': {
        general: {
          defaultProvider: 'openai',
          concurrency: 10,
          batchSize: 200,
          memoryLimit: 2048
        },
        indexing: {
          chunkSize: 5000,
          overlapRatio: 0.2,
          parallelWalk: {
            enabled: true,
            concurrency: 8
          }
        },
        query: {
          defaultResults: 15,
          ranking: {
            bm25: {
              enabled: true,
              k1: 1.2,
              b: 0.75
            }
          }
        },
        advanced: {
          caching: {
            enabled: true,
            maxSize: 5000
          }
        }
      }
    };
    
    if (templates[templateName]) {
      this.config = { ...this.config, ...templates[templateName] };
      console.log(`Loaded template: ${templateName}`);
      return true;
    } else {
      console.error(`Template not found: ${templateName}`);
      return false;
    }
  }

  /**
   * Export configuration
   * @param {string} format - Export format (json, yaml, cli)
   * @returns {string} Exported configuration
   */
  exportConfig(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.config, null, 2);
      
      case 'yaml':
        // Simple YAML conversion (in real implementation, use a proper YAML library)
        return this.convertToYaml(this.config);
      
      case 'cli':
        return this.convertToCliCommands(this.config);
      
      default:
        return JSON.stringify(this.config, null, 2);
    }
  }

  /**
   * Convert configuration to YAML format
   * @param {Object} config - Configuration object
   * @returns {string} YAML representation
   */
  convertToYaml(config, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.convertToYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${item}\n`;
        }
      } else {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    return yaml;
  }

  /**
   * Convert configuration to CLI commands
   * @param {Object} config - Configuration object
   * @returns {string} CLI commands
   */
  convertToCliCommands(config) {
    const commands = [];
    
    // Convert general settings
    if (config.general) {
      if (config.general.defaultProvider) {
        commands.push(`ziri config set general.defaultProvider "${config.general.defaultProvider}"`);
      }
      if (config.general.concurrency) {
        commands.push(`ziri config set general.concurrency ${config.general.concurrency}`);
      }
      if (config.general.batchSize) {
        commands.push(`ziri config set general.batchSize ${config.general.batchSize}`);
      }
      if (config.general.memoryLimit) {
        commands.push(`ziri config set general.memoryLimit ${config.general.memoryLimit}`);
      }
    }
    
    // Convert indexing settings
    if (config.indexing) {
      if (config.indexing.chunkSize) {
        commands.push(`ziri config set indexing.chunkSize ${config.indexing.chunkSize}`);
      }
      if (config.indexing.overlapRatio) {
        commands.push(`ziri config set indexing.overlapRatio ${config.indexing.overlapRatio}`);
      }
      if (config.indexing.parallelWalk) {
        commands.push(`ziri config set indexing.parallelWalk.enabled ${config.indexing.parallelWalk.enabled}`);
        if (config.indexing.parallelWalk.concurrency) {
          commands.push(`ziri config set indexing.parallelWalk.concurrency ${config.indexing.parallelWalk.concurrency}`);
        }
      }
    }
    
    // Convert query settings
    if (config.query) {
      if (config.query.defaultResults) {
        commands.push(`ziri config set query.defaultResults ${config.query.defaultResults}`);
      }
      if (config.query.ranking && config.query.ranking.bm25) {
        commands.push(`ziri config set query.ranking.bm25.enabled ${config.query.ranking.bm25.enabled}`);
        if (config.query.ranking.bm25.k1) {
          commands.push(`ziri config set query.ranking.bm25.k1 ${config.query.ranking.bm25.k1}`);
        }
        if (config.query.ranking.bm25.b) {
          commands.push(`ziri config set query.ranking.bm25.b ${config.query.ranking.bm25.b}`);
        }
      }
    }
    
    return commands.join('\n');
  }

  /**
   * Validate configuration value
   * @param {string} path - Configuration path
   * @param {*} value - Value to validate
   * @returns {Object} Validation result
   */
  validateConfig(path, value) {
    // Define validation rules
    const rules = {
      'general.concurrency': { type: 'number', min: 1, max: 32 },
      'general.batchSize': { type: 'number', min: 1, max: 1000 },
      'general.memoryLimit': { type: 'number', min: 128, max: 8192 },
      'indexing.chunkSize': { type: 'number', min: 100, max: 10000 },
      'indexing.overlapRatio': { type: 'number', min: 0, max: 1 },
      'indexing.parallelWalk.concurrency': { type: 'number', min: 1, max: 16 },
      'query.defaultResults': { type: 'number', min: 1, max: 50 },
      'query.ranking.bm25.k1': { type: 'number', min: 0.1, max: 3.0 },
      'query.ranking.bm25.b': { type: 'number', min: 0, max: 1 }
    };
    
    const rule = rules[path];
    if (!rule) {
      return { valid: true, message: 'No validation rule defined' };
    }
    
    // Type validation
    if (rule.type === 'number' && typeof value !== 'number') {
      return { valid: false, message: 'Value must be a number' };
    }
    
    // Range validation
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, message: `Value must be at least ${rule.min}` };
    }
    
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, message: `Value must be at most ${rule.max}` };
    }
    
    return { valid: true, message: 'Valid' };
  }
}

/**
 * Create and initialize configuration UI
 * @param {Object} options - Configuration options
 * @returns {ConfigUI} Configuration UI instance
 */
export async function createConfigUI(options = {}) {
  const ui = new ConfigUI(options);
  await ui.init();
  return ui;
}

/**
 * CLI command for configuration UI
 * @param {Object} argv - Command line arguments
 */
export async function configUICommand(argv) {
  console.log('🚀 Starting Ziri Configuration UI...');
  
  // Create configuration UI
  const ui = await createConfigUI({
    onChange: (path, value) => {
      console.log(`Configuration changed: ${path} = ${JSON.stringify(value)}`);
    },
    onSave: (config) => {
      console.log('Configuration saved successfully');
    }
  });
  
  // Handle CLI arguments
  const action = argv._[1];
  
  switch (action) {
    case 'start':
      const { startConfigUI } = await import('./config-ui/server.js');
      await startConfigUI({ port: argv.port || 3000 });
      break;
      
    case 'show':
      console.log('Current Configuration:');
      console.log(ui.exportConfig('json'));
      break;
      
    case 'template':
      const templateName = argv._[2];
      if (templateName) {
        ui.loadTemplate(templateName);
        console.log(`Loaded template: ${templateName}`);
      } else {
        console.log('Available templates:');
        console.log('- developer-workstation');
        console.log('- enterprise-server');
      }
      break;
      
    case 'export':
      const format = argv.format || 'json';
      console.log(ui.exportConfig(format));
      break;
      
    case 'set':
      const path = argv._[2];
      const value = argv._[3];
      if (path && value !== undefined) {
        // Try to parse as JSON for complex values
        let parsedValue = value;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // If parsing fails, treat as string
          // Try to convert to number if it looks like one
          if (!isNaN(value) && !isNaN(parseFloat(value))) {
            parsedValue = parseFloat(value);
          }
        }
        
        const validation = ui.validateConfig(path, parsedValue);
        if (validation.valid) {
          ui.updateConfig(path, parsedValue);
          console.log(`Set ${path} = ${JSON.stringify(parsedValue)}`);
        } else {
          console.error(`Invalid value: ${validation.message}`);
        }
      } else {
        console.error('Usage: ziri config-ui set <path> <value>');
      }
      break;
      
    default:
      console.log('Ziri Configuration UI');
      console.log('Usage: ziri config-ui [start|show|template|export|set]');
      console.log('');
      console.log('Commands:');
      console.log('  start                   Start web-based configuration UI server');
      console.log('  show                    Show current configuration');
      console.log('  template [name]         Load or list templates');
      console.log('  export [--format]       Export configuration');
      console.log('  set <path> <value>      Set configuration value');
      console.log('');
      console.log('Examples:');
      console.log('  ziri config-ui start --port 3000');
      console.log('  ziri config-ui show');
      console.log('  ziri config-ui template developer-workstation');
      console.log('  ziri config-ui export --format cli');
      console.log('  ziri config-ui set general.concurrency 8');
  }
}