function parseCoordinatePart(part) {
  const direction = part.slice(-1).toUpperCase();
  const numberPart = part.slice(0, -1);

  if (!['N', 'S', 'E', 'W'].includes(direction)) return null;

  let degrees = 0;
  let minutes = 0;

  if (numberPart.includes('-')) {
    const [degStr, minStr] = numberPart.split('-');
    degrees = parseInt(degStr, 10);
    minutes = parseInt(minStr, 10);
  } else {
    degrees = parseInt(numberPart, 10);
  }

  if (isNaN(degrees)) return null;

  let decimal = degrees + minutes / 60;

  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

function parseCoordinates(coordString) {
  if (!coordString || coordString === '-' || coordString.trim() === '') {
    return null;
  }

  try {
    const coordParts = coordString.split('/');
    if (coordParts.length !== 2) return null;

    const [latPart, lonPart] = coordParts;

    const lat = parseCoordinatePart(latPart.trim());
    const lon = parseCoordinatePart(lonPart.trim());

    if (lat === null || lon === null) return null;

    return { latitude: lat, longitude: lon };
  } catch (error) {
    console.warn('Failed to parse coordinates:', coordString, error);
    return null;
  }
}

// Test cases from our CSV
const testCases = [
  '-',
  '12-30N/92-50E',
  '00-58S/100-20E',
  '13-30S/134E',
  '01N/119E',
  '09-15N/80-45E',
];

console.log('Testing coordinate parsing:');
testCases.forEach((coord) => {
  const result = parseCoordinates(coord);
  console.log(`${coord} => `, result);
});
