function debugDartMethodRegex() {
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
  
  console.log('Testing Dart method regex...');
  
  // Method regex
  const methodRegex = /(\w+)\s+(\w+)\s*\(([^)]*)\)\s*(?:async\s*)?\{/g;
  let match;
  console.log('\nMethod regex:');
  while ((match = methodRegex.exec(dartCode)) !== null) {
    console.log('Match:', match);
  }
  
  // Factory regex
  const factoryRegex = /factory\s+(\w+)\.(\w+)\s*\(([^)]*)\)\s*\{/g;
  console.log('\nFactory regex:');
  while ((match = factoryRegex.exec(dartCode)) !== null) {
    console.log('Match:', match);
  }
}

debugDartMethodRegex();