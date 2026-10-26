import React from 'react';

/**
 * Splits text into string segments and clickable <a> tags for web URLs.
 * Supports http://, https://, and www. links.
 * Automatically cleans trailing punctuation (e.g. dots, commas, exclamation marks)
 * so sentence punctuation isn't included in the link URL.
 */
export function renderTextWithLinks(text: string | null | undefined): React.ReactNode {
  if (!text) return null;

  // Regex to match URLs starting with http://, https://, or www.
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

  const parts = text.split(urlRegex);
  if (parts.length <= 1) {
    return text;
  }

  return parts.map((part, index) => {
    // If the part matches URL pattern
    if (/^(?:https?:\/\/|www\.)[^\s<]+$/i.test(part)) {
      let cleanUrl = part;
      let trailingPunctuation = '';

      // Strip trailing punctuation common in sentences
      const punctMatch = cleanUrl.match(/[.,!?:;'"\]]+$/);
      if (punctMatch) {
        trailingPunctuation = punctMatch[0] + trailingPunctuation;
        cleanUrl = cleanUrl.slice(0, -punctMatch[0].length);
      }

      // Check for trailing parentheses that don't have matching opening parentheses within this segment
      while (cleanUrl.endsWith(')')) {
        const openCount = (cleanUrl.match(/\(/g) || []).length;
        const closeCount = (cleanUrl.match(/\)/g) || []).length;
        if (closeCount > openCount) {
          cleanUrl = cleanUrl.slice(0, -1);
          trailingPunctuation = ')' + trailingPunctuation;
        } else {
          break;
        }
      }

      if (!cleanUrl) {
        return part;
      }

      const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;

      return (
        <React.Fragment key={`link-frag-${index}`}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 break-all font-medium transition cursor-pointer select-text"
            title={href}
          >
            {cleanUrl}
          </a>
          {trailingPunctuation}
        </React.Fragment>
      );
    }

    return part;
  });
}
