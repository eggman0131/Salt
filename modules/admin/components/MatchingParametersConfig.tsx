import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { IngredientMatchingConfig } from '../../../types/contract';
import { canonBackend } from '../../canon';
import { softToast } from '@/lib/soft-toast';

/**
 * UI for tweaking ingredient matching algorithm parameters
 * 
 * Allows fine-tuning of:
 * - Fuzzy match confidence threshold (Stage 1)
 * - Semantic match thresholds (Stage 2)
 * - Score gap minimum (Stage 2)
 * - LLM bias (Stage 3)
 * - Candidate count and cluster window
 */
export const MatchingParametersConfig: React.FC = () => {
  const [config, setConfig] = useState<IngredientMatchingConfig | null>(null);
  const [modified, setModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load current config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const current = await canonBackend.getIngredientMatchingConfig();
        setConfig(current);
        setModified(false);
      } catch (error) {
        softToast.error('Failed to load matching config', {
          description: error instanceof Error ? error.message : 'Please try again',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  if (isLoading || !config) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="p-4 md:p-6">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Matching Parameters</CardTitle>
            <p className="text-sm text-muted-foreground">Ingredient matching algorithm thresholds</p>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const handleChange = (key: keyof IngredientMatchingConfig, value: number | boolean) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
    setModified(true);
  };

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      await canonBackend.updateIngredientMatchingConfig(config);
      setModified(false);
      softToast.success('Parameters updated', {
        description: 'Matching thresholds have been saved',
      });
    } catch (error) {
      softToast.error('Failed to save parameters', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const current = await canonBackend.getIngredientMatchingConfig();
      setConfig(current);
      setModified(false);
    } catch (error) {
      softToast.error('Failed to reload parameters', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 md:p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Matching Parameters</CardTitle>
            <p className="text-sm text-muted-foreground">Ingredient matching algorithm thresholds</p>
          </div>
          {modified && (
            <Badge variant="secondary" className="text-xs">
              Modified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 md:p-6">
        {/* Stage 1: Fuzzy Matching */}
        <div className="space-y-3 rounded-lg border p-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Stage 1: Fuzzy Matching</p>
              <p className="text-xs text-muted-foreground">Fast string similarity check</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {(config.fuzzyHighConfidenceThreshold * 100).toFixed(0)}%
            </Badge>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuzzy-threshold" className="text-xs text-muted-foreground">
              Confidence Threshold
            </Label>
            <Slider
              id="fuzzy-threshold"
              min={0}
              max={1}
              step={0.01}
              value={[config.fuzzyHighConfidenceThreshold]}
              onValueChange={(values) => handleChange('fuzzyHighConfidenceThreshold', values[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Items with fuzzy match score above this will be accepted immediately. Lower = more lenient, higher = stricter.
            </p>
          </div>
        </div>

        {/* Stage 2: Semantic Matching */}
        <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Stage 2: Semantic Matching</p>
            <p className="text-xs text-muted-foreground">AI-powered semantic similarity analysis</p>
          </div>

          {/* High Threshold */}
          <div className="space-y-2 pl-4 border-l-2 border-primary/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="semantic-high" className="text-xs font-medium">
                High Confidence Threshold
              </Label>
              <Badge variant="outline" className="text-xs">
                {(config.semanticHighThreshold * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              id="semantic-high"
              min={0}
              max={1}
              step={0.01}
              value={[config.semanticHighThreshold]}
              onValueChange={(values) => handleChange('semanticHighThreshold', values[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Accept match immediately if above this score (confident match).
            </p>
          </div>

          {/* Low Threshold */}
          <div className="space-y-2 pl-4 border-l-2 border-orange-300/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="semantic-low" className="text-xs font-medium">
                Low Threshold
              </Label>
              <Badge variant="outline" className="text-xs">
                {(config.semanticLowThreshold * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              id="semantic-low"
              min={0}
              max={1}
              step={0.01}
              value={[config.semanticLowThreshold]}
              onValueChange={(values) => handleChange('semanticLowThreshold', values[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Below this score = no match. Between low and high = send to LLM for arbitration.
            </p>
          </div>

          {/* Gap Threshold */}
          <div className="space-y-2 pl-4 border-l-2 border-blue-300/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="gap-threshold" className="text-xs font-medium">
                Score Gap Threshold
              </Label>
              <Badge variant="outline" className="text-xs">
                {(config.semanticGapThreshold * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              id="gap-threshold"
              min={0}
              max={1}
              step={0.01}
              value={[config.semanticGapThreshold]}
              onValueChange={(values) => handleChange('semanticGapThreshold', values[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Minimum gap between top 2 candidates for confident match. Higher = require more separation.
            </p>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Advanced </p>
            <p className="text-xs text-muted-foreground">Fine-tuning and LLM settings</p>
          </div>

          {/* Cluster Window */}
          <div className="space-y-2 pl-4 border-l-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cluster-window" className="text-xs font-medium">
                Cluster Window
              </Label>
              <Badge variant="outline" className="text-xs">
                {(config.semanticClusterWindow * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              id="cluster-window"
              min={0}
              max={1}
              step={0.01}
              value={[config.semanticClusterWindow]}
              onValueChange={(values) => handleChange('semanticClusterWindow', values[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Max score difference between candidates in same cluster.
            </p>
          </div>

          {/* Candidate Count */}
          <div className="space-y-2 pl-4 border-l-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="candidate-count" className="text-xs font-medium">
                Candidate Count
              </Label>
              <Badge variant="outline" className="text-xs">
                {config.semanticCandidateCount}
              </Badge>
            </div>
            <Slider
              id="candidate-count"
              min={1}
              max={20}
              step={1}
              value={[config.semanticCandidateCount]}
              onValueChange={(values) => handleChange('semanticCandidateCount', Math.round(values[0]))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How many top candidates to consider during semantic matching.
            </p>
          </div>

          {/* LLM Bias */}
          <div className="space-y-2 pl-4 border-l-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="llm-bias" className="text-xs font-medium">
                LLM Bias for Existing Items
              </Label>
              <Badge variant="outline" className="text-xs">
                {(config.llmBiasForExistingCanon * 100).toFixed(1)}%
              </Badge>
            </div>
            <Slider
              id="llm-bias"
              min={0}
              max={1}
              step={0.01}
              value={[config.llmBiasForExistingCanon]}
              onValueChange={(values) => handleChange('llmBiasForExistingCanon', values[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Slight preference for matching existing Canon items vs creating new ones.
            </p>
          </div>

          {/* Allow New Canon Items */}
          <div className="flex items-center justify-between rounded-md p-3 bg-background border">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold">Allow New Canon Items</p>
              <p className="text-xs text-muted-foreground">
                Permit creation of new Canon items when no matches found
              </p>
            </div>
            <Switch
              checked={config.allowNewCanonItems}
              onCheckedChange={(checked) => handleChange('allowNewCanonItems', checked)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={!modified || isSaving}
            className="flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={!modified || isSaving}
            className="flex-1"
          >
            Revert
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
