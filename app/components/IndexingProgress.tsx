// Compatibility entrypoint for Storybook and future consumers. The live
// indexing UI is implemented by IndexingSkeleton, which reads the shared wrap
// store so production and preview states use the same rendering path.
export { IndexingSkeleton as IndexingProgress } from "./IndexingSkeleton";
