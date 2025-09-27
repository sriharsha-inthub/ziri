import { describe, it, expect } from 'vitest';
import { CodeAnalyzer } from '../../lib/metadata/code-analyzer.js';

describe('Extended Code Analyzer', () => {
  describe('Dart Analyzer', () => {
    it('should analyze Dart code correctly', () => {
      const dartCode = `
import 'dart:io';
import 'package:http/http.dart' as http;

class UserService {
  Future<User> getUser(int id) async {
    final response = await http.get(Uri.parse('https://api.example.com/users/$id'));
    return User.fromJson(response.body);
  }
}

/// User model class
class User {
  final int id;
  final String name;
  
  User({required this.id, required this.name});
  
  factory User.fromJson(String json) {
    // Parse JSON
    return User(id: 1, name: 'Test');
  }
}
`;

      const result = CodeAnalyzer.analyzeCode(dartCode, 'dart', 'user_service.dart');
      
      expect(result.type).toBe('class');
      expect(result.className).toBe('UserService');
      expect(result.imports.length).toBe(2);
      expect(result.classes.length).toBe(2);
      expect(result.functions.length).toBe(2);
      expect(result.comments.length).toBeGreaterThan(0);
    });
  });

  describe('YAML Analyzer', () => {
    it('should analyze YAML/CloudFormation code correctly', () => {
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

      const result = CodeAnalyzer.analyzeCode(yamlCode, 'yaml', 'template.yaml');
      
      expect(result.type).toBe('code');
      expect(result.comments.length).toBeGreaterThan(0);
      // YAML doesn't have functions/classes in traditional sense
      expect(result.functions.length).toBe(0);
      expect(result.classes.length).toBe(0);
    });
  });

  describe('IBM ACE Analyzer', () => {
    it('should analyze IBM ACE code correctly', () => {
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

      const result = CodeAnalyzer.analyzeCode(aceCode, 'ibm-ace', 'flow.mset');
      
      expect(result.type).toBe('code');
      expect(result.imports.length).toBe(2);
      expect(result.comments.length).toBeGreaterThan(0);
    });
  });

  describe('Mulesoft Analyzer', () => {
    it('should analyze Mulesoft code correctly', () => {
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

      const result = CodeAnalyzer.analyzeCode(muleCode, 'mulesoft', 'customer-api.xml');
      
      expect(result.type).toBe('code');
      expect(result.imports.length).toBe(2);
      expect(result.comments.length).toBeGreaterThan(0);
    });
  });
});