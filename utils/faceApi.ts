// // utils/faceApi.ts
// import * as faceapi from "@vladmandic/face-api";

// let modelsLoaded = false;

// export async function ensureModelsLoaded() {
//   if (modelsLoaded) return;

//   const MODEL_URL = "/models";

//   await Promise.all([
//     faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
//     faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
//     faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
//   ]);

//   modelsLoaded = true;
// }

// export async function computeEmbeddingFromUrl(
//   url: string,
// ): Promise<Float32Array | null> {
//   // Make sure we are in the browser
//   if (typeof window === "undefined") {
//     return null;
//   }

//   await ensureModelsLoaded();

//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.crossOrigin = "anonymous";
//     img.src = url;

//     img.onload = async () => {
//       try {
//         const detection = await faceapi
//           .detectSingleFace(
//             img,
//             new faceapi.TinyFaceDetectorOptions({
//               inputSize: 160,
//               scoreThreshold: 0.5,
//             }),
//           )
//           .withFaceLandmarks()
//           .withFaceDescriptor();

//         if (!detection) {
//           resolve(null);
//         } else {
//           resolve(detection.descriptor);
//         }
//       } catch (err) {
//         reject(err);
//       }
//     };

//     img.onerror = (err) => reject(err);
//   });
// }

// export function cosineSimilarity(
//   a: Float32Array,
//   b: Float32Array,
// ): number {
//   if (a.length !== b.length) return 0;

//   let dot = 0;
//   let normA = 0;
//   let normB = 0;

//   for (let i = 0; i < a.length; i++) {
//     dot += a[i] * b[i];
//     normA += a[i] * a[i];
//     normB += b[i] * b[i];
//   }

//   const denom = Math.sqrt(normA) * Math.sqrt(normB);
//   if (!denom) return 0;

//   return dot / denom;
// }
