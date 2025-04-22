'use client';

import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getLocalizedValue } from '@/lib/iiif-helpers';

interface AnnotationPanelProps {
  manifest: any;
  currentCanvas: number;
  onChange: (manifest: any) => void;
}

export function AnnotationPanel({
  manifest,
  currentCanvas,
  onChange,
}: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [newAnnotation, setNewAnnotation] = useState({
    label: '',
    content: '',
  });
  const [tags, setTags] = useState<string[]>([]);
  const { toast } = useToast();

  // Extract annotations from the current canvas
  useEffect(() => {
    if (!manifest || !manifest.items || !manifest.items[currentCanvas]) {
      setAnnotations([]);
      return;
    }

    const canvas = manifest.items[currentCanvas];

    // Extract annotations from the canvas
    const extractedAnnotations = [];

    // Look for annotations in the items array
    if (canvas.annotations) {
      for (const anno of canvas.annotations) {
        if (anno.items) {
          extractedAnnotations.push(...anno.items);
        }
      }
    }

    // Also check for metadata
    if (canvas.metadata) {
      for (const meta of canvas.metadata) {
        extractedAnnotations.push({
          id: `metadata-${extractedAnnotations.length}`,
          type: 'Annotation',
          label: { en: [meta.label?.en?.[0] || 'Metadata'] },
          body: { value: meta.value?.en?.[0] || '' },
          motivation: 'describing',
        });
      }
    }

    setAnnotations(extractedAnnotations);

    // Extract tags
    const extractedTags = [];
    if (canvas.tags) {
      extractedTags.push(...canvas.tags);
    }
    setTags(extractedTags);
  }, [manifest, currentCanvas]);

  const handleAddAnnotation = () => {
    if (!newAnnotation.label.trim() || !newAnnotation.content.trim()) {
      toast({
        title: 'Missing information',
        description:
          'Please provide both a label and content for the annotation.',
        variant: 'destructive',
      });
      return;
    }

    const updatedManifest = { ...manifest };
    const canvas = updatedManifest.items[currentCanvas];

    // Create a new annotation
    const newAnno = {
      id: `annotation-${Date.now()}`,
      type: 'Annotation',
      label: { en: [newAnnotation.label] },
      body: { value: newAnnotation.content },
      motivation: 'commenting',
      created: new Date().toISOString(),
      creator: {
        id: 'current-user', // In a real app, get from auth
        name: 'Current User',
      },
    };

    // Add the annotation to the canvas
    if (!canvas.annotations) {
      canvas.annotations = [
        {
          type: 'AnnotationPage',
          items: [newAnno],
        },
      ];
    } else if (canvas.annotations[0] && canvas.annotations[0].items) {
      canvas.annotations[0].items.push(newAnno);
    } else {
      canvas.annotations.push({
        type: 'AnnotationPage',
        items: [newAnno],
      });
    }

    // Update the manifest
    onChange(updatedManifest);

    // Reset the form
    setNewAnnotation({ label: '', content: '' });

    toast({
      title: 'Annotation added',
      description: 'Your annotation has been added to the canvas.',
    });
  };

  const handleDeleteAnnotation = (index: number) => {
    const updatedManifest = { ...manifest };
    const canvas = updatedManifest.items[currentCanvas];

    // Find and remove the annotation
    if (
      canvas.annotations &&
      canvas.annotations[0] &&
      canvas.annotations[0].items
    ) {
      canvas.annotations[0].items.splice(index, 1);

      // If no annotations left, remove the annotation page
      if (canvas.annotations[0].items.length === 0) {
        canvas.annotations.splice(0, 1);
      }

      // If no annotation pages left, remove the annotations array
      if (canvas.annotations.length === 0) {
        delete canvas.annotations;
      }
    }

    // Update the manifest
    onChange(updatedManifest);

    toast({
      title: 'Annotation deleted',
      description: 'The annotation has been removed from the canvas.',
    });
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;

    // Don't add duplicate tags
    if (tags.includes(tag)) {
      toast({
        title: 'Duplicate tag',
        description: 'This tag has already been added.',
        variant: 'destructive',
      });
      return;
    }

    const updatedManifest = { ...manifest };
    const canvas = updatedManifest.items[currentCanvas];

    // Add the tag to the canvas
    if (!canvas.tags) {
      canvas.tags = [tag];
    } else {
      canvas.tags.push(tag);
    }

    // Update the manifest
    onChange(updatedManifest);
    setTags([...tags, tag]);

    toast({
      title: 'Tag added',
      description: `The tag "${tag}" has been added to the canvas.`,
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Add Annotation</h3>
            <div className="space-y-2">
              <Label htmlFor="annotation-label">Label</Label>
              <Input
                id="annotation-label"
                value={newAnnotation.label}
                onChange={(e) =>
                  setNewAnnotation({ ...newAnnotation, label: e.target.value })
                }
                placeholder="Annotation title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annotation-content">Content</Label>
              <Textarea
                id="annotation-content"
                value={newAnnotation.content}
                onChange={(e) =>
                  setNewAnnotation({
                    ...newAnnotation,
                    content: e.target.value,
                  })
                }
                placeholder="Annotation content"
                rows={3}
              />
            </div>
            <Button onClick={handleAddAnnotation} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Annotation
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Existing Annotations</h3>
            {annotations.length > 0 ? (
              <div className="space-y-3">
                {annotations.map((anno, index) => (
                  <Card key={anno.id || index}>
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium">
                            {getLocalizedValue(anno.label) || 'Untitled'}
                          </h5>
                          <p className="text-sm text-muted-foreground mt-1">
                            {anno.body?.value ||
                              anno.body?.text ||
                              'No content'}
                          </p>
                          {anno.motivation && (
                            <Badge variant="outline" className="mt-2">
                              {anno.motivation}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAnnotation(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No annotations found for this canvas.
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
              {tags.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No tags added to this canvas yet.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <Button variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
