/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
    outputFileTracingIncludes: {
      "/api/upload": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
        "./node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
      ]
    }
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
