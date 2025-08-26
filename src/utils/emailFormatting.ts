/**
 * Standardize email body formatting across all flows
 * @param input - Raw email body content
 * @param mode - 'html' or 'text' (default: 'text')
 * @returns Formatted email body
 */
export function formatEmailBody(input: string, mode: 'html' | 'text' = 'text'): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Normalize line endings
  let content = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (mode === 'html') {
    // Convert to HTML format
    // First, convert double line breaks to paragraph breaks
    content = content.replace(/\n\s*\n/g, '</p><p>');
    // Then convert single line breaks to <br> tags
    content = content.replace(/\n/g, '<br>');
    // Wrap in paragraph tags
    content = `<p>${content}</p>`;
    // Clean up empty paragraphs
    content = content.replace(/<p><\/p>/g, '');
    // Clean up consecutive <br> tags
    content = content.replace(/(<br>){2,}/g, '<br><br>');
    return content;
  } else {
    // Plain text format - ensure consistent paragraph breaks
    // Replace multiple consecutive line breaks with double line breaks
    content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');
    // Ensure paragraphs are separated by double line breaks
    content = content.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
    // Clean up leading/trailing whitespace
    content = content.trim();
    return content;
  }
}
