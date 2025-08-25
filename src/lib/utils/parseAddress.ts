// Email address parsing utility for Gmail headers
export interface EmailAddress {
  name: string;
  email: string;
}

/**
 * Parse a Gmail header value containing email addresses
 * Handles formats: "Name <email@domain>", "email@domain", "Name" <email@domain>
 */
export function parseAddressList(headerValue: string): EmailAddress[] {
  if (!headerValue || typeof headerValue !== 'string') {
    return [];
  }

  // Split by comma and process each address
  const addresses = headerValue.split(',').map(addr => addr.trim()).filter(Boolean);
  
  return addresses.map(address => {
    // Try to extract name and email from various formats
    
    // Format: "Name" <email@domain>
    const quotedMatch = address.match(/^"([^"]+)"\s*<(.+?)>$/);
    if (quotedMatch) {
      const [, name, email] = quotedMatch;
      if (isValidEmail(email)) {
        return { name: name.trim(), email: email.trim() };
      }
    }
    
    // Format: Name <email@domain>
    const bracketMatch = address.match(/^([^<]+?)\s*<(.+?)>$/);
    if (bracketMatch) {
      const [, name, email] = bracketMatch;
      if (isValidEmail(email)) {
        return { name: name.trim(), email: email.trim() };
      }
    }
    
    // Format: email@domain (no name)
    if (isValidEmail(address)) {
      const localPart = address.split('@')[0];
      return { 
        name: localPart.charAt(0).toUpperCase() + localPart.slice(1), 
        email: address.trim() 
      };
    }
    
    // Fallback: return as-is if parsing fails
    console.warn('Failed to parse email address:', address);
    return { name: 'Unknown', email: address.trim() };
  });
}

/**
 * Parse a single email address
 */
export function parseAddress(address: string): EmailAddress {
  const parsed = parseAddressList(address);
  return parsed[0] || { name: 'Unknown', email: address.trim() };
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format email address for display
 */
export function formatEmailAddress(addr: EmailAddress): string {
  if (addr.name && addr.name !== addr.email.split('@')[0]) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}

/**
 * Extract unique email addresses from a list
 */
export function getUniqueEmails(addresses: EmailAddress[]): EmailAddress[] {
  const seen = new Set<string>();
  return addresses.filter(addr => {
    if (seen.has(addr.email.toLowerCase())) {
      return false;
    }
    seen.add(addr.email.toLowerCase());
    return true;
  });
}
