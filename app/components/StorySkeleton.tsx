import React from 'react';

export const StorySkeleton = React.memo(() => {
  return (
    <div
      className="w-full h-full min-h-[200px] bg-gray-100 dark:bg-gray-900 animate-pulse flex items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading...</span>
      <div
        className="w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin"
        aria-hidden="true"
      />
    </div>
  );
});

StorySkeleton.displayName = 'StorySkeleton';

export default StorySkeleton;
