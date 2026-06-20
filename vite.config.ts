import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import basicSsl from "@vitejs/plugin-basic-ssl";
// import obfuscator from 'vite-plugin-javascript-obfuscator';

const enableHttps = process.env.VITE_DEV_HTTPS === "true";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine HTTPS configuration  
  let httpsConfig: { key: Buffer; cert: Buffer } | undefined = undefined;
  let useBasicSslPlugin = false;
  
  if (enableHttps) {
    // prefer mkcert-generated certs when available in project root
    const cert = [
      "localhost+2.pem",
      "localhost.pem",
      "dev-localhost-8080+2.pem",
      "dev-localhost-8080.pem",
    ].find((f) => fs.existsSync(f));
    const key = cert ? (cert.includes("-key") ? cert : cert.replace(/\.pem$/, "-key.pem")) : undefined;
    
    if (cert && key && fs.existsSync(cert) && fs.existsSync(key)) {
      httpsConfig = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
      };
    } else {
      // Fall back to basicSsl plugin
      useBasicSslPlugin = true;
    }
  }

  return {
    // Use '/' for Vercel web builds so deep routes (e.g. /team) load assets
    // correctly. Keep './' only for local Electron builds.
    base: (mode === 'production' && !process.env.VERCEL) ? './' : '/',
    server: {
      host: "::",
      port: 5173,
      https: httpsConfig,
    },
    plugins: [
      react(),
      (enableHttps && useBasicSslPlugin) && basicSsl(),
      mode === "development" && componentTagger(),
      /* mode === 'production' && obfuscator({
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 10,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayCallsTransformThreshold: 0.75,
          stringArrayEncoding: ['base64'],
          stringArrayIndexesType: ['hexadecimal-number'],
          stringArrayReturnType: 'array',
          stringArrayThreshold: 0.75,
          transformObjectKeys: true,
          unicodeEscapeSequence: false
        },
      }) */
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
 
