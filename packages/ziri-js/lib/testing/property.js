/**
 * Property-Based Testing Framework for Ziri
 * Inspired by QuickCheck and jsverify
 */

/**
 * Property class for defining and running property-based tests
 */
export class Property {
  /**
   * @param {string} name - Name of the property
   * @param {Function} predicate - Predicate function to test
   * @param {Object} options - Configuration options
   */
  constructor(name, predicate, options = {}) {
    this.name = name;
    this.predicate = predicate;
    this.options = {
      numTests: options.numTests || 100,
      maxSize: options.maxSize || 100,
      seed: options.seed || Date.now(),
      verbose: options.verbose || false,
      ...options
    };
    this.failures = [];
  }

  /**
   * Run the property with generated test cases
   * @returns {Object} Test results
   */
  async run() {
    const results = {
      name: this.name,
      passed: 0,
      failed: 0,
      total: this.options.numTests,
      failures: [],
      seed: this.options.seed
    };

    // Initialize random number generator with seed
    const rng = new Random(this.options.seed);

    for (let i = 0; i < this.options.numTests; i++) {
      try {
        // Generate test case
        const testCase = this.generateTestCase(rng, i);
        
        if (this.options.verbose) {
          console.log(`Test ${i + 1}:`, testCase);
        }

        // Run predicate
        const result = await this.predicate(...testCase);
        
        if (result) {
          results.passed++;
        } else {
          results.failed++;
          const failure = {
            testNumber: i + 1,
            input: testCase,
            shrunk: await this.shrink(testCase)
          };
          results.failures.push(failure);
          
          if (this.options.verbose) {
            console.log(`Failed test ${i + 1}:`, testCase);
          }
        }
      } catch (error) {
        results.failed++;
        const failure = {
          testNumber: i + 1,
          error: error.message,
          input: 'Unknown'
        };
        results.failures.push(failure);
        
        if (this.options.verbose) {
          console.log(`Error in test ${i + 1}:`, error.message);
        }
      }
    }

    return results;
  }

  /**
   * Generate a test case
   * @param {Random} rng - Random number generator
   * @param {number} size - Size parameter for generation
   * @returns {Array} Generated test case
   */
  generateTestCase(rng, size) {
    // This is a placeholder - actual implementation would depend on
    // the specific generators used for this property
    return [];
  }

  /**
   * Shrink a failing test case to minimal example
   * @param {Array} testCase - Failing test case
   * @returns {Array} Shrunk test case
   */
  async shrink(testCase) {
    // This is a placeholder - actual implementation would depend on
    // the specific shrinkers used for this property
    return testCase;
  }
}

/**
 * Random number generator with seed support
 */
export class Random {
  /**
   * @param {number} seed - Seed for random number generation
   */
  constructor(seed) {
    this.seed = seed;
  }

  /**
   * Generate random integer in range [min, max]
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Random integer
   */
  int(min = 0, max = 1000) {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return Math.floor((this.seed / Math.pow(2, 32)) * (max - min + 1)) + min;
  }

  /**
   * Generate random float in range [min, max]
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Random float
   */
  float(min = 0, max = 1) {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return (this.seed / Math.pow(2, 32)) * (max - min) + min;
  }

  /**
   * Generate random boolean
   * @returns {boolean} Random boolean
   */
  boolean() {
    return this.int(0, 1) === 1;
  }

  /**
   * Choose random element from array
   * @param {Array} array - Array to choose from
   * @returns {*} Random element
   */
  choice(array) {
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Generate random string
   * @param {Object} options - String generation options
   * @returns {string} Random string
   */
  string(options = {}) {
    const length = this.int(options.minLength || 0, options.maxLength || 10);
    const chars = options.charset || 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.int(0, chars.length - 1)];
    }
    return result;
  }
}

/**
 * Generator functions for property-based testing
 */
export const gen = {
  /**
   * Integer generator
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Function} Generator function
   */
  int: (min = 0, max = 1000) => (rng) => rng.int(min, max),

  /**
   * Float generator
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Function} Generator function
   */
  float: (min = 0, max = 1) => (rng) => rng.float(min, max),

  /**
   * Boolean generator
   * @returns {Function} Generator function
   */
  boolean: () => (rng) => rng.boolean(),

  /**
   * String generator
   * @param {Object} options - String options
   * @returns {Function} Generator function
   */
  string: (options = {}) => (rng) => rng.string(options),

  /**
   * Array generator
   * @param {Function} elementGen - Generator for array elements
   * @param {Object} options - Array options
   * @returns {Function} Generator function
   */
  array: (elementGen, options = {}) => (rng) => {
    const length = rng.int(options.minLength || 0, options.maxLength || 10);
    const result = [];
    for (let i = 0; i < length; i++) {
      result.push(elementGen(rng));
    }
    return result;
  },

  /**
   * Object generator
   * @param {Object} schema - Schema defining property generators
   * @returns {Function} Generator function
   */
  object: (schema) => (rng) => {
    const result = {};
    for (const [key, generator] of Object.entries(schema)) {
      result[key] = generator(rng);
    }
    return result;
  },

  /**
   * One of generator (choose from array)
   * @param {Array} choices - Array of choices
   * @returns {Function} Generator function
   */
  oneOf: (choices) => (rng) => rng.choice(choices),

  /**
   * Constant generator
   * @param {*} value - Constant value
   * @returns {Function} Generator function
   */
  constant: (value) => () => value,

  /**
   * Dictionary generator
   * @param {Function} keyGen - Generator for keys
   * @param {Function} valueGen - Generator for values
   * @param {Object} options - Dictionary options
   * @returns {Function} Generator function
   */
  dictionary: (keyGen, valueGen, options = {}) => (rng) => {
    const length = rng.int(options.minLength || 0, options.maxLength || 10);
    const result = {};
    for (let i = 0; i < length; i++) {
      const key = keyGen(rng);
      const value = valueGen(rng);
      result[key] = value;
    }
    return result;
  }
};

/**
 * Property testing functions
 */

/**
 * Define and run a property
 * @param {string} name - Property name
 * @param {Function} generators - Generator functions for test inputs
 * @param {Function} predicate - Predicate function to test
 * @param {Object} options - Configuration options
 * @returns {Property} Property instance
 */
export function property(name, generators, predicate, options = {}) {
  const prop = new Property(name, predicate, options);
  
  // Override generateTestCase to use provided generators
  prop.generateTestCase = function(rng, size) {
    if (Array.isArray(generators)) {
      return generators.map(gen => gen(rng));
    } else if (typeof generators === 'function') {
      return [generators(rng)];
    } else {
      return [];
    }
  };
  
  return prop;
}

/**
 * Run property and report results
 * @param {Property} prop - Property to run
 * @returns {Promise<Object>} Test results
 */
export async function check(prop) {
  const results = await prop.run();
  
  console.log(`\nProperty: ${results.name}`);
  console.log(`Passed: ${results.passed}/${results.total}`);
  console.log(`Failed: ${results.failed}/${results.total}`);
  console.log(`Seed: ${results.seed}`);
  
  if (results.failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of results.failures.slice(0, 3)) {
      console.log(`  Test ${failure.testNumber}:`, failure.input);
      if (failure.shrunk && failure.shrunk !== failure.input) {
        console.log(`    Shrunk:`, failure.shrunk);
      }
    }
    if (results.failures.length > 3) {
      console.log(`  ... and ${results.failures.length - 3} more failures`);
    }
  }
  
  return results;
}

/**
 * For all quantifier for property testing
 * @param {string} name - Property name
 * @param {Array|Function} generators - Generator functions
 * @param {Function} predicate - Predicate function
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Test results
 */
export async function forall(name, generators, predicate, options = {}) {
  const prop = property(name, generators, predicate, options);
  return await check(prop);
}