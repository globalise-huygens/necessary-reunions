'use client';

import { Input } from '@/components/shared/Input';
import { Label } from '@/components/shared/Label';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { Button } from '@/components/shared/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shared/Tabs';
import { useToast } from '@/hooks/use-toast';
import { Database, Globe, Plus, Search, Tag as TagIcon } from 'lucide-react';
import * as React from 'react';

export interface TagSelectorProps {
  onAddTag: (tag: string) => void;
}

export function TagSelector({ onAddTag }: TagSelectorProps) {
  const [customTag, setCustomTag] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const { toast } = useToast();

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (!tag) return;
    onAddTag(tag);
    setCustomTag('');
  };

  const searchWikidata = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/wikidata?q=${encodeURIComponent(term)}`,
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch {
      toast({
        title: 'Search failed',
        description: 'Failed to search Wikidata. Please try again.',
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const searchGeoNames = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/geonames?q=${encodeURIComponent(term)}`,
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch {
      toast({
        title: 'Search failed',
        description: 'Failed to search Getty GeoNames. Please try again.',
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const mockWikidataResults = [
    {
      id: 'Q1',
      label: 'Universe',
      description: 'All of space and time and their contents',
    },
    {
      id: 'Q2',
      label: 'Earth',
      description: 'Third planet from the Sun in the Solar System',
    },
    {
      id: 'Q5',
      label: 'Human',
      description: 'Species of primate (Homo sapiens)',
    },
  ];

  const mockGeoNamesResults = [
    { id: '1', label: 'Paris', description: 'Capital of France' },
    { id: '2', label: 'London', description: 'Capital of the United Kingdom' },
    { id: '3', label: 'New York', description: 'City in the United States' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="custom-tag">Custom Tag</Label>
        <div className="flex gap-2">
          <Input
            id="custom-tag"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            placeholder="Enter a custom tag"
            className="flex-1"
          />
          <Button onClick={addCustomTag}>
            <TagIcon className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      <div className="border-t pt-4">
        <Tabs defaultValue="wikidata">
          <TabsList className="w-full">
            <TabsTrigger value="wikidata" className="flex-1">
              <Database className="h-4 w-4 mr-2" />
              Wikidata
            </TabsTrigger>
            <TabsTrigger value="geonames" className="flex-1">
              <Globe className="h-4 w-4 mr-2" />
              GeoNames
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for entities"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const activeTab = document
                    .querySelector('[role="tablist"] [data-state="active"]')
                    ?.getAttribute('value');
                  if (activeTab === 'wikidata') searchWikidata();
                  else searchGeoNames();
                }}
                disabled={isSearching}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="wikidata">
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {mockWikidataResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-2 hover:bg-muted rounded-md cursor-pointer flex justify-between items-center"
                    onClick={() => onAddTag(`wikidata:${result.id}`)}
                  >
                    <div>
                      <div className="font-medium">{result.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {result.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {result.id}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="geonames">
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {mockGeoNamesResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-2 hover:bg-muted rounded-md cursor-pointer flex justify-between items-center"
                    onClick={() => onAddTag(`geonames:${result.id}`)}
                  >
                    <div>
                      <div className="font-medium">{result.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {result.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {result.id}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
