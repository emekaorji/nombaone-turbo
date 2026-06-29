import validator from 'validator';

/**
 * Sanitizes error messages in production to avoid leaking sensitive information.
 */
export const sanitizeErrorMessage = (message?: string): string => {
  return (
    message?.replace(/(?:(?:Error:|at)\s+.*?(?:\n|$))|(?:\/[\w/.:-]+)/g, '') ||
    'An unexpected error occurred'
  );
};

/**
 * Trims and HTML-escapes a string for safe output.
 */
export const sanitizeString = (input: string): string => {
  return validator.escape(validator.trim(input));
};
