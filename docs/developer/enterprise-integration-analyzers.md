# Enterprise Integration AST Analyzers

## Overview

Ziri's AST analyzer has been extended to support enterprise integration technologies including IBM App Connect Enterprise (ACE) and Mulesoft. These analyzers provide AST awareness for enterprise integration code, enabling semantic search and analysis for integration flows, transformations, and configurations.

## IBM ACE Analyzers

### MsgflowASTAnalyzer

The MsgflowASTAnalyzer provides AST parsing and analysis for IBM ACE message flow XML files (`.msgflow`).

#### Features

- **Node Extraction**: Identifies message flow nodes (ComputeNode, FilterNode, MQInputNode, etc.)
- **Flow Structure Analysis**: Maps connections between nodes
- **ESQL References**: Detects references to ESQL modules in ComputeNodes
- **Configuration Extraction**: Extracts node properties and configurations

#### Usage

```javascript
import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

// Analyze a msgflow file
const result = await ASTCodeAnalyzer.analyzeCode(msgflowContent, 'msgflow', 'example.msgflow');

// Access analysis results
console.log(`Found ${result.functions.length} nodes`);
console.log(`Found ${result.classes.length} flows`);
console.log(`Found ${result.relationships.length} connections`);
```

### ESQLASTAnalyzer

The ESQLASTAnalyzer provides AST parsing and analysis for IBM ACE's Extended SQL (ESQL) files (`.esql`).

#### Features

- **Module Extraction**: Identifies ESQL modules and their structure
- **Procedure/Function Analysis**: Extracts procedures, functions, and their signatures
- **Variable Declarations**: Identifies declared variables and their types
- **BROKER SCHEMA Detection**: Maps module hierarchies and dependencies

#### Usage

```javascript
import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

// Analyze an ESQL file
const result = await ASTCodeAnalyzer.analyzeCode(esqlContent, 'esql', 'module.esql');

// Access analysis results
console.log(`Found ${result.functions.length} procedures and functions`);
console.log(`Found ${result.classes.length} modules`);
```

## Mulesoft Analyzers

### MulesoftASTAnalyzer

The MulesoftASTAnalyzer provides AST parsing and analysis for Mulesoft XML configuration files.

#### Features

- **Flow Extraction**: Identifies Mule flows and subflows
- **Component Analysis**: Maps processors, transformers, and connectors
- **Configuration References**: Detects configuration dependencies
- **DataWeave References**: Identifies DataWeave transformations within flows

#### Usage

```javascript
import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

// Analyze a Mulesoft XML file
const result = await ASTCodeAnalyzer.analyzeCode(muleXmlContent, 'mulesoft', 'mule-config.xml');

// Access analysis results
console.log(`Found ${result.functions.length} processors`);
console.log(`Found ${result.classes.length} flows`);
```

### DWLASTAnalyzer

The DWLASTAnalyzer provides AST parsing and analysis for Mulesoft's DataWeave language files (`.dwl`).

#### Features

- **Function Extraction**: Identifies DataWeave functions and their signatures
- **Type Definitions**: Maps custom type definitions
- **Variable Declarations**: Extracts variable declarations with type information
- **Import Statements**: Tracks module dependencies

#### Usage

```javascript
import { ASTCodeAnalyzer } from './lib/metadata/ast-code-analyzer.js';

// Analyze a DataWeave file
const result = await ASTCodeAnalyzer.analyzeCode(dwlContent, 'dwl', 'transform.dwl');

// Access analysis results
console.log(`Found ${result.functions.length} functions`);
console.log(`Found ${result.imports.length} imports`);
```

## Implementation Details

### XML-based Analysis

The XML-based analyzers (MsgflowASTAnalyzer and MulesoftASTAnalyzer) share a common base class `XmlASTAnalyzer` that provides:

- XML parsing with position tracking
- Node traversal utilities
- Attribute access helpers
- Comment extraction

### Custom Language Parsers

For the domain-specific languages (ESQL and DataWeave), custom parsers were implemented since no standard libraries exist:

- **ESQLASTAnalyzer**: Uses regex-based parsing with context awareness for ESQL's SQL-like syntax
- **DWLASTAnalyzer**: Implements a specialized parser for DataWeave's functional language constructs

## Extension Points

To add support for additional enterprise integration technologies:

1. Create a new analyzer class extending `BaseASTAnalyzer` or an appropriate subclass
2. Implement the required methods for extraction (imports, functions, classes, etc.)
3. Register the language in `ASTCodeAnalyzer.getASTAnalyzer()`
4. Update the technology detector to recognize the new file types

## Limitations

- ESQL and DWL parsing is based on regex patterns, not a full grammar parser
- Complex expressions in DataWeave may not be fully analyzed
- XML position tracking depends on the quality of the XML parser library
- Advanced features like variable scoping are simplified compared to JavaScript analysis

## Future Improvements

- Replace regex-based parsers with formal grammar parsers
- Add support for IBM Integration Bus (IIB) broker archive files
- Improve cross-reference resolution between different file types
- Add support for MuleSoft APIkit and API specification files
