# GAVOC Atlas URI System

## Overview

The GAVOC Atlas now uses a proper URI system that allows for direct linking to specific locations and provides SEO-friendly URLs.

## URI Format

Each location in the GAVOC Atlas has two types of identifiers:

### 1. Semantic URIs

- Format: `https://necessaryreunions.org/gavoc/{id}/{slug}`
- Example: `https://necessaryreunions.org/gavoc/2/andamanen-andaman-islands`
- These are human-readable and SEO-friendly

### 2. Simple URIs

- Format: `https://necessaryreunions.org/gavoc/{id}`
- Example: `https://necessaryreunions.org/gavoc/2`
- Used when no good slug can be generated

## How It Works

### URL Generation

1. **ID**: Uses the original CSV ID (e.g., `2` for the second entry)
2. **Slug**: Generated from the present name if available, otherwise from the original name
   - Converts to lowercase
   - Removes special characters
   - Replaces spaces with hyphens
   - Example: "Andamanen/Andaman Islands" → "andamanen-andaman-islands"

### URL Routing

- When a user visits `/gavoc/2/andamanen-andaman-islands`, they are redirected to `/gavoc`
- The main GAVOC page detects the URL pattern and automatically:
  - Selects the corresponding location
  - Opens the sidebar
  - Centers the map on the location
  - Highlights the row in the table

### Features

#### Deep Linking

- Direct URLs to any location work as expected
- URLs are preserved in the browser
- Back/forward buttons work correctly

#### Sharing

- Click "Share" button next to any selected location
- Copies the full URL to clipboard
- URLs work when shared with others

#### Browser Integration

- URLs update when locations are selected
- Browser history is properly maintained
- Bookmarking works

## Examples

Here are some example locations and their URIs:

| Location | ID  | Original Name      | Present Name              | URI                                                               |
| -------- | --- | ------------------ | ------------------------- | ----------------------------------------------------------------- |
| River    | 1   | Aajer Gila         | -                         | `https://necessaryreunions.org/gavoc/1/aajer-gila`                |
| Islands  | 2   | Aandomaon, Ilha de | Andamanen/Andaman Islands | `https://necessaryreunions.org/gavoc/2/andamanen-andaman-islands` |
| Mountain | 3   | Aapjesberg         | Apenberg/Bukit Monyet     | `https://necessaryreunions.org/gavoc/3/apenberg-bukit-monyet`     |

## Technical Implementation

### Files Changed

- `lib/gavoc/data-processing.ts` - URI generation logic
- `lib/gavoc/url-utils.ts` - URL routing utilities
- `lib/gavoc/types.ts` - Added `urlPath` field
- `app/gavoc/page.tsx` - URL handling and sharing functionality
- `app/gavoc/[id]/page.tsx` - Dynamic route handler
- `app/gavoc/[id]/[slug]/page.tsx` - Dynamic route with slug handler
- `components/gavoc/GavocTable.tsx` - URL display and copying

### Key Functions

- `generateLocationUri()` - Creates the full URI
- `generateLocationPath()` - Creates the URL path
- `parseLocationPath()` - Parses URL paths back to ID/slug
- `findLocationByPath()` - Finds location by URL path
- `updateUrlForLocation()` - Updates browser URL
- `getShareableUrl()` - Creates shareable URLs

## Future Enhancements

### Potential Improvements

1. **Server-Side Rendering**: Generate proper metadata for each location page
2. **Search Engine Optimization**: Add structured data for better SEO
3. **Social Media**: Add Open Graph tags for better sharing
4. **Canonical URLs**: Handle multiple URL formats pointing to same location
5. **URL Redirects**: Handle legacy URL formats if needed

### Metadata Generation

Each location page could have rich metadata including:

- Location name in title
- Coordinates and category in description
- Geographic markup for search engines
- Social media preview images using map thumbnails
