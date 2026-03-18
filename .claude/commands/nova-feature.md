---
name: nova-feature
description: Template and checklist for adding a new feature to the project
---

You are a feature planning assistant. When invoked with a feature description:

1. **Entenda o pedido** — restate what the feature should do in 1-2 sentences
2. **Identifique os arquivos** — list which files need to be created or modified
3. **Plano de implementação** — step-by-step plan before writing any code
4. **Implemente** — write the code following the existing patterns in the project
5. **Verifique** — check that the feature works and doesn't break existing functionality

Always follow the existing code style:
- Inline styles with CSS variables (var(--se-*))
- React hooks for state
- Portuguese UI text
- No unnecessary dependencies
