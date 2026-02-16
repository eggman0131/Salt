# AI Chat Module

Interactive AI chat for collaborative recipe development with Head Chef persona synthesis.

## Architecture

```
modules/ai/
  ├── components/
  │   └── AIModule.tsx         # Main AI chat UI with recipe generation workflow
  ├── index.ts                 # Public API
  └── README.md                # This file
```

## Features

### Collaborative Recipe Drafting
- Multi-turn conversation with Salt Head Chef AI
- Real-time streaming chat responses
- Consensus-building towards recipe details

### Guided Recipe Creation Workflow
1. **Drafting Chat** (`chatForDraft()`) - Discuss recipe ideas
2. **Consensus** (`summarizeAgreedRecipe()`) - AI synthesises discussion
3. **Generation** (`generateRecipeFromPrompt()`) - Build structured recipe
4. **Image** (`generateRecipeImage()`) - Generate recipe photo
5. **Storage** (`createRecipe()`) - Save to inventory

### External Recipe Import
- Import recipes from URLs
- Automatic image generation
- Ingredient parsing and normalisation
- One-step save workflow

## Dependencies

### Imports from Other Modules
- **recipes module:** `recipesBackend` for all recipe-related AI operations

### Re-exports to Parent
- None; component is fully self-contained

## Usage

### Component Usage
```typescript
import { AIModule } from '../modules/ai';

// In parent component
<AIModule
  onRecipeGenerated={() => loadData()}
  initialUserMessage="Help me create a weeknight pasta dish"
/>
```

### Workflow Example

1. User sends message: "Let's make a quick pasta for 4"
2. AI responds with suggestions
3. User refines: "Add fresh basil, keep it simple"
4. After several exchanges, user clicks "Finalise Recipe"
5. AI synthesises consensus and generates recipe
6. AI creates recipe image
7. Recipe stored automatically
8. `onRecipeGenerated` callback triggers parent refresh

## Status Messages

During recipe creation:
- `finalising` - Consensus summarisation
- `organising` -Recipe structure building
- `imaging` - Photo generation
- `categorising` - Recipe metadata
- `processing` - Ingredient normalisation

## AI Prompts Used

Via `recipesBackend`:
- **Chat:** Conversational, exploratory, suggestions-focused
- **Consensus:** Synthesise discussion into structured brief
- **Generation:** Create detailed, editable recipe from brief
- **Import:** Parse external JSON/HTML recipe formats
- **Categorise:** Auto-tag recipe with cuisine/course/dietary

## Error Handling

- Network failures → Alert user, reset state
- Invalid recipe data → Use defaults (empty arrays, 'Untitled', etc.)
- Image generation failures → Continue without image, allow manual upload
- Import failures → Alert and request manual entry

## Future Enhancements

- [ ] Voice input for hands-free drafting
- [ ] Recipe collaboration (share draft links)
- [ ] Dietary restriction checking
- [ ] Ingredient compatibility warnings
- [ ] Equipment list generation
- [ ] Cooking technique videos
- [ ] Save drafts as unpublished recipes
- [ ] Chat history export
