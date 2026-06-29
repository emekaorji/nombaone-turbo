/**
 * Generates a random identifier string with optional complexity requirements.
 */
export function getRandomId(length = 12, complex = false) {
  // Simple case - random hex string (original behavior)
  if (!complex) {
    const rounds = Math.ceil(length / 10);
    let fullString = '';
    for (let i = 0; i < rounds; i++) {
      fullString += Math.random().toString(16).slice(2).slice(0, 12);
    }
    return fullString.slice(0, length);
  }

  // Complex case - mix of numbers, lowercase and uppercase letters
  const charset = {
    numbers: '0123456789',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  };

  // Use all character sets for complex IDs
  const availableChars = charset.numbers + charset.lowercase + charset.uppercase;
  let result = '';
  const charactersLength = availableChars.length;

  // Generate the random string
  for (let i = 0; i < length; i++) {
    result += availableChars.charAt(Math.floor(Math.random() * charactersLength));
  }

  // Ensure at least one character from each set if length permits
  if (length >= 3) {
    // Convert to array for manipulation
    const resultArray = result.split('');

    // Generate 3 guaranteed-distinct positions so sets cannot overwrite each other.
    const positions = new Set<number>();
    while (positions.size < 3) {
      positions.add(Math.floor(Math.random() * length));
    }
    const [numberPos, lowercasePos, uppercasePos] = [...positions] as [number, number, number];

    // Ensure one character from each set
    resultArray[numberPos] = charset.numbers.charAt(
      Math.floor(Math.random() * charset.numbers.length)
    );
    resultArray[lowercasePos] = charset.lowercase.charAt(
      Math.floor(Math.random() * charset.lowercase.length)
    );
    resultArray[uppercasePos] = charset.uppercase.charAt(
      Math.floor(Math.random() * charset.uppercase.length)
    );

    // Convert back to string
    result = resultArray.join('');
  }

  return result;
}

// Example usage
// console.log(getRandomId(12, false)); // Simple ID - ex. f11a1db29dbe
// console.log(getRandomId(6, true)); // Complex ID - ex. PvMl0P
// console.log(getRandomId(8, true)); // Complex ID - ex. iW5euDfP
