/**
 * Rate Limiter for Embedding Providers
 * Manages API rate limits and request throttling
 */

export class RateLimiter {
  constructor(config) {
    this.requestsPerMinute = config.requestsPerMinute || 1000;
    this.tokensPerMinute = config.tokensPerMinute || 1000000;
    this.concurrentRequests = config.concurrentRequests || 5;
    
    // Request tracking
    this.requestTimes = [];
    this.tokenCounts = [];
    this.activeRequests = 0;
    
    // Queues
    this.requestQueue = [];
    this.processing = false;
  }

  /**
   * Execute a request with rate limiting
   * @param {Function} requestFn - Function that makes the API request
   * @param {number} estimatedTokens - Estimated token count for the request
   * @returns {Promise} Request result
   */
  async execute(requestFn, estimatedTokens = 0) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFn,
        estimatedTokens,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this._processQueue();
    });
  }

  /**
   * Process the request queue
   * @private
   */
  async _processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      // Check if we can make another request
      if (!this._canMakeRequest()) {
        const delay = this._getDelayUntilNextRequest();
        if (delay > 0) {
          await this._sleep(delay);
          continue;
        }
      }

      // Check concurrent request limit
      if (this.activeRequests >= this.concurrentRequests) {
        await this._sleep(100); // Short delay before checking again
        continue;
      }

      const request = this.requestQueue.shift();
      this._executeRequest(request);
    }

    this.processing = false;
  }

  /**
   * Execute a single request
   * @param {Object} request - Request object
   * @private
   */
  async _executeRequest(request) {
    const { requestFn, estimatedTokens, resolve, reject } = request;
    
    this.activeRequests++;
    const startTime = Date.now();
    
    try {
      // Record the request
      this._recordRequest(estimatedTokens);
      
      // Execute the request
      const result = await requestFn();
      
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      
      // Continue processing queue if there are more requests
      if (this.requestQueue.length > 0) {
        setImmediate(() => this._processQueue());
      }
    }
  }

  /**
   * Check if we can make a request based on rate limits
   * @returns {boolean} Whether a request can be made
   * @private
   */
  _canMakeRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    this.tokenCounts = this.tokenCounts.filter(entry => entry.timestamp > oneMinuteAgo);
    
    // Check request rate limit
    if (this.requestTimes.length >= this.requestsPerMinute) {
      return false;
    }
    
    // Check token rate limit
    const totalTokens = this.tokenCounts.reduce((sum, entry) => sum + entry.tokens, 0);
    if (totalTokens >= this.tokensPerMinute) {
      return false;
    }
    
    return true;
  }

  /**
   * Get delay until next request can be made
   * @returns {number} Delay in milliseconds
   * @private
   */
  _getDelayUntilNextRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Find the oldest request that would need to expire
    let oldestRequest = null;
    let oldestToken = null;
    
    if (this.requestTimes.length >= this.requestsPerMinute) {
      oldestRequest = Math.min(...this.requestTimes);
    }
    
    const totalTokens = this.tokenCounts.reduce((sum, entry) => sum + entry.tokens, 0);
    if (totalTokens >= this.tokensPerMinute && this.tokenCounts.length > 0) {
      oldestToken = Math.min(...this.tokenCounts.map(entry => entry.timestamp));
    }
    
    const delays = [];
    if (oldestRequest) {
      delays.push(oldestRequest + 60000 - now);
    }
    if (oldestToken) {
      delays.push(oldestToken + 60000 - now);
    }
    
    return delays.length > 0 ? Math.max(0, Math.min(...delays)) : 0;
  }

  /**
   * Record a request for rate limiting
   * @param {number} tokens - Token count for the request
   * @private
   */
  _recordRequest(tokens) {
    const now = Date.now();
    this.requestTimes.push(now);
    
    if (tokens > 0) {
      this.tokenCounts.push({
        timestamp: now,
        tokens: tokens
      });
    }
  }

  /**
   * Get current rate limit status
   * @returns {Object} Rate limit status
   */
  getStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    const recentRequests = this.requestTimes.filter(time => time > oneMinuteAgo);
    const recentTokens = this.tokenCounts.filter(entry => entry.timestamp > oneMinuteAgo);
    const totalTokens = recentTokens.reduce((sum, entry) => sum + entry.tokens, 0);
    
    return {
      requestsInLastMinute: recentRequests.length,
      requestsPerMinuteLimit: this.requestsPerMinute,
      tokensInLastMinute: totalTokens,
      tokensPerMinuteLimit: this.tokensPerMinute,
      activeRequests: this.activeRequests,
      concurrentRequestsLimit: this.concurrentRequests,
      queueLength: this.requestQueue.length,
      canMakeRequest: this._canMakeRequest()
    };
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all rate limiting state
   */
  reset() {
    this.requestTimes = [];
    this.tokenCounts = [];
    this.activeRequests = 0;
    this.requestQueue = [];
    this.processing = false;
  }
}