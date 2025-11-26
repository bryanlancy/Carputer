#!/bin/bash

# Script to add a verified carputer image to the fleet server
# Usage: ./scripts/add-verified-image.sh <image-build-hash> [options]

set -e

# Default values
API_URL="${API_URL:-http://localhost:3001}"
BUILD_HASH=""
BUILD_ID=""
GIT_SHA=""
VERIFIED_BY="admin"
NOTES=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print usage
usage() {
    echo "Usage: $0 <image-build-hash> [options]"
    echo ""
    echo "Required:"
    echo "  <image-build-hash>    Hash of the carputer image build"
    echo ""
    echo "Options:"
    echo "  -b, --build-id        Build ID (e.g., 2024.01.15)"
    echo "  -g, --git-sha         Git SHA of the build"
    echo "  -u, --verified-by      Who verified this image (default: admin)"
    echo "  -n, --notes           Notes about this image"
    echo "  -a, --api-url         API URL (default: http://localhost:3001)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 sha256:abc123def456 --build-id 2024.01.15 --git-sha a1b2c3d4"
    echo "  $0 sha256:abc123def456 -b dev-001 -g a1b2c3d4 -n 'Development build'"
    exit 1
}

# Parse arguments
if [ $# -eq 0 ]; then
    usage
fi

BUILD_HASH="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--build-id)
            BUILD_ID="$2"
            shift 2
            ;;
        -g|--git-sha)
            GIT_SHA="$2"
            shift 2
            ;;
        -u|--verified-by)
            VERIFIED_BY="$2"
            shift 2
            ;;
        -n|--notes)
            NOTES="$2"
            shift 2
            ;;
        -a|--api-url)
            API_URL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            ;;
    esac
done

if [ -z "$BUILD_HASH" ]; then
    echo -e "${RED}Error: Image build hash is required${NC}"
    usage
fi

# Build JSON payload
JSON_PAYLOAD="{"
JSON_PAYLOAD+="\"imageBuildHash\":\"$BUILD_HASH\""

if [ -n "$BUILD_ID" ]; then
    JSON_PAYLOAD+=",\"buildId\":\"$BUILD_ID\""
fi

if [ -n "$GIT_SHA" ]; then
    JSON_PAYLOAD+=",\"gitSha\":\"$GIT_SHA\""
fi

if [ -n "$VERIFIED_BY" ]; then
    JSON_PAYLOAD+=",\"verifiedBy\":\"$VERIFIED_BY\""
fi

if [ -n "$NOTES" ]; then
    JSON_PAYLOAD+=",\"notes\":\"$NOTES\""
fi

JSON_PAYLOAD+="}"

echo -e "${YELLOW}Adding verified image to fleet server...${NC}"
echo "  API URL: $API_URL"
echo "  Build Hash: $BUILD_HASH"
[ -n "$BUILD_ID" ] && echo "  Build ID: $BUILD_ID"
[ -n "$GIT_SHA" ] && echo "  Git SHA: $GIT_SHA"
[ -n "$VERIFIED_BY" ] && echo "  Verified By: $VERIFIED_BY"
[ -n "$NOTES" ] && echo "  Notes: $NOTES"
echo ""

# Make API request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/verified-images" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Verified image added successfully${NC}"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    exit 0
else
    echo -e "${RED}✗ Failed to add verified image (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    exit 1
fi


