# Media Capture Checklist

This checklist tracks which video recordings and screenshots need to be captured or re-recorded for the documentation page. All media files go in `public/video/` (videos) and `public/image/docs/` (screenshots).

## Videos to Re-record

These existing videos show outdated UI and need re-recording:

| #   | Filename                                      | Section                 | What to Show                                                                                                                                                                        | Why Re-record                                                                                           |
| --- | --------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `neru_recharted_info-tab-and-manifest.mp4`    | Info Tab & Manifest     | Info tab with ProjectSwitcher visible in top navigation bar; demonstrate switching between NeRu and STM projects                                                                    | ProjectSwitcher is new; top navigation has changed                                                      |
| 2   | `neru_recharted_annotation-tab-view-mode.mp4` | Annotation Viewing Mode | Annotation browsing with resizable sidebar; show drag-to-resize handle; demonstrate filter toggles for AI/Human text spotting and iconography                                       | Resizable sidebar is new                                                                                |
| 3   | `neru_recharted_deleting.mp4`                 | 5a. Deletion            | Single annotation deletion and bulk delete mode, showing the two-step confirmation pattern (first click marks for deletion, second click confirms)                                  | Two-step delete confirmation is new                                                                     |
| 4   | `neru_recharted_linking.mp4`                  | 5f. Linking             | Full linking workflow using the new collapsible AnnotationEnrichment sections (Link, Geotag, Point); demonstrate all five geotag sources; show order badges on selected annotations | Major UI overhaul: collapsible sections replaced tab-based widget; five geotag sources instead of three |

## New Videos to Record

These cover features not previously documented:

| #   | Suggested Filename                       | Section               | What to Show                                                                                                                                                                 |
| --- | ---------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | `neru_recharted_project-switcher.mp4`    | Multi-Project Support | Open ProjectSwitcher from top nav; switch between Necessary Reunions and Suriname Time Machine; show how the UI adapts (different manifest, annotations, geotag sources)     |
| 6   | `neru_recharted_share-view.mp4`          | Sharing & URL State   | Use ShareViewButton to copy a shareable link; demonstrate that URL updates when navigating canvases and selecting annotations; optionally show Content State paste/drag-drop |
| 7   | `neru_documentation_language-toggle.mp4` | Documentation         | Toggle between EN and NL on the documentation page; show the URL updating from `/en/documentation` to `/nl/documentation`                                                    |

## Videos to Keep (No Changes Needed)

These workflows have not changed significantly:

| #   | Filename                                  | Section                  | Status                                     |
| --- | ----------------------------------------- | ------------------------ | ------------------------------------------ |
| 8   | `neru_recharted_map-tab.mp4`              | Map Tab                  | Keep -- Allmaps integration unchanged      |
| 9   | `neru_recharted_correct.mp4`              | 5b. Correction           | Keep -- correction workflow stable         |
| 10  | `neru_recharted_addnew.mp4`               | 5c. Add New              | Keep -- add new annotation workflow stable |
| 11  | `neru_recharted_classification.mp4`       | 5d. Classification       | Keep -- classification workflow stable     |
| 12  | `neru_recharted_commenting-assessing.mp4` | 5e. Comment & Assessment | Keep -- comment/assess workflow stable     |
| 13  | `neru_gavoc.mp4`                          | GAVOC                    | Keep                                       |
| 14  | `neru_gazetteer_search.mp4`               | Gazetteer Search         | Keep                                       |
| 15  | `neru_gazetteer-place-details.mp4`        | Gazetteer Place Details  | Keep                                       |

## Screenshots to Capture

New screenshots for inline documentation images:

| #   | Suggested Filename                            | What to Show                                                                                    |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| S1  | `screenshot_project-switcher-desktop.png`     | ProjectSwitcher popover opened on desktop, showing both project options with accent colour dots |
| S2  | `screenshot_project-switcher-mobile.png`      | ProjectSwitcher bottom sheet on mobile view                                                     |
| S3  | `screenshot_annotation-enrichment-link.png`   | AnnotationEnrichment widget with Link section expanded, showing annotation reading order        |
| S4  | `screenshot_annotation-enrichment-geotag.png` | Geotag section expanded with search results from multiple sources visible                       |
| S5  | `screenshot_annotation-enrichment-point.png`  | Point section with crosshair cursor visible on the map                                          |
| S6  | `screenshot_share-view-button.png`            | Share view popover or dialog open                                                               |
| S7  | `screenshot_resizable-sidebar.png`            | Right sidebar being resized (drag handle visible)                                               |
| S8  | `screenshot_language-toggle.png`              | Language toggle (EN/NL) in documentation page header                                            |

## Recording Guidelines

- **Resolution**: Record at 1920x1080 or higher
- **Format**: MP4 with H.264 codec
- **Duration**: Keep each video under 60 seconds where possible
- **Browser**: Use a clean browser profile without extensions visible
- **Theme**: Record in light theme for consistency with existing videos
- **Audio**: No audio required (videos are shown with muted autoplay)
- **Screenshots**: PNG format, same resolution as video recordings
