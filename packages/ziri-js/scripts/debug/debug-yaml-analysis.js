import { CodeAnalyzer } from './lib/metadata/code-analyzer.js';

function debugYamlAnalysis() {
  const yamlCode = `
# CloudFormation template
AWSTemplateFormatVersion: '2010-09-09'
Description: Simple S3 bucket template

Parameters:
  BucketName:
    Type: String
    Description: Name of the S3 bucket

Resources:
  MyS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref BucketName
      Tags:
        - Key: Name
          Value: MyBucket

Outputs:
  BucketURL:
    Description: URL of the created bucket
    Value: !GetAtt MyS3Bucket.WebsiteURL
`;

  console.log('Analyzing YAML code...');
  const result = CodeAnalyzer.analyzeCode(yamlCode, 'yaml', 'template.yaml');
  console.log('Result:', JSON.stringify(result, null, 2));
}

debugYamlAnalysis();