"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as faceapi from "@vladmandic/face-api";
import type { ImageProps } from "../utils/types";

type Props = {
  images: ImageProps[];
};

let modelsLoaded = false;

async function ensureModelsLoaded() {
  if (modelsLoaded) return;

  const MODEL_URL = "/models";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

async function computeEmbeddingFromUrl(
  url: string,
): Promise<Float32Array | null> {
  if (typeof window === "undefined") return null;

  await ensureModelsLoaded();

  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(
            img,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.4,
            }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        // Only require that a face was detected
        if (!detection) {
          resolve(null);
        } else {
          resolve(detection.descriptor);
        }
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(err);
  });
}

async function computeEmbeddingFromFile(
  file: File,
): Promise<Float32Array | null> {
  if (typeof window === "undefined") return null;

  await ensureModelsLoaded();

  try {
    const img = await faceapi.bufferToImage(file);

    const detection = await faceapi
      .detectSingleFace(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.4,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return null;
    }

    // console.log("upload detection score:", detection.detection.score);
    return detection.descriptor;
  } catch (err) {
    console.error("computeEmbeddingFromFile error:", err);
    return null;
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return 0;
  return dot / denom;
}

const FindYourselfClient: React.FC<Props> = ({ images }) => {
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matches, setMatches] = useState<ImageProps[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setMatches([]);

    setUploadedFile(file); // keep File for face-api
    const url = URL.createObjectURL(file); // preview
    setUploadedSrc(url);
  }

  async function handleAnalyze() {
    if (!uploadedFile) {
      setError("Please upload a photo first.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setMatches([]);

      // 1. Embedding for uploaded face (use File-based version)
      const userEmbedding = await computeEmbeddingFromFile(uploadedFile);
      if (!userEmbedding) {
        setError(
          "Could not detect a face in the uploaded photo. Try a clearer, front-facing image.",
        );
        return;
      }

      // 2. Compute embeddings for gallery images (first N for performance)
      const limit = Math.min(images.length, 120);
      const scored: { img: ImageProps; score: number }[] = [];

      for (let i = 0; i < limit; i++) {
        const img = images[i];
        const imgUrl = `https://res.cloudinary.com/${
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
        }/image/upload/c_scale,w_720/${img.public_id}.${img.format}`;

        const emb = await computeEmbeddingFromUrl(imgUrl);
        if (!emb) continue;

        const score = cosineSimilarity(userEmbedding, emb);
        scored.push({ img, score });
      }

      // 2.5 Guard: if nothing could be analyzed
      if (scored.length === 0) {
        setError(
          "No faces from the gallery could be analyzed. Try again or refresh the page.",
        );
        setMatches([]);
        return;
      }

// 3. Sort by similarity, highest first
        scored.sort((a, b) => b.score - a.score);

// 4. Look at the best match and the margin to the second best
        const best = scored[0];
        const second = scored[1];
        const s = best.score;
        const margin = second ? s - second.score : 1;

// Heuristic:
// - Require a VERY high similarity (>= 0.9).
// - Require that it's clearly better than the second best (margin >= 0.03).
//   If not, we call it "no clear match" instead of guessing.
  let finalMatches: ImageProps[] = [];
  if (s >= 0.9 && margin >= 0.03) {
    // confident: show the best match (or top 2)
    finalMatches = [best.img];
    setError(null);
  } else {
    setError("No clear match found in the gallery for this photo.");
    finalMatches = [];
  }
  setMatches(finalMatches);
    } catch (err) {
      console.error("Face analysis error:", err);
      setError(
        err instanceof Error
          ? `Error: ${err.message}`
          : "Something went wrong while analyzing the photo.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1960px] p-4 text-white">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-xl">
          Find Yourself in the Gallery
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/40 px-3 py-1 text-sm hover:bg-white hover:text-black"
        >
          ← Back to gallery
        </Link>
      </header>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        {/* Left: upload + controls */}
        <div className="rounded-lg bg-white/5 p-4 shadow-highlight">
          <p className="mb-2 text-sm text-white/70">
            Upload a photo (ideally a clear face). We&apos;ll try to
            find visually similar faces in the Next.js Conf gallery.
            For the assignment demo, you can upload one of the existing
            gallery images to show a perfect match.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mb-3 block w-full text-sm text-white"
          />
          {uploadedSrc && (
            <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
              <Image
                src={uploadedSrc}
                alt="Uploaded face"
                width={400}
                height={400}
                className="h-auto w-full object-contain"
              />
            </div>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !uploadedFile}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-white/40"
          >
            {isAnalyzing ? "Analyzing…" : "Find my photos"}
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Right: matches */}
        <div className="rounded-lg bg-white/5 p-4 shadow-highlight">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/80">
            Matches
          </h2>
          {isAnalyzing && (
            <p className="text-sm text-white/70">
              Analyzing faces in the gallery. This can take a little
              time on the first run while models load.
            </p>
          )}
          {!isAnalyzing && matches.length === 0 && !error && (
            <p className="text-sm text-white/60">
              No matches yet. Upload a photo and click &quot;Find my
              photos&quot;.
            </p>
          )}
          <div className="mt-3 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {matches.map(
              ({ id, public_id, format, blurDataUrl }) => (
                <div key={id} className="mb-4 break-inside-avoid">
                  <Image
                    alt="Matched Next.js Conf photo"
                    className="rounded-lg brightness-90"
                    placeholder="blur"
                    blurDataURL={blurDataUrl}
                    src={`https://res.cloudinary.com/${
                      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
                    }/image/upload/c_scale,w_720/${public_id}.${format}`}
                    width={720}
                    height={480}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default FindYourselfClient;
