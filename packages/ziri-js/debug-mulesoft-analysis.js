import { CodeAnalyzer } from './lib/metadata/code-analyzer.js';

function debugMulesoftAnalysis() {
  const muleCode = `
import "common.xml";
import "customer.xml";

<mule xmlns:http="http://www.mulesoft.org/schema/mule/http">
  <flow name="customer-api">
    <http:listener config-ref="HTTP_Listener_config" path="/customers"/>
    <logger level="INFO" message="Processing customer request"/>
  </flow>
</mule>
`;

  console.log('Analyzing Mulesoft code...');
  const result = CodeAnalyzer.analyzeCode(muleCode, 'mulesoft', 'customer-api.xml');
  console.log('Result:', JSON.stringify(result, null, 2));
}

debugMulesoftAnalysis();