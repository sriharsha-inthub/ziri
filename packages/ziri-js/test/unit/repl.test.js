import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZiriRepl } from '../../lib/repl.js';

describe('Ziri REPL', () => {
  let repl;
  let mockConfigManager;
  
  beforeEach(() => {
    mockConfigManager = {
      getConfig: vi.fn().mockResolvedValue({})
    };
    repl = new ZiriRepl(mockConfigManager);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize with correct default values', () => {
    expect(repl.configManager).toBe(mockConfigManager);
    expect(repl.history).toEqual([]);
    expect(repl.mode).toBe('query');
  });
  
  it('should handle built-in commands', async () => {
    // Test help command
    console.log = vi.fn();
    await repl.handleCommand('help');
    expect(console.log).toHaveBeenCalled();
    
    // Test mode command
    await repl.handleCommand('mode chat');
    expect(repl.mode).toBe('chat');
    
    // Test mode command with invalid mode
    await repl.handleCommand('mode invalid');
    expect(repl.mode).toBe('chat'); // Should remain unchanged
  });
  
  it('should manage command history', () => {
    // Add some commands to history
    repl.history = ['command1', 'command2', 'command3'];
    
    // History should be limited to 100 items
    for (let i = 0; i < 100; i++) {
      repl.history.push(`command${i}`);
    }
    
    expect(repl.history.length).toBe(100);
  });
});