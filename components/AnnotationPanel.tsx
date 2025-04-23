'use client';

import { useState, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { ScrollArea } from '@/components/ScrollArea';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Textarea } from '@/components/Textarea';
import { Badge } from '@/components/Badge';
import { Card, CardContent } from '@/components/Card';
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

  useEffect(() => {
    const canvas = manifest?.items?.[currentCanvas];
    if (!canvas) {
      setAnnotations([]);
      setTags([]);
      return;
    }

    const extracted: any[] = [];
    if (canvas.annotations) {
      canvas.annotations.forEach((page: any) =>
        page.items?.forEach((item: any) => extracted.push(item)),
      );
    }
    if (canvas.metadata) {
      canvas.metadata.forEach((meta: any, i: number) => {
        extracted.push({
          id: `metadata-${i}`,
          type: 'Annotation',
          label: { en: [meta.label?.en?.[0] || 'Metadata'] },
          body: { value: meta.value?.en?.[0] || '' },
          motivation: 'describing',
        });
      });
    }
    setAnnotations(extracted);
    setTags(canvas.tags || []);
  }, [manifest, currentCanvas]);

  const handleAddAnnotation = () => {
    if (!newAnnotation.label.trim() || !newAnnotation.content.trim()) {
      toast({
        title: 'Missing information',
        description:
          'Please provide both a label and content for the annotation.',
      });
      return;
    }
    const updated = { ...manifest };
    const canvas = updated.items[currentCanvas];
    const annotation = {
      id: `annotation-${Date.now()}`,
      type: 'Annotation',
      label: { en: [newAnnotation.label] },
      body: { value: newAnnotation.content },
      motivation: 'commenting',
      created: new Date().toISOString(),
      creator: { id: 'current-user', name: 'Current User' },
    };
    canvas.annotations = canvas.annotations?.length
      ? [...canvas.annotations]
      : [{ type: 'AnnotationPage', items: [] }];
    canvas.annotations[0].items.push(annotation);
    onChange(updated);
    setNewAnnotation({ label: '', content: '' });
    toast({
      title: 'Annotation added',
      description: 'Your annotation has been added to the canvas.',
    });
  };

  const handleDeleteAnnotation = (index: number) => {
    const updated = { ...manifest };
    const items = updated.items[currentCanvas]?.annotations?.[0]?.items;
    if (!items) return;
    items.splice(index, 1);
    if (items.length === 0) delete updated.items[currentCanvas].annotations;
    onChange(updated);
    toast({
      title: 'Annotation deleted',
      description: 'The annotation has been removed from the canvas.',
    });
  };

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      toast({
        title: 'Duplicate tag',
        description: 'This tag has already been added.',
      });
      return;
    }
    const updated = { ...manifest };
    const canvas = updated.items[currentCanvas];
    canvas.tags = canvas.tags ? [...canvas.tags, trimmed] : [trimmed];
    onChange(updated);
    setTags((prev) => [...prev, trimmed]);
    toast({
      title: 'Tag added',
      description: `The tag "${trimmed}" has been added to the canvas.`,
    });
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTag((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).value = '';
    }
  };

  const handleInputChange =
    (field: 'label' | 'content') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setNewAnnotation((prev) => ({ ...prev, [field]: e.target.value }));
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
                onChange={handleInputChange('label')}
                placeholder="Annotation title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annotation-content">Content</Label>
              <Textarea
                id="annotation-content"
                value={newAnnotation.content}
                onChange={handleInputChange('content')}
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
            {annotations.length ? (
              <div className="space-y-3">
                {annotations.map((anno, i) => (
                  <Card key={anno.id || i}>
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
                          onClick={() => handleDeleteAnnotation(i)}
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
              {tags.length ? (
                tags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No tags added to this canvas yet.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                className="flex-1"
                onKeyDown={handleTagKeyDown}
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
