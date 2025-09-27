function debugDartMethodRegex2() {
  const methodCode = 'Future<User> getUser(int id) async {';
  
  console.log('Testing Dart method regex on single line...');
  
  // Method regex
  const methodRegex = /([\w<>]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:async\s*)?\{/g;
  let match;
  console.log('\nMethod regex:');
  while ((match = methodRegex.exec(methodCode)) !== null) {
    console.log('Match:', match);
  }
  
  // Let's also test the full content but focus on just the method line
  const fullCode = `
class UserService {
  Future<User> getUser(int id) async {
    final response = await http.get(Uri.parse('https://api.example.com/users/$id'));
    return User.fromJson(response.body);
  }
}`;
  
  console.log('\nTesting on full code:');
  while ((match = methodRegex.exec(fullCode)) !== null) {
    console.log('Match:', match);
  }
}

debugDartMethodRegex2();