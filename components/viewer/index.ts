// This file exports all the core components and utilities that make up re:Charted

// Core Components
export { ManifestViewer as default, ManifestViewer } from './ManifestViewer';
export { ImageViewer } from './ImageViewer';
export { DrawingTools } from './DrawingTools';
export { CollectionSidebar } from './CollectionSidebar';
export { MetadataViewer } from './MetadataViewer';
export { MetadataSidebar } from './MetadataSidebar';
export { ManifestLoader } from './ManifestLoader';

// Map Components
export { default as AllmapsMap } from './AllmapsMap';
export { GeoTagMap } from './GeoTagMap';
export { MapControls } from './MapControls';

// Annotation Components
export { EditableAnnotationText } from './EditableAnnotationText';
export { FastAnnotationItem } from './FastAnnotationItem';
export { PointSelector } from './PointSelector';
export { TagSelector } from './TagSelector';

// Linking Components
export { LinkingAnnotationWidget } from './LinkingAnnotationWidget';
export { LinkingCleanupManager } from './LinkingCleanupManager';
export {
  LinkingModeProvider,
  useLinkingMode,
  useLinkingModeHistory,
} from './LinkingModeContext';
export { LinkingPreValidation } from './LinkingPreValidation';
export { ExistingLinkingDisplay, ValidationDisplay } from './LinkingValidation';

// Utility exports from lib - avoid conflicts by being selective
export {
  getCanvasImageInfo,
  getManifestCanvases,
  isImageCanvas,
  mergeLocalAnnotations,
  normalizeManifest,
} from '../../lib/viewer/iiif-helpers';

export {
  createAnnotation,
  deleteAnnotation,
  updateAnnotation,
} from '../../lib/viewer/annoRepo';

export type { ValidationResult as LinkingValidationResult } from '../../lib/viewer/linking-validation';

export type { ValidationResult as ManifestValidationResult } from '../../lib/viewer/manifest-validator';
