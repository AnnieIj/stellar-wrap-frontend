"use client"

import { useEffect, useState } from "react"

const ProgressLoader = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 1
      })
    }, 20)

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <style>{`
        @keyframes shimmer-sweep {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .shimmer-effect::after {
            animation: none !important;
          }
        }

        .progress-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.4),
            transparent
          );
          animation: shimmer-sweep 1.5s infinite;
        }
      `}</style>
      <div className="w-[20%] mx-auto h-1 bg-black/10 rounded-full overflow-hidden mt-4">
        <div
          className="h-full bg-[#b408b4]/50 transition-all duration-200 ease-out relative progress-shimmer"
          style={{ width: `${progress}%` }}
        />
      </div>
    </>
  )
}

export default ProgressLoader
