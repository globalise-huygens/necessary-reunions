# Necessary Reunions

**Remarrying Maps to Text and Reconceptualizing Histories of Early Modern Kerala**

[![License: EUPL-1.2](https://img.shields.io/badge/License-EUPL--1.2-blue.svg)](LICENSE.md)
[![Website](https://img.shields.io/badge/Website-necessaryreunions.org-green)](https://necessaryreunions.org/)
[![DOI](https://zenodo.org/badge/DOI/ZENODO_DOI_PLACEHOLDER.svg)](https://doi.org/ZENODO_DOI_PLACEHOLDER)

Maps and textual sources in the Dutch East India Company (VOC) archives were meant to be together. Maps were vital for understanding textual information about places. Written sources, in turn, enriched knowledge from maps. Previously, information from these sources could not be reintegrated because no suitable techniques existed to reunify them. Today, emerging techniques of georeferencing on maps and machine-generated transcriptions on text and maps make this possible. This project applied these methods to the VOC archives on early modern Kerala, India, enabling us to reconceptualize Kerala's early modern topography and support writing new histories of the region.

[https://necessaryreunions.org/](https://necessaryreunions.org/)

## Table of Contents

- [Necessary Reunions](#necessary-reunions)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
    - [Map Viewer](#map-viewer)
    - [GAVOC Explorer](#gavoc-explorer)
    - [Gazetteer](#gazetteer)
  - [Tools and Frameworks](#tools-and-frameworks)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Environment Variables](#environment-variables)
    - [Build](#build)
  - [Funding](#funding)
  - [Related Projects](#related-projects)
  - [Output and Outreach](#output-and-outreach)
  - [License](#license)
  - [Citation](#citation)

## Features

The application at [necessaryreunions.org](https://necessaryreunions.org/) provides three main tools:

### Map Viewer

An interactive viewer _re:Charted_ for exploring annotated VOC maps of Kerala from the Leupe collection at the National Archives in The Hague. The viewer displays historical maps served via IIIF alongside georeferenced overlays (powered by [Allmaps](https://allmaps.org/)) and supports browsing of automatically generated annotations, including handwritten text recognition (HTR) results and computer-vision-detected iconography. Logged in users can create, edit, and geotag annotations stored in our annotation repository, a project instance of [AnnoRepo](https://github.com/knaw-huc/annorepo).

Direct link: https://necessaryreunions.org/viewer

### GAVOC Explorer

A geographical exploration tool for the _Grote Atlas van de Verenigde Oost-Indische Compagnie_ (GAVOC). Historical place names from the atlas are linked to modern coordinates and names, forming a historical thesaurus of place names that can be explored on a modern map and queried via an API.

Direct link: https://necessaryreunions.org/gavoc

### Gazetteer

A gazetteer of place information for early modern Kerala, combining data from textual archives and thirty maps from the Leupe collection. The gazetteer includes historical and modern place names, coordinates, and links to external geographical datasets (Wikidata, GeoNames, GLOBALISE).

Direct link: https://necessaryreunions.org/gazetteer

## Tools and Frameworks

- **Framework:** [Next.js](https://nextjs.org/) 16 with React 19
- **Mapping:** [Leaflet](https://leafletjs.com/) / [React-Leaflet](https://react-leaflet.js.org/) with [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- **Image Viewing:** [OpenSeadragon](https://openseadragon.github.io/) (IIIF image viewer)
- **Georeferencing Overlays:** [Allmaps](https://allmaps.org/)
- **Annotation Storage:** [AnnoRepo](https://github.com/knaw-huc/annorepo) (W3C Web Annotation)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Radix UI](https://www.radix-ui.com/) primitives
- **Deployment:** [Netlify](https://www.netlify.com/)
- **Package Manager:** [pnpm](https://pnpm.io/)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10

### Installation

```bash
# Clone the repository
git clone https://github.com/globalise-huygens/necessary-reunions.git
cd necessary-reunions

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Environment Variables

For full functionality (annotation editing, authentication), the following environment variables are required:

| Variable               | Description                                |
| ---------------------- | ------------------------------------------ |
| `NEXTAUTH_URL`         | Base URL of the application                |
| `NEXTAUTH_SECRET`      | Secret for NextAuth.js session encryption  |
| `ANNO_REPO_TOKEN_JONA` | Bearer token for AnnoRepo write access     |
| `ORCID_ALLOWLIST_NERU` | Comma-separated ORCID iDs for write access |

> **Note:** Read access to annotations is public. Write access requires ORCID authentication and allowlisting.

### Build

```bash
pnpm build
pnpm start
```

## Funding

This project was funded by the NWO Open Competition XS grant, file number [406.XS.24.02.046](https://doi.org/10.61686/OBKQG09045) (March–December 2025), and conducted at the [Huygens Institute](https://www.huygens.knaw.nl/).

## Related Projects

- **[GLOBALISE](https://globalise.huygens.knaw.nl/)** — Data created in the Necessary Reunions project is part of the GLOBALISE project and will be available and further used there.
- **[Combatting Bias](https://combattingbias.huygens.knaw.nl/)** — The project worked to identify biases in the data and methods, especially linked to the VOC archives. Guidelines, vocabulary, and a helpful toolkit can be found on the Combatting Bias website.
- **[MapReader](https://github.com/maps-as-data/MapReader)** — Computer vision techniques for map analysis, whose methods were adapted for this project.
- **[Loghi](https://github.com/knaw-huc/loghi)** — HTR toolkit developed at the Huygens Institute, used to generate transcriptions of the VOC archives.

## Output and Outreach

- Kuruppath, M. & van Wissen, L. (August 16, 2025). Sailing Through Time: History on Screens [Print]. _The Times of India_. [Sailing Through Time: History on Screens](https://timesofindia.indiatimes.com/blogs/tracking-indian-communities/sailing-through-time-history-on-screens/)

- Kuruppath, M. & van Wissen, L. (August 13, 2025). Georeferencing Dutch Malabar — Necessary Reunions: Remarrying maps to text, Cosmos Malabaricus Summer School 2025, Kochi.
- Kuruppath, M. & van Wissen, L. (March 4, 2025). Introduction to Digital Tools. The GLOBALISE and Necessary Reunions projects, GHCC-Map History Research Group Joint Workshop, Coventry.

- van Wissen, L., Kuruppath, M., & Petram, L. (2025). Unlocking the Research Potential of Early Modern Dutch Maps. _European Journal of Geography_, 16(1), s12–s17. [https://doi.org/10.48088/ejg.si.spat.hum.l.wis.12.17](https://doi.org/10.48088/ejg.si.spat.hum.l.wis.12.17)

## License

This project is licensed under the [European Union Public Licence v. 1.2](LICENSE.md) (EUPL-1.2).

Any data created in the project is licensed under [Creative Commons CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Citation

If you use this software, please cite it using the metadata in the [CITATION.cff](CITATION.cff) file, or use the following:

> Schlegel, J., van Wissen, L., & Kuruppath, M. (2026). _Necessary Reunions (Software)_ (v1.0). [https://doi.org/ZENODO_DOI_PLACEHOLDER](https://doi.org/ZENODO_DOI_PLACEHOLDER)
