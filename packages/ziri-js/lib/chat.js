/**
 * Chat with Context Command
 * Combines vector search + Ollama generation for contextual AI responses
 */

export async function chatCommand({ argv, configManager }) {
  const query = argv._[1];
  if (!query) {
    console.error('❌ Query required. Usage: ziri chat "your question" [options]');
    console.error('Example: ziri chat "how does authentication work?" --k 5');
    
    // Don't call process.exit in test environments
    if (typeof process !== 'undefined' && process.exit && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      process.exit(1);
    } else {
      throw new Error('Query required');
    }
  }

  // Start performance timing
  const startTime = Date.now();
  
  console.log('🤖 Starting Ziri Chat with Context...');
  console.log(`📝 Query: "${query}"`);

  // Set up timeout for the entire operation
  const timeoutMs = 120000; // 120 seconds (2 minutes) for complex context processing
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Chat command timed out after 2 minutes')), timeoutMs);
  });

  try {
    // Wrap the main operation in a timeout
    await Promise.race([
      performChatOperation(query, argv, configManager, startTime),
      timeoutPromise
    ]);
    
    // Clear the timeout if operation completed successfully
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    // Clear the timeout if operation failed
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.error('❌ Chat command failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('No available providers')) {
      console.error('\n💡 To set up Ollama (recommended):');
      console.error('   1. Install Ollama: https://ollama.ai/download');
      console.error('   2. Start Ollama: ollama serve');
      console.error('   3. Pull models: ollama pull nomic-embed-text && ollama pull qwen2:1.5b');
      console.error('\n💡 Or configure an alternative provider:');
      console.error('   ziri config provider openai --api-key sk-...');
    } else if (error.message.includes('Ollama provider not configured')) {
      console.error('\n💡 To configure Ollama:');
      console.error('   1. Install Ollama: https://ollama.ai/download');
      console.error('   2. Start Ollama: ollama serve');
      console.error('   3. Pull models: ollama pull nomic-embed-text && ollama pull qwen2:1.5b');
    } else if (error.message.includes('Cannot connect to Ollama')) {
      console.error('\n💡 Make sure Ollama is running:');
      console.error('   1. Start Ollama: ollama serve');
      console.error('   2. Check if running: curl http://localhost:11434/api/tags');
      console.error('   3. Install if needed: https://ollama.ai/download');
    } else if (error.message.includes('No relevant context found')) {
      console.error('\n💡 Try indexing your repository first:');
      console.error('   ziri index');
    } else if (error.message.includes('Chat generation not yet implemented')) {
      console.error('\n💡 Chat is currently only supported with Ollama:');
      console.error('   1. Install Ollama: https://ollama.ai/download');
      console.error('   2. Start Ollama: ollama serve');
      console.error('   3. Pull models: ollama pull nomic-embed-text && ollama pull qwen2:1.5b');
    }
    
    if (argv.verbose) {
      console.error('Stack trace:', error.stack);
    }
    
    // Don't call process.exit in test environments
    if (typeof process !== 'undefined' && process.exit && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

/**
 * Perform the main chat operation with proper error handling
 */
async function performChatOperation(query, argv, configManager, startTime) {
  // Step 1: Get configuration
  console.log('\n🔧 Checking configuration...');
  const config = await configManager.getConfig();
  
  // Use Ollama as default provider
  const activeProvider = 'ollama';
  const providerConfig = config.providers?.[activeProvider];
  
  if (!providerConfig) {
    throw new Error('Ollama provider not configured. Run: ziri config provider ollama --base-url http://localhost:11434');
  }

  console.log('✅ Using Ollama for chat generation');

  // Step 2: Search for relevant context in vector store
  console.log('\n� Searching for relevant context...');
  
  const contextResults = await getContextFromQuery(query, argv);

  if (!contextResults || contextResults.length === 0) {
    console.log('❌ No relevant context found in vector store.');
    console.log('💡 Try indexing your repository first: ziri index');
    
    // In test environments, throw an error for proper test assertions
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      throw new Error('No relevant context found in vector store');
    }
    return;
  }

  console.log(`✅ Found ${contextResults.length} relevant context items`);

  // Step 3: Format context for Ollama
  const formattedContext = formatContextForOllama(contextResults);

  // Step 4: Generate response using Ollama
  console.log(`\n🧠 Generating response with Ollama...`);
  const response = await generateWithOllama(query, formattedContext, configManager);

  // Step 5: Format and display final result
  console.log('\n🎯 Ziri Chat Response:');
  console.log('═'.repeat(80));
  console.log(response);
  console.log('═'.repeat(80));

  console.log('\n💡 This response combines your question with relevant code context.');
  console.log('🔄 Use this with your AI agent for enhanced code understanding!');
  
  // Add performance timing at the end
  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total response time: ${totalTime} seconds`);
}



/**
 * Get context from vector store using existing query functionality
 */
async function getContextFromQuery(query, argv) {
  try {
    // Use the existing query command to get results
    const { queryCommand } = await import('./query.js');
    
    // Create a mock argv for the query command
    const queryArgv = {
      _: ['query', query], // queryCommand expects argv._[1] to be the query
      k: argv.k || '8',
      scope: argv.scope || 'repo',
      verbose: false // Don't show verbose output during chat
    };
    
    // Capture the query results by temporarily redirecting console.log
    const originalLog = console.log;
    let capturedOutput = '';
    console.log = (message) => {
      capturedOutput += message + '\n';
    };
    
    try {
      const queryResults = await queryCommand({ argv: queryArgv });
      console.log = originalLog;
      
      // If queryCommand returns results directly, use them
      if (queryResults && Array.isArray(queryResults)) {
        return queryResults;
      }
      
      // Parse the captured output to extract results
      const results = parseQueryOutput(capturedOutput);
      return results;
    } catch (error) {
      console.log = originalLog;
      console.error('Query command error:', error.message);
      return [];
    }
  } catch (error) {
    console.warn('⚠️  Could not retrieve context from vector store:', error.message);
    return [];
  }
}

/**
 * Parse query output to extract structured results from enhanced format
 */
function parseQueryOutput(output) {
  const results = [];
  const lines = output.split('\n');
  
  let currentResult = null;
  let inCodeContext = false;
  
  for (const line of lines) {
    // Look for new result format: "📄 Result N:"
    if (line.includes('📄 Result')) {
      if (currentResult) {
        results.push(currentResult);
      }
      currentResult = {
        file: '',
        score: 0,
        context: '',
        language: 'unknown',
        lines: null
      };
      inCodeContext = false;
    }
    
    // Extract score from format: "📊 Score: 0.3922 (39%)"
    if (currentResult && line.includes('📊 Score:')) {
      const scoreMatch = line.match(/📊 Score:\s*([\d.]+)/);
      if (scoreMatch) {
        currentResult.score = parseFloat(scoreMatch[1]);
      }
    }
    
    // Extract file path from format: "📁 File: path/to/file"
    if (currentResult && line.includes('📁 File:')) {
      const fileMatch = line.match(/📁 File:\s*(.+)/);
      if (fileMatch) {
        currentResult.file = fileMatch[1].trim();
      }
    }
    
    // Extract language from format: "🏷️ Language: javascript"
    if (currentResult && line.includes('🏷️  Language:')) {
      const langMatch = line.match(/🏷️\s+Language:\s*(\w+)/);
      if (langMatch) {
        currentResult.language = langMatch[1];
      }
    }
    
    // Extract line numbers from format: "📍 Lines: 1-89"
    if (currentResult && line.includes('📍 Lines:')) {
      const linesMatch = line.match(/📍 Lines:\s*([\d-]+)/);
      if (linesMatch) {
        currentResult.lines = linesMatch[1];
      }
    }
    
    // Start of code context section
    if (line.includes('📝 Code Context:')) {
      inCodeContext = true;
      continue;
    }
    
    // End of code context section
    if (line.includes('────────────────────────────────────────────────────────────')) {
      inCodeContext = false;
      continue;
    }
    
    // Collect code content from lines with format: "     1 |>code here"
    if (currentResult && inCodeContext && line.match(/^\s*\d+\s*\|>/)) {
      const codeMatch = line.match(/^\s*\d+\s*\|>(.*)$/);
      if (codeMatch) {
        currentResult.context += codeMatch[1] + '\n';
      }
    }
  }
  
  // Add the last result
  if (currentResult) {
    results.push(currentResult);
  }
  
  return results;
}



/**
 * Format context for Ollama input
 */
function formatContextForOllama(contextResults) {
  if (!contextResults || contextResults.length === 0) {
    return 'No relevant context found.';
  }

  let formattedContext = 'Relevant Code Context:\n\n';

  contextResults.forEach((result, index) => {
    formattedContext += `## ${index + 1}. ${result.file}`;
    
    if (result.lines) {
      formattedContext += ` (lines ${result.lines})`;
    }
    
    if (result.language && result.language !== 'unknown') {
      formattedContext += ` - ${result.language}`;
    }
    
    formattedContext += `\nRelevance Score: ${result.score}\n`;
    
    if (result.context) {
      formattedContext += '```' + (result.language || 'code') + '\n';
      formattedContext += result.context.trim();
      formattedContext += '\n```\n\n';
    } else if (result.compatibility === 'legacy') {
      formattedContext += `*Legacy index entry - content not available (score: ${result.score})*\n\n`;
    } else {
      formattedContext += `*No content available for this result*\n\n`;
    }
  });

  return formattedContext;
}

/**
 * Generate response using Ollama
 */
async function generateWithOllama(userQuery, context, configManager) {
  try {
    // Get Ollama configuration
    const config = await configManager.getConfig();
    const ollamaConfig = config.providers?.ollama;

    if (!ollamaConfig) {
      throw new Error('Ollama provider not configured. Run: ziri config provider ollama --base-url http://localhost:11434');
    }

    const baseUrl = ollamaConfig.baseUrl || 'http://localhost:11434';
    const model = ollamaConfig.textModel || 'qwen2:1.5b';

    // Prepare the prompt
    const systemPrompt = `You are an expert code assistant. Use the provided code context to give a comprehensive and accurate answer to the user's question. Be specific about code locations, functions, and implementation details.`;

    console.log(`🔗 Connecting to Ollama at: ${baseUrl}`);
    console.log(`🤖 Using model: ${model}`);

    // Try the chat completion endpoint
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `${context}\n\nUser Question: ${userQuery}`
          }
        ],
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for factual responses
          top_p: 0.9,
          num_predict: 1000, // Reasonable response length
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.message?.content) {
      throw new Error('No response from Ollama');
    }

    return data.message.content.trim();

  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running: ollama serve');
    }
    throw error;
  }
}

/**
 * Internal Ollama generation implementation (unused - kept for reference)
 */
/* async function generateWithOllamaInternal(userQuery, context, configManager) {
  try {
    // Get Ollama configuration with proper error handling
    const config = await configManager.getConfig();
    const ollamaConfig = config.providers?.ollama;

    if (!ollamaConfig) {
      throw new Error('Ollama provider not configured. Run: ziri config provider ollama --base-url http://localhost:11434');
    }

    const baseUrl = ollamaConfig.baseUrl || 'http://localhost:11434';
    
    // Prepare the prompt
    const systemPrompt = `You are an expert code assistant. Use the provided code context to give a comprehensive and accurate answer to the user's question. Be specific about code locations, functions, and implementation details.`;

    // Check Ollama connectivity first
    console.log(`🔗 Connecting to Ollama at: ${baseUrl}`);
    
    let availableModels = [];
    try {
      const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout for model check
      });
      
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        availableModels = tagsData.models?.map(m => m.name) || [];
        console.log(`📋 Available models: ${availableModels.join(', ')}`);
      } else {
        throw new Error(`Failed to fetch models: ${tagsResponse.status} ${tagsResponse.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        throw new Error('Cannot connect to Ollama. Make sure Ollama is running: ollama serve');
      }
      throw new Error(`Failed to connect to Ollama: ${error.message}`);
    }

    if (availableModels.length === 0) {
      throw new Error('No models available in Ollama. Please pull a model first: ollama pull llama3.2:3b');
    }

    // Filter out embedding models and select appropriate text generation model
    const textGenerationModels = availableModels.filter(modelName =>
      !modelName.includes('embed') &&
      !modelName.includes('nomic-embed') &&
      !modelName.includes('all-minilm')
    );

    if (textGenerationModels.length === 0) {
      throw new Error('No text generation models available. Please pull a model: ollama pull llama3.2:3b');
    }

    // Use configured model or first available text generation model
    const configuredModel = ollamaConfig.textModel || ollamaConfig.model;
    let finalModel = textGenerationModels[0]; // Default to first available
    
    if (configuredModel && textGenerationModels.includes(configuredModel)) {
      finalModel = configuredModel;
    } else if (configuredModel && availableModels.includes(configuredModel)) {
      finalModel = configuredModel;
    }

    console.log(`🤖 Using model: ${finalModel}`);

    // Make the API call with proper error handling
    console.log(`� Generating response...`);

    const requestBody = {
      model: finalModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Code Context:\n${context}\n\nUser Question: ${userQuery}\n\nPlease provide a detailed answer based on the code context above.`
        }
      ],
      stream: false,
      options: {
        temperature: 0.1, // Low temperature for factual responses
        top_p: 0.9,
        num_predict: 1000, // Reasonable response length
        stop: ['<|end|>', '<|endoftext|>'] // Common stop tokens
      }
    };

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(90000) // 90 second timeout for generation with rich context
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.message?.content && !data.response) {
      throw new Error('No response content from Ollama. The model may not support chat format.');
    }

    // Handle both chat format and generate format responses
    const responseContent = data.message?.content || data.response;
    
    if (!responseContent || responseContent.trim().length === 0) {
      throw new Error('Empty response from Ollama');
    }

    return responseContent.trim();

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Ollama request timed out. The model may be too slow or overloaded.');
    }
    if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running: ollama serve');
    }
    throw error;
  }
} */
