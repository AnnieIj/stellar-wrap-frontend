/**
 * Indexing step types and metadata
 */

export type IndexingStep =
  | "initializing"
  | "fetching-transactions"
  | "filtering-timeframes"
  | "calculating-volume"
  | "identifying-assets" 
  | "counting-contracts"
  | "finalizing";

export interface StepMetadata {
  id: IndexingStep;
  label: string;
  description: string;
  weight: number; // Percentage weight in overall progress (should sum to 100)
  estimatedDuration: number; // in milliseconds
}

export const INDEXING_STEPS: Record<IndexingStep, StepMetadata> = {
  initializing: {
    id: "initializing",
    label: "Initializing",
    description: "Setting up Horizon connection",
    weight: 5,
    estimatedDuration: 500,
  },
  "fetching-transactions": {
    id: "fetching-transactions",
    label: "Fetching Transactions",
    description: "Calling Stellar Horizon API",
    weight: 25,
    estimatedDuration: 3000,
  },
  "filtering-timeframes": {
    id: "filtering-timeframes",
    label: "Filtering Timeframes",
    description: "Filtering by 1w, 2w, 1m",
    weight: 15,
    estimatedDuration: 1000,
  },
  "calculating-volume": {
    id: "calculating-volume",
    label: "Calculating Volume",
    description: "Summing payment amounts",
    weight: 20,
    estimatedDuration: 1500,
  },
  "identifying-assets": {
    id: "identifying-assets",
    label: "Identifying Assets",
    description: "Counting operations per asset",
    weight: 20,
    estimatedDuration: 1500,
  },
  "counting-contracts": {
    id: "counting-contracts",
    label: "Counting Contracts",
    description: "Filtering Soroban operations",
    weight: 10,
    estimatedDuration: 1000,
  },
  finalizing: {
    id: "finalizing",
    label: "Finalizing",
    description: "Preparing wrap data",
    weight: 5,
    estimatedDuration: 500,
  },
};

export const STEP_ORDER: IndexingStep[] = [
  "initializing",
  "fetching-transactions",
  "filtering-timeframes",
  "calculating-volume",
  "identifying-assets",
  "counting-contracts",
  "finalizing",
];

export interface IndexingMetrics {
  transactionCount: number;
  totalTransactions: number | null;
  assetCount: number;
  contractCount: number;
  volumeProcessed: string; // Total volume as string (for large numbers)
  timeframesProcessed: number; // Number of timeframes completed
}

export interface IndexingProgress {
  currentStep: IndexingStep | null;
  stepProgress: Record<IndexingStep, number>; // 0-100 per step
  overallProgress: number; // 0-100
  completedSteps: number;
  totalSteps: number;
  startTime: number | null; // timestamp
  estimatedTimeRemaining: number | null; // in ms
  error: IndexingError | null;
  isLoading: boolean;
  isCancelled: boolean;
  metrics: IndexingMetrics; // Real-time metrics for visualizations
}

export interface IndexingError {
  step: IndexingStep;
  message: string;
  recoverable: boolean;
}

export interface PersistedIndexingState {
  currentStep: IndexingStep | null;
  completedSteps: number;
  stepProgress: Record<IndexingStep, number>;
  overallProgress: number;
  completedStepRecord: Record<IndexingStep, boolean>;
  stepTimings: Record<IndexingStep, number>; // time taken per step
  startTime: number | null;
  timestamp: number; // when state was saved
  address: string | null;
  network: string;
  period: string;
}
