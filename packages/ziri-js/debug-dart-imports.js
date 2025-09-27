import { CodeAnalyzer } from './lib/metadata/code-analyzer.js';

function debugDartImports() {
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
  
  console.log('Analyzing Dart code...');
  const result = CodeAnalyzer.analyzeCode(dartCode, 'dart', 'user_service.dart');
  console.log('Result:', JSON.stringify(result, null, 2));
  
  console.log('\nImports found:', JSON.stringify(result.imports, null, 2));
}

debugDartImports();