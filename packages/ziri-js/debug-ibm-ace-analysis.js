import { CodeAnalyzer } from './lib/metadata/code-analyzer.js';

function debugIbmAceAnalysis() {
  const aceCode = `
import "common.xsd";
import "customer.xsd";

namespace com.example.ace;

flow MyFlow {
  InputPort: In;
  OutputPort: Out;
  
  // Transform customer data
  Compute: TransformCustomer {
    setOutputRoot();
    OutputRoot.XMLNSC.Customer = InputRoot.XMLNSC.Customer;
  }
}
`;

  console.log('Analyzing IBM ACE code...');
  const result = CodeAnalyzer.analyzeCode(aceCode, 'ibm-ace', 'flow.mset');
  console.log('Result:', JSON.stringify(result, null, 2));
}

debugIbmAceAnalysis();