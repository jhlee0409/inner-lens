#!/bin/bash
# analyze-source.sh
# Extract exported functions and their signatures from a TypeScript file
#
# Usage: ./analyze-source.sh <source-file.ts>
#
# Output: List of exported functions with their signatures

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <source-file.ts>"
  echo "Example: $0 src/utils/masking.ts"
  exit 1
fi

SOURCE_FILE="$1"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Error: File not found: $SOURCE_FILE"
  exit 1
fi

echo "=== Analyzing: $SOURCE_FILE ==="
echo ""

# Extract exported functions
echo "## Exported Functions"
echo ""
grep -E "^export (async )?function" "$SOURCE_FILE" 2>/dev/null | while read -r line; do
  # Extract function name
  func_name=$(echo "$line" | sed -E 's/export (async )?function ([a-zA-Z0-9_]+).*/\2/')
  echo "- $func_name"
done

# Extract exported const functions (arrow functions)
echo ""
echo "## Exported Const Functions"
echo ""
grep -E "^export const [a-zA-Z0-9_]+ =" "$SOURCE_FILE" 2>/dev/null | while read -r line; do
  const_name=$(echo "$line" | sed -E 's/export const ([a-zA-Z0-9_]+) =.*/\1/')
  echo "- $const_name"
done

# Extract interface/type exports
echo ""
echo "## Exported Types/Interfaces"
echo ""
grep -E "^export (type|interface) " "$SOURCE_FILE" 2>/dev/null | while read -r line; do
  type_name=$(echo "$line" | sed -E 's/export (type|interface) ([a-zA-Z0-9_]+).*/\2/')
  echo "- $type_name"
done

# Check for existing test file
TEST_FILE="${SOURCE_FILE%.ts}.test.ts"
echo ""
echo "## Test File Status"
if [ -f "$TEST_FILE" ]; then
  echo "Test file exists: $TEST_FILE"
  existing_tests=$(grep -c "it\(" "$TEST_FILE" 2>/dev/null || echo "0")
  echo "Existing test cases: $existing_tests"
else
  echo "No test file found. Expected: $TEST_FILE"
fi

echo ""
echo "=== Analysis Complete ==="
