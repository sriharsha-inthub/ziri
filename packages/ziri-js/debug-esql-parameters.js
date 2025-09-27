import { ESQLASTAnalyzer } from './lib/metadata/esql-ast-analyzer.js';

function debugESQLParameters() {
  const analyzer = new ESQLASTAnalyzer();
  
  const content = `
      CREATE PROCEDURE SimpleProcedure()
      BEGIN
        DECLARE temp INT 1;
        SET temp = temp + 1;
      END;
      
      CREATE PROCEDURE ProcedureWithParams(IN inputParam CHAR, OUT outputParam INT)
      BEGIN
        SET outputParam = LENGTH(inputParam);
      END PROCEDURE;
      `;
  
  console.log('Parsing procedures...');
  const procedures = analyzer.parseProcedures(content);
  console.log('Procedures found:', JSON.stringify(procedures, null, 2));
  
  // Let's also test the parseParameters method directly
  const paramsStr = "IN inputParam CHAR, OUT outputParam INT";
  console.log('\nParsing parameters string:', paramsStr);
  const params = analyzer.parseParameters(paramsStr);
  console.log('Parsed parameters:', JSON.stringify(params, null, 2));
}

debugESQLParameters();