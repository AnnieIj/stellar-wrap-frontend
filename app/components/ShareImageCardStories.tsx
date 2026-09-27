"use client";

import Image from "next/image";
import { mockData } from "../data/mockData";

interface ShareImageCardStoriesVibe {
  percentage: number;
  label: string;
}

interface ShareImageCardStoriesData {
  username: string;
  transactions: number;
  persona: string;
  vibes?: ShareImageCardStoriesVibe[];
}

interface ShareCardLabels {
  stellarWrapped: string;
  totalTransactions: string;
  persona: string;
  topVibe: string;
  scanToView: string;
  scanToViewAlt: string;
  noVibeData: string;
}

interface ShareImageCardStoriesProps {
  themeColor: string;
  archetypeImage?: string;
  data?: ShareImageCardStoriesData;
  shareUrl?: string;
  locale?: string;
  labels?: ShareCardLabels;
}

export function ShareImageCardStories({ themeColor, archetypeImage, data, shareUrl, labels = { stellarWrapped: "STELLAR WRAPPED 2026", totalTransactions: "TOTAL TRANSACTIONS", persona: "YOUR PERSONA", topVibe: "TOP VIBE", scanToView: "SCAN TO VIEW", scanToViewAlt: "Scan to view", noVibeData: "No vibe data" } }: ShareImageCardStoriesProps) {
  const { persona, transactions, username, vibes = [] } = data ?? mockData;
  const topVibe = vibes[0];
  const topThreeVibes = vibes.slice(0, 3);
  const resolvedArchetypeImage =
    archetypeImage ??
    `/archetypes/${persona.toLowerCase().replace(/^the\s+/, "").replace(/\s+/g, "-")}.png`;

  const qrCodeUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(shareUrl)}`
    : null;

  const getRgbValues = (color: string): string => {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
    }
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    return "29, 185, 84";
  };

  const rgbValues = getRgbValues(themeColor);

  return (
    <div
      style={{
        width: "1080px",
        height: "1920px",
        position: "relative",
        padding: "24px",
        backgroundColor: "#020202",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          aspectRatio: "9/16",
          borderRadius: "40px",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: `linear-gradient(to bottom, rgba(${rgbValues}, 0.2), rgba(0, 0, 0, 0.8))`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "32px 24px 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: themeColor,
              }}
            />
            <span
              style={{
                fontSize: "14px",
                fontWeight: "900",
                color: "rgba(255, 255, 255, 0.7)",
                letterSpacing: "0.2em",
                lineHeight: "1",
              }}
            >
              {labels.stellarWrapped}
            </span>
          </div>
          <h2
            style={{
              fontSize: "40px",
              fontWeight: "900",
              color: "white",
              marginBottom: "8px",
              margin: 0,
            }}
          >
            @{username}
          </h2>
        </div>

        {/* Main Content */}
        <div
          style={{
            paddingLeft: "24px",
            paddingRight: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
          }}
        >
          {/* Transactions Card */}
          <div
            style={{
              backdropFilter: "blur(4px)",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              {labels.totalTransactions}
            </p>
            <p
              style={{
                fontSize: "48px",
                fontWeight: "900",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                background: `linear-gradient(135deg, ${themeColor}, rgba(255, 255, 255, 0.8))`,
                margin: "8px 0 0 0",
              }}
            >
              {transactions}
            </p>
          </div>

          {/* Persona Card */}
          <div
            style={{
              backdropFilter: "blur(4px)",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Image
              src={resolvedArchetypeImage}
              alt={persona}
              width={56}
              height={56}
              style={{ borderRadius: "12px", objectFit: "cover", flexShrink: 0 }}
            />
            <div>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "rgba(255, 255, 255, 0.6)",
                  margin: "0 0 4px 0",
                }}
              >
                {labels.persona}
              </p>
              <p
                style={{
                  fontSize: "20px",
                  fontWeight: "900",
                  color: "white",
                  margin: 0,
                }}
              >
                {persona}
              </p>
            </div>
          </div>

          {/* Top Vibe Card */}
          <div
            style={{
              backdropFilter: "blur(4px)",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "rgba(255, 255, 255, 0.6)",
                marginBottom: "8px",
              }}
            >
              {labels.topVibe}
            </p>
            <p
              style={{
                fontSize: "20px",
                fontWeight: "900",
                color: "white",
                margin: 0,
              }}
            >
              {topVibe.percentage}% {topVibe.label}
            </p>
          </div>

          {/* Top 3 Vibes List */}
          <div
            style={{
              backdropFilter: "blur(4px)",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "rgba(255, 255, 255, 0.6)",
                marginBottom: "12px",
              }}
            >
              YOUR VIBES
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {topThreeVibes.map((vibe, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "white/80" }}>{vibe.label}</span>
                  <div
                    style={{
                      width: "120px",
                      height: "6px",
                      borderRadius: "3px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${vibe.percentage}%`,
                        backgroundColor: themeColor,
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(255, 255, 255, 0.6)",
                      minWidth: "32px",
                      textAlign: "right",
                    }}
                  >
                    {vibe.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: "900",
              color: "rgba(255, 255, 255, 0.5)",
              textAlign: "center",
            }}
          >
            stellar.org/wrapped
          </div>

          {qrCodeUrl && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <img
                src={qrCodeUrl}
                alt={labels.scanToViewAlt}
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "8px",
                  backgroundColor: "white",
                  padding: "8px",
                }}
              />
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: "700",
                  color: "rgba(255, 255, 255, 0.6)",
                  letterSpacing: "0.05em",
                }}
              >
                {labels.scanToView}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
