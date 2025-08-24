# Ziri Security Considerations

This document outlines security best practices, potential risks, and mitigation strategies when using Ziri in various environments.

## Overview

Ziri processes source code and generates embeddings that may contain sensitive information. This document helps you understand and mitigate security risks while using Ziri effectively.

## Data Security

### Code Content Exposure

**Risk**: Source code is sent to embedding providers (OpenAI, Hugging Face, etc.) for processing.

**Mitigation Strategies**:

1. **Use Local Providers**
   ```bash
   # Use Ollama for completely local processing
   ziri config provider ollama
   ziri index  # No data leaves your environment
   ```

2. **Content Filtering**
   ```bash
   # Exclude sensitive files and patterns
   ziri config set exclusions.patterns "secrets,keys,passwords,config,env"
   ziri config set exclusions.extensions ".key,.pem,.p12,.env"
   ```

3. **Pre-processing Sanitization**
   ```javascript
   // Custom sanitization before indexing
   const sanitizeContent = (content) => {
     return content
       .replace(/password\s*=\s*["'][^"']+["']/gi, 'password="[REDACTED]"')
       .replace(/api[_-]?key\s*=\s*["'][^"']+["']/gi, 'api_key="[REDACTED]"')
       .replace(/secret\s*=\s*["'][^"']+["']/gi, 'secret="[REDACTED]"')
   }
   ```

### API Key Security

**Risk**: Embedding provider API keys could be exposed or misused.

**Best Practices**:

1. **Environment Variables**
   ```bash
   # Never hardcode API keys
   export OPENAI_API_KEY="sk-your-key"
   export HUGGINGFACE_API_KEY="hf_your-key"
   
   # Use in CI/CD
   # GitHub Actions: Use secrets
   # GitLab CI: Use variables with protection
   # Jenkins: Use credentials plugin
   ```

2. **Key Rotation**
   ```bash
   # Regularly rotate API keys
   # Set up monitoring for key usage
   # Use separate keys for different environments
   ```

3. **Least Privilege**
   ```bash
   # Use API keys with minimal required permissions
   # Monitor API usage and set alerts
   # Implement rate limiting
   ```

### Storage Security

**Risk**: Vector embeddings and metadata stored locally could contain sensitive information.

**Mitigation**:

1. **Encryption at Rest**
   ```bash
   # Enable storage encryption
   ziri config set storage.encryption true
   ziri config set storage.encryptionKey "$(openssl rand -base64 32)"
   ```

2. **Access Controls**
   ```bash
   # Restrict file system permissions
   chmod 700 ~/.ziri
   chown -R $(whoami):$(whoami) ~/.ziri
   
   # Use dedicated service accounts in production
   ```

3. **Secure Deletion**
   ```bash
   # Securely delete sensitive indexes
   ziri delete-repository /path/to/sensitive/repo --secure-delete
   
   # Or manually
   shred -vfz -n 3 ~/.ziri/repositories/*/vectors.db
   ```

## Network Security

### API Communication

**Risk**: Data transmitted to embedding providers could be intercepted.

**Protection**:

1. **TLS/HTTPS Verification**
   ```bash
   # Ensure TLS certificate validation
   ziri config set network.verifyTLS true
   ziri config set network.minTLSVersion "1.2"
   ```

2. **Proxy Configuration**
   ```bash
   # Use corporate proxy if required
   export HTTPS_PROXY="https://proxy.company.com:8080"
   export HTTP_PROXY="http://proxy.company.com:8080"
   
   # Configure proxy authentication
   ziri config set network.proxy.url "https://proxy.company.com:8080"
   ziri config set network.proxy.auth "username:password"
   ```

3. **Network Monitoring**
   ```bash
   # Monitor network traffic
   # Log API requests (without sensitive data)
   ziri config set logging.logRequests true
   ziri config set logging.redactSensitive true
   ```

### Firewall Configuration

```bash
# Allow outbound HTTPS to embedding providers
# OpenAI: api.openai.com (443)
# Hugging Face: api-inference.huggingface.co (443)
# Cohere: api.cohere.ai (443)

# Block unnecessary outbound connections
# Monitor for unexpected network activity
```

## Access Control

### User Authentication

**For Multi-User Environments**:

1. **User Isolation**
   ```bash
   # Separate data directories per user
   export ZIRI_HOME="/home/$USER/.ziri"
   
   # Use user-specific configuration
   ziri config set storage.userIsolation true
   ```

2. **Role-Based Access**
   ```bash
   # Define user roles and permissions
   ziri config set access.roles.developer "read,write,index"
   ziri config set access.roles.viewer "read"
   ziri config set access.roles.admin "read,write,index,configure"
   ```

### Repository Access

1. **Repository-Level Permissions**
   ```bash
   # Control which repositories users can access
   ziri config set access.repositories.allowed "/path/to/allowed/repos/*"
   ziri config set access.repositories.denied "/path/to/sensitive/repos/*"
   ```

2. **Audit Logging**
   ```bash
   # Enable comprehensive audit logging
   ziri config set logging.audit true
   ziri config set logging.auditFile "/var/log/ziri/audit.log"
   ```

## Container Security

### Docker Security

1. **Non-Root User**
   ```dockerfile
   # Run as non-root user
   FROM node:18-alpine
   RUN addgroup -g 1001 -S ziri && \
       adduser -S ziri -u 1001
   USER ziri
   ```

2. **Minimal Image**
   ```dockerfile
   # Use minimal base images
   FROM node:18-alpine
   # Remove unnecessary packages
   RUN apk del --purge wget curl
   ```

3. **Secret Management**
   ```yaml
   # docker-compose.yml
   services:
     ziri:
       image: ziri:latest
       environment:
         - OPENAI_API_KEY_FILE=/run/secrets/openai_key
       secrets:
         - openai_key
   
   secrets:
     openai_key:
       external: true
   ```

### Kubernetes Security

1. **Security Context**
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ziri
   spec:
     template:
       spec:
         securityContext:
           runAsNonRoot: true
           runAsUser: 1001
           fsGroup: 1001
         containers:
         - name: ziri
           securityContext:
             allowPrivilegeEscalation: false
             readOnlyRootFilesystem: true
             capabilities:
               drop:
               - ALL
   ```

2. **Network Policies**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: ziri-network-policy
   spec:
     podSelector:
       matchLabels:
         app: ziri
     policyTypes:
     - Egress
     egress:
     - to: []
       ports:
       - protocol: TCP
         port: 443  # HTTPS only
   ```

## Compliance Considerations

### GDPR Compliance

1. **Data Minimization**
   ```bash
   # Only index necessary files
   ziri config set exclusions.patterns "personal,private,gdpr,pii"
   
   # Implement data retention policies
   ziri config set storage.retentionDays 90
   ```

2. **Right to Erasure**
   ```bash
   # Implement secure deletion
   ziri delete-repository /path/to/repo --secure-delete
   
   # Verify deletion
   ziri verify-deletion /path/to/repo
   ```

### SOC 2 Compliance

1. **Access Logging**
   ```bash
   # Comprehensive access logging
   ziri config set logging.access true
   ziri config set logging.accessFile "/var/log/ziri/access.log"
   ziri config set logging.retention 2555  # 7 years
   ```

2. **Change Management**
   ```bash
   # Track configuration changes
   ziri config set audit.configChanges true
   ziri config set audit.approvalRequired true
   ```

### HIPAA Compliance

1. **Encryption Requirements**
   ```bash
   # Enable encryption for all data
   ziri config set storage.encryption true
   ziri config set storage.encryptionAlgorithm "AES-256-GCM"
   ziri config set network.forceHTTPS true
   ```

2. **Access Controls**
   ```bash
   # Implement strict access controls
   ziri config set access.requireAuthentication true
   ziri config set access.sessionTimeout 900  # 15 minutes
   ziri config set access.maxFailedAttempts 3
   ```

## Incident Response

### Security Monitoring

1. **Anomaly Detection**
   ```bash
   # Monitor for unusual patterns
   ziri config set monitoring.anomalyDetection true
   ziri config set monitoring.alertThresholds.apiCalls 1000
   ziri config set monitoring.alertThresholds.dataVolume 1048576  # 1MB
   ```

2. **Log Analysis**
   ```bash
   # Analyze logs for security events
   grep "SECURITY" /var/log/ziri/audit.log
   grep "FAILED_AUTH" /var/log/ziri/access.log
   grep "API_ERROR" /var/log/ziri/ziri.log
   ```

### Incident Response Plan

1. **Immediate Response**
   ```bash
   # Disable API access
   ziri config set providers.openai.enabled false
   ziri config set providers.huggingface.enabled false
   
   # Stop all indexing operations
   ziri stop-all-operations
   
   # Secure logs
   cp -r /var/log/ziri /secure/backup/location/
   ```

2. **Investigation**
   ```bash
   # Generate security report
   ziri security-report --start-date "2024-01-01" --end-date "2024-01-31"
   
   # Check for data exfiltration
   ziri audit-data-access --suspicious-patterns
   
   # Verify data integrity
   ziri verify-integrity --all-repositories
   ```

## Security Hardening

### System Hardening

1. **File System Permissions**
   ```bash
   # Secure Ziri directories
   chmod 700 ~/.ziri
   chmod 600 ~/.ziri/config.json
   chmod 600 ~/.ziri/logs/*.log
   
   # Set up file integrity monitoring
   aide --init
   aide --check
   ```

2. **Process Isolation**
   ```bash
   # Run Ziri in isolated environment
   # Use containers or VMs for isolation
   # Implement resource limits
   
   systemd-run --scope --slice=ziri.slice \
     --property=MemoryMax=1G \
     --property=CPUQuota=50% \
     ziri index
   ```

### Network Hardening

1. **TLS Configuration**
   ```bash
   # Force strong TLS settings
   ziri config set network.tlsMinVersion "1.3"
   ziri config set network.cipherSuites "ECDHE-RSA-AES256-GCM-SHA384,ECDHE-RSA-AES128-GCM-SHA256"
   ziri config set network.verifyHostname true
   ```

2. **Certificate Pinning**
   ```bash
   # Pin certificates for critical services
   ziri config set network.certificatePinning.openai "sha256:ABCD1234..."
   ziri config set network.certificatePinning.huggingface "sha256:EFGH5678..."
   ```

## Vulnerability Management

### Regular Security Updates

1. **Update Schedule**
   ```bash
   # Check for updates regularly
   ziri check-updates
   
   # Enable automatic security updates
   ziri config set updates.autoSecurityUpdates true
   ziri config set updates.checkInterval 86400  # Daily
   ```

2. **Dependency Scanning**
   ```bash
   # Scan for vulnerable dependencies
   npm audit
   pip-audit  # For Python version
   
   # Use in CI/CD
   npm audit --audit-level high
   ```

### Security Testing

1. **Penetration Testing**
   ```bash
   # Regular security assessments
   # Test API endpoints
   # Verify access controls
   # Check for injection vulnerabilities
   ```

2. **Code Security Analysis**
   ```bash
   # Static analysis
   semgrep --config=security .
   bandit -r packages/ziri-py/  # Python
   
   # Dynamic analysis
   # Monitor runtime behavior
   # Test with malicious inputs
   ```

## Security Checklist

### Pre-Deployment

- [ ] API keys stored securely (environment variables/secrets management)
- [ ] Local provider configured for sensitive code
- [ ] Exclusion patterns configured for sensitive files
- [ ] Storage encryption enabled
- [ ] Access controls implemented
- [ ] Audit logging enabled
- [ ] Network security configured
- [ ] Container security hardened (if applicable)

### Post-Deployment

- [ ] Monitor API usage and costs
- [ ] Review audit logs regularly
- [ ] Update dependencies regularly
- [ ] Rotate API keys periodically
- [ ] Test incident response procedures
- [ ] Conduct security assessments
- [ ] Train users on security practices

### Ongoing Maintenance

- [ ] Monitor for security advisories
- [ ] Update security configurations
- [ ] Review and update access controls
- [ ] Backup and test recovery procedures
- [ ] Document security incidents
- [ ] Update security policies

## Reporting Security Issues

If you discover a security vulnerability in Ziri:

1. **Do not** create a public GitHub issue
2. Email security@ziri.ai with details
3. Include steps to reproduce the issue
4. Provide your contact information
5. Allow reasonable time for response

We follow responsible disclosure practices and will work with you to address security issues promptly.

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [SANS Security Policies](https://www.sans.org/information-security-policy/)

Remember: Security is a shared responsibility. While Ziri implements security best practices, users must also follow secure deployment and operational practices.