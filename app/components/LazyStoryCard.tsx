import { useState, useEffect, useRef, ReactNode } from 'react';

interface LazyStoryCardProps {
  children: ReactNode;
}

export const LazyStoryCard = ({ children }: LazyStoryCardProps) => {
  const [hasViewed, setHasViewed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasViewed(true);
          // Once viewed, we can stop observing to save resources
          if (cardRef.current) observer.unobserve(cardRef.current);
        }
      },
      {
        // Triggers when the card is 80% close to the viewport
        rootMargin: '80% 80% 80% 80%', 
        threshold: 0.01,
      }
    );

    if (cardRef.current) observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={cardRef} className="w-full h-full shrink-0">
      {hasViewed ? children : null}
    </div>
  );
};
